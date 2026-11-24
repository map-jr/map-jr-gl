# Triage of the globe render tests

This page gives the cause of each render test of the globe (`projection/globe/`) that is not a match (#1740).

## Globe

The run used the pinned Chromium (Playwright's `chromium_headless_shell-1255`) on `main` at `5be3bd2` (2026-11-24):

```sh
node test/conformance/render.mjs --filter='^projection/globe' --list --save=<dir>
```

It gave 80 matches of 127 tests, 38 near and 9 that differ, and it skipped none. The five tests of custom layers
(`custom/tent-3d-globe`, `custom/tent-3d-globe-occlusion`, `custom/tent-3d-globe-zoomed` and the two of them under
`terrain/`) were skipped before #1786, because the run had no `addCustomLayer` operation. They run now.
`custom/tent-3d-globe-zoomed` was a differ (19.5%, the red quad missing) in one run of the whole group and a match in
three other runs, so its result varies with the load of the machine (#1036). Each image that is near or differs was
compared by eye with the expected image and with a mask of the pixels that differ.

The column "Action" says what follows. "Found n" is a cause that needs its own issue (see the list below the table).
"none (near)" is a difference of a pixel at edges, which needs no issue. "none (decision)" is the collision boxes of
`collisionDebug`, which the map does not draw by decision (`docs/reference/maplibre-differences.md`). All tests keep
the label `globe` of `test/conformance/render-expectations.json`, except `symbol-height-offset-tile-retention`, which
has the label `symbol-height-offset` (#1007).

| Test (under `projection/globe/`) | Result | Cause | Action |
|---|---|---|---|
| `circle-planet` | differ 5.4% | Circles with `circle-pitch-alignment: map` are not foreshortened toward the edge of the globe. | Found 4 |
| `collision-text-pitched-rotated` | differ 5.5% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `heatmap` | differ 28.0% | The heatmap is drawn flat and is not projected onto the globe, so the blobs are not foreshortened and reach past the edge of the globe. | Found 3 |
| `image` | differ 10.8% | The image is stretched toward the pole, which is the fault that the test describes. | Found 5 |
| `image-non-parallelogram` | differ 21.7% | The image is placed differently, and the area around the pole is filled with the background color, which MapLibre leaves out. | Found 5 |
| `terrain/circle-planet` | differ 5.4% | Circles with `circle-pitch-alignment: map` are not foreshortened toward the edge of the globe. | Found 4 |
| `terrain/collision-text-pitched-rotated` | differ 5.5% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `terrain/fill-seams/checkerboard` | differ 55.4% | With terrain, the tiles of the checkerboard come from a lower zoom than in MapLibre, so the squares are twice as large. | Found 7 |
| `terrain/heatmap` | differ 28.7% | The heatmap is drawn flat and is not projected onto the globe, so the blobs are not foreshortened and reach past the edge of the globe. | Found 3 |
| `background-pattern` | near 3.6% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `circle-pitch-alignment/map-scale-viewport` | near 1.5% | The edges of the circles with `circle-pitch-alignment: map` are a pixel off. This is the fault of `circle-planet` in a smaller form. | Found 4 |
| `collision-icon-text-translate-map` | near 4.4% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `collision-text-line-equator` | near 1.1% | The labels along the line (`symbol-placement: line`) are not drawn on the globe. The collision boxes are not drawn either, which is a decision. | Found 2 |
| `collision-text-line-pole-to-pole` | near 1.4% | The labels along the line (`symbol-placement: line`) are not drawn on the globe. The collision boxes are not drawn either, which is a decision. | Found 2 |
| `collision-text-point-pole-to-pole` | near 3.1% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `collision-text-variable-anchor/pitched` | near 1.0% | The collision boxes of `collisionDebug` are not drawn, which is a decision. The labels are in place. | none (decision) |
| `custom/tent-3d-globe` | near 4.5% | The custom layer draws the tent at another place and with another shape on the globe. | Found 6 |
| `fill-extrusion` | near 1.8% | The walls near the edge of the globe differ by a pixel. The extrusions are in place. | none (near) |
| `fill-extrusion-translate` | near 4.4% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `fill-planet-pole-top` | near 2.2% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `fill-seams/checkerboard` | near 2.6% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `fill-translate` | near 2.8% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `hillshade` | near 1.3% | Single pixels of the hillshade differ. The relief is in place. | none (near) |
| `icon-text-translate-map` | near 3.5% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |
| `icon-text-translate-viewport` | near 3.5% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |
| `line-translate` | near 1.7% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `symbol-height-offset-tile-retention` | near 3.6% | The icon and the label at a `symbol-height-offset` of 500 km are not drawn above the globe, because `symbol-height-offset` is not read. | #1007 |
| `terrain/circle-pitch-alignment/map-scale-viewport` | near 1.5% | The edges of the circles with `circle-pitch-alignment: map` are a pixel off. This is the fault of `circle-planet` in a smaller form. | Found 4 |
| `terrain/collision-icon-text-translate-map` | near 4.4% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `terrain/collision-text-line-equator` | near 1.1% | The labels along the line (`symbol-placement: line`) are not drawn on the globe. The collision boxes are not drawn either, which is a decision. | Found 2 |
| `terrain/collision-text-line-pole-to-pole` | near 1.4% | The labels along the line (`symbol-placement: line`) are not drawn on the globe. The collision boxes are not drawn either, which is a decision. | Found 2 |
| `terrain/collision-text-point-pole-to-pole` | near 3.1% | `text-translate` and `icon-translate` are not applied on the globe, and the collision boxes of `collisionDebug` are not drawn, which is a decision (`maplibre-differences.md`). | Found 1 |
| `terrain/collision-text-variable-anchor/pitched` | near 1.0% | The collision boxes of `collisionDebug` are not drawn, which is a decision. The labels are in place. | none (decision) |
| `terrain/custom/tent-3d-globe` | near 4.4% | The custom layer draws the tent at another place and with another shape on the globe. | Found 6 |
| `terrain/fill-extrusion` | near 1.8% | The walls near the edge of the globe differ by a pixel. The extrusions are in place. | none (near) |
| `terrain/fill-extrusion-translate` | near 4.4% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `terrain/fill-planet-pole` | near 2.4% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `terrain/fill-planet-tiles` | near 1.0% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `terrain/fill-planet-tiles-no-background` | near 1.0% | The edges of the shapes differ by a pixel. The shapes are in place. | none (near) |
| `terrain/fill-translate` | near 1.8% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `terrain/hillshade` | near 2.0% | Single pixels of the hillshade differ. The relief is in place. | none (near) |
| `terrain/hillshade-sky` | near 2.0% | Single pixels of the hillshade differ. The relief is in place. | none (near) |
| `terrain/icon-text-translate-map` | near 3.5% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |
| `terrain/icon-text-translate-viewport` | near 3.5% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |
| `terrain/line-translate` | near 1.7% | A `*-translate` with either anchor is not applied on the globe, so the translated copies are drawn under the layer that has no translate. | Found 1 |
| `text-pitched-rotated` | near 3.5% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |
| `text-point-pole-to-pole` | near 2.0% | `text-translate` and `icon-translate` are not applied on the globe, so the icons and labels sit at other points. | Found 1 |

## Causes that need their own issue

| Found | Cause |
|---|---|
| 1 | `fill-translate`, `line-translate`, `fill-extrusion-translate`, `icon-translate` and `text-translate` are not applied on the globe, with either anchor. |
| 2 | Labels with `symbol-placement: line` are not drawn on the globe. |
| 3 | The heatmap is drawn flat and is not projected onto the globe. |
| 4 | Circles with `circle-pitch-alignment: map` are not foreshortened toward the edge of the globe. |
| 5 | An image source on the globe is stretched toward the pole, and the area around the pole is filled. |
| 6 | A custom layer draws at another place and with another shape on the globe than in MapLibre. |
| 7 | With terrain on the globe, a vector source uses tiles of a lower zoom than in MapLibre. |
