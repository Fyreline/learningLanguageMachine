# CineGrade — the looks

Contact sheets for every preset on every test frame are committed under
[`tests/output/`](../tests/output/) (`sheet_<map>.png`: original top-left,
then each preset at 100 % strength with auto exposure on). Regenerate with
`python3 reference/run_tests.py`.

The test frames are procedural CS2-palette stand-ins (see README note) —
run `reference/grade_cli.py --all` on your own captures for the real
picture.

---

### '80s Analog (`eighties_analog`)
Calibrated against a real late-70s/80s NYC street-photography film frame
(measured: blacks lifted to ~0.04, highlights rolled off by 0.91, mean
saturation ~0.15, strong fine grain ≈0.03 hf-std, cool shadows / neutral-warm
mids). Muted, soft, nostalgic; heavy grain, gentle halation, diffusion,
gate weave and flicker on. The one for tape-era frag movies.

### Wes Pastel (`wes_pastel`)
Flat-ish contrast with lifted exposure, storybook pastels, **rich golden
yellows** (+34 yellow band sat, warm highlight split-tone), minty teals,
crisp detail, faint grain, tidy symmetric vignette. Best on Mirage/Inferno
daylight; sits beautifully on static locked-off comps.

### Blockbuster (`blockbuster`)
Modern teal & orange: teal shadows, warm mids, punchy filmic contrast with
protected highlights, subtle glow, clean grain. The safe crowd-pleaser for
highlight reels.

### Kodachrome 64 (`kodachrome`)
Reversal stock: dense blacks (toe 30), saturated primaries — reds
especially (+26) — warm cast, tight moderate grain, zero diffusion. Punchy
and vintage without being soft.

### Bleach Noir (`bleach_noir`)
Bleach bypass: saturation cut to ~46 %, hard contrast, silver retained
highlights, cold steel cast, coarse gritty grain (size 1.15), strong
vignette. Train, Nuke interiors, anything grim.

### Neon Night (`neon_night`)
For night maps: lifted cool shadows (keeps readability), cyan/magenta
split, heavy bloom + halation around practicals, blue-shifted chromatic
aberration. Filmic night-city, not synthwave.

### Arrakis 65 (`arrakis_65`)
Dune: Part Three inspired. Linus Sandgren shot it on Kodak 65mm — his
signature Technicolor-dye-transfer sensibility applied to the desert:
golden amber sands (+temperature, +24 red / +18 yellow band sat), rich
colour separation, dense cool-leaning blacks against warm light, creamy
protected highlights, **very fine** large-format grain, restrained
halation. Made for Dust2 / Mirage / Anubis.

### Eterna Soft (`eterna_soft`)
Fujifilm Eterna-style documentary baseline: gentle contrast, muted true
colours, creamy rolloff, light grain. The default — makes raw CS2
immediately filmic without imposing an opinion. Start here, then trim in
Advanced.

---

## Designing your own

1. Duplicate an entry in `presets/presets.json` (all keys optional —
   unspecified values fall back to `neutral`).
2. Iterate with the CLI: `python3 reference/grade_cli.py shot.png -p my_look`.
3. `python3 tools/gen_presets_header.py` to bake it into the plugin, then
   rebuild — it appears in the Film Preset popup automatically.
   (Append new presets at the END of the list: popup indices are saved in
   AE projects.)
