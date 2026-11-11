# Decisions for review

This document lists decisions that were made without the owner, for a later review. Each entry says what was
decided, why, and how to change it.

## Size budgets

| Decision | Reason | To change it |
|---|---|---|
| The size check now measures what a page downloads before the map can start: `map-jr-gl.js` and the files that it imports when it loads. Before, it measured `map-jr-gl.js` alone, which hid two more files. | The check found that the page loaded the expression compiler and the text shaper, which only the engine needs. They are now out of the page script: it went from 33.8 KB to about 26 KB (gzip), with all of today's additions (events, handlers, `LngLat`, `transformRequest`, `addProtocol`, box zoom, context recovery). The budget is 27 KB. | Change the budgets in `scripts/size-check.mjs`. |
| The engine for the main thread (loaded only when no worker can start) has a budget of 53 KB. | It now contains the expression compiler and the shaper that the page script no longer has. The total for a map on the main thread is the same as before. | |

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
