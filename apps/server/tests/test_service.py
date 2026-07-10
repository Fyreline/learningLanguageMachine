"""GET /api/stats/service — the static-token sibling read for Sukumo
(routers/service.py, docs/API.md).

Auth here is deliberately NOT the per-user JWT flow (app/auth.py) — it's a
single static bearer token (MICHI_SERVICE_TOKEN) plus a configured
MICHI_SERVICE_USER_EMAIL saying which household login to report on. Both
unconfigured paths answer a friendly 503 (the same convention
routers/converse.py uses for a missing MICHI_ANTHROPIC_API_KEY); a configured
token that doesn't match answers 401.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.config import get_settings
from app.db import SessionLocal
from app.models import DailyActivity, ItemProgress
from app.scoring import fmt_ts

from .conftest import make_user


@pytest.fixture
def service_creds():
    """Sets both MICHI_SERVICE_TOKEN and MICHI_SERVICE_USER_EMAIL on the
    live cached Settings object (same save/mutate/yield/restore shape as
    test_converse.py's fake_key), scoped to the household user this test
    inserts."""
    settings = get_settings()
    old_token = settings.service_token
    old_email = settings.service_user_email
    settings.service_token = "test-service-token"
    settings.service_user_email = "amy@example.com"
    yield
    settings.service_token = old_token
    settings.service_user_email = old_email


def _forge_daily_activity(user_id: int, date_str: str, xp: int):
    with SessionLocal() as db:
        db.add(DailyActivity(user_id=user_id, date=date_str, xp=xp, minutes=5, lessons=1, reviews=0))
        db.commit()


def _forge_progress(
    user_id: int,
    item_id: str,
    *,
    strength: int,
    due_delta_days: int | None,
    last_seen_delta_days: int = 1,
):
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        db.add(
            ItemProgress(
                user_id=user_id,
                item_id=item_id,
                strength=strength,
                ease=2.5,
                interval_days=1,
                due_at=fmt_ts(now + timedelta(days=due_delta_days)) if due_delta_days is not None else None,
                reps=1,
                lapses=0,
                last_grade=2,
                last_seen_at=fmt_ts(now - timedelta(days=last_seen_delta_days)),
            )
        )
        db.commit()


def test_no_token_configured_503s_even_without_auth_header(client):
    res = client.get("/api/stats/service")
    assert res.status_code == 503
    assert res.json()["code"] == "service_not_configured"


def test_token_configured_missing_header_401s(client):
    settings = get_settings()
    old = settings.service_token
    settings.service_token = "test-service-token"
    try:
        res = client.get("/api/stats/service")
        assert res.status_code == 401
    finally:
        settings.service_token = old


def test_token_configured_wrong_token_401s(client):
    settings = get_settings()
    old = settings.service_token
    settings.service_token = "test-service-token"
    try:
        res = client.get(
            "/api/stats/service", headers={"Authorization": "Bearer wrong-token"}
        )
        assert res.status_code == 401
    finally:
        settings.service_token = old


def test_token_ok_but_user_email_unset_503s(client):
    settings = get_settings()
    old = settings.service_token
    settings.service_token = "test-service-token"
    try:
        res = client.get(
            "/api/stats/service",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert res.status_code == 503
        assert res.json()["code"] == "service_not_configured"
    finally:
        settings.service_token = old


def test_token_ok_but_user_email_matches_nobody_503s(client, service_creds):
    # service_creds points at amy@example.com, but no such user exists yet.
    res = client.get(
        "/api/stats/service", headers={"Authorization": "Bearer test-service-token"}
    )
    assert res.status_code == 503
    assert res.json()["code"] == "service_not_configured"


def test_configured_and_matched_returns_exact_shape(client, service_creds):
    user_id = make_user("Amy@Example.com", "Amy", mishka_id=1)  # matched case-insensitively

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    # Three consecutive active days including today -> streak of 3.
    _forge_daily_activity(user_id, two_days_ago.isoformat(), xp=10)
    _forge_daily_activity(user_id, yesterday.isoformat(), xp=10)
    _forge_daily_activity(user_id, today.isoformat(), xp=10)

    # One overdue item -> due_reviews == 1.
    _forge_progress(user_id, "u01.konnichiwa", strength=1, due_delta_days=-1)
    # One future-due item -> excluded from due_reviews.
    _forge_progress(user_id, "u01.ohayo", strength=1, due_delta_days=3)
    # Two items with strength >= 3 -> words_known == 2 (per curriculum._words_known).
    _forge_progress(user_id, "u01.arigatou", strength=3, due_delta_days=None, last_seen_delta_days=0)
    _forge_progress(user_id, "u01.sumimasen", strength=4, due_delta_days=None, last_seen_delta_days=5)

    res = client.get(
        "/api/stats/service", headers={"Authorization": "Bearer test-service-token"}
    )
    assert res.status_code == 200
    body = res.json()

    assert set(body.keys()) == {
        "streak_days",
        "studied_today",
        "due_reviews",
        "words_known",
        "last_session_at",
    }
    assert body["streak_days"] == 3
    assert body["studied_today"] is True
    assert body["due_reviews"] == 1
    assert body["words_known"] == 2
    # last_session_at is the most recent last_seen_at across all rows, which
    # is the "arigatou" row forged with last_seen_delta_days=0 (i.e. ~now).
    assert body["last_session_at"] is not None


def test_studied_today_false_without_todays_activity(client, service_creds):
    user_id = make_user("Amy@Example.com", "Amy", mishka_id=1)
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    _forge_daily_activity(user_id, yesterday, xp=10)

    res = client.get(
        "/api/stats/service", headers={"Authorization": "Bearer test-service-token"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["studied_today"] is False
    assert body["due_reviews"] == 0
    assert body["words_known"] == 0
    assert body["last_session_at"] is None
