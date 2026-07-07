// Answer grading (docs/CURRICULUM.md §4). Pure functions, vitest-covered:
// Japanese normalization + mora Levenshtein for speech (§4.8), macron-optional
// romaji compare (§4.5), and tile-order compare with the particle-slip
// "close" rule (§4.3).

/* ------------------------- Japanese normalization ------------------------ */

const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const KANA_OFFSET = 0x60 // katakana -> hiragana codepoint shift

/** Everything that is not kana or kanji: punctuation, spaces, latin, digits. */
const NON_JA = /[^぀-ゟ゠-ヿ一-鿿々ー]/gu

const VOWEL_OF: Record<string, string> = {}
for (const [vowel, kana] of [
  ['あ', 'あかがさざただなはばぱまやらわゃぁ'],
  ['い', 'いきぎしじちぢにひびぴみりぃ'],
  ['う', 'うくぐすずつづぬふぶぷむゆるゅぅゔ'],
  ['え', 'えけげせぜてでねへべぺめれぇ'],
  ['お', 'おこごそぞとどのほぼぽもよろをょぉ'],
] as const) {
  for (const ch of kana) VOWEL_OF[ch] = vowel
}

/**
 * Normalize Japanese text for comparison: NFKC, katakana→hiragana fold,
 * strip punctuation/spaces, long-vowel normalization (ー becomes the
 * preceding vowel; う after an o-vowel and い after an e-vowel fold to the
 * plain vowel, so ありがとう ≡ ありがとー ≡ ありがとお).
 */
export function normalizeJa(input: string): string {
  const nfkc = input.normalize('NFKC')
  let out = ''
  for (const ch of nfkc) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      out += String.fromCodePoint(code - KANA_OFFSET)
    } else {
      out += ch
    }
  }
  out = out.replace(NON_JA, '')
  // long-vowel mark: extend the previous kana's vowel
  let folded = ''
  for (const ch of out) {
    if (ch === 'ー') {
      const prev = folded[folded.length - 1]
      folded += prev ? (VOWEL_OF[prev] ?? prev) : ''
    } else {
      folded += ch
    }
  }
  // canonical long vowels: おう -> おお, えい -> ええ (spelling variants agree)
  let canon = ''
  for (const ch of folded) {
    const prev = canon[canon.length - 1]
    if (prev && ch === 'う' && VOWEL_OF[prev] === 'お') canon += 'お'
    else if (prev && ch === 'い' && VOWEL_OF[prev] === 'え') canon += 'え'
    else canon += ch
  }
  return canon
}

/* ------------------------------ mora arrays ------------------------------ */

const SMALL_COMBINERS = new Set([
  'ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ',
  'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ',
])

/** Split normalized hiragana into mora: small ya/yu/yo (and small vowels)
 * attach to the previous kana; っ and ん stand alone. */
export function toMora(normalized: string): string[] {
  const mora: string[] = []
  for (const ch of normalized) {
    if (SMALL_COMBINERS.has(ch) && mora.length > 0) {
      mora[mora.length - 1] += ch
    } else {
      mora.push(ch)
    }
  }
  return mora
}

export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return prev[b.length]
}

/* ----------------------------- speech (§4.8) ----------------------------- */

export type SpeechVerdict = 'pass' | 'close' | 'miss'

/** 1 - levenshtein(mora)/max(len), on normalized text. */
export function speechSimilarity(expected: string, actual: string): number {
  const a = toMora(normalizeJa(expected))
  const b = toMora(normalizeJa(actual))
  const max = Math.max(a.length, b.length)
  if (max === 0) return 0
  return 1 - levenshtein(a, b) / max
}

/** pass >= 0.75, close 0.55-0.75 (one free retry), else miss (§4.4). */
export function gradeSpeech(expected: string, transcript: string): {
  verdict: SpeechVerdict
  similarity: number
} {
  const similarity = speechSimilarity(expected, transcript)
  const verdict: SpeechVerdict = similarity >= 0.75 ? 'pass' : similarity >= 0.55 ? 'close' : 'miss'
  return { verdict, similarity }
}

/* ----------------------------- romaji (§4.5) ----------------------------- */

const MACRONS: Record<string, string> = { ā: 'a', ī: 'i', ū: 'u', ē: 'e', ō: 'o' }

/** Lowercase, strip macrons and punctuation, collapse long vowels so that
 * `ou` = `ō` = `o` and doubled vowels fold (macron-optional typing). */
export function normalizeRomaji(input: string): string {
  let s = input.toLowerCase().normalize('NFC')
  s = [...s].map((ch) => MACRONS[ch] ?? ch).join('')
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '') // any stray diacritics
  s = s.replace(/[^a-z]/g, '') // spaces, hyphens, apostrophes out
  s = s.replace(/ou/g, 'o')
  s = s.replace(/([aiueo])\1+/g, '$1') // aa/ii/uu/ee/oo -> single
  return s
}

export type RomajiVerdict = 'pass' | 'close' | 'miss'

/** Exact (normalized) = pass; Levenshtein <= 1 = close; else miss. */
export function gradeRomaji(expected: string, typed: string): RomajiVerdict {
  const a = normalizeRomaji(expected)
  const b = normalizeRomaji(typed)
  if (a === b) return 'pass'
  if (levenshtein([...a], [...b]) <= 1) return 'close'
  return 'miss'
}

/* --------------------------- tile order (§4.3) --------------------------- */

/** Particles whose confusion is a "close", not a fail. */
const SLIP_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'へ', 'も'])

function stripTrailingParticle(tile: string): string {
  const last = tile[tile.length - 1]
  if (tile.length > 1 && last && SLIP_PARTICLES.has(last)) {
    return tile.slice(0, -1)
  }
  return tile
}

export type TileVerdict = 'pass' | 'close' | 'miss'

/** Order-exact = pass. If the only differences are particle slips (wa/ga
 * confusion and friends) the answer is close — shown, not failed. */
export function gradeTiles(expected: readonly string[], arranged: readonly string[]): TileVerdict {
  if (expected.length === arranged.length && expected.every((t, i) => t === arranged[i])) {
    return 'pass'
  }
  if (
    expected.length === arranged.length &&
    expected.every((t, i) => {
      const a = arranged[i]
      return t === a || (SLIP_PARTICLES.has(t) && SLIP_PARTICLES.has(a)) ||
        stripTrailingParticle(t) === stripTrailingParticle(a)
    })
  ) {
    return 'close'
  }
  return 'miss'
}

/** Tiles for a jp sentence: content authors space-separate phrase chunks;
 * single-word items fall back to mora-pair chunks so there is something to
 * arrange. */
export function tilesFor(jp: string): string[] {
  const chunks = jp.split(/\s+/).filter(Boolean)
  if (chunks.length >= 2) return chunks
  // Tiles show the learner the AUTHORED spelling — never the
  // comparison-normalized form (おはよう must not become おはよお).
  const mora = toMora(jp.replace(/\s+/g, ''))
  const tiles: string[] = []
  for (let i = 0; i < mora.length; i += 2) {
    tiles.push(mora.slice(i, i + 2).join(''))
  }
  return tiles.length >= 2 ? tiles : chunks
}

/** Fisher-Yates on a copy — option/tile shuffling. Guaranteed not to return
 * the original order for n >= 2 (re-shuffles until different). */
export function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  if (out.length < 2) return out
  for (let attempts = 0; attempts < 10; attempts++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    if (out.some((v, i) => v !== arr[i])) break
  }
  return out
}
