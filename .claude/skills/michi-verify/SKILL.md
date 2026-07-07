---
name: michi-verify
description: Verify Michi end-to-end — boot both servers, mint a preview session, exercise auth/curriculum/stats/lesson flows, and check the UI in both themes. Use before committing any phase, after subagent work lands, or when asked "does it work?".
---

# Verifying Michi

Never trust a completion report (subagent or your own memory) — run this.

## Boot

preview_start `michi-web` (5174) and `michi-api` (8100) from the shared launch.json.
Mishka Hub's server on :8000 is only needed to test *login itself*.

## Gates (in order, all must pass)

1. `apps/server: .venv/bin/python -m pytest -q` green; `apps/web: npm run typecheck` and
   `npm run build` green; `python3 apps/server/scripts/validate_content.py` green (or its
   failures are exactly the known-missing units listed in docs/HANDOFF.md).
2. `grep -ri argon2 apps/server` returns nothing (the no-passwords invariant, docs/AUTH.md).
3. API smoke — mint a session without real credentials:
   ```bash
   cd apps/server && .venv/bin/python - <<'EOF'
   from datetime import datetime, timedelta, timezone
   from app.db import SessionLocal, engine
   from app.models import Base, RefreshToken, User
   from app import security
   import app.config as config
   Base.metadata.create_all(engine); db = SessionLocal()
   email = "thediamondmincrafter@gmail.com"   # real household email → real login upserts onto this row
   user = db.query(User).filter(User.email == email).one_or_none()
   if not user:
       user = User(email=email, display_name="Meowck", mishka_user_id=1)
       db.add(user); db.commit(); db.refresh(user)
   raw, hashed = security.generate_refresh_token()
   db.add(RefreshToken(user_id=user.id, token_hash=hashed,
       expires_at=(datetime.now(timezone.utc)+timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")))
   db.commit()
   print("refresh:", raw)
   print("access:", security.create_access_token(user.id, config.Settings()))
   EOF
   ```
   curl `/api/health`, `/api/curriculum/manifest`, `/api/stats/me`, `/api/stats/household`
   with the access token — 200s, shapes per docs/API.md.
4. UI: `preview_eval` → `localStorage.setItem('michi-refresh-token','<raw>')`, navigate to
   `http://localhost:5174/?mock` → screenshot Path (cat on current node, stars, torii,
   summit meter) and Stats (tiles, week bars, garden). Then toggle `.dark` and re-shot.
   Remove `?mock` and confirm the truthful zero-state renders (no crash, empty-journal
   copy).
5. Console/network: preview_console_logs level=error empty; preview_network no failed
   requests (a 401 before login bootstrap is fine).
6. If auth code changed: full cross-app check per docs/AUTH.md §5 (needs Mishka running
   and, for the password-change case, the household running `set_password.py`).

Clean up nothing — the minted user row is the real household row and gets refreshed by
the next genuine login.
