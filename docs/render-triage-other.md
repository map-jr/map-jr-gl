# Triage of the other render-test groups

This page gives the cause of each render test that is not a match in the groups `combinations`, `debug`, the six
`hillshade-*` groups, `line-dasharray`, `line-gradient`, `line-pattern`, `regressions`, `sky` and `terrain` (#1739).
It follows the triage of the symbol groups in [render-triage-symbols.md](render-triage-symbols.md) (#1738).

The run used the pinned Chromium (`chromium_headless_shell-1255` of the installed Playwright) on commit `f8c7f16` of
`main` (2026-11-24):

```sh
node test/conformance/render.mjs --list --save=<dir> \
  --filter='^(combinations|terrain|regressions|sky|hillshade-[^/]*|line-pattern|debug|line-dasharray|line-gradient)/'
```

It gave 244 matches of 405 tests, 118 near, 37 that differ and 6 errors. The six errors were time-outs of
`terrain/` tests on a loaded machine. A second run of only those six gave 2 matches, 3 near and 1 that differs, and
the table uses that run, so it has 159 tests. Each test in the table was compared by eye with its expected image,
so no line says "Not inspected".

The column "Action" says what follows. An issue number is a cause that has its own issue; the list below the
table names the causes that this triage found. "label" names a label of
`test/conformance/render-expectations.json`; the section "Labels" says which of these the file already has.

| Test | Result | Cause | Action |
|---|---|---|---|
| `combinations/background-opaque--hillshade-translucent` | near 1.8% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/background-opaque--symbol-translucent` | near 4.7% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/background-translucent--hillshade-translucent` | near 1.9% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/background-translucent--symbol-translucent` | near 4.7% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/circle-translucent--hillshade-translucent` | near 3.3% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/circle-translucent--symbol-translucent` | near 4.8% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/color-relief--hillshade--color-relief--hillshade` | near 1.6% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/color-relief--hillshade--vector-fill--color-relief--hillshade` | near 1.6% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/fill-extrusion-translucent--hillshade-translucent` | near 3.6% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/fill-extrusion-translucent--symbol-translucent` | differ 5.2% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/fill-opaque--fill-extrusion-translucent` | near 1.4% | The edges of the extrusion are a pixel above and to the right of MapLibre's. | #1803 |
| `combinations/fill-opaque--hillshade-translucent` | near 3.1% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/fill-opaque--symbol-translucent` | near 4.8% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/fill-translucent--fill-extrusion-translucent` | near 1.4% | The edges of the extrusion are a pixel above and to the right of MapLibre's. | #1803 |
| `combinations/fill-translucent--hillshade-translucent` | near 3.3% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/fill-translucent--symbol-translucent` | differ 5.2% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/heatmap-translucent--background-opaque` | differ 97.8% | The heatmap is drawn under the opaque layer above it. | label (heatmap over an opaque layer above it, wontfix) |
| `combinations/heatmap-translucent--fill-opaque` | differ 19.9% | The heatmap is drawn under the opaque layer above it. | label (heatmap over an opaque layer above it, wontfix) |
| `combinations/heatmap-translucent--hillshade-translucent` | near 2.2% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/heatmap-translucent--symbol-translucent` | near 4.7% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/hillshade-translucent--circle-translucent` | near 3.2% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/hillshade-translucent--fill-extrusion-translucent` | near 3.7% | The edges of the extrusion are a pixel above and to the right of MapLibre's. | #1803 |
| `combinations/hillshade-translucent--fill-opaque` | near 3.0% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/hillshade-translucent--fill-translucent` | near 3.2% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/hillshade-translucent--hillshade-translucent` | near 3.6% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/hillshade-translucent--line-translucent` | near 3.4% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/hillshade-translucent--symbol-translucent` | differ 8.0% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/line-translucent--hillshade-translucent` | near 3.3% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/line-translucent--symbol-translucent` | near 4.8% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/raster-translucent--hillshade-translucent` | near 2.4% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `combinations/raster-translucent--symbol-translucent` | near 4.7% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--background-translucent` | near 4.3% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--circle-translucent` | near 4.8% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--fill-extrusion-translucent` | near 3.0% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--fill-opaque` | near 2.3% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--fill-translucent` | differ 5.4% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--heatmap-translucent` | near 4.0% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--hillshade-translucent` | differ 6.9% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. Most of the icon is covered by the hillshade layer above it, and the cause of that is not known. | #1774 |
| `combinations/symbol-translucent--line-translucent` | near 4.5% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `combinations/symbol-translucent--symbol-translucent` | differ 5.6% | The icon along the edge of the polygon (`symbol-placement: line`) sits at another point of the line than in MapLibre. | #1774 |
| `debug/collision-horizon-cutoff` | near 1.8% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines-large-font` | near 1.1% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines-overscaled` | near 3.0% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines-pitched-2` | near 1.2% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines-pitched` | differ 8.9% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines-simple-words` | near 2.5% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-lines` | differ 10.4% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-overscaled` | differ 5.6% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-pitched-wrapped` | differ 15.9% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-pitched` | near 1.9% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-variable-anchor/base` | near 3.1% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-variable-anchor/pitched-and-rotated` | near 2.1% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision-variable-anchor/pitched` | near 4.4% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/collision` | differ 20.6% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/overdraw` | differ 96.4% | The debug drawing (overdraw, tile borders) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/ease-to-btm-distort` | differ 5.5% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/ease-to-left-distort` | differ 5.6% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/ease-to-no-distort` | differ 6.0% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/ease-to-right-distort` | differ 5.6% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/ease-to-top-distort` | differ 6.2% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/padding/set-padding` | near 3.8% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/raster` | near 3.0% | The debug drawing (collision boxes and circles, padding lines, tile labels) is not drawn. | label (debug drawing, wontfix) |
| `debug/tile` | differ 12.6% | The debug drawing (overdraw, tile borders) is not drawn. | label (debug drawing, wontfix) |
| `hillshade-accent-color/default` | near 1.8% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-accent-color/literal` | near 1.6% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-accent-color/zoom-function` | near 1.5% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-highlight-color/default` | near 1.8% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-highlight-color/literal` | near 1.9% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-highlight-color/zoom-function` | near 2.3% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-illumination-altitude/basic-0` | near 3.7% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-illumination-altitude/basic-90` | near 1.4% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-maxzoom/default` | near 1.8% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-method/basic` | near 4.7% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `hillshade-shadow-color/default` | near 1.8% | The hillshade differs by a pixel along ridges and at tile edges. | #1802 |
| `line-dasharray/function/line-width-composite-function` | near 3.7% | The ends of the dashes are sharp, where MapLibre softens them over one or more pixels. | #1804 |
| `line-dasharray/literal/line-width-composite-function` | near 2.6% | The ends of the dashes are sharp, where MapLibre softens them over one or more pixels. | #1804 |
| `line-dasharray/literal/line-width-zoom-function` | near 3.9% | The ends of the dashes are sharp, where MapLibre softens them over one or more pixels. | #1804 |
| `line-dasharray/overscaled` | near 1.4% | Some dashed lines are drawn solid. | #1806 |
| `line-dasharray/property-function/cap-default` | differ 5.6% | With a `line-dasharray` for each feature, the dashes of one line are longer than in MapLibre. | #1807 |
| `line-dasharray/round/segments` | near 3.3% | Round dashes have another length and position than in MapLibre. | #1805 |
| `line-dasharray/round/single-dasharray-element` | differ 6.1% | The round caps at the ends of the line are shorter, and the thin lines are lighter. | #1805 |
| `line-dasharray/round/zero-gap-width` | near 3.7% | Round dashes have another length and position than in MapLibre. | #1805 |
| `line-dasharray/slant` | near 3.3% | Some dashed lines are drawn solid. | #1806 |
| `line-dasharray/zero-length-gap` | differ 24.6% | `line-offset` and `line-blur` for each feature are not read. | label (line-offset and line-blur for each feature, later) |
| `line-gradient/gradient-step-zoomed-cross-continental` | near 4.5% | The line is drawn in one color instead of the steps of `line-gradient`. | #1808 |
| `line-gradient/gradient-step-zoomed` | near 4.2% | The steps of `line-gradient` are blended into a smooth gradient. | #1808 |
| `line-gradient/gradient-step` | near 2.2% | Where segments of a `line-gradient` line join, the line is drawn twice, so the joins are darker. | #1809 |
| `line-gradient/translucent` | near 2.5% | Where segments of a `line-gradient` line join, the line is drawn twice, so the joins are darker. | #1809 |
| `line-pattern/@2x` | near 1.4% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/3x-on-2x-add-image` | near 4.0% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/global-state` | near 3.3% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/literal` | near 2.0% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/overscaled` | differ 9.2% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/pitch` | near 3.7% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/property-function` | near 3.3% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/step-curve` | near 3.5% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/with-dasharray` | near 2.0% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `line-pattern/zoom-expression` | near 3.3% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `regressions/mapbox-gl-js#2467` | differ 100.0% | The image is empty halfway through the cross-fade of raster tiles; `raster-fade-duration` has no effect. | #1694 |
| `regressions/mapbox-gl-js#2762` | near 3.2% | The transition of `text-translate` is not drawn: the label is at its final position. | #972 |
| `regressions/mapbox-gl-js#3426` | near 2.2% | The ends of the dashes are sharp, where MapLibre softens them over one or more pixels. | #1804 |
| `regressions/mapbox-gl-js#4172` | near 1.4% | A circle whose `circle-radius` expression divides by zero is not drawn. | #1811 |
| `regressions/mapbox-gl-js#4235` | near 3.4% | The filter `["has", "$id"]` reads a property named `$id` instead of the feature id, so the two colors are swapped. | #1812 |
| `regressions/mapbox-gl-js#4647` | near 2.8% | The collision box of the debug drawing is not drawn. | label (debug drawing, wontfix) |
| `regressions/mapbox-gl-js#4928` | near 1.7% | The colors of an icon at `pixelRatio` 1.1 differ from MapLibre (seen); the cause is not known. | none yet |
| `regressions/mapbox-gl-js#5546` | near 2.6% | The glyphs of the CJK labels along the lines are a pixel off (seen). | none yet |
| `regressions/mapbox-gl-js#6655` | near 3.9% | A `circle-stroke-width` that depends on the feature state is not applied. | label (circle stroke and blur for each feature, later) |
| `regressions/mapbox-gl-js#6919` | near 1.2% | A `line-center` label that MapLibre hides (it has no collision boxes) is drawn. | #1813 |
| `regressions/mapbox-gl-js#8273` | differ 5.7% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `regressions/mapbox-gl-native#11729` | near 2.1% | Khmer text is not shaped: the characters are drawn one after the other. | #1816 |
| `regressions/mapbox-gl-native#7572` | near 3.2% | Only one of the two icons is drawn after `setLayoutProperty` changes `icon-offset` of the second layer. | #1814 |
| `regressions/mapbox-gl-native#8460` | differ 9.1% | A circle with a legacy function of zoom and property (stops at zoom 0 and 0.5) is not drawn at zoom 0.999. | #1815 |
| `regressions/mapbox-gl-native#9976` | near 4.7% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `regressions/mapbox-gl-shaders#37` | near 1.1% | The ends of the dashes are sharp, where MapLibre softens them over one or more pixels. | #1804 |
| `regressions/maplibre-gl-js#7704-pattern` | near 3.6% | The pattern image is sampled sharper than in MapLibre, and on narrow lines it is scaled differently. | #1810 |
| `sky/fog-color/function` | near 1.0% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/fog-color/global-state` | near 1.8% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/fog-ground-blend/default` | near 1.8% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/fog-ground-blend/function` | near 1.8% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/fog-ground-blend/global-state` | near 1.8% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/horizon-color/default` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/horizon-color/function` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/horizon-color/global-state` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/horizon-fog-blend/default` | near 1.8% | The horizon is a pixel lower than in MapLibre, and the fog band along it is shifted with it. | #1817 |
| `sky/roll/roll10` | differ 5.2% | The map has roll. | label (roll, later) |
| `sky/roll/roll180` | differ 77.7% | The map has roll. | label (roll, later) |
| `sky/roll/roll45-with-text` | differ 22.0% | The map has roll. | label (roll, later) |
| `sky/roll/roll90` | differ 55.2% | The map has roll. | label (roll, later) |
| `sky/sky-color/default` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/sky-color/function` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/sky-color/global-state` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/sky-horizon-blend/default` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/sky-horizon-blend/function` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `sky/sky-horizon-blend/global-state` | near 1.6% | The horizon is a pixel lower than in MapLibre. | #1817 |
| `terrain/default` | near 2.4% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/dem-cell-centre-hillshade-peak` | differ 9.0% | The elevation at the center of the map is not taken into account. | label (`field of view and centre elevation`, later) |
| `terrain/field-of-view-number` | near 1.5% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/fill-extrusion-multiple` | near 1.8% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/fill-extrusion-multipolygon` | near 2.5% | One of the three extrusions of a MultiPolygon is drawn as an outline without walls and roof, and another is drawn larger. | #1821 |
| `terrain/fill-extrusion-vertical-gradient-pattern` | near 4.6% | The pattern on the walls of the extrusion differs. | #1444 |
| `terrain/fill-extrusion` | near 1.6% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/fog-no-sky-blend-roll` | differ 69.0% | The map has roll. | label (roll, later) |
| `terrain/fog-sky-blend-globe` | near 2.7% | The atmosphere of the globe is not drawn. | label (atmosphere, later) |
| `terrain/fog-sky-blend-roll` | differ 74.6% | The map has roll. | label (roll, later) |
| `terrain/heatmap` | differ 24.4% | The heatmap on terrain is drawn in other places and is cut off. | #1819 |
| `terrain/image-projective` | near 2.6% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/image` | near 3.7% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/low-zoom` | near 2.1% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/occlusion-debug` | near 4.4% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |
| `terrain/pitched-world` | differ 42.9% | The map at zoom -2.5 with terrain and pitch 60 is empty. | #1820 |
| `terrain/rtt-mipmap-minification/pitch-70` | near 4.1% | The pitch is above 60 degrees. | label (pitch above 60 degrees, later) |
| `terrain/skirts-auto` | differ 15.0% | The terrain surface has spikes, and `terrainSkirtLength` is not read. | #1788 |
| `terrain/skirts-none` | differ 14.2% | The terrain surface has spikes, and `terrainSkirtLength` is not read. | #1788 |
| `terrain/symbol-add-terrain` | near 3.1% | After `setTerrain` is removed and added again, the shading of the hillshade layer differs in one area (seen); the cause is not known. | none yet |
| `terrain/symbol-height-anchor-absolute` | near 1.7% | The pitch is above 60 degrees. | label (pitch above 60 degrees, later) |
| `terrain/symbol-height-anchor-ground` | near 1.7% | The pitch is above 60 degrees. | label (pitch above 60 degrees, later) |
| `terrain/symbol-height-offset-building` | near 1.2% | `symbol-height-offset` is not read. | label (symbol-height-offset, later) |
| `terrain/symbol-height-offset-occluded-ground` | near 2.5% | The pitch is above 60 degrees. | label (pitch above 60 degrees, later) |
| `terrain/tile-stiching` | near 1.2% | Layers on the terrain are a pixel or two off MapLibre's positions, and lines show at some tile edges. | #1818 |

## Causes found by this triage

| Issue | Cause | Tests |
|---|---|---|
| #1802 | The hillshade differs from MapLibre by a pixel along ridges and at tile edges. | 27 |
| #1803 | `fill-extrusion` edges are a pixel above and to the right of MapLibre's at pitch 0. | 3 |
| #1804 | `line-dasharray`: the ends of the dashes are sharp where MapLibre softens them. | 5 |
| #1805 | `line-dasharray` with `line-cap: round`: dashes have another length and position. | 3 |
| #1806 | `line-dasharray`: some dashed lines are drawn solid (`slant`, `overscaled`). | 2 |
| #1807 | `line-dasharray` for each feature gives longer dashes than in MapLibre. | 1 |
| #1808 | `line-gradient` with `step` is blended into a smooth gradient or drawn in one color. | 2 |
| #1809 | `line-gradient`: joins of segments are drawn twice, so they are darker. | 2 |
| #1810 | `line-pattern` is sampled sharper than in MapLibre and scaled differently on narrow lines. | 13 |
| #1811 | A circle whose `circle-radius` expression divides by zero is not drawn. | 1 |
| #1812 | Filter `["has", "$id"]` reads a property named `$id` instead of the feature id. | 1 |
| #1813 | A `line-center` label that MapLibre hides for lack of collision boxes is drawn. | 1 |
| #1814 | After `setLayoutProperty` of `icon-offset`, the icon of the second layer is missing. | 1 |
| #1815 | A legacy zoom-and-property function with stops at zoom 0 and 0.5 draws no circle at zoom 0.999. | 1 |
| #1816 | Khmer text is not shaped: characters are drawn one after the other. | 1 |
| #1817 | The horizon with sky is a pixel lower than in MapLibre. | 15 |
| #1818 | Layers draped on terrain are a pixel or two off MapLibre, with lines at some tile edges. | 9 |
| #1788 | `terrainSkirtLength` is not read, and the terrain surface of `terrain/skirts-*` has spikes that MapLibre does not draw. | 2 |
| #1819 | A heatmap on terrain is drawn in other places and cut off. | 1 |
| #1820 | The map at zoom -2.5 with terrain and pitch 60 is empty. | 1 |
| #1821 | On terrain, one part of a `fill-extrusion` MultiPolygon is drawn as an outline only. | 1 |
These causes were already known and have an issue: #1774 (icons along a line start at other points), #1694
(`raster-fade-duration`), #972 (paint transitions of symbols) and #1444 (`fill-extrusion-pattern` on walls).

Three tests have a difference whose cause is not known: `regressions/mapbox-gl-js#4928`,
`regressions/mapbox-gl-js#5546` and `terrain/symbol-add-terrain`. Their action is "none yet".

## Labels

The file `render-expectations.json` already gives a label to 29 tests of the table: the two
`combinations/heatmap-translucent--*-opaque` tests, 13 `debug/` tests of the label "debug drawing", the six roll
tests of `sky/roll/` and `terrain/fog-*-roll`, `line-dasharray/zero-length-gap`, `terrain/fog-sky-blend-globe`,
`terrain/dem-cell-centre-hillshade-peak`, four `terrain/` tests of "pitch above 60 degrees" and
`terrain/symbol-height-offset-building`.

The other tests that the table gives a label need a change of the file:

- `debug/collision-horizon-cutoff`, `debug/collision-lines-overscaled`, `debug/collision-lines-pitched-2`,
  `debug/collision-lines-simple-words`, `debug/collision-pitched`, the three `debug/collision-variable-anchor/*`
  tests, `debug/padding/set-padding`, `debug/raster` and `regressions/mapbox-gl-js#4647` fit the label "debug
  drawing". That label has the decision `wontfix`, so only the owner can extend it.
- `regressions/mapbox-gl-js#6655` fits the label "circle stroke and blur for each feature" (`later`).
