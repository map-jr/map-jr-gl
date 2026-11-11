# Decisions for review

This document lists decisions that were made without the owner, for a later review. Each entry says what was
decided, why, and how to change it.

## Start here

Decisions that wait for you:

1. **The renderer in Safari** (worker or main thread). See [the section below](#a-decision-for-the-owner-the-renderer-in-safari). The newer measurements make the worker a better default than before.
2. **Methods that are accepted but have no effect**: done on 2026-11-11, in the entry `map-jr-gl/maplibre-compat` only (12 methods and an empty `GlobeControl`; see `src/compat-map.ts`). The main entry does not have them.
3. **The worker budget went from 58 KB to 58.5 KB, and the engine budget from 55 KB to 55.5 KB** (the owner allowed it on 2026-11-11). The worker is 58.0 KB. Each new feature needs bytes from another place. Build steps already shorten names (private members, and the variables of the shaders) and take the spaces out of the shaders. A third step can shorten the names of the fields that the tile workers and the engine send to each other. It was not done: it needs the types of the compiler to be safe, and the compiler in use (TypeScript 7) does not give them to a script.
4. **The budget of the engine for the main thread** went from 54 KB to 55 KB when the PMTiles reader left the page script. See [Size budgets](#size-budgets).
5. **The default export of the library.** The README no longer uses it: the instructions show named imports. The export itself stays, because 4 of the 15 tested plugins contain `import maplibregl from 'maplibre-gl'` (maplibre-gl-compare, maplibre-gl-inspect, maplibre-gl-export, vue-maplibre-gl) and fail without it. Say if you want it removed.
6. **The map is idle 200 ms later after a movement.** After the last frame of a movement, one more frame is drawn for the map at rest (sharp raster tiles), and `idle` fires after that frame.

To try on your iPhone, because the test machines cannot show it:

1. The terrain example in the gallery: pan to new ground and zoom. A tilted terrain view now loads about half of the tiles that it loaded before, and each ground image is drawn once.
2. A tilted street map: road names now lie on the ground.
3. A drag with a slow release: `moveend` now fires each time.

## The two entries, and what comes next

Done on 2026-11-11, as agreed with the owner:

1. The package is version 0.2.0. The entry `map-jr-gl` is the main API (`createMap`, see [The main API](api.md)); the
   entry `map-jr-gl/maplibre-compat` is the replacement for MapLibre GL JS.
2. The map class is split. 50 members that only the API of MapLibre GL JS needs are in `src/compat-map.ts`. The main
   page script is 26.8 KB; the compatibility page script is 27.7 KB.
3. The methods that are accepted with no effect are in the compatibility entry only.
4. The Vue adapter (`map-jr-gl/vue`): a component with `v-model:view`, a composable, and server rendering that Vue
   and the map take over in the browser. See [Vue and Nuxt](vue.md). Tests: `pnpm test:vue`.

5. Controls for the main API (`map-jr-gl/controls`), as descriptions in the field `controls`. The control classes are
   a file of their own now: the main page script is 25.9 KB, and the compatibility page script 28.2 KB (its budget
   is 28.5 KB; three files in place of two cost about 0.5 KB after gzip).
6. The Vue component sees changes in place (a marker pushed to a data array, a field of the view), at a cost that
   does not grow with the number of markers. The `ssr` prop takes `overrides` for style layers and `attribution`;
   the server puts the credits of the sources into the page.

7. Elements of the page on the map for the main API: `map.overlay(element, options)` (a marker with own content, or a
   popup), and the component `MapOverlay` for Vue.

8. A one-file build for each API (`map-jr-gl/standalone`, `map-jr-gl/maplibre-compat/standalone`).
9. The React adapter (`map-jr-gl/react`): a component, `useMap`, `useMapState`, `MapOverlay`, and the first view from
   a server as a prop. See [React](react.md). Tests: `pnpm test:react`. It was not tried in Next.js.

10. The field `data` of the description: GeoJSON data for sources of the style, sent alone and compared by identity.
11. `map-jr-gl/svelte`: an action and a store (no component). They were tested by direct calls, not in a Svelte
    application.

Not done yet, in the order that I propose:

2. **The features under the pointer found by the engine.** Now the page makes one query for each pointer position.
3. **More of the map class into the compatibility class**: the layer and source methods (`addLayer`, `setPaintProperty`
   and others), when the main API has its own path for a change of the style. This makes the main entry smaller.
4. **A check in the owner's Nuxt application.** The tests use Vue's server renderer directly. A small Nuxt 4 application was also built for production and opened in a browser on 2026-11-11: the server put the SVG into the page, and the map took it over without an error. That application is not in the repository.
5. **A component for Svelte, and an adapter for Solid.**

### The switch in the gallery for the code of each form

Done on 2026-11-11. The header of the gallery has a switch: Main API, Vue, React, MapLibre compatible. The choice is
kept in `localStorage` and in the URL (`?code=vue`).

- The code of each row is in files, one for each form: `site/examples/<row>.js` (main API), `.vue`, `.jsx`,
  `.compat.js`. The gallery shows the text of the file.
- The live map of a row runs the file of the main API form, or of the MapLibre form when that form is selected. So
  for these two forms, the code that a visitor reads is the code that runs.
- The Vue and React forms are shown as text and are not run. `pnpm test:examples` checks that each one compiles and
  imports only names that the entries have. Not done: to run each Vue and React form in a browser and compare its
  image with the image of the main form. That is the remaining part of the plan.
- The server row has one text for all forms.

### The shaders: a third-party tool to make them smaller?

Examined on 2026-11-11. Not worth it now.

- The shaders are 11.5 KB of the 161 KB of the worker, and about 4.0 KB of its 58 KB after gzip. The build already
  removes spaces and gives short names to uniforms, attributes, varyings and local names.
- What text tools add after that, measured on the built shaders: shorter numbers (`1.0` to `1.`) 34 bytes, no spaces
  at `+` and `-` 50 bytes, joined declarations 17 bytes. Together about 100 bytes after gzip (0.2% of the worker).
- A tool that reads the syntax (Shader Minifier, spglsl) can also put functions in line and remove dead code. A
  fair estimate is some hundred bytes more. But these tools need complete shaders. The shaders here are put together
  from parts in JavaScript, with shared parts and values from the code, and the JavaScript finds the uniforms by
  name. Each shader would have to be written out completely before the build. Shader Minifier also needs .NET.
- If bytes are needed, the three text steps can go into the build step of this project (`build.mjs`) without a new
  dependency.

## Size budgets

| Decision | Reason | To change it |
|---|---|---|
| The size check now measures what a page downloads before the map can start: `map-jr-gl.js` and the files that it imports when it loads. Before, it measured `map-jr-gl.js` alone, which hid two more files. | The check found that the page loaded the expression compiler and the text shaper, which only the engine needs. They are now out of the page script: it went from 33.8 KB to about 26 KB (gzip), with all of today's additions (events, handlers, `LngLat`, `transformRequest`, `addProtocol`, box zoom, context recovery). The budget is 27 KB. | Change the budgets in `scripts/size-check.mjs`. |
| The budget of the page script went from 27 KB to 27.5 KB; the file set is 27.1 KB. | `queryRenderedFeatures` now also gives a result at once for GeoJSON sources (see below). The code that the page needs for this at once is small; the larger part is loaded only when a style has a GeoJSON source with its data in the style. | |
| The engine for the main thread (loaded only when no worker can start) has a budget of 54 KB. | It now contains the expression compiler and the shaper that the page script no longer has. The total for a map on the main thread is the same as before. | |
| The page script is now 26.4 KB (budget 27.5 KB). The budget of the engine for the main thread went from 54 KB to 55 KB; it is 54.7 KB. | The reader for PMTiles archives was in the page script, because the page reads the header of an archive when it resolves a style. It is now loaded only for a style that has a `pmtiles://` source: 1.1 KB less for each page. The reader is counted with the engine for the main thread now, which is why that budget changed. A map in a worker (the usual case) downloads less; a map on the main thread downloads 0.6 KB more in total. | Import `./pmtiles.ts` at the top of `src/resolve.ts` again. |
| The build gives short names to private class members and to the names in the shaders (uniforms, attributes, varyings, local variables), and takes the spaces from around the operators in the shaders (`scripts/private-names.mjs`, `build.mjs`). The budgets did not change. | The minifier does not shorten property names, and it does not look into GLSL text. The steps make the worker about 1.1 KB smaller (gzip). The features of this night used that room: the worker is 57.7 KB. A name is shortened only when each use of it is a `private` declaration or `this.name`, so message fields, options and browser properties keep their names. | Remove `privates` from the plugins in `build.mjs`. |

## `queryRenderedFeatures` gives two kinds of result

`map.queryRenderedFeatures(...)` returns an array that can also be awaited.

- Used at once as an array, it has the features of the GeoJSON sources whose data is in the style. The page can
  read these itself. It does not have the features of tile sources.
- Awaited (`await map.queryRenderedFeatures(...)`), it has the complete result from all sources.

The reason: `@mapbox/mapbox-gl-draw` and similar plugins use the result at once and query only their own GeoJSON
sources. With this, mapbox-gl-draw works without changes. The risk: code that uses the result at once for a tile
source gets an empty array and no error. The document on compatibility tells users to add `await`.

To change it: `queryRenderedFeatures` in `src/map.ts`, and `src/sync-query.ts`.

`querySourceFeatures` now gives the same two kinds of result (it gave a promise only). The example page "Display HTML
clusters with custom properties" reads it at once in each `move` event. Used at once, the two methods now also have
the features of a GeoJSON source whose data is at a URL: the page fetches the data for the first query (the browser
has it in its cache) and then fires the data events of the source again, so that code that listens for them asks
again.

## Features that are not in the library

These were left out because of their size or their complexity. The audit in [Plugins and frameworks](ecosystem.md)
shows how many of the audited packages use each one.

| Feature | Used by | Why it is not there |
|---|---|---|
| Globe and other projections (`setProjection`, `GlobeControl`) | 6 packages call `setProjection` | A second projection changes almost every shader and the tile cover. It is the largest missing feature. Most packages call it only when the user asks for a globe. |
| Sky and fog (`setSky`, `getSky`) | 3 packages | The largest pitch is 60 degrees, so the horizon is not in view. |
| `setTransformCameraUpdate`, `setTransformConstrain` | 3 packages (the React and Svelte wrappers, for controlled camera state) | The camera is in the engine, which can be in a worker. A function on the page cannot run for each camera change without a delay. |
| `setRenderWorldCopies(false)` | 4 packages pass the option through | The map always draws the copies of the world. |
| The camera option `elevation` with `centerClampedToGround: false` (`setCenterElevation`) | 1 package; 1 example page | The centre of the map is always on the ground. A centre above the ground needs a ground height in each place where the transform uses the centre. The worker has 0.1 KB left. |
| A style image that is drawn with WebGL (`renderWithWebGL`) | 1 example page | The page cannot draw into the WebGL context of a map that renders in a worker. |
| The layer type `color-relief` (colours from elevation) | 0 packages; 8 render tests | It is new in MapLibre GL JS and few styles use it. It needs a shader and a colour ramp: about 0.4 KB in the worker, which has 0.3 KB left in its budget. |
| An icon together with text that follows a curved line | 1 render test | Curved text is placed by a separate path that has no icon. Road shields are not affected: their text does not follow the line. |
| A building on 3D terrain keeps a flat roof | 3 render tests show a small difference | MapLibre GL JS gives each building the ground height of one point. This library gives each corner its own ground height, so on a steep slope the roof slopes with the ground. To match needs one more value for each vertex of each building. |
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

New facts for the decision, from the runs of this night:

- The wrappers for React and Vue now run in a browser test with a map, a control, a marker, a popup, a source and a
  layer, without these methods (React needed only `getSky()`, which was added).
- Of the 33 example pages of MapLibre that do not work, 11 stop only at `new GlobeControl()`, `map.setProjection(...)`
  or `setSourceTileLodParams`. With methods and a control that have no effect, those pages would show a flat map
  where MapLibre shows a globe.
- The page script now has room: it is 27.1 KB with a budget of 27.5 KB.

## A decision for the owner: the renderer in Safari

In WebKit (the engine of Safari) the renderer in a worker draws fewer frames than the renderer on the main thread.
These are the frames that the engine drew for each second, on a macOS machine of the workflow `Browsers`, in three
measurements of the terrain scenario and one of the street map:

| Scenario | Main thread | Worker | MapLibre GL JS (frames that the page counted) |
|---|---|---|---|
| Street map | 69 | 61 | 57 |
| 3D terrain | 52, 66, 61 | 40, 55, 42 | 53, 56, 50 |

The engine's own time for a frame is small in the two cases (2 to 6 ms), so the cause is not the code of the
library. It is probably the cost for WebKit to show a canvas that a worker draws. The measurements of the owner on
an iPhone showed the same order. Chromium and Firefox do not have this difference; in Firefox the worker is much
faster than the main thread.

The choices:

1. Keep the worker as the default in each browser (as now). The page thread stays free, which is the main promise of
   the library, but Safari draws 10 to 25% fewer frames in heavy scenes.
2. Use the main thread by default in Safari (`renderer: 'auto'` would select it there). Safari then draws as many
   frames as MapLibre GL JS or more, but a busy page can make the map stutter, as with MapLibre GL JS.
3. Keep the worker, and tell users of terrain on Safari about `renderer: 'main'`.

This was not changed. Each choice is one line in `src/map.ts` (where `wantWorker` is set).

After the work on terrain tiles (fewer tiles, the level of detail of MapLibre GL JS, ground images that are made
once), the difference is smaller. These are the frames that the page counted for each second, and the longest time
between two frames, in three measurements of the terrain scenario on the same kind of macOS machine (the screen
shows 60 frames each second at most):

| 3D terrain in WebKit | Frames for each second | Longest time between two frames |
|---|---|---|
| This library, main thread | 59.6, 59.5, 59.8 | 33, 30, 28 ms |
| This library, worker | 55.9, 52.7, 51.3 | 28, 31, 33 ms |
| MapLibre GL JS | 59.1, 58.3, 55.5 | 57, 59, 81 ms |

The worker now draws 6 to 14% fewer frames than the main thread, and its longest pause is half of that of
MapLibre GL JS. The street map is the same in the three (58 to 60). The choices above are the same; the reason for
choice 2 is weaker than before.

## Findings from running react-map-gl

The scenario `test/conformance/plugins/react.js` runs `@vis.gl/react-maplibre` (the MapLibre part of react-map-gl,
the most used wrapper) with this library: a map with a control, a marker, a popup, a source and a layer. It passes
now. It found these faults, which are corrected:

| Finding | Correction |
|---|---|
| The events `style.load` and `styledata` did not fire when the first style had loaded. Code that adds layers in `map.on('style.load', ...)` never ran. | The events fire after the first style and after `setStyle`. |
| `Marker` did not have `getOffset`, `setOffset`, `getRotation`, `setRotation`, `getRotationAlignment`, `setRotationAlignment`, `getPitchAlignment`, `setPitchAlignment`, `addClassName`, `removeClassName`, `toggleClassName` and the options `className` and `rotation`. `Popup` did not have `setOffset`, `setMaxWidth`, the class name methods and a public `options`. | Added. A marker can now be turned. `pitchAlignment` is kept but has no effect: a marker is always upright on the screen. |
| The wrapper reads private members of the MapLibre map: `map.style._loaded`, `map._render()`, `map._update()`. | The map has these three, for wrappers only. |
| The wrapper calls `map.getSky()` each time a style has loaded. | `getSky()` is there and returns `undefined`. This is the only method from the proposal below that was added without your decision, because the wrapper does not work without it. `setSky` is not there. |

## Findings from the example pages of MapLibre GL JS

`node test/conformance/examples.mjs` runs each example page of the MapLibre documentation with MapLibre GL JS and
with this library. The results are in [Plugins and frameworks](ecosystem.md). The first runs found these faults,
which are corrected:

| Finding | Correction |
|---|---|
| The page "3D terrain" drew garbage. Its elevation source names a TileJSON, and the TileJSON says that the tiles use the Terrarium encoding. The library read the encoding from the style only. | The encoding is read from the TileJSON too. |
| With 3D terrain, raster tiles near the camera were up to two levels deeper than those of MapLibre GL JS (30 tiles of level 14 where MapLibre GL JS loads 10). The image was soft and the load was slow. | Raster and elevation tiles on the ground are selected for each tile by the rule of MapLibre GL JS. The same view loads the same numbers of tiles of each level. |
| The page "Display buildings in 3D" drew flat buildings. Its layer is the standard one: the height grows from 0 between zoom 15 and 15.05. A tile of the deepest level of its source (14) was built for that level only, so the height stayed 0 at each zoom. | Such a tile is built for the zoom of the map, and built again when the zoom has changed and is still. This is done only for a source with a `fill-extrusion` layer whose properties depend on the zoom and on the feature. Other properties that depend on the two (a line width, a text size) are mixed between two levels as before, which is not exact past the deepest level of the source. |
| The page "Display a hybrid satellite map with terrain elevation" stopped with an exception. It makes the map without a style and gives the style later with `setStyle(url, {transformStyle})`. | A map can be made without a style. `setStyle` takes the option `transformStyle`. |
| The page "Display and style rich text labels" stopped with an exception: it changes a layer that the style does not have. MapLibre GL JS gives an `error` event for that and continues. | `setLayoutProperty`, `setPaintProperty`, `setFilter`, `moveLayer` and `removeLayer` give an `error` event for a layer that does not exist. |
| After a change of the style, raster and elevation tiles were sent to be built again as vector tiles. That gave errors such as "Unsupported protobuf wire type 4" (the pages with contour lines and with satellite images). | Only tiles of geometry are built again. |
| The page "Add a WMS source" drew no tiles: its tile URL has `{bbox-epsg-3857}`, which the library did not fill in. | The library fills it in with the edges of the tile in Web Mercator metres. |
| With `addProtocol` or `transformRequest`, some tiles never finished loading. Each tile worker asks the page about a request and counts its questions separately; the answer went back with the number of the engine. With one tile worker the numbers are the same, so the tests (which use one) did not show it. The page "Add contour lines" (the plugin maplibre-contour) showed it. | Each worker gets its own number back. A browser test with the usual number of workers checks that each tile arrives. |
| A protocol can give its data in a buffer that is larger than the data (zeros after the end), and can give the same buffer two times. The library read past the end of a vector tile, and it took the buffer away from the protocol when it sent the bytes to a worker. | The reader of vector tiles stops at the zeros. The page sends a copy of the buffer. |
| The page "Animate a series of images" calls `updateImage` on an image source. | Image sources have `updateImage` and `setCoordinates`. |
| A style can carry its own start camera. With a zoom in the options and no centre, the library took the centre of the style; MapLibre GL JS uses the camera of the style only when the options give no part of the camera. | The same rule as MapLibre GL JS. |
| Eleven example pages use the option `hash` (the camera in the fragment of the URL, for links that show the same view). The library did not have it. | The option is there, with a name or without. Its code is loaded only when the option is used. |
| The view could go past the top or the bottom of the world (a map at zoom 0 with a centre at 32 degrees north showed an empty band above the Arctic). | The centre is limited so that the view stays inside the world, as in MapLibre GL JS. |
| With a steep tilt, the ground at the map centre was drawn with the style of the zoom level below that of the map: layers that start at the zoom of the map were missing there. | Each ground image uses the style of the zoom level of the map. |

## Two reports from the iPhone that are open

After the changes to 3D terrain, the owner reported from an iPhone:

1. The first view fills in significantly slower.
2. The map stops panning when it reaches a tile with no terrain yet.

Neither one shows on the development machine (Chromium, software GPU):

| What was tried | Result |
|---|---|
| The first view of the gallery's terrain example at the size of a phone, the version of the day before against the present one, with fast tiles and with tiles that take 1.5 seconds each | The present version is complete sooner in each run, and asks for a third of the elevation tiles. |
| Pans by mouse and by touch into ground whose elevation tiles take 4 to 5 seconds | The centre moves at each step. |
| A drag of a point on a summit while the map centre is in a valley | The map follows. |
| A CPU profile of a pan into ground without elevation | No long task; less script time than the day before. |

What was done:

- The mesh of the ground now asks for the same elevation tiles as relief shading. Before, when the relief layer was
  added after the terrain (as the gallery does), the two loaded two sets of elevation tiles.
- A browser test now pans over ground whose elevation tiles are slow. The workflow `Browsers` runs it in WebKit and
  Firefox too.

To find the cause, these facts from the phone would help: if the first view is slow in each example or only with
terrain; and what "stops" is: the map does not follow the finger, the glide after the finger lifts ends at once, or
the picture freezes for a moment.

## Findings from the cross-browser runs

The workflow `Browsers` runs the benchmark and the behaviour tests in Chromium, Firefox and WebKit on Linux, macOS
and Windows. Its results are on the branch `bench-results`. These points are for the owner to know:

| Finding | State |
|---|---|
| 3D terrain was slower than MapLibre GL JS in WebKit (the engine of Safari), and each repeated measurement was slower than the one before. This agrees with what the owner saw on an iPhone. | Corrected. The causes: work on the CPU for each frame (mesh heights, the source tiles of each ground tile); ground textures that were made again while the map turned, and one in each frame of a movement; and memory on the GPU that was not given back (removed maps, and ground textures that were made and deleted all the time). On the main thread, terrain in WebKit now draws as many frames as MapLibre GL JS. For the worker, see the decision above. |
| WebKit did not load web fonts inside a worker, so labels used a fallback font. | Corrected: the engine fetches the font file and gives the browser its bytes. |
| Elevation tiles are decoded in tile workers with `OffscreenCanvas`. Safari before version 16.4 (March 2023) does not have it in workers. | Not changed. Terrain, relief shading and contours do not work there (they did not before, for the same reason). The library has its own PNG and WebP decoders for the server; to use them in the browser adds about 2.5 KB to the worker. |
| In WebKit, the test of wheel zoom found the place under the pointer some hundred pixels away after the zoom. | Not a fault of the library. WebKit reports that the mouse was released before the page has handled the events, so the test started the wheel zoom while the drag before it and its inertia were still in progress. The tests now wait until the camera is still. |
| Firefox without a window draws about 3 frames each second on the page's thread (MapLibre GL JS also), so its tests timed out. | The workflow now runs Firefox with a window. In a worker the library draws 60 frames each second in Firefox. |
| WebKit on Linux and Windows cannot draw WebGL in a worker. | The library uses the main thread there, as designed. Safari on macOS and iOS can. |
| A tilted view with 3D terrain loaded 100 tiles where MapLibre GL JS loads 34, and took 2 to 3 times as long to load. This agrees with the hitches that the owner saw when panning to new terrain. | Corrected. Each ground tile also requested the tiles beyond its edges, and tiles were requested two times at two sets of zoom levels. The level of detail of each tile now follows the rule of MapLibre GL JS. The same view now loads 46 tiles. (MapLibre GL JS loads 34: when relief shading and terrain use the same source, it draws the relief one level coarser. This library keeps the relief sharp.) On macOS in Chromium the load went from 2.8–5.1 s to 1.3–2.0 s (MapLibre GL JS: 0.5–1.1 s); on Linux and Windows the library now loads terrain faster than MapLibre GL JS. |
| A test run on macOS stopped because `isMoving()` stayed `true` after a drag. | A fault of the library, corrected. When a drag ended with a very small movement, the glide after it could start and end inside one frame. The engine then never reported the glide, and the page waited for it: `moveend` did not fire. It happened on slow machines (long frames). The engine now reports the glide in the frame that ends it. |
| The test of wheel zoom fails now and then (about 1 run in 10, in a worker, on a loaded machine): after the zoom the place under the pointer is 1.5 or 21 pixels away, in the direction of the drag before it. | Open. Twelve repeats of the same steps alone gave no error, so it needs a certain timing. The probable cause is a glide after the drag that is not over when the test reads the position. It is not known if a person can see it. |
| In Firefox, a blocked page also stops the frames of a map that renders in a worker (1 frame in a second, as on the main thread). In Chromium the worker draws on (9 to 12 frames with the software GPU). | Not changed: it is how Firefox runs the frames of a worker. The test is not run in Firefox. |
| WebKit on Windows (the build that Playwright uses, not a browser that people use) gets no heights for 3D terrain. | Not changed. This build has no `OffscreenCanvas` in workers, as Safari before version 16.4 (see the row above): the tile workers cannot decode elevation tiles there. The two tests of terrain and relief fail in this build for that reason. |
| On the benchmark, the time from the start to `idle` was longer than in MapLibre GL JS where the GPU is emulated. | Three causes. (1) The labels of layers for higher zooms (see below): corrected. (2) The overview: 4 large tiles of zoom 11 were requested together with the 4 tiles of the view, took connections and tile workers from them, and each arrival started the label placement again. The overview is now requested when the tiles of the view have loaded, and its arrival does not change the state of the map. (3) After the last tile, labels are placed and fade in (0.3 to 0.5 s); MapLibre GL JS has the same step. The tile requests come from the live network, so single measurements differ by some hundred milliseconds. |
| The `hash` option did not write the camera in WebKit on Windows. | A fault of the library, corrected. A movement that ended before the on-demand file of the option had loaded was lost. |
| Where the GPU is emulated (Windows and Linux Chromium in the workflow), the flat map draws fewer frames than MapLibre GL JS during a camera animation (for example 6 to 10 against 13 each second on the development machine). | Open, and probably not a fault on real GPUs. Measured on the development machine: the script of the engine uses 10% of the time, and each layer type alone is as fast as in MapLibre GL JS (fills are faster). The result changes from 5.7 to 9.6 frames each second between a first run and a run with the tiles in the HTTP cache, and MapLibre GL JS does not change. An emulated GPU draws on the CPU, so the tile workers and the drawing compete for the same cores. On the macOS runners, which have a GPU, the library draws as many frames as MapLibre GL JS or more. Examined: see the next row. |
| To load a city view, the library used about 1.5 times the CPU time of MapLibre GL JS on all threads (about 1650 ms against 1100 ms on the development machine). | Corrected. A tile of the deepest level of its source had the labels of each layer, also of layers that show only at much higher zooms: 13,586 of the 16,827 labels of the view belonged to a layer for zoom 17 and higher. Such a tile now has the labels of the layers that show up to one level above the zoom of the map, and it is built again when the map comes to another whole zoom (MapLibre GL JS also makes new tiles there). The CPU time to load the view is now about 950 ms with the worker renderer. To see on a device: after a fast zoom from 14 to 17 or more, the labels of small places come about half a second after the zoom stops. |

