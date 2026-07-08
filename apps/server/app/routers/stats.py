"""GET /api/stats/me and /api/stats/household (docs/API.md).

Everything here is derived per docs/DATA_MODEL.md "Derivations" — nothing new
is stored. Until the lesson engine (phase 3) writes activity rows these
endpoints truthfully return zeros, which the Stats page renders as the
blank-journal empty state.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import content
from ..auth import current_user
from ..db import get_session
from ..models import DailyActivity, ItemProgress, User
from .curriculum import _trip_ready, _words_known, current_lesson_id

router = APIRouter(prefix="/stats", tags=["stats"])


def _streak(db: Session, user_id: int, today: date) -> dict[str, Any]:
    """Consecutive active days ending today-or-yesterday, with one free rest
    day per rolling 7 (docs/CURRICULUM.md §8)."""
    rows = db.execute(
        select(DailyActivity.date)
        .where(DailyActivity.user_id == user_id, DailyActivity.xp > 0)
        .order_by(DailyActivity.date.desc())
        .limit(400)
    ).all()
    active = {date.fromisoformat(r[0]) for r in rows}
    if not active:
        return {"current": 0, "rest_day_used": False}

    streak = 0
    rest_days: list[date] = []
    day = today
    # Today not yet practiced doesn't break anything — start counting from
    # yesterday in that case.
    if day not in active:
        day -= timedelta(days=1)
    while True:
        if day in active:
            streak += 1
        else:
            # a rest day only BRIDGES two active stretches — it is never
            # spent on the trailing gap before the streak began (which made
            # a day-one streak report "resting") — and only when no other
            # rest day sits within 6 days
            prev = day - timedelta(days=1)
            if prev not in active or any((rest - day).days < 7 for rest in rest_days) or streak == 0:
                break
            rest_days.append(day)
        day -= timedelta(days=1)
    rest_day_used = any((today - rest).days < 7 for rest in rest_days)
    return {"current": streak, "rest_day_used": rest_day_used}


@router.get("/me")
def stats_me(
    user_id: int = Depends(current_user), db: Session = Depends(get_session)
) -> dict[str, Any]:
    user = db.get(User, user_id)
    today = datetime.now(timezone.utc).date()
    week = [today - timedelta(days=i) for i in range(6, -1, -1)]

    activity = {
        r.date: r
        for r in db.execute(
            select(DailyActivity).where(
                DailyActivity.user_id == user_id,
                DailyActivity.date >= week[0].isoformat(),
            )
        ).scalars()
    }
    minutes_total = (
        db.execute(
            select(func.coalesce(func.sum(DailyActivity.minutes), 0)).where(
                DailyActivity.user_id == user_id
            )
        ).scalar_one()
    )

    bands = {str(band): 0 for band in range(5)}
    for band, n in db.execute(
        select(ItemProgress.strength, func.count())
        .where(ItemProgress.user_id == user_id)
        .group_by(ItemProgress.strength)
    ).all():
        bands[str(band)] = n

    forecast = []
    for i in range(7):
        day = today + timedelta(days=i)
        due = db.execute(
            select(func.count())
            .select_from(ItemProgress)
            .where(
                ItemProgress.user_id == user_id,
                ItemProgress.due_at.is_not(None),
                # overdue items pile onto today rather than vanishing
                (
                    ItemProgress.due_at < (day + timedelta(days=1)).isoformat()
                    if i == 0
                    else func.substr(ItemProgress.due_at, 1, 10) == day.isoformat()
                ),
            )
        ).scalar_one()
        forecast.append({"date": day.isoformat(), "due": due})

    # recent accuracy: share of last-grades that were pass/easy
    graded = db.execute(
        select(ItemProgress.last_grade)
        .where(ItemProgress.user_id == user_id, ItemProgress.last_grade.is_not(None))
        .order_by(ItemProgress.last_seen_at.desc())
        .limit(100)
    ).all()
    accuracy = (
        round(100 * sum(1 for (g,) in graded if g >= 2) / len(graded))
        if graded
        else None
    )

    settings = json.loads(user.settings_json or "{}")
    return {
        "streak": _streak(db, user_id, today),
        "words_known": _words_known(db, user_id),
        "minutes_total": round(minutes_total, 1),
        "xp_week": [
            {
                "date": d.isoformat(),
                "xp": activity[d.isoformat()].xp if d.isoformat() in activity else 0,
            }
            for d in week
        ],
        "daily_goal_xp": settings.get("daily_goal_xp", 30),
        "accuracy_recent": accuracy,
        "strength_bands": bands,
        "forecast": forecast,
        "trip_ready_pct": _trip_ready(db, user_id),
    }


@router.get("/household")
def stats_household(
    _user_id: int = Depends(current_user), db: Session = Depends(get_session)
) -> dict[str, Any]:
    today = datetime.now(timezone.utc).date()
    users = db.execute(select(User).order_by(User.id)).scalars().all()
    manifest = content.manifest()
    unit_titles = {
        lesson["id"]: u["title"]
        for u in manifest["units"]
        for lesson in u["lessons"]
    }

    partners = []
    for u in users:
        current = current_lesson_id(db, u.id)
        u_settings = json.loads(u.settings_json or "{}")
        partners.append(
            {
                "display_name": u.display_name,
                # each user's own chosen kitsune palette (default clay if unset
                # or a legacy row) — the buddies swatch matches their walker
                "tone": u_settings.get("kitsune_tone", "clay"),
                "streak": _streak(db, u.id, today)["current"],
                "words_known": _words_known(db, u.id),
                "current_lesson_id": current,
                "current_unit_title": unit_titles.get(current or "", None),
            }
        )

    # "Together you know n phrases" — union of items either partner knows.
    together = db.execute(
        select(func.count(func.distinct(ItemProgress.item_id))).where(
            ItemProgress.strength >= 3
        )
    ).scalar_one()

    return {"partners": partners, "together_phrases": together}
