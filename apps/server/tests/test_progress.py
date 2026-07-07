"""routers/progress.py + routers/curriculum.py lesson content — the
lesson-complete transaction, its idempotency, placement, and lock enforcement
(docs/API.md, docs/DATA_MODEL.md)."""
from __future__ import annotations

import uuid

from app.db import SessionLocal
from app.models import DailyActivity, ItemProgress, LessonCompletion


def _complete_payload(**overrides):
    body = {
        "submission_id": str(uuid.uuid4()),
        "score": 90,
        "duration_seconds": 300,
        "local_date": "2026-07-07",
        "results": [
            {"item_id": "u01.konnichiwa", "grade": 3, "mode": "listen-pick"},
            {"item_id": "u01.ohayo", "grade": 2, "mode": "listen-pick-jp"},
            {"item_id": "u01.konbanwa", "grade": 0, "mode": "speak"},
        ],
    }
    body.update(overrides)
    return body


# --------------------------- lesson content -----------------------------
def test_get_lesson_returns_content_slice(authed):
    client, _uid, headers = authed
    res = client.get("/api/curriculum/lessons/u01.l1", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["lesson"]["id"] == "u01.l1"
    assert body["lesson"]["kind"] == "teach"
    ids = {it["id"] for it in body["items"]}
    assert "u01.konnichiwa" in ids
    # every new item carries a strength (0 for an untouched account)
    assert all("strength" in it for it in body["items"])


def test_get_unknown_lesson_404(authed):
    client, _uid, headers = authed
    res = client.get("/api/curriculum/lessons/u01.nope", headers=headers)
    assert res.status_code == 404
    assert res.json()["code"] == "unknown_lesson"


def test_locked_lesson_403(authed):
    client, _uid, headers = authed
    # u01.l3 is locked until u01.l2 is done (nothing completed yet).
    res = client.get("/api/curriculum/lessons/u01.l3", headers=headers)
    assert res.status_code == 403
    assert res.json()["code"] == "lesson_locked"


def test_checkpoint_lesson_includes_dialogues(authed):
    client, uid, headers = authed
    # unlock the whole unit by completing l1..l5
    for n in range(1, 6):
        client.post(
            f"/api/curriculum/lessons/u01.l{n}",  # touch is not required, just complete
            headers=headers,
        )
        client.post(
            f"/api/lessons/u01.l{n}/complete",
            headers=headers,
            json=_complete_payload(submission_id=str(uuid.uuid4()), score=85, results=[]),
        )
    res = client.get("/api/curriculum/lessons/u01.check", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["steps"], "checkpoint carries hand-authored steps"
    assert any(d["id"] == "u01.d1" for d in body["dialogues"])


# --------------------------- lesson complete ----------------------------
def test_complete_lesson_writes_rows_and_awards_xp(authed):
    client, uid, headers = authed
    payload = _complete_payload()
    res = client.post("/api/lessons/u01.l1/complete", headers=headers, json=payload)
    assert res.status_code == 200
    body = res.json()
    # base 10 + 2 correct (grades 3 and 2); miss earns nothing
    assert body["xp_awarded"] == 12
    assert body["stars"] == 2  # score 90 -> 2 stars
    assert body["path"]["next_lesson_id"] == "u01.l2"

    with SessionLocal() as db:
        comps = db.query(LessonCompletion).filter_by(user_id=uid).all()
        assert len(comps) == 1
        assert comps[0].xp == 12
        day = db.get(DailyActivity, (uid, "2026-07-07"))
        assert day.xp == 12
        assert day.lessons == 1
        assert round(day.minutes, 1) == 5.0
        # SRS rows exist for each graded item
        assert db.get(ItemProgress, (uid, "u01.konnichiwa")).strength >= 1


def test_complete_is_idempotent_on_submission_id(authed):
    client, uid, headers = authed
    payload = _complete_payload()
    first = client.post("/api/lessons/u01.l1/complete", headers=headers, json=payload).json()
    second = client.post("/api/lessons/u01.l1/complete", headers=headers, json=payload).json()
    assert first == second  # byte-identical, no double XP

    with SessionLocal() as db:
        assert db.query(LessonCompletion).filter_by(user_id=uid).count() == 1
        assert db.get(DailyActivity, (uid, "2026-07-07")).xp == 12  # not 24


def test_completing_a_unit_reports_unit_completed(authed):
    client, uid, headers = authed
    for n in range(1, 6):
        client.post(
            f"/api/lessons/u01.l{n}/complete",
            headers=headers,
            json=_complete_payload(submission_id=str(uuid.uuid4()), score=85, results=[]),
        )
    final = client.post(
        "/api/lessons/u01.check/complete",
        headers=headers,
        json=_complete_payload(submission_id=str(uuid.uuid4()), score=85, results=[]),
    ).json()
    assert final["path"]["unit_completed"] is True
    assert final["path"]["next_lesson_id"] == "u02.l1"


def test_replay_after_three_stars_grants_no_xp(authed):
    client, uid, headers = authed
    client.post(
        "/api/lessons/u01.l1/complete",
        headers=headers,
        json=_complete_payload(submission_id=str(uuid.uuid4()), score=100, results=[]),
    )
    replay = client.post(
        "/api/lessons/u01.l1/complete",
        headers=headers,
        json=_complete_payload(submission_id=str(uuid.uuid4()), score=100, results=[]),
    ).json()
    assert replay["xp_awarded"] == 0
    assert replay["stars"] == 3


def test_fast_skip_marks_strength_three_and_next_day_review(authed):
    client, uid, headers = authed
    client.post(
        "/api/lessons/u01.l1/complete",
        headers=headers,
        json=_complete_payload(
            submission_id=str(uuid.uuid4()),
            score=100,
            results=[{"item_id": "u01.konnichiwa", "grade": 3, "mode": "fast-skip"}],
        ),
    )
    with SessionLocal() as db:
        row = db.get(ItemProgress, (uid, "u01.konnichiwa"))
        assert row.strength == 3
        assert row.due_at is not None  # scheduled (tomorrow)


# --------------------------- placement ----------------------------------
def test_placement_pre_completes_known_lessons(authed):
    client, uid, headers = authed
    known = [
        "u01.konnichiwa", "u01.ohayo", "u01.konbanwa", "u01.oyasumi", "u01.sayonara",
    ]
    res = client.post(
        "/api/placement/complete",
        headers=headers,
        json={"submission_id": str(uuid.uuid4()), "known_item_ids": known, "local_date": "2026-07-07"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "u01.l1" in body["tested_out_lessons"]  # all 5 of its items known

    with SessionLocal() as db:
        comp = db.query(LessonCompletion).filter_by(user_id=uid, lesson_id="u01.l1").one()
        assert comp.stars == 0  # tested-out marker
        assert comp.source == "placement"
        assert db.get(ItemProgress, (uid, "u01.konnichiwa")).strength == 3


def test_placement_is_idempotent(authed):
    client, uid, headers = authed
    sub = str(uuid.uuid4())
    known = ["u01.konnichiwa", "u01.ohayo", "u01.konbanwa", "u01.oyasumi", "u01.sayonara"]
    payload = {"submission_id": sub, "known_item_ids": known, "local_date": "2026-07-07"}
    first = client.post("/api/placement/complete", headers=headers, json=payload).json()
    second = client.post("/api/placement/complete", headers=headers, json=payload).json()
    assert sorted(first["tested_out_lessons"]) == sorted(second["tested_out_lessons"])
    with SessionLocal() as db:
        assert db.query(LessonCompletion).filter_by(user_id=uid, lesson_id="u01.l1").count() == 1
