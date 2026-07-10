"""GET /api/stats/service — a read-only stats digest for Sukumo, our
household's sibling app (docs/API.md).

Sukumo's dashboard wants to show "how's Michi going" alongside the other
household apps without a human sitting there logged in. Michi's normal auth
is a per-user JWT minted via the Mishka Hub login proxy (app/auth.py) — that
model doesn't fit a machine-to-machine call, and Sukumo should never hold a
household password (docs/AUTH.md's hard rule, mirrored here). So this
endpoint uses a completely separate, static bearer token
(``MICHI_SERVICE_TOKEN``) instead of the JWT flow, checked with
``hmac.compare_digest`` to avoid a timing side-channel.

Michi also has no built-in "primary user" concept (there are just two
household logins, symmetric) — ``MICHI_SERVICE_USER_EMAIL`` says which one
this endpoint reports on. Either setting missing/unmatched answers a
friendly 503, the same "unconfigured feature" convention routers/converse.py
uses for MICHI_ANTHROPIC_API_KEY.

Every number below is a read of state that already exists elsewhere in the
API (stats.py, curriculum.py) — this module adds no new derivations, just a
machine-auth-friendly wrapper around them.
"""
from __future__ import annotations

import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_session
from ..errors import MichiHTTPException
from ..models import DailyActivity, ItemProgress, User
from .curriculum import _words_known
from .stats import _streak

router = APIRouter(tags=["service"])


def _require_service_token(request: Request) -> None:
    settings: Settings = request.app.state.settings

    if not settings.service_token:
        raise MichiHTTPException(
            status_code=503,
            detail="The service endpoint isn't set up yet",
            code="service_not_configured",
        )

    header = request.headers.get("Authorization")
    if not header or not header.startswith("Bearer "):
        raise MichiHTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header",
            code="unauthorized",
        )

    token = header.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token, settings.service_token):
        raise MichiHTTPException(
            status_code=401,
            detail="Invalid service token",
            code="unauthorized",
        )


@router.get("/stats/service", dependencies=[Depends(_require_service_token)])
def stats_service(db: Session = Depends(get_session)) -> dict[str, Any]:
    settings = get_settings()

    if not settings.service_user_email:
        raise MichiHTTPException(
            status_code=503,
            detail="The service endpoint isn't set up yet",
            code="service_not_configured",
        )

    user = db.execute(
        select(User).where(
            func.lower(User.email) == settings.service_user_email.lower()
        )
    ).scalar_one_or_none()
    if not user:
        raise MichiHTTPException(
            status_code=503,
            detail="The service endpoint isn't set up yet",
            code="service_not_configured",
        )

    today = datetime.now(timezone.utc).date()

    today_activity = db.get(DailyActivity, (user.id, today.isoformat()))
    studied_today = bool(today_activity and today_activity.xp > 0)

    # Same "due today or overdue" formula as stats.py's forecast[0].
    due_reviews = db.execute(
        select(func.count())
        .select_from(ItemProgress)
        .where(
            ItemProgress.user_id == user.id,
            ItemProgress.due_at.is_not(None),
            ItemProgress.due_at < (today + timedelta(days=1)).isoformat(),
        )
    ).scalar_one()

    last_session_at = db.scalar(
        select(func.max(ItemProgress.last_seen_at)).where(ItemProgress.user_id == user.id)
    )

    return {
        "streak_days": _streak(db, user.id, today)["current"],
        "studied_today": studied_today,
        "due_reviews": due_reviews,
        "words_known": _words_known(db, user.id),
        "last_session_at": last_session_at,
    }
