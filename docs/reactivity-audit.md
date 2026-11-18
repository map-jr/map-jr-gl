# Audit of updates at a high rate, 2026-11-17

This audit measures how the main API (`@map-jr/map-jr-gl`) and the Vue adapter (`@map-jr/map-jr-gl/vue`) handle
descriptions that change many times a second, and compares them with MapLibre GL JS 6.17 doing the same work with its
own methods. It also compares the model of the description with the methods of other wrappers. The script is
`test/bench/reactivity.mjs`.

## Results in short

| Finding | Evidence | Issue |
|---|---|---|
| The worker renderer draws no frame while a source of 10,000 points gets new data 60 times a second. It draws 11 to 12 frames of 60 at 30 a second, and draws normally at 10 a second. | ran | #856 |
| `setData` writes the GeoJSON of `data` into the app's `sources` object, so the next description with the same content reloads the style. | ran | #857 |
| A changed `style` object reloads the whole style, also for one filter or paint value. A reactive `mapStyle` in Vue takes the same path. | ran | #858 |
| A new order of the layers in `layers` reloads the whole style. | read | #859 |
| The main API has no GeoJSON diff (MapLibre's `updateData`). | measured, needs the owner | #860 |

In the other scenarios the main API costs the page about as much as MapLibre GL JS, or less:

- The page script of one `update()` stays under 1 ms in every scenario but one (the reactive Vue style, 1.9 ms).
- With the worker renderer the page has no long tasks, while MapLibre GL JS blocks the page for 6 to 14 s in each
  run on the software GPU.
- A framework that makes the description again with the same content costs 0.1 ms an update when the style object
  keeps its identity, and 0.4 to 0.6 ms with a new style object of 111 layers. MapLibre's `setStyle` with `diff` costs
  2.1 to 4.1 ms for the same work.

## How it was measured

`node test/bench/reactivity.mjs` (the demo server must run) drives one change per animation frame, or one in every
few frames, in headless Chromium on an Apple laptop without a GPU for the browser (WebGL in software), with the
liberty style of OpenFreeMap (111 layers). `RENDERER=main` makes the main API draw on the main thread, as MapLibre GL
JS does. Each arm runs in a new page. The columns:

| Column | Meaning |
|---|---|
| call | Median page script of one step, in ms. |
| long | Total of long tasks (50 ms or more) during the run, in ms. |
| drawn | Frames that the map drew during the run, against the number of steps. |
| settle | Time from the last step until the map is idle, in ms. |

The frame times of a software GPU are only relative. The call times are CPU work on the page and compare well between
the arms. The benchmark does not measure the CPU of the workers.

## Measurements

One run each, except where three runs are given. `jr` is the main API, `ml` is MapLibre GL JS with its own methods.

| Scenario | Arm | call (worker) | drawn (worker) | call (main thread) | drawn (main thread) | long (main thread) |
|---|---|---|---|---|---|---|
| 1,000 points, new data in each frame | jr | 0.10 | 39/180 | 0.10 | 178/180 | 11,781 |
| | ml | 0.00 | 178/180 | | | 12,507 |
| 10,000 points, new data in every frame | jr | 0.00 | 0/60, 1/60 | 0.00 | 59/60 | 6,117 |
| | ml | 0.00 | 56/60, 57/60 | | | 6,356 |
| 10,000 points, new data in every 2nd frame | jr | 0.00 | 12/60, 11/60 | | | |
| | ml | 0.00 | 116/60 | | | |
| 10,000 points, new data in every 6th frame | jr | 0.00 | 41/40 | 0.00 | 132/40 | 12,389 |
| | ml | 0.00 | 78/40 | | | 7,878 |
| One of 10,000 points moves in each frame | jr (new collection) | 0.00 | 1/120 (three runs) | 0.00 | 119/120 | 10,274 |
| | ml (`updateData`) | 0.00 | 118/120 | | | 8,663 |
| The app moves the camera in each frame | jr (`view`) | 0.00 | 35/180 | 0.00 | 180/180 | 17,674 |
| | ml (`jumpTo`) | 0.10 | 179/180 | | | 12,658 |
| A paint value of an added layer in each frame | jr (`layers`) | 0.00 | 47/180 | 0.00 | 94/180 | 6,316 |
| | ml (`setPaintProperty`) | 0.00 | 179/180 | | | 13,676 |
| A filter of a layer of the style, every 3rd frame | jr (new `style`) | 0.40 | 9 to 13/40, 26 style loads | 0.90 | 5/40 | 637 |
| | jr (`globalState`) | 0.00 | 11 to 13/40 | 0.00 | 103/40 | 11,299 |
| | ml (`setFilter`) | 0.20 | 115/40 | | | 10,137 |
| | ml (`setStyle`, `diff`) | 1.70 to 2.50 | 116/40 | | | 9,295 |
| The description made again, same content | jr (same style object) | 0.10 | | 0.10 | | |
| | jr (new style object) | 0.40 | | 0.60 | | |
| | ml (`setStyle`, `diff`) | 2.10 | | 4.10 | | |
| 200 overlays move in each frame | jr | 0.40 | | 0.50 | | |
| | ml (`Marker`) | 0.30 | | 0.60 | | |
| `global-state` in each frame | jr | 0.00 | 28/180 | 0.00 | 178/180 | 13,162 |
| | ml | 0.30 | 179/180 | | | 13,448 |
| Feature state of 50 points in each frame | jr | 0.20 | 21/120 | 0.70 | 120/120 | 8,404 |
| | ml | 0.00 | 119/120 | | | 7,493 |
| Vue: a paint value of a reactive `mapStyle`, every 3rd frame | `ref` style | 1.90 (three runs) | 27 to 29 style loads | 1.60 | 43/40 | 3,335 |
| | `layers` prop | 0.30 | 17 to 28/40 | 0.30 | 52/40 | 3,686 |
| | ml | 0.00 | 117/40 | | | 7,154 |
| Vue: 1,000 points in each frame | `ref` | 0.40 | 17 to 23/120 | 1.10 | 119/120 | 10,571 |
| | `shallowRef` | 0.50 to 0.80, one style load (#857) | 6 to 19/120 | 1.20 | 109/120 | 8,552 |
| Vue: `v-model:view` while the map moves | `v-model` | 0.00 | 20/120 | 0.00 | 119/120 | 9,142 |

Two maps where map B follows map A through `onViewChange`: with the worker renderer, B showed the view of the frame
before in 29 of 120 frames. MapLibre GL JS on the main thread kept B on the same frame in all 120. The view of the
worker renderer reaches the page one frame late, so a map that follows it is one more frame behind.

The cost of the comparison itself, measured in Node on the same machine:

| Comparison | ms |
|---|---|
| `JSON.stringify` of two liberty styles of the same content | 0.6 to 1.1 |
| Vue's deep copy (`plain`) of the liberty style | 0.4 |
| `JSON.stringify` of `sources` with 10,000 features inline | 7.8 |
| Vue's deep copy of the same | 12.2 |
| `JSON.stringify` of 50 added layers | 0.03 |

So GeoJSON belongs in `data`, as the documentation says: inline in `sources` it costs 20 ms an update in Vue, and a
change reloads the style.

## The model compared with other projects

| Project | How it applies a change |
|---|---|
| This library | One description. Each field is compared by identity, then by `JSON.stringify`. `sources`, `layers` and `terrain` go through `edit()` (paint, layout, filter, add and remove); anything else reloads the style. `data` is compared by identity and goes to `setData`. |
| react-map-gl (MIT) | `<Layer>` compares `paint` and `layout` by identity, then each key with `deepEqual`, and calls `setPaintProperty`, `setLayoutProperty`, `setFilter` or `moveLayer`. `<Source>` calls `setData`. `mapStyle` goes to `setStyle(style, {diff: true})` only on a new identity. A controlled view is not applied while the map moves. |
| maplibre-style-spec `diff` (BSD-3-Clause) | Keys layers by id. A new order becomes `removeLayer` and `addLayer` with `before`. A changed `type` or `source` adds that one layer again. A GeoJSON source whose data alone changed becomes `setData`. |
| MapLibre `GeoJSONSource` (BSD-3-Clause) | `updateData` sends only the diff to the worker. One update is in flight per source; a newer `setData` replaces the waiting one, and diffs are merged. |
| deck.gl (MIT) | Compares `data` and props shallowly. `updateTriggers` says which accessors to run again, and `_dataDiff` limits the work to changed objects. |
| vue-maplibre-gl, svelte-maplibre (MIT), svelte-maplibre-gl (Apache-2.0) | Compare each paint and layout key with `!==` and call `setPaintProperty`; call `setData` on each new data object. svelte-maplibre-gl copies the state first, as `plain()` does. |
| Vue 3, Svelte 5 | `shallowRef`, `markRaw` and `$state.raw` avoid the proxy and the deep copy for large values. Since Vue 3.4 a `computed` can return its old value (`computed(old => …)`). |

The model of one description holds up: the cost of finding the change is small next to the cost of drawing, and less
than MapLibre's own `setStyle` with `diff`. The gaps are in what happens after the comparison: the full reload for a
style object (#858) and for a new layer order (#859), and the GeoJSON path of the worker renderer under a fast
stream (#856).

## Ideas that were not filed as faults

These would make the comparison cheaper. The measured cost is below 1 ms an update, so they come after the issues
above.

- `plain()` in `src/vue.ts` could return the old copy of each part whose children did not change. A change of one
  paint value would then leave the other layers with their identity, and the comparison would stop at `!==`.
- `differ` in `src/host.ts` stringifies `before` again on each update. A `WeakMap` of the last string of each object
  would halve the work.
- A controlled `view` could wait while the user moves the map, as in react-map-gl, so that an app that rounds the view
  does not fight the drag. The benchmark did not test this case.
- `update()` could apply only the newest description of a frame. Vue already merges the changes of one tick, and
  React runs one effect per commit, so this would help only code that calls `update()` several times in one frame.
