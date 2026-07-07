# Phase 6 — Verification & ship (owner: Fable)

1. Walk **every** acceptance list (AUTH §5, DESIGN §9, CURRICULUM §10, CONTENT_GUIDE §5,
   each phase doc) against the running system — checkbox-by-checkbox, with evidence.
   Subagent completion reports count for nothing here; only observed behaviour.
2. The golden path, by hand: fresh DB → login (real Mishka creds) → placement (skip) →
   lessons u01.l1–l3 with audio → path advances, stats move → forge clock +1 day → reviews
   due → review session → streak = 2.
3. Cross-app checks: password changed via Mishka `set_password.py` propagates; both SPAs
   logged in side-by-side; Mishka down → Michi sessions live.
4. Lighthouse a11y ≥95 on Path/Lesson/Stats; reduced-motion sweep; 375px viewport sweep.
5. DEPLOYMENT notes (tunnel hostname, Pages base path) appended to ARCHITECTURE §5 as a
   short tested runbook.
6. Final commits pushed to `https://github.com/Fyreline/learningLanguageMachine.git`.
