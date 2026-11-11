# Decisions for review

This document lists decisions that were made without the owner, for a later review. Each entry says what was
decided, why, and how to change it.

## Size budgets

| Decision | Reason | To change it |
|---|---|---|
| The size check now measures what a page downloads before the map can start: `map-jr-gl.js` and the files that it imports when it loads. Before, it measured `map-jr-gl.js` alone, which hid two more files. | The check found that the page loaded the expression compiler and the text shaper, which only the engine needs. They are now out of the page script: it went from 33.8 KB to about 26 KB (gzip), with all of today's additions (events, handlers, `LngLat`, `transformRequest`, `addProtocol`, box zoom, context recovery). The budget is 27 KB. | Change the budgets in `scripts/size-check.mjs`. |
| The budget of the page script went from 27 KB to 27.5 KB; the file set is 27.1 KB. | `queryRenderedFeatures` now also gives a result at once for GeoJSON sources (see below). The code that the page needs for this at once is small; the larger part is loaded only when a style has a GeoJSON source with its data in the style. | |
| The engine for the main thread (loaded only when no worker can start) has a budget of 54 KB. | It now contains the expression compiler and the shaper that the page script no longer has. The total for a map on the main thread is the same as before. | |

## `queryRenderedFeatures` gives two kinds of result

`map.queryRenderedFeatures(...)` returns an array that can also be awaited.

- Used at once as an array, it has the features of the GeoJSON sources whose data is in the style. The page can
  read these itself. It does not have the features of tile sources.
- Awaited (`await map.queryRenderedFeatures(...)`), it has the complete result from all sources.

The reason: `@mapbox/mapbox-gl-draw` and similar plugins use the result at once and query only their own GeoJSON
sources. With this, mapbox-gl-draw works without changes. The risk: code that uses the result at once for a tile
source gets an empty array and no error. The document on compatibility tells users to add `await`.

To change it: `queryRenderedFeatures` in `src/map.ts`, and `src/sync-query.ts`.

## Features that are not in the library

These were left out because of their size or their complexity. The audit in [Plugins and frameworks](ecosystem.md)
shows how many of the audited packages use each one.

| Feature | Used by | Why it is not there |
|---|---|---|
| Globe and other projections (`setProjection`, `GlobeControl`) | 6 packages call `setProjection` | A second projection changes almost every shader and the tile cover. It is the largest missing feature. Most packages call it only when the user asks for a globe. |
| Sky and fog (`setSky`, `getSky`) | 3 packages | The largest pitch is 60 degrees, so the horizon is not in view. |
| Box zoom (shift and drag) | 1 package listens for its events | `map.boxZoom` is there and stays off. The gesture itself is small; it was not a priority. |
| `setTransformCameraUpdate`, `setTransformConstrain` | 3 packages (the React and Svelte wrappers, for controlled camera state) | The camera is in the engine, which can be in a worker. A function on the page cannot run for each camera change without a delay. |
| `setRenderWorldCopies(false)` | 4 packages pass the option through | The map always draws the copies of the world. |
| Source classes (`GeoJSONSource`, `VectorTileSource` and others) and event classes as exports | 1 to 3 packages each | Most uses are type checks. `getSource()` returns a plain object with the methods of the source. |
| Opt-in features (a smaller worker without 3D terrain, contours and others) | | Discussed with the owner: not wanted unless features can be selected with imports or configuration in a build. That needs the features as separate registered modules, which is a large change. |

## A proposal: methods that are accepted but have no effect

The nine audited packages that still use missing API are framework wrappers (for React, Vue, Svelte, Angular) and
two others. They call methods such as `setProjection`, `setSky`, `setRenderWorldCopies`, `setZoomSnap`,
`setTransformCameraUpdate` and `setRoll`, usually only when the application sets the related option.

A possible change: add these methods so that they accept the default value silently and write one warning for a
value that the library cannot do (a globe, a sky, a roll). A wrapper then does not stop with an error.

- For: more applications start without changes.
- Against: about 0.4 KB in the page script, which is at its budget; and the count of available methods then
  includes methods that do nothing, so the documents must list them apart.

This was not done. It is a decision for the owner.

## Findings from the cross-browser runs

The workflow `Browsers` runs the benchmark and the behaviour tests in Chromium, Firefox and WebKit on Linux, macOS
and Windows. Its results are on the branch `bench-results`. These points are for the owner to know:

| Finding | State |
|---|---|
| 3D terrain was slower in a worker than on the main thread in each browser, and slower than MapLibre GL JS in WebKit (the engine of Safari). This agrees with what the owner saw on an iPhone. | The causes were work on the CPU for each frame (mesh heights, the source tiles of each ground tile) and ground textures that were made again while the map turned. They are corrected. The next runs show the new numbers. |
| WebKit did not load web fonts inside a worker, so labels used a fallback font. | Corrected: the engine fetches the font file and gives the browser its bytes. |
| Elevation tiles are decoded in tile workers with `OffscreenCanvas`. Safari before version 16.4 (March 2023) does not have it in workers. | Not changed. Terrain, relief shading and contours do not work there (they did not before, for the same reason). The library has its own PNG and WebP decoders for the server; to use them in the browser adds about 2.5 KB to the worker. |
| In WebKit, the test of wheel zoom finds the place under the pointer some hundred pixels away after the zoom. The wheel event itself has the correct position. | Open. It was not seen in Chromium or in Firefox. It needs a look in Safari on a Mac: zoom with a mouse wheel and see if the place under the pointer stays. |
| Firefox without a window draws about 3 frames each second on the page's thread (MapLibre GL JS also), so its tests timed out. | The workflow now runs Firefox with a window. In a worker the library draws 60 frames each second in Firefox. |
| WebKit on Linux and Windows cannot draw WebGL in a worker. | The library uses the main thread there, as designed. Safari on macOS and iOS can. |
