# Michi — Data Model (SQLite `data/michi.db`)

Progress only — curriculum lives in `content/*.json` (CONTENT_GUIDE.md), credentials live
in Mishka Hub (AUTH.md). SQLAlchemy 2.x mapped classes in `app/models.py`; timestamps are
UTC `"%Y-%m-%d %H:%M:%S"` strings (Mishka convention); item/lesson ids are content-string
ids, deliberately not FKs.

```sql
users
  id INTEGER PK
  email TEXT UNIQUE NOT NULL            -- lower(); mirrors Mishka's user email
  display_name TEXT NOT NULL            -- refreshed from Mishka at every login
  mishka_user_id INTEGER NOT NULL
  created_at TEXT NOT NULL
  settings_json TEXT NOT NULL DEFAULT '{}'
      -- {romaji: "show"|"fade"|"hide", tts_rate: 0.9, daily_goal_xp: 30,
      --  trip_date: "2026-09-15", placement_done: bool, stt_mode: "auto"|"shadow"}

refresh_tokens                           -- line-for-line port of Mishka's
  id INTEGER PK
  user_id INTEGER NOT NULL REFERENCES users(id)
  token_hash TEXT UNIQUE NOT NULL
  expires_at TEXT NOT NULL
  revoked INTEGER NOT NULL DEFAULT 0
  created_at TEXT NOT NULL

item_progress                            -- one row per (user, item) ever touched; SRS state
  user_id INTEGER NOT NULL REFERENCES users(id)
  item_id TEXT NOT NULL                  -- content id, e.g. "u04.okaikei"
  strength INTEGER NOT NULL DEFAULT 0    -- 0–4 (CURRICULUM §6)
  ease REAL NOT NULL DEFAULT 2.5
  interval_days REAL NOT NULL DEFAULT 0
  due_at TEXT                            -- NULL until first graded rep
  reps INTEGER NOT NULL DEFAULT 0
  lapses INTEGER NOT NULL DEFAULT 0
  last_grade INTEGER                     -- 0..3
  last_seen_at TEXT
  PRIMARY KEY (user_id, item_id)
  INDEX (user_id, due_at)                -- the reviews-due query

lesson_completions                       -- append-only; latest row per lesson = path state
  id INTEGER PK
  user_id INTEGER NOT NULL REFERENCES users(id)
  lesson_id TEXT NOT NULL                -- "u04.l3"
  score INTEGER NOT NULL                 -- 0–100
  stars INTEGER NOT NULL                 -- 0–3 (0 = tested-out via placement)
  xp INTEGER NOT NULL
  duration_seconds INTEGER NOT NULL
  source TEXT NOT NULL DEFAULT 'lesson'  -- 'lesson' | 'replay' | 'placement'
  completed_at TEXT NOT NULL
  INDEX (user_id, lesson_id)

daily_activity                           -- upserted aggregate; streaks + weekly chart + goals
  user_id INTEGER NOT NULL REFERENCES users(id)
  date TEXT NOT NULL                     -- "2026-07-07" in the USER'S local day (client sends it)
  xp INTEGER NOT NULL DEFAULT 0
  minutes REAL NOT NULL DEFAULT 0
  lessons INTEGER NOT NULL DEFAULT 0
  reviews INTEGER NOT NULL DEFAULT 0
  PRIMARY KEY (user_id, date)
```

Derivations (computed in `routers/stats.py`, not stored):

- **Streak**: walk `daily_activity` backwards from today; a day counts if `xp > 0`; one
  zero-day per rolling 7 is forgiven (CURRICULUM §8). Client sends its local date on every
  write precisely so streaks respect the household's timezone, not UTC.
- **Path state**: for each lesson id in the manifest, latest `lesson_completions` row →
  done/stars; first not-done lesson (in manifest order) = current node; everything after =
  locked. Kana-trail lessons resolve identically but never gate the main path.
- **Words known** = count of `item_progress` with `strength >= 3`; **trip-ready %** =
  same, filtered to the manifest's `trip_core` item set (server loads content to know it).
- **Review forecast** = `item_progress` grouped by `date(due_at)` over the next 7 days.

Integrity rules:

- All writes are per-authenticated-user; no endpoint accepts a `user_id`. Household stats
  expose only the aggregate fields listed in API.md §stats — never another user's
  item-level rows.
- `item_progress` upserts must be idempotent per submission batch (a retried
  lesson-complete POST must not double-count XP: the client sends a UUID `submission_id`;
  `lesson_completions` gets a UNIQUE index on it, and `daily_activity`/SRS writes happen in
  the same transaction).
