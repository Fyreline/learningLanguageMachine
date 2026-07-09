"""SQLAlchemy 2.x ORM models — mirrors docs/DATA_MODEL.md exactly.

Progress only — curriculum lives in ``content/*.json``, credentials live in
Mishka Hub (docs/AUTH.md). Timestamps are UTC ``"%Y-%m-%d %H:%M:%S"`` strings
(Mishka's convention); item/lesson ids are content-string ids, deliberately
not foreign keys.
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# datetime('now') default, shared by every *_at/created_at column that uses it.
NOW = text("datetime('now')")


# ============ users — one household identity, mirrored from Mishka Hub ============
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(nullable=False, unique=True)  # lower()
    display_name: Mapped[str] = mapped_column(nullable=False)  # refreshed at every login
    mishka_user_id: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[str] = mapped_column(nullable=False, server_default=NOW)
    # {romaji, tts_rate, daily_goal_xp, trip_date, placement_done, stt_mode}
    settings_json: Mapped[str] = mapped_column(nullable=False, server_default=text("'{}'"))


# ============ refresh_tokens — line-for-line port of Mishka's ============
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(nullable=False, unique=True)
    expires_at: Mapped[str] = mapped_column(nullable=False)
    revoked: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    created_at: Mapped[str] = mapped_column(nullable=False, server_default=NOW)

    __table_args__ = (Index("idx_refresh_user", "user_id", "revoked"),)


# ============ item_progress — one row per (user, item) ever touched; SRS state ============
class ItemProgress(Base):
    __tablename__ = "item_progress"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    item_id: Mapped[str] = mapped_column(primary_key=True)  # content id, e.g. "u04.okaikei"
    strength: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))  # 0-4
    ease: Mapped[float] = mapped_column(nullable=False, server_default=text("2.5"))
    interval_days: Mapped[float] = mapped_column(nullable=False, server_default=text("0"))
    due_at: Mapped[str | None] = mapped_column(nullable=True)  # NULL until first graded rep
    reps: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    lapses: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    last_grade: Mapped[int | None] = mapped_column(nullable=True)  # 0..3
    last_seen_at: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (Index("idx_item_progress_due", "user_id", "due_at"),)


# ============ lesson_completions — append-only; latest row per lesson = path state ============
class LessonCompletion(Base):
    __tablename__ = "lesson_completions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    lesson_id: Mapped[str] = mapped_column(nullable=False)  # "u04.l3"
    score: Mapped[int] = mapped_column(nullable=False)  # 0-100
    stars: Mapped[int] = mapped_column(nullable=False)  # 0-3 (0 = tested-out via placement)
    xp: Mapped[int] = mapped_column(nullable=False)
    duration_seconds: Mapped[int] = mapped_column(nullable=False)
    source: Mapped[str] = mapped_column(nullable=False, server_default=text("'lesson'"))  # lesson|replay|placement
    # De-dupes a retried lesson-complete POST (docs/DATA_MODEL.md "Integrity rules").
    submission_id: Mapped[str] = mapped_column(nullable=False, unique=True)
    completed_at: Mapped[str] = mapped_column(nullable=False, server_default=NOW)

    __table_args__ = (Index("idx_lesson_completions_user_lesson", "user_id", "lesson_id"),)


# ============ daily_activity — upserted aggregate; streaks + weekly chart + goals ============
class DailyActivity(Base):
    __tablename__ = "daily_activity"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    date: Mapped[str] = mapped_column(primary_key=True)  # "2026-07-07", the user's local day
    xp: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    minutes: Mapped[float] = mapped_column(nullable=False, server_default=text("0"))
    lessons: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    reviews: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))


# ============ nudges — a calm "thinking of you" poke, not a guilt mechanic ============
class Nudge(Base):
    __tablename__ = "nudges"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    from_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    to_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(nullable=False, server_default=NOW)
    dismissed_at: Mapped[str | None] = mapped_column(nullable=True)

    __table_args__ = (Index("idx_nudges_to_user", "to_user_id", "dismissed_at"),)
