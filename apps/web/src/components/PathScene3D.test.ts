// The mountain patch pipeline: hand edits from tools/mountain-editor are a
// diff (by face index) applied on top of the generator. These tests pin the
// application order — moves before the paint pass, recolours after it,
// deletions/additions last — and the wrong-build guard.
import { describe, expect, it } from 'vitest'
import { buildMountain } from './PathScene3D'

const pal = {
  paper: '#f7fbfa',
  ink: '#17293a',
  clay: '#c33c54',
  olive: '#2e8b74',
  kraft: '#d08770',
  cloud: '#90a5ab',
  trail: '#c5e0dd',
  trailDone: '#2e8b74',
  liquid: '#c5e0dd',
  gold: '#e8b84b',
}

const identity = {
  version: 1,
  baseFaceCount: null,
  movedCorners: [],
  recoloredCorners: [],
  deletedFaces: [],
  addedFaces: [],
}

describe('buildMountain patch application', () => {
  const base = buildMountain(pal, identity)
  const basePos = base.getAttribute('position')
  const baseFaces = basePos.count / 3

  it('generates a stable non-indexed soup', () => {
    expect(Number.isInteger(baseFaces)).toBe(true)
    expect(baseFaces).toBeGreaterThan(1000)
  })

  it('applies moves, recolours, deletions and additions in order', () => {
    const added = {
      positions: [0, 30, 0, 1, 30, 0, 0, 30, 1],
      colors: [1, 0, 0, 1, 0, 0, 1, 0, 0],
    }
    const geo = buildMountain(pal, {
      version: 1,
      baseFaceCount: baseFaces,
      movedCorners: [[0, 1.5, 2.5, 3.5]],
      recoloredCorners: [[1, 0.1, 0.2, 0.3]],
      deletedFaces: [5],
      addedFaces: [added],
    })
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')

    // one deleted, one added
    expect(pos.count).toBe(basePos.count)
    // corner 0 moved
    expect(pos.getX(0)).toBeCloseTo(1.5, 5)
    expect(pos.getY(0)).toBeCloseTo(2.5, 5)
    expect(pos.getZ(0)).toBeCloseTo(3.5, 5)
    // corner 1 recoloured absolutely
    expect(col.getX(1)).toBeCloseTo(0.1, 5)
    expect(col.getY(1)).toBeCloseTo(0.2, 5)
    expect(col.getZ(1)).toBeCloseTo(0.3, 5)
    // face 5 gone: its slot now holds what was face 6
    for (let k = 0; k < 3; k++) {
      expect(pos.getX(15 + k)).toBeCloseTo(basePos.getX(18 + k), 5)
      expect(pos.getY(15 + k)).toBeCloseTo(basePos.getY(18 + k), 5)
    }
    // the added face sits at the end, verbatim
    const last = pos.count - 3
    expect(pos.getY(last)).toBeCloseTo(30, 5)
    expect(col.getX(last)).toBeCloseTo(1, 5)
    expect(col.getY(last)).toBeCloseTo(0, 5)
  })

  it('ignores a patch saved against a different mountain build', () => {
    const geo = buildMountain(pal, {
      version: 1,
      baseFaceCount: baseFaces + 1,
      movedCorners: [[0, 9, 9, 9]],
      recoloredCorners: [],
      deletedFaces: [0],
      addedFaces: [],
    })
    const pos = geo.getAttribute('position')
    expect(pos.count).toBe(basePos.count)
    expect(pos.getX(0)).toBeCloseTo(basePos.getX(0), 5)
  })
})
