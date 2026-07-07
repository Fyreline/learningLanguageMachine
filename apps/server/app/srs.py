"""SM-2-lite spaced repetition — the single memory model (docs/CURRICULUM.md §6).

Pure functions only: no database, no clock of their own — the caller passes
``now`` so the transitions can be unit-tested against a forged clock. One
``review`` call is applied per graded step, whether that step came from a
lesson or a review session (there is one memory model, not two).

The transitions below are a line-for-line implementation of CURRICULUM §6 —
change the doc first if the maths must change.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

# Grades (docs/CURRICULUM.md §6): easy = a pass on first exposure or a fast-skip.
MISS = 0
CLOSE = 1
PASS = 2
EASY = 3

EASE_DEFAULT = 2.5
EASE_FLOOR = 1.3
INTERVAL_CAP_DAYS = 60  # a travel app — nothing should sleep past the trip


@dataclass(frozen=True)
class SrsState:
    """The per-(user, item) memory state (docs/DATA_MODEL.md item_progress)."""

    strength: int = 0
    ease: float = EASE_DEFAULT
    interval_days: float = 0.0
    reps: int = 0
    lapses: int = 0
    due_at: datetime | None = None


def review(state: SrsState, grade: int, now: datetime) -> SrsState:
    """Apply one graded exposure, returning the new state.

    Implements docs/CURRICULUM.md §6 exactly. ``now`` is injected so callers
    (and tests) control the clock; ``due_at = now + interval_days``.
    """
    ease = state.ease
    interval = state.interval_days
    reps = state.reps
    lapses = state.lapses
    strength = state.strength

    if grade == MISS:
        lapses += 1
        ease = max(EASE_FLOOR, ease - 0.2)
        interval = max(1.0, interval * 0.25)
        strength = max(1, strength - 1)
    elif grade == CLOSE:
        ease = max(EASE_FLOOR, ease - 0.05)
        # interval unchanged; strength unchanged.
    else:  # PASS or EASY
        if grade == EASY:
            ease += 0.05
        interval = 1.0 if reps == 0 else float(round(interval * ease))
        reps += 1
        strength = min(
            4,
            strength
            + (1 if interval >= 4 else 0)
            + (1 if grade == EASY and reps <= 1 else 0),
        )

    interval = min(interval, float(INTERVAL_CAP_DAYS))
    due_at = now + timedelta(days=interval)
    return SrsState(
        strength=strength,
        ease=ease,
        interval_days=interval,
        reps=reps,
        lapses=lapses,
        due_at=due_at,
    )


def fast_skip(state: SrsState, now: datetime) -> SrsState:
    """The "I know this" escape hatch (docs/CURRICULUM.md §5.1): mark the item
    strength 3 immediately and schedule a next-day review, so a lie to oneself
    surfaces cheaply tomorrow. Applied on top of an ``easy`` grade."""
    graded = review(state, EASY, now)
    return SrsState(
        strength=max(3, graded.strength),
        ease=graded.ease,
        interval_days=1.0,
        reps=max(1, graded.reps),
        lapses=graded.lapses,
        due_at=now + timedelta(days=1),
    )
