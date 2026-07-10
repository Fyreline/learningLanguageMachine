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
- **Recolour a vertex** — pick a paint role from the swatches (the
  mountain's own colours: grass, light grass, rock, snow, dirt, water,
  cave ink — plus light/mid/dark grey), then "Paint vertex" (blends across
  the touching faces) or "Paint touching faces" (solid facets). The patch
  stores the role name, not the colour, and Michi resolves it from the
  live palette — so painted spots follow light/dark mode like everything
  else. There is deliberately no free colour picker.
- **Reshape the silhouette (mesh-only)** — vertex mode, select a vertex to
  set the height line, then "Move points below" pushes every vertex at or
  below that height out from the centre (negative amounts pull in). "Equal"
  shifts the whole skirt uniformly; "tapered" scales the move from full at
  the base to zero at the line. Keep moves on trail loops modest: this moves
  the mesh only, so Michi's lesson stones keep their generated spots and a
  big flare strands them. A whole-mountain reshape records a move for most
  vertices and makes the patch a few hundred KB — fine, it gzips well.
- **Reshape the spiral itself** — the Shape panel: base radius, top radius
  and height. Unlike the mesh-only tool this re-solves the actual trail
  spiral, and because everything in `PathScene3D` derives from it, the
  lesson stones, torii, camera orbit, walkway, bridges and scenery rings all
  follow in Michi. Same trailhead-to-summit journey, different proportions:
  widen the base or shrink the top and the sides slope more. The panel shows
  the per-turn shrink live — the staircase stays overhang-free above 3.05
  per turn (lip + wall + jitter margin) and both the editor and Michi clamp
  below that, so you cannot reintroduce overhangs above the path. Applying a
  shape carries vertex moves across as offsets from the regenerated base;
  added/bridged/split faces keep their absolute spots (they may need
  redoing), and the undo history clears.
- **Preview and tune Michi's camera** — the Camera panel runs the exact
  CameraRig formula from `PathScene3D` (distance clamp, height, look-ahead
  bias, look-at height): tick "preview Michi's camera" and scrub the walk
  slider to ride the trail as the app frames it, with whatever shape you
  have applied. The five tuning values export in the patch and Michi's
  camera reads them at load.
- **Place the scenery** — scenery mode. Every decorative object Michi
  renders (pines, sakuras, rocks, lanterns, bridges, houses, the onsen, the
  train's tunnel foothill, the pond) is here with a stable id: click to
  select, drag to move (the object follows the terrain under the pointer),
  type exact x/y/z, rotation in degrees, and scale, ⌫ removes. "Add object"
  drops any kind — including extra torii — at the camera's focus. The
  "scenery objects" View tick hides or shows the whole layer while you work
  on the mesh. Not placeable: lesson stones, checkpoint torii and the
  kitsune (the curriculum owns their spots — checkpoint gates mark specific
  lessons), and the summit gate, which shows as a reference. Scenery edits
  export as remove/move/add by id in the patch's scenery section; base ids
  re-place themselves when the shape changes, while moved/added items keep
  their absolute spots.
- **Variant kinds** — beyond the stock set, the add dropdown carries add-in
  variants with no procedural placements of their own: weathered, fallen
  and broken torii; cedar, snowy pine, maple, bamboo and dead trees; a
  wayside shrine and a stone lantern (which glows at night in Michi, like
  the trail lanterns). "Swap selected to this kind" replaces any object
  in place, keeping its position, rotation and scale — handy for turning a
  procedural pine into a maple, or the odd trail torii spot into a ruin.
- Undo (⌘Z), wireframe/double-sided/reference toggles, save/load.

## Getting edits into Michi

"Save patch" downloads `mountainPatch.json`. Drop it over
`apps/web/src/mountainPatch.json` and rebuild — done. An identity patch (no
edits) is committed there by default.

## How the patch works (and its one caveat)

Baking the whole mesh would freeze its colours, but Michi paints the mountain
live from the Aizome theme tokens (light *and* dark). So the patch stores only
the diff: corner moves and face deletions/additions by face index, plus your
recolours as named paint roles that re-resolve from the palette per theme.
Untouched faces stay fully procedural and theme-aware; moved faces are even
re-banded by their new altitude. (Patches saved before the role system, with
absolute rgb recolours, still load — the editor maps them to the nearest
role on load, and Michi applies them as-is, fixed across themes.)

The caveat: face indices are only meaningful for the generator build they were
saved against. The editor embeds a verbatim port of `buildMountain` ("round
ten") and stamps `baseFaceCount` into the patch; if the generator in
`PathScene3D.tsx` ever changes shape, Michi notices the mismatch, warns on the
console and ignores the patch — re-port the generator into `index.html` here
and redo the edits (or reload the old patch and fix up what moved).

Small print: the editor bakes its display colours with the light palette, so
what you see is the light theme; in Michi's dark mode both the procedural
paint and your role recolours re-resolve from the dark tokens. A reloaded
patch shows split/added faces as independent triangles (unwelded) — geometry
is unchanged, they just select separately.
