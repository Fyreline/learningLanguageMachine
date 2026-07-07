# Michi — API Contract

Base: `http://127.0.0.1:8100`, all routes under `/api`. Bearer JWT auth (Michi's own,
AUTH.md) on everything except `login/refresh/health`. Errors: `{detail, code}` with the
codes noted. Shapes are the contract between the backend agent and frontend agent — do not
drift from them; change this doc first if a change is truly needed.

## Auth (AUTH.md §2–3)
```
POST /api/auth/login    {email, password}
  → 200 {access_token, refresh_token, expires_in, user:{id,email,display_name}}
  → 401 invalid_credentials · 429 rate_limited · 503 identity_unavailable
POST /api/auth/refresh  {refresh_token} → 200 TokenPair (rotated) · 401 invalid_refresh_token | refresh_reuse_detected
POST /api/auth/logout   {refresh_token} → 200 {logged_out: true}
GET  /api/auth/me       → 200 {id, email, display_name, settings}          # settings_json parsed
PUT  /api/auth/settings {partial settings object} → 200 {settings}         # merge-patch
```

## Curriculum (read-only content passthrough)
```
GET /api/curriculum/manifest        → content/manifest.json + per-lesson learner state merged:
   {course, trip_date_default, units:[{...unit, lessons:[{id,title,kind,
      state: "done"|"current"|"available"|"locked", stars, best_score}]}],
    kana_trail: {...same state merge},
    summit: {trip_ready_pct, days_to_trip},
    partner: {display_name, current_lesson_id, words_known} | null}
GET /api/curriculum/lessons/{lesson_id} → the lesson's full content slice:
   {lesson:{id,title,kind}, items:[Item...] (new + a server-picked warm-up/review set with
    current strengths), steps: Step[] | null, dialogues: [...] when referenced}
  → 404 unknown_lesson · 403 lesson_locked (path order enforced server-side)
```
The session builder runs client-side (engine/session.ts) from this payload; the server
only decides *which* review items ride along (SRS-weakest 3–5 due-or-weak items).

## Progress
```
POST /api/lessons/{lesson_id}/complete
   {submission_id: uuid, score: 0-100, duration_seconds, local_date: "YYYY-MM-DD",
    results: [{item_id, grade: 0|1|2|3, mode: "listen-pick"|...}, ...]}
  → 200 {xp_awarded, stars, streak, path: {next_lesson_id, unit_completed: bool,
         trip_ready_pct}, leveled_items: [{item_id, strength}]}
  idempotent on submission_id (repeat POST → 200 with same payload, no double writes)
  grades update SRS per CURRICULUM §6 in the same transaction.
POST /api/placement/complete   {submission_id, known_item_ids: [...], local_date}
  → 200 {tested_out_lessons: [...], path: {...}}     # strength-3s + lesson pre-completes
```

## Reviews
```
GET  /api/reviews/due            → {due: [{item_id, strength, due_at, overdue_days}], counts:{today, week:[7 ints]}}
                                    ordered weakest-first, trip-core 3× weighted inside T-21 (CURRICULUM §7)
POST /api/reviews/complete       {submission_id, duration_seconds, local_date,
                                  results:[{item_id, grade, mode}]}
  → 200 {xp_awarded, streak, next_due_counts}
```

## Stats
```
GET /api/stats/me        → {streak:{current, rest_day_used}, words_known, minutes_total,
                            xp_week:[{date,xp} x7], daily_goal_xp, accuracy_recent,
                            strength_bands: {0:n,1:n,2:n,3:n,4:n},
                            forecast:[{date, due} x7], trip_ready_pct}
GET /api/stats/household → {partners:[{display_name, avatar: "clay"|"sky", streak,
                            words_known, current_lesson_id, current_unit_title}],
                            together_phrases: int}   # both users, aggregates only
```

## Misc
```
GET /api/health → {status:"ok", identity: "reachable"|"unreachable", content_version}
```

Conventions: snake_case JSON; timestamps UTC strings; the client never sends user ids;
CORS per ARCHITECTURE §4; every POST body ≤64KB (validation guard).
