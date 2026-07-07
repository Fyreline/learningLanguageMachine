# Michi — Content Guide

The contract for authoring `content/*.json`. The content author (human or agent) follows
this doc + CURRICULUM.md §1's inventories; the engine treats these files as read-only
truth. **Schema violations are build failures** — `apps/server/scripts/validate_content.py`
(write it first) checks every rule marked ✋ below and runs in CI/pre-commit.

## 1. Ids — stable forever

- Item ids: `u{unit:02}.{slug}` — `u01.sumimasen`, `u03.hyaku`, `u04.okaikei`. Kana items:
  `kana.hi.a`, `kana.ka.a` (hiragana/katakana rows). Slug = lowercase romaji, dots
  reserved. ✋ unique across the whole course; **never rename or reuse** (SRS rows point at
  them; renaming an id orphans a learner's memory of it).
- Lesson ids: `u04.l3`; checkpoint: `u04.check`. Unit ids: `u04`.

## 2. Schemas (TypeScript-shaped; `curriculum/types.ts` is generated from these by hand)

```ts
// content/manifest.json
{
  course: "ja-travel-v1",
  trip_date_default: "2026-09-15",
  units: Array<{
    id: string; title: string; kicker: string;        // "Ordering food", "UNIT 4 · RESTAURANT"
    summary: string;                                   // one path-header line
    landmark: string;                                  // DESIGN.md §5 landmark key, e.g. "izakaya"
    lessons: Array<{ id: string; title: string; kind: "teach" | "checkpoint" }>;
  }>;
  kana_trail: { hiragana: string[]; katakana: string[] };  // lesson ids
}

// content/units/u04.json
{
  id: "u04",
  items: Array<{
    id: string;
    jp: string;              // kana, or kanji with kana in `furigana`
    furigana?: string;       // full-string kana reading when jp contains kanji ✋ required then
    romaji: string;          // Hepburn, macrons (ō); see §3
    en: string;              // natural gloss: "the bill, please"
    literal?: string;        // "'honourable-account, please' — o- politeness prefix"
    note?: string;           // one usage line, learner-facing, ≤120 chars
    mnemonic?: string;       // optional, only when genuinely good
    tags: string[];          // ["food","politeness","trip_core", ...]
    trip_core?: boolean;
    slots?: { pattern: string; fills: string[] };   // "{X} o kudasai", fills = item ids
  }>,
  lessons: Array<{
    id: string; title: string; kind: "teach" | "checkpoint";
    new_items: string[];      // teach lessons: 4–7 ids ✋ ; checkpoints: [] ✋
    steps?: Step[];           // OPTIONAL hand-authored steps (dialogues NEED this);
                              // when absent the session builder generates per CURRICULUM §3
  }>,
  dialogues?: Array<{        // referenced from checkpoint/unit-14 steps
    id: string; scene: string;                     // "Izakaya, 7pm, two of you at the door"
    turns: Array<
      | { speaker: "npc"; jp: string; furigana?: string; romaji: string; en: string }
      | { speaker: "you"; expect_item: string; mode: "pick" | "speak"; stakes: string }
    >;
  }>
}

type Step =
  | { type: "teach"; item: string }
  | { type: "listen-pick" | "listen-pick-jp" | "tile-arrange" | "speak"
      | "listen-type-romaji" | "kana-glyph"; item: string; distractors?: string[] }
  | { type: "match-pairs"; items: string[] }              // exactly 5 ✋
  | { type: "dialogue"; dialogue: string };
```

✋ every id referenced (new_items, steps, fills, distractors, expect_item) must exist; every
item must be reachable from some lesson; every teach lesson's new_items must be items of
its own unit; `speak`/`dialogue` steps only reference items whose `jp` ≤ ~20 mora.

## 3. Japanese style rules

1. **Register**: polite form everywhere (です／ます). No plain-form verbs in v1 content
   except set phrases (いただきます).
2. **Script**: `jp` uses kana by default; use kanji **only** where a traveller will *see*
   the word written (駅, 出口, 円, 水, トイレ …) — then `furigana` is mandatory. Katakana
   loanwords stay katakana (ビール, ホテル).
3. **Romaji**: Hepburn with macrons (ō, ū; Tōkyō), は-as-particle → `wa`, を → `o`, long
   え → `ei` where spelled えい. Loanwords keep source-word feel (bīru).
4. **TTS input is `jp`** (kana/kanji), never romaji. Author `jp` so speechSynthesis reads
   it right: prefer kana when a kanji reading is ambiguous; test-listen anything unusual.
   Particle は must appear inside sentences (TTS reads it correctly in context); a bare
   sentence-fragment ending in は should be rephrased.
5. **Glosses** are natural British English, lowercase unless a proper noun ("the bill,
   please" not "The Bill, Please!"). `literal` explains structure only when it aids memory.
6. **Notes** teach the culture in one calm line: "Say it to staff as you leave — it thanks
   the whole kitchen." No weeb energy, no romaji-only slang.
7. **Distractor discipline**: auto-picked distractors come from same-unit items; hand-set
   `distractors` when the auto pool would create two defensible answers (e.g. never offer
   both "excuse me" and "sorry" against sumimasen).
8. **Dialogue NPC lines** may use vocabulary the learner hasn't studied *if* the `en` line
   carries the meaning and the learner's expected turn only needs studied items — that's
   the Pingo-style stretch, fenced.

## 4. Authoring order & review gates

1. `manifest.json` + units 1–4 + hiragana trail → **review gate: native-adequacy pass**
   (spot-check TTS pronunciation, romaji, glosses) before the engine work builds on them.
2. Units 5–10 + katakana trail.
3. Units 11–13, unit 14 dialogues (these six are the artisanal centrepiece — write them
   like tiny scenes with stakes, not vocab lists).
4. Full-course validator run + a `trip_core` census (must land 110–130).

## 5. Acceptance criteria

- [ ] `validate_content.py` passes; zero orphan/duplicate ids; counts within CURRICULUM §1
      ranges (±20%).
- [ ] Every unit-4-and-beyond lesson's generated drills can draw ≥2 earlier-unit items via
      `slots` fills (the compounding rule).
- [ ] 10 random items TTS-listened on macOS Chrome + Safari: readings correct.
- [ ] Six unit-14 dialogues exist, 8–14 turns each, alternating npc/you, every `you` turn
      answerable from studied items.
