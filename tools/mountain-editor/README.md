# Mountain editor

A small standalone viewer/editor for the Path page's 3D mountain
(`apps/web/src/components/PathScene3D.tsx`, `buildMountain`). The mountain is
generated, not modelled, so this tool regenerates the exact same mesh, lets you
make hand adjustments, and saves them as a **patch** that Michi applies on top
of the generator at runtime.

## Running it

Three.js is resolved from `apps/web/node_modules` (run `npm install` there
once if you haven't), so serve from the **repo root**:

```
python3 -m http.server 8102          # from the repo root
```

then open http://localhost:8102/tools/mountain-editor/ in a browser. Do not
take 5173/8000 (Mishka Hub) or 8100 (production Michi API).

## What it can do

- **Delete an edge** — edge mode, click near an edge, press ⌫ (removes the
  faces sharing it).
- **Bridge two edges** — edge mode, click one edge, shift-click another,
  "Bridge edges" (fills a quad between them; "Flip bridge" if the new faces
  render dark/invisible — Michi front-face culls, so winding matters).
- **Split a vertex from a corner** — vertex mode, select the vertex, "Split
  from corner", then click the corner face(s) to peel onto the duplicate,
  "Finish", and drag the new vertex apart.
- **Move a vertex** — drag its gold marker (moves in the camera plane) or type
  exact coordinates.
- **Recolour a vertex** — pick a colour, then "Paint vertex" (blends across
  the touching faces) or "Paint touching faces" (solid facets).
- **Reshape the silhouette** — vertex mode, select a vertex to set the height
  line, then "Move points below" pushes every vertex at or below that height
  out from the centre (negative amounts pull in). "Equal" shifts the whole
  skirt uniformly; "tapered" scales the move from full at the base to zero at
  the line, which changes the slope angle — the safe equivalent of retuning
  the spiral constants. (Changing `SPIRAL_A`/`SPIRAL_B` themselves would move
  the trail, and the lesson stones, torii, camera and scenery all place
  themselves from that spiral — do not go that way.) Keep moves on trail
  loops modest: the shelf is part of the mesh but Michi's lesson stones keep
  their generated spots, so a big flare strands them. A whole-mountain
  reshape records a move for most vertices and makes the patch a few hundred
  KB — fine, it gzips well in the build.
- Undo (⌘Z), wireframe/double-sided/reference toggles, save/load.

## Getting edits into Michi

"Save patch" downloads `mountainPatch.json`. Drop it over
`apps/web/src/mountainPatch.json` and rebuild — done. An identity patch (no
edits) is committed there by default.

## How the patch works (and its one caveat)

Baking the whole mesh would freeze its colours, but Michi paints the mountain
live from the Aizome theme tokens (light *and* dark). So the patch stores only
the diff: corner moves and face deletions/additions by face index, plus your
explicit recolours as absolute values. Untouched faces stay fully procedural
and theme-aware; moved faces are even re-banded by their new altitude.

The caveat: face indices are only meaningful for the generator build they were
saved against. The editor embeds a verbatim port of `buildMountain` ("round
ten") and stamps `baseFaceCount` into the patch; if the generator in
`PathScene3D.tsx` ever changes shape, Michi notices the mismatch, warns on the
console and ignores the patch — re-port the generator into `index.html` here
and redo the edits (or reload the old patch and fix up what moved).

Small print: the editor bakes its display colours with the light palette, so
what you see is the light theme; recolours you paint are absolute and will
look the same in dark mode. A reloaded patch shows split/added faces as
independent triangles (unwelded) — geometry is unchanged, they just select
separately.
