// The mountain patch pipeline: hand edits from tools/mountain-editor are a
// diff (by face index) applied on top of the generator. These tests pin the
// application order — moves before the paint pass, recolours after it,
// deletions/additions last — and the wrong-build guard.
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyScenery, buildMountain } from './PathScene3D'

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

  it('recolours by paint role, re-resolving from the palette per theme', () => {
    const patch = {
      version: 2,
      baseFaceCount: baseFaces,
      movedCorners: [],
      recoloredCorners: [[0, 'snow'], [1, 'grass']] as [number, string][],
      deletedFaces: [],
      addedFaces: [
        {
          positions: [0, 30, 0, 1, 30, 0, 0, 30, 1],
          colors: [0.5, 0.5, 0.5, 0.25, 0.25, 0.25, 0.5, 0.5, 0.5],
          roles: ['water', null, 'grey'],
        },
      ],
    }
    const light = buildMountain(pal, patch)
    const lightCol = light.getAttribute('color')
    // snow is a fixed hex; grass is the palette's olive
    const snow = new THREE.Color('#f3f6f5')
    const grass = new THREE.Color(pal.olive)
    expect(lightCol.getX(0)).toBeCloseTo(snow.r, 4)
    expect(lightCol.getY(1)).toBeCloseTo(grass.g, 4)
    // added face: corner 0 takes the water role, corner 1 keeps its
    // absolute colour, corner 2 takes the grey role (the cloud token)
    const last = lightCol.count - 3
    expect(lightCol.getX(last)).toBeCloseTo(new THREE.Color(pal.liquid).r, 4)
    expect(lightCol.getX(last + 1)).toBeCloseTo(0.25, 4)
    expect(lightCol.getX(last + 2)).toBeCloseTo(new THREE.Color(pal.cloud).r, 4)

    // dark theme: same patch, different palette → grass corner re-themes
    const darkPal = { ...pal, olive: '#5fcfae', cloud: '#6d8794' }
    const dark = buildMountain(darkPal, patch)
    const darkCol = dark.getAttribute('color')
    expect(darkCol.getY(1)).toBeCloseTo(new THREE.Color('#5fcfae').g, 4)
    expect(darkCol.getY(1)).not.toBeCloseTo(grass.g, 4)
    // while snow (fixed) stays put
    expect(darkCol.getX(0)).toBeCloseTo(snow.r, 4)
  })

  it('removes, moves and adds scenery items', () => {
    const base = [
      { id: 'pine-0', kind: 'pine', x: 1, y: 0, z: 0, angle: 0, scale: 1 },
      { id: 'house-0', kind: 'house', x: 2, y: 0, z: 0, angle: 0.5, scale: 1, variant: 1 },
    ] as Parameters<typeof applyScenery>[0]
    const out = applyScenery(base, {
      removed: ['pine-0'],
      moved: [{ id: 'house-0', x: 3, y: 1, z: 2, angle: 1.2, scale: 2 }],
      added: [{ kind: 'torii', x: 9, y: 0, z: 9, angle: 0.4, scale: 1.5 }],
    })
    expect(out.map((i) => i.id)).toEqual(['house-0', 'add-0'])
    expect(out[0]).toMatchObject({ x: 3, y: 1, z: 2, angle: 1.2, scale: 2, variant: 1 })
    expect(out[1]).toMatchObject({ kind: 'torii', x: 9, scale: 1.5 })
    // and with no scenery patch, untouched
    expect(applyScenery(base, undefined)).toBe(base)
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
