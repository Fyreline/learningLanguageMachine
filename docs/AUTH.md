# Michi — Auth: one household identity, shared with Mishka Hub

**Requirement (verbatim from the brief):** Michi shares the same email/password as Mishka
Hub, and a change to either is reflected in both automatically.

**Design answer: there is only one credential store — Mishka Hub's.** Michi never stores,
hashes, or even *sees a hash of* a password. At login, Michi's server verifies the
submitted email/password by calling Mishka Hub's own login endpoint. A password or email
changed in Mishka Hub (via its `scripts/set_password.py`) is therefore *instantly and
automatically* the credential for Michi — there is no second copy to update, no sync job,
no drift. This satisfies "update automatically" by construction.

## 1. Why not the alternatives

| Option | Verdict |
|---|---|
| Copy the users table / hashes into Michi + sync job | Two sources of truth, sync bugs, exactly what the requirement fears. **No.** |
| Michi reads Mishka's SQLite directly | Cross-app DB coupling, schema lock-in, file-lock hazards with two uvicorns. **No.** |
| Shared JWT secret — SPA logs into Mishka, Michi trusts Mishka tokens | Workable, but couples token TTL/rotation policy and secret rotation across apps, and Mishka's refresh-reuse tripwire would kill both apps' sessions at once. **No.** |
| **Michi proxies the login *verification* to Mishka, then issues its own tokens** | One credential store, zero password handling in Michi, sessions fully independent after login. **Yes.** |

## 2. Flow

```
LoginScreen ──(email, password over HTTPS)──► Michi POST /api/auth/login
    Michi server ──POST {MICHI_MISHKA_BASE_URL}/api/auth/login (httpx, 5s timeout)──► Mishka Hub
        200 → body.user {id, email, display_name}   → verified ✓
        401 → invalid credentials                    → Michi returns 401, same shape
        429 → Mishka's rate limit tripped            → Michi returns 429, message passed through
        conn error / timeout → Michi returns 503 code="identity_unavailable",
              detail "Mishka Hub isn't reachable — Michi borrows its login. Is it running?"
    on verified:
        upsert local users row keyed by lower(email):
            {email, display_name (from Mishka), mishka_user_id, created_at}
            — display_name/mishka_user_id refreshed on every login, so renames follow too
        issue MICHI tokens: JWT access (15 min, MICHI_JWT_SECRET) +
            opaque rotating refresh token (30 d) — same mechanics as Mishka's security.py
    response body: identical TokenPair shape to Mishka's
        {access_token, refresh_token, expires_in, user:{id, email, display_name}}
```

Notes:

- **The Mishka-side session created by the verification call is discarded** — Michi throws
  away the token pair Mishka returns (never persisted, never logged). Its refresh token
  simply expires server-side in 30 days, unused; harmless, but the identity client SHOULD
  fire a best-effort `POST /api/auth/logout` with it to keep Mishka's refresh_tokens table
  tidy.
- Michi's refresh/logout/me endpoints are pure ports of Mishka's `routers/auth.py`
  (rotation, reuse-detection tripwire, revocation) minus the password paths, pointing at
  Michi's own `refresh_tokens` table and secret. After login, Mishka Hub can be down for a
  month and Michi sessions keep refreshing.
- Michi adds its own login rate limit (same 5-failures/15-min/IP deque as Mishka) *in front
  of* the proxy call, so a brute force can't use Michi to hammer Mishka.
- `identity.py` is one small class (`MishkaIdentityClient.verify(email, password) ->
  IdentityResult`) so tests stub it trivially and a future standalone mode (own passwords)
  would swap one class.

## 3. Server pieces (implementation order for the agent)

1. `app/security.py` — port from Mishka Hub `apps/server/app/security.py`, **delete**
   `hash_password`/`verify_password`/`needs_rehash` and the argon2 import (no argon2 in
   requirements.txt at all — its absence is the proof Michi holds no passwords).
2. `app/identity.py` — httpx.AsyncClient, base URL from settings, `verify()` per §2
   mapping; raises typed `IdentityUnavailable` / `IdentityRejected` / `IdentityRateLimited`.
3. `app/routers/auth.py` — port Mishka's router; replace the DB password check inside
   `login` with the identity client call + user upsert. Refresh/logout/me are line-for-line
   ports against Michi models.
4. `app/auth.py` — `current_user` dependency, unchanged port.
5. Frontend `src/auth.ts` — copy Mishka's file, change `BASE` default to
   `http://127.0.0.1:8100` and storage key to `michi-refresh-token` (distinct key: both
   SPAs may share `localhost` origin during dev, and clobbering Mishka's session would be a
   rude bug).

## 4. Security posture

- Passwords transit Michi's process memory during login only; never written to DB, logs, or
  error messages. The identity client must redact the body from any logged exception.
- `MICHI_JWT_SECRET` is independent of `MISHKA_JWT_SECRET` — rotating one never affects the
  other app's sessions.
- CORS: explicit origin allow-list (ARCHITECTURE.md §4); credentials flow as bearer headers,
  no cookies, same as Mishka.
- The verification call targets loopback (or the tunnel-internal hostname) — it must be
  HTTPS or loopback; `identity.py` refuses a plain-http non-loopback base URL at startup.

## 5. Acceptance criteria

- [ ] Logging into Michi with current Mishka Hub credentials succeeds; wrong password → 401
      with `code="invalid_credentials"`.
- [ ] Change the password via Mishka's `set_password.py` → old password immediately fails on
      Michi, new one works, with **zero** Michi-side action.
- [ ] Stop Mishka Hub's server → Michi login returns the friendly 503; an *already
      logged-in* Michi session keeps working (refresh succeeds with Mishka down).
- [ ] `grep -ri argon2\|password_hash apps/server` in Michi returns nothing.
- [ ] Refresh-token reuse on Michi revokes all Michi sessions (tripwire ported correctly)
      and leaves Mishka Hub sessions untouched.
- [ ] Both SPAs logged in simultaneously in one browser: logging out of one does not log
      out the other (distinct localStorage keys).
