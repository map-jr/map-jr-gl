# Decisions for review

This document lists decisions that were made without the owner, for a later review. Each entry says what was
decided, why, and how to change it.

## Size budgets

| Decision | Reason | To change it |
|---|---|---|
| The budget of the page script (`map-jr-gl.js`) went from 19 KB to 20 KB (gzip). The file is 19.4 KB. | Plugins and framework wrappers for MapLibre need these parts of the API, which are all in the page script: the pointer and touch events with `preventDefault()`, the interaction handlers (`map.dragPan` and others), `LngLat` and `LngLatBounds`, `transformRequest` and `addProtocol`. Together they are about 1.9 KB. With them, 14 and later more of the 26 audited packages find the API that they use ([Plugins and frameworks](ecosystem.md)). | Change `BUDGET_KB` in `scripts/size-check.mjs`. |

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
