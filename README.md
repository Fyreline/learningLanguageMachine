# 🐾 Michi (道)

*Learn enough Japanese to order the ramen, catch the right train, and charm the konbini
staff — before the plane leaves. Then keep going, because it turns out this is fun.*

Michi is a private, two-person Japanese learning app built for one household's trip to Japan
(mid-September → early October 2026) and designed to stay useful long after. It is the
sibling app of Mishka Hub — same ivory-and-clay design language, same two accounts, same cat.

## Why another language app

- **Duolingo** is too slow: twenty lessons in and you can say "the apple is red" but not
  "two beers please, and where is the toilet?"
- **Pingo** is too fast: full-speed conversation from minute one with no ladder up to it.

Michi sits in between, and lets *you* move the dial: a travel-first curriculum (restaurant,
trains, shopping, emergencies — the stuff you'll actually say in week one), an
**"I already know this"** fast-lane on every single item, and a gentle re-teach lane when
something keeps slipping. Audio-first throughout — every word and phrase is spoken aloud in
Japanese, you speak back and get scored — with the written form (kana + toggleable romaji)
always alongside so the symbols become familiar by osmosis.

## The tour

- **The Path** — the home screen: a winding trail from your front door to the summit of
  Mt. Fuji, one paw-print node per lesson, torii-gate checkpoints per unit, and the cat
  walking it with you. You can see "trip-ready" from wherever you're standing.
- **Lessons** — 5–8 minute audio-first sessions: listen-and-pick, tile-arrange, speak-back
  (speech recognition), dialogue simulations set in real situations.
- **Practice** — a spaced-repetition review queue that keeps old phrases warm, plus free
  drills: listening, speaking, kana trainer.
- **Phrasebook** — everything you've learned (and everything coming), searchable, each entry
  one tap from being spoken aloud. Deliberately useful *in* Japan, standing in the station.
- **Stats** — streaks, words known, minutes practiced, accuracy, review forecast, and a
  travel-buddies panel comparing the two of you (kindly).

## Docs

Implementation is driven by the documents in [`docs/`](docs/):

| Doc | What it pins down |
|---|---|
| [PLAN.md](docs/PLAN.md) | Phases, who builds what, acceptance gates |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Repo layout, stack, how the pieces talk |
| [AUTH.md](docs/AUTH.md) | Shared identity with Mishka Hub (one password, everywhere) |
| [DESIGN.md](docs/DESIGN.md) | Visual system — tokens, components, the Path, motion |
| [CURRICULUM.md](docs/CURRICULUM.md) | The teaching system: units, exercise types, SRS, adaptive pacing |
| [CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | Content JSON schemas + Japanese style rules |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | SQLite schema |
| [API.md](docs/API.md) | HTTP contract between web and server |

## Running it

```
apps/server:  uvicorn app.main:app --port 8100     # FastAPI + SQLite
apps/web:     npm run dev                          # Vite dev server, port 5174
```

Login uses your Mishka Hub email and password — Michi has no accounts of its own.
Mishka Hub's server must be reachable (default `http://127.0.0.1:8000`) the moment you log
in; after that, Michi sessions stand on their own.
