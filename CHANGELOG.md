# Changelog

Each version has one entry. While the version is 0.x, a version that breaks code that worked increases the second
number, and its entry starts with a section "Breaking changes". See
[How a release is made](docs/development.md#how-a-release-is-made).

`#12` is a link to pull request 12. A change without a number comes from before 2026-11-11, when the repository had
no pull requests.

## 0.4.0 (2026-11-15)

This entry covers the changes after 0.3.0 (the tag `v0.3.0`).

### Breaking changes

- `@map-jr/map-jr-gl/vue` and the Nuxt module: the composable `useMap` is renamed to `useMapJr`, and no alias is
  left. `import {useMap} from '@map-jr/map-jr-gl/vue'` and the auto-imported `useMap()` of Nuxt fail. Write
  `useMapJr` instead. The React hook `useMap` of `@map-jr/map-jr-gl/react` keeps its name ([#405]).
- `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`: the option `glyphs: false` is removed. TypeScript code
  that passes `glyphs` to `createMap`, to `update` or to `new Map()` no longer compiles, and at run time a map with
  `glyphs: false` requests the glyph files of the style. Glyph files now load also when `fonts` is set, so labels use
  the glyph files where the files have the characters. To draw all text with `fonts`, remove `glyphs` from the style
  ([#402]).
- `@map-jr/map-jr-gl/maplibre-compat`: a `ScaleControl` added without a position is at the bottom left, as in MapLibre
  GL JS. Before, it was at the top right. Pass `'top-right'` to `addControl` to keep the old place ([#283]).

### New

- `@map-jr/map-jr-gl`: `transformRequest` in the description (`MapSpec`) changes the URL or the headers of each
  request ([#420]).
- `@map-jr/map-jr-gl`: overlays can be dragged, the Vue component `MapOverlay` supports this, and `defaultPin()` gives
  the default marker element ([#409]).
- Both entries: `toBlob()` exports the map as an image with both renderers ([#374]).
- Both entries: `flyTo` flies along the curve of van Wijk and Nuij, with the options `curve`, `speed` and
  `maxDuration`. In the compat entry, `flyTo` without `duration` takes the time that MapLibre GL JS takes instead of
  1200 ms ([#363]).
- `@map-jr/map-jr-gl/maplibre-compat`: `easeTo` and `flyTo` use `offset` and `easing`. A call with `offset` now ends
  with the center at the offset ([#335]).
- Both entries: `cooperativeGestures` is available in the description, in the Vue component and in the compat `Map`
  ([#362], [#373]).
- `@map-jr/map-jr-gl/maplibre-compat`: `GeolocateControl` with `trackUserLocation` tracks the user location as in
  MapLibre GL JS. Before, the option was accepted and did nothing ([#426]).
- `@map-jr/map-jr-gl/maplibre-compat`: `FullscreenControl` has the pseudo fullscreen, and the map has the option
  `locale` ([#376]).
- Both entries: the compass can be dragged to rotate and pitch the map ([#358]).
- `@map-jr/map-jr-gl/maplibre-compat`: `GPUInitializationError` is exported, and a failed start reports it
  ([#347]).
- `@map-jr/map-jr-gl`: `fitBounds`, `moveTo` and the description take padding per side ([#323]).
- `@map-jr/map-jr-gl`: the state has the bounds of the view in `state.view.bounds`, and `initialView` accepts bounds
  ([#307]).
- `@map-jr/map-jr-gl`: the control `custom()`, the cluster methods on `MapHost` and the style specification types are
  available from the main entry ([#320], [#315], [#318]).
- `@map-jr/map-jr-gl/maplibre-compat`: `on`, `once` and `off` accept an array of layer ids. A listener that is not a
  function now throws ([#278]).
- The map is ready sooner. The first tiles, the sprite and the first glyph file of each font are requested before
  the shaders compile, the worker file is fetched once for all workers, and each chunk loads the chunks that it needs
  in one round. A map at rest places labels at once and shows the labels of new tiles without a fade
  ([#416], [#382], [#375], [#344], [#354], [#340], [#349], [#433]).
- Labels are placed with less work, and a style edit resends no GeoJSON and recompiles only what changed
  ([#348], [#339], [#336], [#331], [#329], [#322], [#327], [#304], [#298]).

### Fixed

Some of these corrections change a result so that it agrees with the documentation or with MapLibre GL JS. Code
that relied on the old result can see a difference, and the item says which.

- `@map-jr/map-jr-gl`: `update()` and `addImage()` set `state.idle` to `false` while the engine has work. Code that
  read `state.idle === true` right after `update()` now sees `false` until the map is drawn ([#414]).
- Tile, style, TileJSON and GeoJSON requests time out after 30 s, and the timer is cleared when a request settles
  ([#413], [#422]).
- A tile whose request failed is requested again after 0.5, 1 and 2 s, and it shows its overview tile at once
  ([#378], [#419]). After the first idle, a pan requests a new overview tile at once ([#366]).
- A tile that leaves the view while it waits for its upload is kept, and a tile dropped while it waits frees its GPU
  tile ([#399], [#401]).
- Elevation tiles are read exactly when the browser adds noise to a canvas, as Safari does in private browsing
  ([#430]). After a pause, a second frame follows the first, because WebKit does not show the first ([#432]).
- A popup that closes no longer catches clicks during its fade, and its element is removed when the closing animation
  never ends ([#437], [#434]).
- `maxBounds` keeps the edges of the view inside the bounds, and bounds across the antimeridian wrap, as in MapLibre
  GL JS. A map with `maxBounds` can stop its center earlier and raise its zoom ([#308], [#333]).
- `@map-jr/map-jr-gl/maplibre-compat`: `LngLatBounds` keeps its corners as given. Bounds given north-east first are no
  longer sorted ([#337]).
- `@map-jr/map-jr-gl/maplibre-compat`: `project()` and the `point` of events are a `Point`. `Marker` takes its
  `offset` as a `PointLike`, and `getOffset()` returns a `Point` ([#350], [#357], [#317]).
- `@map-jr/map-jr-gl/maplibre-compat`: `getImage(name).data` gives RGBA pixels instead of the object that was passed
  to `addImage` ([#317]).
- `@map-jr/map-jr-gl/maplibre-compat`: a click on a marker is a click of the map, and a click on a draggable marker
  fires no drag events ([#345], [#288]).
- A map with `interactive: false` fires mouse events, as in MapLibre GL JS ([#292]).
- `@map-jr/map-jr-gl/maplibre-compat`: controls inherit the font of the map, so text in the container without its own
  font shows `12px/1.3 system-ui`. An interactive map shows the grab cursor ([#352]).
- `@map-jr/map-jr-gl/maplibre-compat`: `querySourceFeatures` reads all features of the tiles under the view, not
  only those in the view ([#281]).
- `getClusterLeaves` follows the `limit` and `offset` rules of supercluster, so `limit: 0` gives every leaf ([#284]).
- GeoJSON sources support `generateId` and `promoteId` in the object form. With `generateId: true`, features get
  index ids, as in MapLibre GL JS ([#291], [#342]).
- `@map-jr/map-jr-gl/maplibre-compat`: vector, raster and raster-dem sources have `setTiles` and `setUrl`. The source
  object is now a copy of the specification ([#296]).
- The attribution credits only sources of visible layers, hides blank credits and folds only on a drag. Its button is
  placed inside the compact control ([#302], [#313]).
- `@map-jr/map-jr-gl/maplibre-compat`: `once('idle')` in a `load` listener waits for the sources that the listener
  added ([#282]).
- `@map-jr/map-jr-gl/maplibre-compat`: the class `maplibregl-map` and the position and overflow of the container are
  set before the map measures it, also for a container attached later ([#286], [#346]).
- `@map-jr/map-jr-gl/maplibre-compat`: `ScaleControl.setUnit()` works, also with the unit `nautical` ([#343]).
- `@map-jr/map-jr-gl/maplibre-compat`: the members and exports that Vue wrappers and apps read are added. `Marker` and
  `FullscreenControl` are subclasses of the classes of the main entry ([#300]).
- `@map-jr/map-jr-gl/maplibre-compat`: the `eventData` of camera methods is on the events of the move ([#297]).
- `@map-jr/map-jr-gl/maplibre-compat`: `addControl` with a value that is not a control fires `error` instead of
  throwing a `TypeError` ([#287]).
- Sizes that depend on zoom and feature are found at the zoom of an overzoomed tile ([#285]).
- A Marker in a container scaled by CSS follows the pointer when it is dragged ([#310]).
- A new engine gets the request rules when it starts, also after the fall back to the main thread ([#356]).
- Options and methods that have no effect warn once. Among them are `fadeDuration`, `pitchWithRotate`,
  `focusAfterOpen`, the `fitBounds` options `speed`, `curve` and `linear`, `addProtocol('pmtiles')`, reading
  `map.painter` and a projection other than mercator. With `strict: true`, two map options throw
  ([#293], [#372], [#316], [#359], [#303]).
- Warnings name the Vite dependency cache and `toBlob()`, and the warning for a container of height 0 names the
  component or action ([#424], [#306]).
- Types: the per-layer style types check the prefix of `paint` and `layout` names. The compat types of `fitBounds`,
  `CameraOptions`, `getStyle`, feature state and `querySourceFeatures` follow MapLibre GL JS, and the compat style
  types accept values typed with `maplibre-gl`. Code with a wrong prefix, or with a `[top, right, bottom, left]`
  tuple as `CameraOptions.padding`, no longer compiles ([#321], [#311], [#418]).
- `@map-jr/map-jr-gl/vue`: the template ref of `MapJr` is typed, and `load` gives the map. A client build does not
  emit the server renderer as a chunk ([#301], [#312]).
- The build option `--sizes` imports the controls from the right file ([#398]).

[#278]: https://github.com/map-jr/map-jr-gl/pull/278
[#281]: https://github.com/map-jr/map-jr-gl/pull/281
[#282]: https://github.com/map-jr/map-jr-gl/pull/282
[#283]: https://github.com/map-jr/map-jr-gl/pull/283
[#284]: https://github.com/map-jr/map-jr-gl/pull/284
[#285]: https://github.com/map-jr/map-jr-gl/pull/285
[#286]: https://github.com/map-jr/map-jr-gl/pull/286
[#287]: https://github.com/map-jr/map-jr-gl/pull/287
[#288]: https://github.com/map-jr/map-jr-gl/pull/288
[#291]: https://github.com/map-jr/map-jr-gl/pull/291
[#292]: https://github.com/map-jr/map-jr-gl/pull/292
[#293]: https://github.com/map-jr/map-jr-gl/pull/293
[#296]: https://github.com/map-jr/map-jr-gl/pull/296
[#297]: https://github.com/map-jr/map-jr-gl/pull/297
[#298]: https://github.com/map-jr/map-jr-gl/pull/298
[#300]: https://github.com/map-jr/map-jr-gl/pull/300
[#301]: https://github.com/map-jr/map-jr-gl/pull/301
[#302]: https://github.com/map-jr/map-jr-gl/pull/302
[#303]: https://github.com/map-jr/map-jr-gl/pull/303
[#304]: https://github.com/map-jr/map-jr-gl/pull/304
[#306]: https://github.com/map-jr/map-jr-gl/pull/306
[#307]: https://github.com/map-jr/map-jr-gl/pull/307
[#308]: https://github.com/map-jr/map-jr-gl/pull/308
[#310]: https://github.com/map-jr/map-jr-gl/pull/310
[#311]: https://github.com/map-jr/map-jr-gl/pull/311
[#312]: https://github.com/map-jr/map-jr-gl/pull/312
[#313]: https://github.com/map-jr/map-jr-gl/pull/313
[#315]: https://github.com/map-jr/map-jr-gl/pull/315
[#316]: https://github.com/map-jr/map-jr-gl/pull/316
[#317]: https://github.com/map-jr/map-jr-gl/pull/317
[#318]: https://github.com/map-jr/map-jr-gl/pull/318
[#320]: https://github.com/map-jr/map-jr-gl/pull/320
[#321]: https://github.com/map-jr/map-jr-gl/pull/321
[#322]: https://github.com/map-jr/map-jr-gl/pull/322
[#323]: https://github.com/map-jr/map-jr-gl/pull/323
[#327]: https://github.com/map-jr/map-jr-gl/pull/327
[#329]: https://github.com/map-jr/map-jr-gl/pull/329
[#331]: https://github.com/map-jr/map-jr-gl/pull/331
[#333]: https://github.com/map-jr/map-jr-gl/pull/333
[#335]: https://github.com/map-jr/map-jr-gl/pull/335
[#336]: https://github.com/map-jr/map-jr-gl/pull/336
[#337]: https://github.com/map-jr/map-jr-gl/pull/337
[#339]: https://github.com/map-jr/map-jr-gl/pull/339
[#340]: https://github.com/map-jr/map-jr-gl/pull/340
[#342]: https://github.com/map-jr/map-jr-gl/pull/342
[#343]: https://github.com/map-jr/map-jr-gl/pull/343
[#344]: https://github.com/map-jr/map-jr-gl/pull/344
[#345]: https://github.com/map-jr/map-jr-gl/pull/345
[#346]: https://github.com/map-jr/map-jr-gl/pull/346
[#347]: https://github.com/map-jr/map-jr-gl/pull/347
[#348]: https://github.com/map-jr/map-jr-gl/pull/348
[#349]: https://github.com/map-jr/map-jr-gl/pull/349
[#350]: https://github.com/map-jr/map-jr-gl/pull/350
[#352]: https://github.com/map-jr/map-jr-gl/pull/352
[#354]: https://github.com/map-jr/map-jr-gl/pull/354
[#356]: https://github.com/map-jr/map-jr-gl/pull/356
[#357]: https://github.com/map-jr/map-jr-gl/pull/357
[#358]: https://github.com/map-jr/map-jr-gl/pull/358
[#359]: https://github.com/map-jr/map-jr-gl/pull/359
[#362]: https://github.com/map-jr/map-jr-gl/pull/362
[#363]: https://github.com/map-jr/map-jr-gl/pull/363
[#366]: https://github.com/map-jr/map-jr-gl/pull/366
[#372]: https://github.com/map-jr/map-jr-gl/pull/372
[#373]: https://github.com/map-jr/map-jr-gl/pull/373
[#374]: https://github.com/map-jr/map-jr-gl/pull/374
[#375]: https://github.com/map-jr/map-jr-gl/pull/375
[#376]: https://github.com/map-jr/map-jr-gl/pull/376
[#378]: https://github.com/map-jr/map-jr-gl/pull/378
[#382]: https://github.com/map-jr/map-jr-gl/pull/382
[#398]: https://github.com/map-jr/map-jr-gl/pull/398
[#399]: https://github.com/map-jr/map-jr-gl/pull/399
[#401]: https://github.com/map-jr/map-jr-gl/pull/401
[#402]: https://github.com/map-jr/map-jr-gl/pull/402
[#405]: https://github.com/map-jr/map-jr-gl/pull/405
[#409]: https://github.com/map-jr/map-jr-gl/pull/409
[#413]: https://github.com/map-jr/map-jr-gl/pull/413
[#414]: https://github.com/map-jr/map-jr-gl/pull/414
[#416]: https://github.com/map-jr/map-jr-gl/pull/416
[#418]: https://github.com/map-jr/map-jr-gl/pull/418
[#419]: https://github.com/map-jr/map-jr-gl/pull/419
[#420]: https://github.com/map-jr/map-jr-gl/pull/420
[#422]: https://github.com/map-jr/map-jr-gl/pull/422
[#424]: https://github.com/map-jr/map-jr-gl/pull/424
[#426]: https://github.com/map-jr/map-jr-gl/pull/426
[#430]: https://github.com/map-jr/map-jr-gl/pull/430
[#432]: https://github.com/map-jr/map-jr-gl/pull/432
[#433]: https://github.com/map-jr/map-jr-gl/pull/433
[#434]: https://github.com/map-jr/map-jr-gl/pull/434
[#437]: https://github.com/map-jr/map-jr-gl/pull/437

## 0.3.0 (2026-11-14)

This entry covers the changes after 0.2.0 (the tag `v0.2.0`).

### Breaking changes

- `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`: an SVG image without a `viewBox` takes its size from
  its `width` and `height` attributes, in CSS pixels. Before, it was always 24×24, so a smaller drawing sat in the
  top-left corner and a larger one was cropped. An SVG with neither a `viewBox` nor `width` and `height` is still
  24×24. The size is read from the root `<svg>` element only. If an image now has another size than you want, give
  it a `viewBox`, or give `width` and `height` in the options of the image ([#176]).
- `@map-jr/map-jr-gl/vue`: `useMap` loads the map with `import()` when the component is mounted, so its `host` is
  still `null` inside the caller's own `onMounted`. Use the event `load` of `MapJr`, or watch `host` ([#179]).
- Both entries: a popup fires `close` when it starts to close, not after its fade of 110 ms. `isOpen()` is `false`
  during the fade. Code that waited for `close` to know that the element is gone must wait for the fade too ([#181]).

### New

- `@map-jr/map-jr-gl/vue`: the static code of `vue.js` is 2.8 KB gzip instead of 32.1 KB. `MapOverlay`, `MapImage`
  and `useMapHost` no longer load the map with the page, so `LazyMapJr` delays the map code as `docs/vue.md` says
  ([#179]).
- Several `setData` calls on one GeoJSON source in the same task send only the last data to the tile workers. Every
  promise still resolves. 50 calls in a loop send 2 messages instead of 100 ([#180]).

### Fixed

- `@map-jr/map-jr-gl/maplibre-compat`: `click`, `dblclick` and `contextmenu` reached the listener only after a query of
  all layers (469 to 857 ms in slow cases). The query now starts at `pointerdown` or `touchstart`, and the event comes
  when the answer is there, at most 300 ms after the pointer is up. `queryRenderedFeatures` in a click listener still
  has the features, also for a touch tap ([#174]).
- A click on the close button of a Vue `MapOverlay` popup sometimes did not close it ([#181]).
- The check of the size budgets measured the wrong engine file in some builds ([#183]).
- The README said that the package is not on npm ([#185]).

[#174]: https://github.com/map-jr/map-jr-gl/pull/174
[#176]: https://github.com/map-jr/map-jr-gl/pull/176
[#179]: https://github.com/map-jr/map-jr-gl/pull/179
[#180]: https://github.com/map-jr/map-jr-gl/pull/180
[#181]: https://github.com/map-jr/map-jr-gl/pull/181
[#183]: https://github.com/map-jr/map-jr-gl/pull/183
[#185]: https://github.com/map-jr/map-jr-gl/pull/185

## 0.2.0 (2026-11-14)

This is the first entry and the first version on npm. It covers the repository from its first commit (2026-11-10) to
the commit 6777dfa, which has the tag `v0.2.0`.

The name of the package is `@map-jr/map-jr-gl`
([issue 17](https://github.com/map-jr/map-jr-gl/issues/17)). Install it with `npm install @map-jr/map-jr-gl`.

### What the library does

- It draws a MapLibre style with WebGL2: fill, line, symbol, circle, heatmap, raster, hillshade, 3D building and
  background layers, from vector, raster, elevation, GeoJSON, image and PMTiles sources.
- It has two entries. `@map-jr/map-jr-gl` is the main API: `createMap` makes a map from one description (`MapSpec`),
  `update` changes it, and queries return promises. `@map-jr/map-jr-gl/maplibre-compat` has the `Map` class of
  MapLibre GL JS. [MapLibre compatibility](docs/maplibre-compatibility.md) lists the differences.
- The map draws in a worker when the browser can do that, and on the main thread when it cannot.
  [Browser support](docs/browser-support.md) says what each renderer needs.
- The field `images` of the description gives images (SVG, a URL or pixels) to the style layers by name (#120).
- A symbol layer draws icons that are always shown (no text, `icon-allow-overlap`) from buffers on the GPU. The cost
  of a frame does not grow with their number, unless labels must keep away from them (#122).
- A query for drawn features finds a feature of a symbol layer where its icon is drawn. Before, it was found within
  10 pixels of its point (#124). In one layer, the feature that is drawn on top comes first.
- The Vue and React components pass each event of the map on (`@moveend`, `onMoveend`, `@styleimagemissing` and the
  others).
- The adapters for Vue and React have the component `MapImage`: an image for the style layers, with the SVG
  written in the template and its parameters as the props of the slot (#128).
- An SVG image with slots (`{{name}}`) is a template. Each feature gives the slots their values, from its
  properties or from `params` of the `image` expression (#125).
- A marker layer draws markers on the canvas. It is shorthand for a GeoJSON source and a symbol layer with an
  image, so a click finds its markers and the layer has a place in the layer order (#125). `Marker` and `Popup` are
  also available as elements of the page.
- 3D terrain, hillshade, contour lines and elevation queries use one elevation source.
- The entry `@map-jr/map-jr-gl/server` renders the first view as SVG or as an image on Node.js 22 and on Cloudflare Workers.
- The adapters are `@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/nuxt`, `@map-jr/map-jr-gl/react` and `@map-jr/map-jr-gl/svelte`.
- The package has type declarations for each entry and a source map beside each built file ([#85], [#87], [#98]).
- The package has a development build of each entry beside the production build. In the development build, the main
  API writes one warning for each common mistake in a description or in a query, for example a container with the
  height 0 or an id in `interactiveLayers` that the style does not have. `package.json` names the development
  build under the `development` export condition, so a bundler that sets this condition uses it in development.
  The production build does not contain the checks ([#90], [#106]).
- `supported()` of both entries says whether the browser can show a map ([#116]).
- The page file and the worker file each contain the version of the package. The page writes one warning when the
  two versions differ, which can happen behind a CDN or a cache ([#116]).
- The [status table](README.md#status) of the README has the test results and the sizes of the built files.

### Behaviour that changed during 0.2.0

These changes matter if you used a build of the repository from before 2026-11-12.

- Text uses the glyph files of the style, as MapLibre GL JS does. `glyphs: false` uses the fonts of the browser
  instead.
- The main API has one `queryFeatures` for all queries, and `watchFeatures` keeps an answer up to date.
- `queryFeatures` has the same meaning in both entries ([#117]). With `sources`, it reads the tile data of those
  sources. Without `sources`, it returns the features that the style layers draw, and it does not read other data.
  Before, `map.queryFeatures` of `@map-jr/map-jr-gl/maplibre-compat` always read the tile data: add `sources` to
  such a call.
- `radius` of `queryFeatures` is the distance around the place in pixels of the screen, in both kinds of query.
  Without `sources`, the default is 0. With `sources`, the default is 3 ([#117]).
- The methods `queryLayers` and `querySources` of the map are gone. Use `queryFeatures` without `sources` in
  place of `queryLayers`, and `queryFeatures` with `sources` in place of `querySources` ([#117]).
- In TypeScript, a call of `queryFeatures` that writes `sources` gives `QueriedFeature[]`, and a call without
  `sources` gives `RenderedFeature[]` ([#117]).
- In the main API, `queryFeatures` with a place of the form `{lng, lat}` and without `sources` is rejected with a
  message that names the accepted forms ([#90]).
- `createMap()` and `update()` throw when the description has no `style` ([#57]).
- A style or a source that fails fires `error`, and the map continues with the other sources ([#63]). The main API
  reports each error to `onError`, or to the console when the description has no `onError` ([#65]).
- `idle` fires after changed data is drawn. Directly after `setData`, the source is not loaded ([#62]).
- When two styles are requested in quick succession, the map uses the later one, also when the earlier one answers
  later ([#61]). The same is true for two `setData` calls with URLs ([#81]).
- A query is rejected when the map is removed or loses its WebGL context. When a listener throws, the map fires
  `error`, and the listeners after it get the event ([#109]).
- A map with the worker renderer goes to the main thread and writes one warning when the worker loses its WebGL
  context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after its first
  start ([issue 119](https://github.com/map-jr/map-jr-gl/issues/119)) or after the map has started it again. Before, the map started a worker again without end and did not load. When the main thread
  fails in the same way after a restart, the map fires `error`
  ([issue 78](https://github.com/map-jr/map-jr-gl/issues/78), [#110]).
- A map that cannot start, for example without WebGL2, fires one `error` that says what to do, and it shows a
  message in the container (an element with the class `map-jr-unavailable`). Before, the container stayed empty
  ([#116]).
- `getVersion()` of `@map-jr/map-jr-gl/maplibre-compat` returns the version of the package ([#116]).
- The `queryFeatures` example of the gallery gives an answer for each click, and its forms for the main API pass
  `sources` ([#115]).
- A camera animation that is not `essential` does not run when the system asks for less motion
  (`prefers-reduced-motion: reduce`). The container of the map has a role and shows the keyboard focus ([#71]).
- In `@map-jr/map-jr-gl/maplibre-compat`, an option that has no effect writes one warning, and a style call that the library
  refuses fires `error` ([#70]). `setMaxBounds` moves the centre into the bounds at once ([#93]).
- The server renderer has time limits, a size limit and a list of allowed hosts for its requests ([#96]).
- Two ways for HTML from data to reach the page are closed: the colour of a marker, and the attribution of the
  first view from a server.

### What is known not to work

- **Without WebGL2** no map can be shown. `supported()` of both entries says so before a map is made. A map that is
  made anyway fires one `error` and shows a message in the container.
- **Not available:** globe and other projections, sky, fog, custom layers, color relief, video and canvas sources,
  MapLibre Tiles (MLT), and the properties in
  [What is not available](docs/maplibre-compatibility.md#what-is-not-available).
- **`queryRenderedFeatures` and `querySourceFeatures`** give the complete result as a promise, because the tile
  data is in a worker. Code from MapLibre GL JS needs `await`.
- **Plugins** that read `map.style` or `map.painter` do not work.
- **The server renderer** does not draw heatmap and hillshade layers.
- **Terrain, hillshade and contour lines** need `OffscreenCanvas` in a worker. No automatic run covers a browser
  without it, a real iPhone or Android. See [Browser support](docs/browser-support.md).
- **Safari 27.2 on a hosted macOS runner** cannot use the worker renderer: a worker draws one frame and then
  stops, and its WebGL context is lost. Since [#110] the map goes to the main thread there and loads (seen in one
  run of the Safari job). The cause is not known. A worker that stops with no lost context at the first start is
  not detected. The same Safari draws in a worker on a Mac with a GPU.
- The package contains ES modules only. `require('@map-jr/map-jr-gl')` does not work.
- The [open issues](https://github.com/map-jr/map-jr-gl/issues) list the other known faults by priority.

[#57]: https://github.com/map-jr/map-jr-gl/pull/57
[#61]: https://github.com/map-jr/map-jr-gl/pull/61
[#62]: https://github.com/map-jr/map-jr-gl/pull/62
[#63]: https://github.com/map-jr/map-jr-gl/pull/63
[#65]: https://github.com/map-jr/map-jr-gl/pull/65
[#70]: https://github.com/map-jr/map-jr-gl/pull/70
[#71]: https://github.com/map-jr/map-jr-gl/pull/71
[#81]: https://github.com/map-jr/map-jr-gl/pull/81
[#85]: https://github.com/map-jr/map-jr-gl/pull/85
[#87]: https://github.com/map-jr/map-jr-gl/pull/87
[#90]: https://github.com/map-jr/map-jr-gl/pull/90
[#93]: https://github.com/map-jr/map-jr-gl/pull/93
[#96]: https://github.com/map-jr/map-jr-gl/pull/96
[#98]: https://github.com/map-jr/map-jr-gl/pull/98
[#106]: https://github.com/map-jr/map-jr-gl/pull/106
[#109]: https://github.com/map-jr/map-jr-gl/pull/109
[#110]: https://github.com/map-jr/map-jr-gl/pull/110
[#115]: https://github.com/map-jr/map-jr-gl/pull/115
[#116]: https://github.com/map-jr/map-jr-gl/pull/116
[#117]: https://github.com/map-jr/map-jr-gl/pull/117
