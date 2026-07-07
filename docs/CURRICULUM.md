# Michi — Curriculum & Teaching System

The pedagogy doc: what is taught, in what order, through which exercise mechanics, and how
pacing adapts. This is the part that has to beat both reference apps: **Duolingo's flaw is
pace-locked drip-feed of non-travel content; Pingo's flaw is full-speed immersion with no
ladder.** Michi's answer is a travel-first syllabus + learner-controlled tempo + spaced
repetition that quietly does the remembering.

## 0. Learners & clock

Two adults, UK/Scotland household. Prior knowledge: scattered anime vocabulary
(recognition-level; assume *arigatou, konnichiwa, sumimasen* are known-ish, grammar zero).
Trip: **mid-September → early October 2026**. Assume start ~mid-July: **~9 weeks**, target
cadence 10–15 min/day → realistically **~55–70 lessons before the flight**. The course
below is 84 lessons; the *Trip Core* mechanism (§7) guarantees the highest-value material
is mastered even if the tail isn't reached. Post-trip, the same engine continues (the
course is a path, not a countdown — §9 sketches the continuation).

Register decision: **teach polite form (です/ます) exclusively** at this level. It is
correct in 100% of tourist interactions; casual form is a post-trip unit.

## 1. Course map

14 units × 6 lessons (5 teaching + 1 checkpoint). Each lesson introduces 4–7 new items
(adaptive, §5) and re-drills earlier ones. Item counts are the *inventory the content
author must cover* (CONTENT_GUIDE.md holds the schemas and style rules).

| # | Unit (path stretch) | What you can do after it | Inventory highlights (~items) |
|---|---|---|---|
| 1 | **First words** (front door) | Greet, thank, apologise, yes/no, catch attention | konnichiwa/ohayō/konbanwa, arigatō (gozaimasu), sumimasen (the Swiss-army word — taught as excuse-me AND sorry AND waiter-summons), hai/iie, onegaishimasu, daijōbu, wakarimasen, mō ichido onegaishimasu, eigo (ga hanasemasu ka) (~26) |
| 2 | **Survival grammar** (tenement street) | Point at anything and ask/say what it is; want things | kore/sore/are, ~wa ~desu, ~o kudasai, ~wa arimasu ka, nan desu ka, doko desu ka, ikura desu ka; particles wa/o/ka as *patterns inside phrases*, never as grammar tables (~24) |
| 3 | **Numbers & money** (airport) | 1–10,000, prices, paying | ichi–jū, hyaku, sen, man; en; counters gently (-tsu for things, -mai for tickets); kādo de ii desu ka, genkin, reshīto; IC cards (Suica) (~30) |
| 4 | **Restaurant** (Tokyo izakaya) | Get seated, order, ask, pay, leave charmed | futari desu, menyū onegaishimasu, osusume wa, kore o hitotsu/futatsu, biru o nihai, mizu, oishii!, okaikei onegaishimasu, gochisōsama deshita; dietary: niku/sakana nashi de, arerugī (~34) |
| 5 | **Trains & transport** (shinkansen) | Buy tickets, find platforms, not end up in Nagoya | eki, kippu, ~made, katamichi/ōfuku, nanban-sen, tsugi wa, norikae, JR/chikatetsu, shinkansen, jiyūseki/shiteiseki, basu, takushī, ~made onegaishimasu (~32) |
| 6 | **Directions & places** (Tokyo streets) | Ask where, understand the answer's shape | massugu, migi/hidari, chikaku, tōi, kōban, toire wa doko desu ka (the single most valuable sentence in Japan), konbini, ginkō, hoteru, byōin; floors (-kai) (~28) |
| 7 | **Shopping & konbini** (Don Quijote) | Browse, ask for sizes/colours, konbini rituals | mite iru dake desu, ~wa arimasu ka, chotto chiisai/ōkii, fukuro onegaishimasu / iranai desu, atatamemasu ka → hai onegaishimasu, omiyage, menzei (~28) |
| 8 | **Hotel & home base** (ryokan) | Check in/out, ask for things, onsen etiquette basics | yoyaku shite imasu, chekku-in/auto, nimotsu o azukatte moraemasu ka, kagi, wifi no pasuwādo, asagohan wa nanji, onsen, yukata (~26) |
| 9 | **Time & plans** (calendar stretch) | Hours, days, opening times, "when?" | ~ji, ~fun gently, nanji, kyō/ashita/kinō, getsu–nichi yōbi, ~kara ~made, eigyō-chū, yasumi (~30) |
| 10 | **Feelings & small talk** (onsen town) | Be a person, not a phrasebook | tanoshii, samui/atsui, tsukaremashita, suki desu, kirei, sugoi, hajimemashite, ~kara kimashita (Sukottorando!), shashin o totte moraemasu ka (~26) |
| 11 | **Emergencies & health** (kōban) | Get help fast, pharmacy runs | tasukete, keisatsu, kyūkyūsha, byōki, itai (+ body parts mini-set), kusuri, yakkyoku, ~o nakushimashita (pasupōto!), michi ni mayoimashita (~28) |
| 12 | **Food, deeper** (Kyoto market) | Read menus-ish, name what you love | dish names (rāmen/sushi/udon/…), aji (amai/karai/shoppai), teishoku, tabemono allergies deepened, kore wa nan no niku desu ka (~30) |
| 13 | **Politeness & culture** (torii avenue) | The unspoken rules, said | o-/go- honorifics as received patterns, itadakimasu, osaki ni, shitsurei shimasu, sumimasen-vs-gomennasai, cash tray, shoes, escalator sides (regional!), IC beeps — taught as 50% culture-note cards, 50% language (~22) |
| 14 | **Trip dress rehearsal** (Fuji approach) | Full scenario runs | no new vocab; six long-form dialogue simulations chaining units 1–13: Arrival airport→hotel; Izakaya night; Day-trip by train; Shopping run; Feeling unwell; Last-night thank-yous (~0 new, all review) |

**Kana side-trail** (optional, parallel, off the main path — its own little spur on the
Path scene): hiragana in 10 micro-lessons, katakana in 10, recognition-only (see a kana →
pick the sound; hear a sound → pick the kana), plus a "menu katakana" bonus (reading
ビール/ラーメン/コーヒー in the wild). Never blocks main-path progress; main path shows
kana + romaji regardless (DESIGN.md §2). Finishing it flips a satisfying switch: the
learner *can* enable "fade romaji".

## 2. Item model

An **item** is the atomic learnable unit: a word, phrase, or pattern. Every item carries
(CONTENT_GUIDE.md §2): stable id, Japanese (kana; kanji+furigana where natural), romaji
(Hepburn), English gloss, literal gloss where it helps ("gochisōsama = 'it was a feast'"),
audio-notes (TTS reads kana, never romaji), usage note, optional mnemonic, unit/lesson
assignment, `trip_core` flag, and tags (`food`, `politeness`, …) that power Phrasebook
filters and themed practice.

**Patterns** (e.g. `~o kudasai`) are items with a `slots` field; drills substitute learned
vocab into the slot, so unit 4 quietly revises unit 3's numbers inside new sentences. This
is the compounding trick the whole course leans on: **every unit's drills consume earlier
units' vocabulary by construction.**

## 3. Lesson anatomy

A teaching lesson is a generated session of ~14–20 exercise steps (5–8 min):

```
warm-up      2–3 review reps of weakest earlier items (SRS-picked, §6)
teach        new item 1 → teach card → immediate easy drill (recognition)
             new item 2 → …            (interleaved, never 3 teach cards in a row)
drill        mixed exercises over today's new items, difficulty ramping:
             recognition (hear→meaning) → recall (meaning→pick kana/tiles) →
             production (arrange tiles / speak)
weave        2–3 exercises mixing new items WITH older vocab in one sentence
finish       hardest step: one speak-back or mini-dialogue using ≥2 new items
             → score screen (stars, XP, path walk)
```

Checkpoint lessons (each unit's 6th): no teach cards — a 12-step gauntlet drawn from the
whole unit + SRS-weak older items, ending in a **dialogue simulation** (§4.7) set in the
unit's scenario. Passing (≥60) opens the torii gate.

## 4. Exercise type catalogue

Every type is audio-first: Japanese audio auto-plays on mount wherever Japanese is shown.
All are one shared `Exercise` interface so the session builder can mix freely
(`components/exercises/`, one file each).

| # | Type (id) | Prompt → response | Grading |
|---|---|---|---|
| 4.1 | `listen-pick` | audio (+kana) → 4 English meaning cards | exact |
| 4.2 | `listen-pick-jp` | English → 4 Japanese cards (kana, audio on tap) | exact |
| 4.3 | `tile-arrange` | audio + English → arrange kana word-tiles into the sentence | order-exact; particle slips (wa/ga confusion) marked *close*, shown, not failed |
| 4.4 | `speak` | kana + audio → hold-to-talk, say it | speech similarity (§4.8): pass ≥0.75, close 0.55–0.75 (one free retry), else miss |
| 4.5 | `listen-type-romaji` | audio only → type what you heard, in romaji | normalized compare (macron-optional: `ou`=`ō`=`o`), Levenshtein ≤1 = close |
| 4.6 | `match-pairs` | 5 audio/kana ⇄ 5 English chips | all pairs; per-pair correctness feeds item stats |
| 4.7 | `dialogue` | scripted scene, partner lines TTS-spoken (rate 0.85), learner's turns are `listen-pick-jp` or `speak` steps with situational stakes ("The waiter asks: 何名様ですか — respond for two people") | per-turn, scene score = mean |
| 4.8 | `kana-glyph` | (kana trail only) glyph → 4 sounds, or sound → 4 glyphs | exact |

**§4.8 Speech grading.** `stt.ts` uses `webkitSpeechRecognition` (`lang: 'ja-JP'`,
`interimResults: true`). `grading.ts` normalizes both sides — NFKC, katakana→hiragana
fold, strip punctuation/spaces, long-vowel normalization — converts to mora arrays, and
scores `1 - levenshtein(mora) / max(len)`. Thresholds above. **Fallback (Safari/Firefox/
no-mic):** shadow mode — the learner hears it, says it aloud, taps reveal, self-grades
("nailed it / roughly / not really") mapping to pass/close/miss. Capability is detected
once at startup; Settings shows which mode the device gets. Speech exercises are never
gate-blocking: a `speak` step a device can't do becomes shadow mode, silently.

**Anti-frustration rules (applies to all types):** answer options never include two
correct-ish variants; after 2 misses on the same step the step converts to a teach card +
gentle recognition retry (the *slow lane*, §5); the feedback strip always contains replay
buttons; nothing in a lesson is timed. Timed pressure exists only in the optional
"lightning review" practice drill, clearly labelled.

## 5. Adaptive pacing — the anti-Duolingo/anti-Pingo core

Three mechanisms, all per-item, all invisible until needed:

1. **Fast lane ("I know this").** Teach cards and *first* drills of a new item carry the
   ghost-link skip (DESIGN.md §4.6). Skipping marks the item strength 3 immediately (it
   enters SRS as "known", so a lie to oneself surfaces as a review tomorrow, cheaply). The
   anime-vocab head start is thereby honoured in minute one, not lesson forty.
2. **Slow lane.** 2 misses on an item within a session → item flagged `struggling`: it gets
   a re-teach card now, +2 extra easy reps this session, and enters SRS at reduced ease.
   No public failure state — the lesson just quietly bends around the learner.
3. **New-item rate.** Rolling accuracy over the last 3 sessions sets the next lesson's
   new-item count: ≥90% → 7, 75–90% → 5–6, <75% → 4 (and the session builder swaps two
   teach slots for review). Session length stays 5–8 min regardless — pace changes, time
   doesn't.

**Onboarding placement (first run, optional, 3 min):** "Know some already?" → a 12-step
adaptive probe over units 1–3 items (binary-search-ish: start at unit 1 basics, jump
forward on streaks of 3). Items answered correctly are pre-marked strength 3; whole
lessons where ≥80% of items are known are pre-completed on the path (shown olive with a
small "tested out" mark instead of stars). Skippable entirely ("Start from the very
beginning").

## 6. Spaced repetition (SRS)

SM-2-lite, server-side (`app/srs.py`), per (user, item):

```
state: ease (2.5 default, floor 1.3), interval_days, due_at, reps, lapses, strength 0–4
grade g ∈ {miss=0, close=1, pass=2, easy=3}   # easy = pass on first exposure or fast-skip

on review:
  g==0: lapses+=1; ease=max(1.3, ease-0.2); interval=max(1, interval*0.25); strength=max(1, strength-1)
  g==1: ease-=0.05; interval stays; strength unchanged
  g>=2: ease+= (0.05 if g==3 else 0); interval = 1 if reps==0 else round(interval*ease)
        reps+=1; strength=min(4, strength + (1 if interval>=4 else 0) + (1 if g==3 and reps<=1 else 0))
  interval cap 60 days (travel app — nothing should sleep past the trip)
  due_at = now + interval_days
strength meaning: 0 new · 1 seen · 2 learning · 3 known · 4 strong  (drives the Stats garden)
```

Lesson exercises double as reviews: every graded step posts `(item_id, grade)` in the
lesson-complete payload and updates SRS — there is **one** memory model, not
lessons-vs-reviews. The **Practice tab** surfaces `GET /api/reviews/due` as a 3–5 min
session (same exercise components, review-flavoured mix, production-biased for strong
items). Due counts appear as a small clay badge on the Practice tab icon — an invitation,
never a guilt trip (no red, cap display at "20+").

## 7. Trip Core

~120 items across all units flagged `trip_core: true` — the *must-not-fumble* set
(sumimasen, toire wa doko, kore o kudasai, numbers 1–10k, okaikei, tasukete, eki/kippu
basics…). The Path summit meter (DESIGN.md §5) = % of trip-core items at strength ≥3.
From **T-21 days** (user-set trip date in Settings, default 2026-09-15), Practice sessions
weight trip-core items 3×, and the path header gently offers the unit-14 dress rehearsals
even if units 11–13 are incomplete. This is the graceful-degradation guarantee: whatever
happens, the plane is boarded knowing the 120 things that matter.

## 8. Motivation model (gamified, not casino)

- **XP**: 10/lesson + 1/exercise-correct + 5/checkpoint star; feeds daily-goal ring &
  weekly chart. No XP inflation events, no gems, no shop, nothing to buy.
- **Stars** 1–3 per lesson (score ≥60/80/95) — replayable anytime to improve (replay grants
  no XP after 3 stars; it's for mastery, not grinding).
- **Streak with one free rest day per week** (any 6-of-7 keeps it alive) — sustainable
  habit > anxiety mechanics; copy per DESIGN.md §6.
- **Torii moments** — the only confetti in the app (DESIGN.md §5).
- **Buddy presence** — the partner's ghost cat + shared "together you know n phrases"
  stat. Cooperative framing only.

## 9. After the trip

The engine is course-agnostic: a `manifest.json` swap adds "Season 2" (casual form, past
tense, kanji-first items, JLPT-N5 alignment) as trail beyond Fuji ("the descent into the
onsen town"). Out of scope for v1 except: nothing in the schema may hard-code 14 units,
and strength/SRS must not assume the course ends.

## 10. Acceptance criteria

- [ ] All 14 units + kana trail authored per CONTENT_GUIDE and loadable; total items 350–420
      with ~120 trip-core.
- [ ] A brand-new user reaches "can order two beers and pay" (unit 4 checkpoint) in ≤10
      lessons from zero.
- [ ] Fast-skip on a teach card marks strength 3, schedules a next-day review, and skips the
      item's remaining drills this session.
- [ ] Two misses → visible re-teach + extra reps in the same session; next lesson's
      new-item count drops when rolling accuracy <75%.
- [ ] SRS math matches §6 exactly (unit tests with a forged clock); lesson steps and review
      steps update the same state.
- [ ] Placement probe pre-completes lessons correctly and is fully skippable.
- [ ] Speech grading passes a native-ish "sumimasen" recording and *close*-grades a mangled
      one in Chrome; Safari gets shadow mode with no dead ends.
- [ ] Trip-core meter reflects strength≥3 fraction; T-21 weighting kicks in off the
      Settings trip date.
