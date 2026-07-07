"""routers/reviews.py — due listing off forged due_at clocks, review-complete
SRS writes + idempotency, and the shared memory model with lessons
(docs/API.md §Reviews, docs/CURRICULUM.md §6)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import DailyActivity, ItemProgress, LessonCompletion
from app.scoring import fmt_ts


def _forge_progress(user_id: int, item_id: str, *, due_delta_days: int, strength: int = 1):
    """Insert an item_progress row with a forged due_at (negative = past)."""
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        db.add(
            ItemProgress(
                user_id=user_id,
                item_id=item_id,
                strength=strength,
                ease=2.5,
                interval_days=1,
                due_at=fmt_ts(now + timedelta(days=due_delta_days)),
                reps=1,
                lapses=0,
                last_grade=2,
                last_seen_at=fmt_ts(now - timedelta(days=1)),
            )
        )
        db.commit()


def test_due_empty_for_fresh_account(authed):
    client, _uid, headers = authed
    body = client.get("/api/reviews/due", headers=headers).json()
    assert body["due"] == []
    assert body["counts"]["today"] == 0
    assert len(body["counts"]["week"]) == 7


def test_due_returns_past_due_items_weakest_first(authed):
    client, uid, headers = authed
    _forge_progress(uid, "u01.konnichiwa", due_delta_days=-1, strength=2)
    _forge_progress(uid, "u01.ohayo", due_delta_days=-2, strength=1)
    _forge_progress(uid, "u01.konbanwa", due_delta_days=3, strength=1)  # future

    body = client.get("/api/reviews/due", headers=headers).json()
    ids = [d["item_id"] for d in body["due"]]
    assert ids == ["u01.ohayo", "u01.konnichiwa"]  # weakest first, future item absent
    assert body["due"][0]["overdue_days"] >= 1
    assert body["counts"]["today"] == 2


def test_review_complete_updates_srs_and_daily_activity(authed):
    client, uid, headers = authed
    _forge_progress(uid, "u01.konnichiwa", due_delta_days=-1, strength=1)

    res = client.post(
        "/api/reviews/complete",
        headers=headers,
        json={
            "submission_id": str(uuid.uuid4()),
            "duration_seconds": 180,
            "local_date": "2026-07-07",
            "results": [{"item_id": "u01.konnichiwa", "grade": 2, "mode": "listen-pick"}],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["xp_awarded"] == 1  # 1 per correct
    assert "next_due_counts" in body

    with SessionLocal() as db:
        row = db.get(ItemProgress, (uid, "u01.konnichiwa"))
        assert row.reps == 2  # the same memory model a lesson writes
        assert row.last_grade == 2
        day = db.get(DailyActivity, (uid, "2026-07-07"))
        assert day.reviews == 1
        assert day.xp == 1


def test_review_complete_idempotent(authed):
    client, uid, headers = authed
    _forge_progress(uid, "u01.konnichiwa", due_delta_days=-1, strength=1)
    payload = {
        "submission_id": str(uuid.uuid4()),
        "duration_seconds": 60,
        "local_date": "2026-07-07",
        "results": [{"item_id": "u01.konnichiwa", "grade": 2, "mode": "listen-pick"}],
    }
    first = client.post("/api/reviews/complete", headers=headers, json=payload).json()
    second = client.post("/api/reviews/complete", headers=headers, json=payload).json()
    assert first["xp_awarded"] == second["xp_awarded"]
    with SessionLocal() as db:
        assert db.get(DailyActivity, (uid, "2026-07-07")).xp == 1  # not 2
        row = db.get(ItemProgress, (uid, "u01.konnichiwa"))
        assert row.reps == 2  # graded once, not twice


def test_review_session_row_never_pollutes_path(authed):
    client, uid, headers = authed
    _forge_progress(uid, "u01.konnichiwa", due_delta_days=-1)
    client.post(
        "/api/reviews/complete",
        headers=headers,
        json={
            "submission_id": str(uuid.uuid4()),
            "duration_seconds": 60,
            "local_date": "2026-07-07",
            "results": [{"item_id": "u01.konnichiwa", "grade": 2, "mode": "listen-pick"}],
        },
    )
    manifest = client.get("/api/curriculum/manifest", headers=headers).json()
    first_lesson = manifest["units"][0]["lessons"][0]
    assert first_lesson["state"] == "current"  # 'review' pseudo-lesson didn't complete anything


def test_yesterdays_lesson_items_come_due_next_day(authed):
    """The acceptance box: complete a lesson, forge the clock a day forward
    (by backdating due_at), and the items appear in /reviews/due."""
    client, uid, headers = authed
    client.post(
        "/api/lessons/u01.l1/complete",
        headers=headers,
        json={
            "submission_id": str(uuid.uuid4()),
            "score": 90,
            "duration_seconds": 300,
            "local_date": "2026-07-06",
            "results": [{"item_id": "u01.konnichiwa", "grade": 2, "mode": "listen-pick"}],
        },
    )
    # New pass -> interval 1 day -> due tomorrow. Forge: pull due_at back 25h.
    with SessionLocal() as db:
        row = db.get(ItemProgress, (uid, "u01.konnichiwa"))
        due = datetime.strptime(row.due_at, "%Y-%m-%d %H:%M:%S") - timedelta(hours=25)
        row.due_at = fmt_ts(due.replace(tzinfo=timezone.utc))
        db.commit()

    body = client.get("/api/reviews/due", headers=headers).json()
    assert any(d["item_id"] == "u01.konnichiwa" for d in body["due"])
