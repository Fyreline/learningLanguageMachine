// engine/grading.ts — docs/CURRICULUM.md §4.3/§4.5/§4.8 acceptance maths.
import { describe, expect, it } from 'vitest'
import {
  gradeRomaji,
  gradeSpeech,
  gradeTiles,
  levenshtein,
  normalizeJa,
  normalizeRomaji,
  speechSimilarity,
  tilesFor,
  toMora,
} from './grading'

describe('normalizeJa', () => {
  it('folds katakana to hiragana', () => {
    expect(normalizeJa('スミマセン')).toBe('すみません')
  })
  it('strips punctuation and spaces', () => {
    expect(normalizeJa('すみ ません。！?')).toBe('すみません')
  })
  it('normalizes long vowels so spelling variants agree', () => {
    expect(normalizeJa('ありがとー')).toBe(normalizeJa('ありがとう'))
    expect(normalizeJa('ありがとお')).toBe(normalizeJa('ありがとう'))
    expect(normalizeJa('コーヒー')).toBe(normalizeJa('こおひい'))
  })
  it('applies NFKC (half-width katakana folds in)', () => {
    expect(normalizeJa('ｽﾐﾏｾﾝ')).toBe('すみません')
  })
})

describe('toMora', () => {
  it('attaches small ya/yu/yo to the previous kana', () => {
    expect(toMora('きょうと')).toEqual(['きょ', 'う', 'と'])
  })
  it('keeps っ and ん as their own mora', () => {
    expect(toMora('ちょっと')).toEqual(['ちょ', 'っ', 'と'])
    expect(toMora('すみません')).toEqual(['す', 'み', 'ま', 'せ', 'ん'])
  })
})

describe('levenshtein', () => {
  it('is zero for identical arrays', () => {
    expect(levenshtein(['a', 'b'], ['a', 'b'])).toBe(0)
  })
  it('counts substitutions, insertions, deletions', () => {
    expect(levenshtein(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(1)
    expect(levenshtein(['a'], ['a', 'b'])).toBe(1)
    expect(levenshtein([], ['a', 'b'])).toBe(2)
  })
})

describe('speech grading (§4.8)', () => {
  it('passes a native-ish transcript', () => {
    expect(gradeSpeech('すみません', 'すみません').verdict).toBe('pass')
    // recognizer heard it in katakana with punctuation
    expect(gradeSpeech('すみません', 'スミマセン。').verdict).toBe('pass')
  })
  it('close-grades a mangled one', () => {
    // 2 of 5 mora off -> 0.6 similarity -> close, one free retry
    const g = gradeSpeech('すみません', 'すいまえん')
    expect(g.verdict).toBe('close')
  })
  it('misses something unrelated', () => {
    expect(gradeSpeech('すみません', 'こんにちは').verdict).toBe('miss')
  })
  it('similarity is 1 - lev/max(len)', () => {
    expect(speechSimilarity('すみません', 'すみません')).toBe(1)
    expect(speechSimilarity('すみません', '')).toBe(0)
  })
  it('long-vowel spelling never penalizes', () => {
    expect(gradeSpeech('ありがとうございます', 'ありがとーございます').verdict).toBe('pass')
  })
})

describe('romaji grading (§4.5)', () => {
  it('is macron-optional: ou = ō = o', () => {
    expect(normalizeRomaji('arigatō')).toBe(normalizeRomaji('arigatou'))
    expect(normalizeRomaji('arigatō')).toBe(normalizeRomaji('arigato'))
    expect(gradeRomaji('ohayō gozaimasu', 'ohayou gozaimasu')).toBe('pass')
    expect(gradeRomaji('ohayō gozaimasu', 'ohayo gozaimasu')).toBe('pass')
  })
  it('ignores spaces and case', () => {
    expect(gradeRomaji('mō ichido onegaishimasu', 'Mo Ichido Onegaishimasu')).toBe('pass')
  })
  it('grades one letter off as close', () => {
    expect(gradeRomaji('sumimasen', 'sumimasan')).toBe('close')
    expect(gradeRomaji('hai', 'haii')).toBe('pass') // doubled vowel folds, not a typo
    expect(gradeRomaji('hai', 'kai')).toBe('close')
  })
  it('misses a different word', () => {
    expect(gradeRomaji('sumimasen', 'konnichiwa')).toBe('miss')
  })
})

describe('tile grading (§4.3)', () => {
  it('passes exact order', () => {
    expect(gradeTiles(['えいごが', 'はなせますか'], ['えいごが', 'はなせますか'])).toBe('pass')
  })
  it('marks a particle slip close, not failed', () => {
    // wa/ga confusion inside a chunk
    expect(gradeTiles(['えいごが', 'はなせますか'], ['えいごは', 'はなせますか'])).toBe('close')
  })
  it('fails wrong order', () => {
    expect(gradeTiles(['えいごが', 'はなせますか'], ['はなせますか', 'えいごが'])).toBe('miss')
  })
  it('fails wrong length', () => {
    expect(gradeTiles(['a', 'b'], ['a'])).toBe('miss')
  })
})

describe('tilesFor', () => {
  it('splits authored phrase chunks on spaces', () => {
    expect(tilesFor('もういちど おねがいします')).toEqual(['もういちど', 'おねがいします'])
  })
  it('falls back to mora pairs for single words', () => {
    const tiles = tilesFor('こんにちは')
    expect(tiles.length).toBeGreaterThanOrEqual(2)
    expect(tiles.join('')).toBe('こんにちは')
  })
  it('preserves the authored spelling — no comparison normalization', () => {
    expect(tilesFor('おはようございます').join('')).toBe('おはようございます')
    expect(tilesFor('チェックイン').join('')).toBe('チェックイン')
  })
})
