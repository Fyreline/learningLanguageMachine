"""app/srs.py — SM-2-lite transitions (docs/CURRICULUM.md §6), verified against
a forged clock so due dates are exact and reproducible."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.srs import (
    CLOSE,
    EASE_FLOOR,
    EASY,
    INTERVAL_CAP_DAYS,
    MISS,
    PASS,
    SrsState,
    fast_skip,
    review,
)

NOW = datetime(2026, 7, 7, 9, 0, 0, tzinfo=timezone.utc)


def test_new_item_easy_first_exposure():
    s = review(SrsState(), EASY, NOW)
    assert s.reps == 1
    assert s.interval_days == 1.0
    assert s.strength == 1  # +1 for easy on first exposure; interval < 4 adds nothing
    assert round(s.ease, 2) == 2.55
    assert s.due_at == NOW + timedelta(days=1)


def test_new_item_pass_first_exposure():
    s = review(SrsState(), PASS, NOW)
    assert s.reps == 1
    assert s.interval_days == 1.0
    assert s.strength == 0  # a plain pass on a brand-new item doesn't level it yet
    assert s.ease == 2.5


def test_pass_ramp_grows_interval_and_strength():
    s = review(SrsState(), PASS, NOW)          # interval 1, reps 1, strength 0
    s = review(s, PASS, NOW)                    # interval round(1*2.5)=2, strength 0 (<4)
    assert s.interval_days == 2.0
    assert s.strength == 0
    s = review(s, PASS, NOW)                    # interval round(2*2.5)=5 >=4 -> strength +1
    assert s.interval_days == 5.0
    assert s.strength == 1


def test_close_holds_interval_and_softens_ease():
    seeded = review(SrsState(), PASS, NOW)      # interval 1, reps 1
    s = review(seeded, CLOSE, NOW)
    assert s.interval_days == seeded.interval_days  # unchanged
    assert s.reps == seeded.reps                     # unchanged
    assert s.strength == seeded.strength             # unchanged
    assert round(s.ease, 2) == round(seeded.ease - 0.05, 2)


def test_miss_lapses_shrinks_interval_and_ease():
    # Build up an interval first.
    s = review(SrsState(), PASS, NOW)
    s = review(s, PASS, NOW)
    s = review(s, PASS, NOW)   # interval 5, strength 1, ease 2.5
    before_ease = s.ease
    m = review(s, MISS, NOW)
    assert m.lapses == 1
    assert round(m.ease, 2) == round(before_ease - 0.2, 2)
    assert m.interval_days == max(1.0, 5.0 * 0.25)  # 1.25
    assert m.strength == 0 or m.strength == max(1, s.strength - 1)
    assert m.strength == max(1, s.strength - 1)
    assert m.due_at == NOW + timedelta(days=m.interval_days)


def test_miss_interval_floored_at_one():
    s = review(SrsState(), PASS, NOW)  # interval 1
    m = review(s, MISS, NOW)
    assert m.interval_days == 1.0  # max(1, 1*0.25)


def test_ease_never_drops_below_floor():
    s = SrsState(ease=1.35)
    s = review(s, MISS, NOW)  # 1.35 - 0.2 -> floored
    assert s.ease == EASE_FLOOR
    s = review(SrsState(ease=1.32), CLOSE, NOW)
    assert s.ease == EASE_FLOOR


def test_interval_capped_at_sixty_days():
    s = SrsState(ease=2.5, interval_days=40.0, reps=5)
    s = review(s, EASY, NOW)  # 40 * 2.55 = 102 -> capped
    assert s.interval_days == INTERVAL_CAP_DAYS
    assert s.due_at == NOW + timedelta(days=INTERVAL_CAP_DAYS)


def test_strength_ceiling_is_four():
    s = SrsState(strength=4, ease=2.5, interval_days=30.0, reps=6)
    s = review(s, EASY, NOW)
    assert s.strength == 4


def test_fast_skip_marks_known_and_schedules_tomorrow():
    s = fast_skip(SrsState(), NOW)
    assert s.strength == 3
    assert s.interval_days == 1.0
    assert s.reps >= 1
    assert s.due_at == NOW + timedelta(days=1)
