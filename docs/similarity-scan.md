# Similarity scan

The similarity scan compares the source of Map Jr. GL (`src/`) with the source of the projects that it follows, to
check that it contains no code of those projects without the notice that their licence requires. Run it before a
release and after a change that follows another project. Both tools run on your computer and upload nothing.

## Projects that the scan compares

| Project | Version | Licence | Where the source comes from |
|---|---|---|---|
| MapLibre GL JS | 6.17.0 | BSD-3-Clause | `node_modules/maplibre-gl/src` after `pnpm install` (test files removed) |
| supercluster | 8.0.1 | ISC | `npm pack supercluster@8.0.1`, file `index.js` |
| kdbush | 4.0.2 | ISC | `npm pack kdbush@4.0.2`, file `index.js` (supercluster uses it) |
| maplibre-contour | 0.1.0 | BSD-3-Clause | `npm pack maplibre-contour@0.1.0`, folder `src` and `dist/index.mjs` |

earcut is not compared, because the built files contain it as a library with its notice in `THIRD-PARTY-LICENSES.md`.
`@mapbox/point-geometry` is not compared, because only the names and results of some methods follow it.

## How to run it

Copy the trees into one empty folder outside the repository, so that the paths in the results are short:

```sh
mkdir scan && cd scan
cp -r ../map-jr-gl/src ours
cp -r ../map-jr-gl/node_modules/maplibre-gl/src ml && find ml -name '*.test.ts' -delete
mkdir oth && for p in supercluster@8.0.1 kdbush@4.0.2 maplibre-contour@0.1.0; do npm pack -q $p; done
# unpack each .tgz and copy the files named in the table above into oth/
```

Then run the two tools:

1. **jscpd** finds blocks with the same tokens. Raise its limits, because by default it skips files longer than 1000
   lines, and the largest files of `src/` are longer:

   ```sh
   npx jscpd@4 --min-tokens 25 --min-lines 3 --max-lines 100000 --max-size 10mb --mode weak \
     --format typescript,javascript,css,glsl --ignore '**/*.d.ts' --reporters json --output out ours ml oth
   ```

   Keep only the clones that have one side in `ours/` and the other side in `ml/` or `oth/`.

2. **`scripts/similarity-scan.mjs`** finds runs of tokens that are the same when every name is replaced by one
   token. It finds a copy whose variables were renamed, which jscpd does not find. A run is reported from 40
   tokens (`--k`), which is about two or three lines.

   ```sh
   node ../map-jr-gl/scripts/similarity-scan.mjs ours ml oth --top=25
   ```

Read each reported block next to its source. Decide for each one whether it is a method that `ACKNOWLEDGEMENTS.md`
names, a copy that needs its licence text in `THIRD-PARTY-LICENSES.md` (see "Code and methods from other projects" in
`CLAUDE.md`), or unrelated code that looks the same because the API or the task is the same.

## Result of 2026-11-14

The scan ran on `main` at the time of this document, with 13,411 lines in `src/` and 80,899 lines in the source of
MapLibre GL JS.

- **jscpd** found no clone between `src/` and the other projects at 50 tokens. At 25 tokens it found 2 overlapping
  clones of 4 lines (`src/gl.ts:486-491`, `draw_layer_opacity.ts:49-54` of MapLibre GL JS). They are the four
  `gl.texParameteri` calls that every WebGL program writes to set up a texture.
- **`scripts/similarity-scan.mjs`** found 36 runs of at least 40 tokens. The longest run has 80 tokens, about six
  lines. The largest runs are these:

| Tokens | Map Jr. GL | Other project | Decision |
|---|---|---|---|
| 80 | `src/gl.ts:485-490` | MapLibre `webgl/draw/draw_heatmap.ts:213-218` | Unrelated: the same WebGL calls to set up a texture. |
| 76 | `src/index.ts:3` | MapLibre `index.ts:282-307` | Unrelated: a list of exported names. |
| 67 | `src/engine.ts:149-152` | MapLibre `ui/camera.ts:1453-1456` | Method, acknowledged: the formula of `flyTo` by van Wijk and Nuij. The code is written new (other names, one function for both cases). |
| 64 | `src/vue.ts:148-150` | MapLibre `util/dom.ts:11-13` | Unrelated: the same DOM calls with other names. |
| 57 | `src/lnglat.ts:14-16` | MapLibre `geo/lng_lat.ts:136-139` | Unrelated: `distanceTo` uses the spherical law of cosines, a public formula, with the mean radius of the Earth (6371008.8 m). |
| 57 | `src/vue.ts:10-15` | MapLibre `webgl/context.ts:9-15` | Unrelated: a list of imported names. |
| 53 | `src/vue.ts:320-321` | MapLibre `render/image_manager.ts:320-329` | Unrelated: a chain of short conditions. |
| 50 | `src/gl.ts:1298-1300` | MapLibre `webgl/draw/draw_layer_opacity.ts:52-54` | Unrelated: the same WebGL calls to set up a texture. |
| 45 | `src/overlays.ts:196-198` | maplibre-contour `src/types.ts:31-59` | Unrelated: type declarations of option objects. The form of `thresholds` is acknowledged. |
| 43 | `src/map.ts:1755-1758` | MapLibre `util/image.ts:160-163` | Unrelated: a loop that premultiplies alpha, with a different formula. |

No block is a copy of code. No change to `ACKNOWLEDGEMENTS.md` or `THIRD-PARTY-LICENSES.md` was needed. The CSS that
the compat entry copies from `maplibre-gl.css` (the rule for pseudo fullscreen and the hint of
`cooperativeGestures`) is acknowledged, and its licence text is in `THIRD-PARTY-LICENSES.md`. The scan compares code
and does not prove the absence of a copy that was rewritten line by line.
