# MapLibre differences

This page compares the library with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) version 6. The API of
MapLibre GL JS is in the entry `@map-jr/map-jr-gl/maplibre-compat`: [The compat entry](maplibre-compat.md) lists its
exports and the members of its `Map`. The main entry, `@map-jr/map-jr-gl`, has another API: see
[`createMap`](create-map.md).

It has six parts:

1. [What this library adds](#what-this-library-adds)
2. [What is different](#what-is-different)
3. [What is not available](#what-is-not-available)
4. [Map methods](#map-methods)
5. [Source methods](#source-methods)
6. [Types](#types)

The [status table](../../README.md#status) gives the current test results.

## What this library adds

### Worker rendering

The renderer can run in a worker. The option is `renderer: 'auto'`, `'worker'` or `'main'`.

### Server rendering

`renderToSVG` and `renderToImage` draw a map without a browser. See [Server rendering](../guide/server-rendering.md).

### Many markers

A symbol layer draws icons that are always shown from a buffer on the GPU: the cost of a frame does not grow with their number. See [Which icons are fast](../guide/markers-and-popups.md#keep-many-markers-fast).

### SVG images

`addImage` accepts an SVG string. The image is sharp on each screen. Its size in CSS pixels is the size of its `viewBox`, or else of its `width` and `height` attributes, or 24 by 24.

### Many icons

A symbol layer draws an icon that is always shown (no text, `icon-allow-overlap`) from a buffer on the GPU. Such an icon is not hidden by ground in front of it with 3D terrain, does not fade in, and is drawn below the labels of the symbol layers next to its layer (those with no other visible layer between them) unless its layer is above each layer with labels. See [Markers and popups](../guide/markers-and-popups.md).

### SVG templates

An SVG string with slots (`{{name}}`) is a template. Each feature gives the slots their values, from its properties or from `params` of the `image` expression: `['image', 'pin', {params: {color: ['get', 'color']}}]`. MapLibre GL JS does not have `params`. See [An image that is a template](description.md#images).

### The global state property `color-scheme`

A map of `@map-jr/map-jr-gl` sets the global state property `color-scheme` of the style to `'light'` or `'dark'`, the resolved `colorScheme` of the description. The compat entry does not set it. The name is not reserved in the MapLibre style specification: MapLibre GL JS shows such a style with the default in `state` of the style, so give one (`state: {'color-scheme': {default: 'light'}}`). See [Dark mode](../guide/color-scheme.md).

### Fonts

Text uses the glyph files of the style (`glyphs`), as in MapLibre GL JS. A style without `glyphs` needs no glyph files: text then uses the fonts of the browser. The option `glyphs` of earlier versions is removed; to use the fonts of the browser, remove `glyphs` from the style. The style can also give font files in `font-faces`.

### `queryFeatures`, `querySource`

Find features, with the meaning that they have in `@map-jr/map-jr-gl`. `querySource(sourceId, at, options)` reads the tile data of one source, and you do not need a style layer. `queryFeatures(at, options)` gives what the style layers draw. See [Queries](map.md#queryfeatures).

### `queryElevation`

Gives the elevation at a position from a `raster-dem` source.

### Contour source

`type: 'contour'` makes contour lines from an elevation source. See [Terrain and elevation](../guide/terrain.md).

### PMTiles

A source URL that starts with `pmtiles://` reads a PMTiles archive. You do not need a plugin. The zoom range and the bounds in the header of the archive limit the tile requests; `minzoom`, `maxzoom` and `bounds` in the style take precedence over them.

### Changes for the server in the style

`metadata["map-jr:ssr"]` on a layer changes that layer only on the server.

### Images in the style

`metadata["map-jr:images"]` of a style gives images by name. The main entry (`@map-jr/map-jr-gl`), the compat entry (`@map-jr/map-jr-gl/maplibre-compat`) and the server renderer draw them; MapLibre GL JS ignores the key. An image of the style wins over the sprite image of the same name. In the compat entry, an image that the page adds with `addImage` wins over an image of the style with the same name, and `setMissingStyleImageResolver` gets only the names that the style does not have. See [Images in the style](../guide/images-and-fonts.md#put-images-into-a-style).

### Icons generated on demand

`setMissingStyleImageResolver` supplies an image for a name that the sprite does not contain.

### `toBlob(type, quality)`

Gives the map as an image: it waits until the map is idle, draws one frame and resolves to a `Blob` of the canvas, with both renderers. Use it instead of `preserveDrawingBuffer`, which has no effect (see "Reading the canvas" in [What is different](#what-is-different)).

### Frame data

The `stats` event gives the frames per second and the work for each frame.

### `supported()`

A function of the module. It returns `false` in a browser without WebGL2. MapLibre GL JS has had no such function since version 2. A map that cannot start fires one `error` and shows a message in the container (the class is `map-jr-unavailable`). See [A browser without WebGL2](../guide/getting-started.md#show-other-content-in-a-browser-without-webgl2).

### Controls without a CSS file

The library adds the styles for its controls to the root node of the container, so a map inside a shadow root has styled controls. You change the colors with `--map-control-*` custom properties. The rules for the buttons and links of the controls have the specificity of one class, as in MapLibre GL JS, so a page rule for `button`, `a` or `svg` does not change them and a page rule for a button needs two classes.

The other rules (the groups, the attribution, the scale, the icons) have no specificity, so a page rule with one class, such as `.maplibregl-ctrl-group {background: #010101}`, wins. The map option `nonce` sets the nonce of a strict `style-src` on the `<style>` element that a browser without constructed style sheets gets. See [Content Security Policy](../guide/loading.md#content-security-policy).

### The look of the controls

The controls, the popup, the scale and the attribution of the compat entry keep the look of MapLibre GL JS. The round, translucent look, the compass with a dial and the control `colorScheme()` belong to the main API (`@map-jr/map-jr-gl`) only. The popup of both entries fades and grows from its tip when it opens and closes, where the popup of MapLibre GL JS has no animation; `animate: false` turns it off.

## What is different

### The attribution after a change of the global state

- **MapLibre GL JS:** A source appears in the attribution when a `visibility` expression of the global state shows its layers. When the state hides them again, the source stays in the attribution until the next change of a source (MapLibre GL JS 6.17).
- **This library:** The attribution names a source while one of its layers is visible, and drops it when the state hides its layers again.

### Text

- MapLibre GL JS reads glyph files from the `glyphs` URL.
- This library does the same: glyphs and their widths come from the glyph files. Two cases use the fonts of the browser, or the web fonts of `fonts` (the option of the compat entry, or the field of the description of the main API): a character, font stack or range that the files do not have (most ideographs, emoji), and text that the browser must shape (Arabic, Hebrew, Indic scripts).
  This is like `localIdeographFontFamily` of MapLibre GL JS. A label waits for its glyph file, as in MapLibre GL JS. The map requests the file of the first 256 characters (`0-255`) of each font stack of the symbol layers in view when it starts, at the same time as the first tiles; MapLibre GL JS requests a glyph file only once a tile needs it.
- In both, text drawn with the fonts of the browser uses each name of the `text-font` list in order, with the weight and the style of the first name.
- This library takes the weight and style words out of each name (`Open Sans Bold` is the family `Open Sans`, where MapLibre GL JS asks for a family named `Open Sans Bold`).
- This library quotes every name except a CSS generic family keyword (MapLibre GL JS leaves nearly every name unquoted, and a name that is not a valid CSS identifier, such as one that starts with a digit, makes the font string invalid).
- This library tries `fontFamily` after the list, where MapLibre GL JS tries `sans-serif`.
- MapLibre GL JS uses `localIdeographFontFamily` alone for ideographs of the default font stack; this library has no such option and draws them with the same family list. This is a decision and will stay.

### Text on lines

- **MapLibre GL JS:** Each character follows the line. The style sets the largest angle.
- **This library:** Each character follows the line. A label does not show where the line turns more than about 35 degrees between characters.

### `fill-sort-key` and `line-sort-key` with a pattern for each feature

- **MapLibre GL JS:** The sort key orders all features of the layer.
- **This library:** The sort key orders the features that have the same image. The features of each image are drawn together.

### Order of symbol layers

- **MapLibre GL JS:** A symbol layer draws at its position in the layer list.
- This library does the same without 3D terrain: a fill, line or other layer between two symbol layers draws over the labels of the symbol layers before it and below the labels of those after it. Symbol layers that follow each other with no other visible layer between them draw their labels together. With 3D terrain, the labels of all symbol layers draw together, at the position of the last symbol layer that has labels, and the layers on the ground draw below all labels.

### A heatmap below an opaque layer

- **MapLibre GL JS:** A heatmap is drawn over an opaque fill or background layer that is above it in the style.
- **This library:** The layers draw in the order of the style, so the opaque layer covers the heatmap. This is a decision and will stay.

### Label placement

- **MapLibre GL JS:** Changes gradually, tile by tile.
- **This library:** The library decides about four times each second. Labels fade between decisions.

### Feature queries

- **MapLibre GL JS:** `queryRenderedFeatures` and `querySourceFeatures` return their result synchronously.
- **This library:** The two methods have the same arguments and return the same features, but the complete result is a promise. Add `await`. The tile data is in a worker. Without `await`, the value of each of the two methods is an array. For `queryRenderedFeatures` the array has the answer of the engine to the same question before (the same view, place and layers). Two rules make that answer present for usual MapLibre code. The map asks the engine about the place of a `mousedown` or `touchstart` and where the pointer rests for 50 ms. A `click`, `dblclick` or `contextmenu` listener that queries `e.point` therefore gets the features at once. When the answer is not there yet, the event waits for it for at most 300 ms, and after that the array has GeoJSON features only. A `mousemove` listener that reads the array gets the same `mousemove` a second time when the answer arrives and the pointer has not moved since, so hover through react-map-gl (`interactiveLayerIds`, `onMouseEnter`, `cursor`) works; the listener sees the first event with an empty array. When an array did not have the complete result, the map fires `idle` again, so code that queries on `idle` gets the features on its next call. For `querySourceFeatures` the array has the last answer of the engine for the same source and options (`sourceLayer`, `filter`), from any view, once the promise of an earlier call has settled. A change of the style keeps that answer, and new data of the source (`setData`, `refreshTiles`, `removeSource`) drops it. When that answer has more features than the array that the earlier call gave, the map fires `sourcedata` and `data` again for the last tile of the source that loaded, one time for that question, so code that queries when a tile loads, as Maputnik does, gets the features on its next call. Without an answer before, the array has the features of GeoJSON sources only. The features of a GeoJSON source whose data the page has are always read from that data, so they are current after `setData`: this is sufficient for plugins such as mapbox-gl-draw and for code that makes HTML markers from clusters. (For a GeoJSON source with its data at a URL, the first call gives an empty array; the source then fires its data events again, and the next call has the features.) A feature that several tiles hold is in the result one time when it has an id or comes from a GeoJSON source. MapLibre GL JS returns such a feature once for each tile whose area it touches: a GeoJSON polygon over the corner of four tiles comes four times from `queryRenderedFeatures` of MapLibre GL JS and one time here, and `querySourceFeatures` of MapLibre GL JS gives each feature once for each loaded tile that holds it. Two GeoJSON features with the same id are two results, as in MapLibre GL JS. `querySource` is also available: it reads data that the style does not draw. The promise is a decision and will stay: the tile data is in a worker, so the library has no synchronous result.

### Queries on labels

- **MapLibre GL JS:** A label is found on the collision boxes of its text and of its icon.
- This library does the same for text at a point and for icons. Text that follows a line is found on one square box for each glyph, centered where the glyph meets the line, where MapLibre GL JS uses a circle for each glyph. A label on a line whose text is not shown is not found, as in MapLibre GL JS. A label at a point whose text is not shown at the moment is found within 10 pixels of its point, and a line with an icon is found when the line passes within the reach of the largest icon or text box of the layer from the point of the query.

### Feature state

- **MapLibre GL JS:** The GPU applies the state. An `id` can be text.
- **This library:** `setFeatureState` and the `feature-state` expression work. A change builds the tiles of the source again in the background when a layer of that source reads feature state, so it shows after a short time. On a GeoJSON source, the `id` of a feature is its `id`, or the value of the property that `promoteId` names. Each can be a number or a string. A string `id` of a GeoJSON feature that is decimal digits and a safe integer becomes the number, as in MapLibre GL JS: `'12'` and `'012'` give `12`. Any other string `id` stays the string in `queryRenderedFeatures` and `querySourceFeatures`, and `setFeatureState` takes it. MapLibre GL JS 6.17.0 reads a string `id` with `parseInt` and gives a number for every one, so there a string needs `promoteId`: it gives `0` for `'square-a'`, `1` for `'1.5'`, `7` for `' 7'`, `18446744073709552000` for `'-3'` and `9007199254740992` for `'9007199254740993'`, where this library keeps the string. `promoteId` can also be an object, as in MapLibre GL JS: a GeoJSON source reads the property under the key `_geojsonTileLayer`. On a vector source, the `id` is the numeric `id` of the feature in the tile, or the value of the property that `promoteId` names, as in MapLibre GL JS: `promoteId` is a property name, or an object with a property name for each source layer. A string value stays the string, a boolean becomes `0` or `1`, and a feature without the property has no id. Without `promoteId`, a `setFeatureState` call with an `id` that is text (not digits) on a vector source changes nothing and writes one warning for the map. `setFeatureState` and `getFeatureState` with a feature that has no `id` change nothing and write one warning; MapLibre GL JS fires `error`.

### Style changes

- **MapLibre GL JS:** Applied step by step.
- **This library:** A paint value that is the same for all of a layer is applied immediately. Other changes build the tiles of that source again. The old tiles stay on the screen until the new tiles are ready.

### 3D terrain

- MapLibre GL JS draws terrain at each tilt.
- This library draws a flat map when you look vertically down. See [Terrain and elevation](../guide/terrain.md).

### Camera

- **MapLibre GL JS:** Tilt to 180 degrees with `maxPitch: 180` (the default `maxPitch` is 60). Roll. Field of view.
- **This library:** Tilt to 180 degrees with `maxPitch: 180` (the default `maxPitch` is 60, as in MapLibre GL JS). A larger `maxPitch` stops at 180 and writes one warning, where MapLibre GL JS throws an error. The map center is on the ground unless `setCenterClampedToGround(false)` and `setCenterElevation` give it a height, as in MapLibre GL JS: above a pitch of 90 a camera that is below the ground sees the map from below. No roll. `setVerticalFieldOfView` sets the field of view in degrees from 0.1 to 150, as in MapLibre GL JS, and the default is 36.87. The main API (`@map-jr/map-jr-gl`) has no field of view option and keeps the default. Padding is available.

### Miter joins longer than about 2

- **MapLibre GL JS:** A miter join whose length is more than 127/63 (about 2.02) times the line width breaks into a notch, because the extrusion of the vertex overflows its byte (the render test `line-miter-limit/global-state` shows it).
- This library draws the full miter up to `line-miter-limit`.

### `line-gradient` and the GeoJSON option `lineMetrics`

- **MapLibre GL JS:** A line layer with `line-gradient` needs a GeoJSON source with `lineMetrics: true`. Without it, the style fails to load with the error "layer specifies a line-gradient, which requires a GeoJSON source with `lineMetrics` enabled", and the map draws nothing.
- This library measures the lines of each GeoJSON source that a `line-gradient` layer uses, so the gradient is drawn whether `lineMetrics` is `true`, `false` or missing. It does not read `lineMetrics`. The development build of `@map-jr/map-jr-gl/maplibre-compat` warns once for each such layer when the GeoJSON source does not have `lineMetrics: true`, unless the option `validate` is `false`.

### The pixel ratio

- **MapLibre GL JS:** Without the option `pixelRatio`, the canvas follows `devicePixelRatio` with no limit. A
  `pixelRatio` of 0, a negative number or `NaN` is used as it is, with no message.
- **This library (`@map-jr/map-jr-gl/maplibre-compat`):** Without the option, the canvas follows `devicePixelRatio` up
  to 3. A `pixelRatio` that is not a number above 0 writes a warning, and the map follows `devicePixelRatio`.

### The lowest zoom

- **MapLibre GL JS:** `minZoom` is -2 by default. The world is never less tall than the map.
- This library does the same.

### The `renderWorldCopies` option

- **MapLibre GL JS:** With `renderWorldCopies: false` or `setRenderWorldCopies(false)`, the view stays inside -180 to 180 degrees of longitude, and the zoom rises until the world is as wide as the view. Only the tiles of one world load, markers and popups are not wrapped to the copy of the world nearest the center, and the `background` layer is drawn over that world only.
- This library does the same in both entries (`renderWorldCopies` of the description in `@map-jr/map-jr-gl`), with one difference: the `background` layer fills the whole view, so past the antimeridian a tilted or rotated view shows the background color where MapLibre GL JS shows the color of the page.

### The `cooperativeGestures` option

- **MapLibre GL JS:** The wheel zooms only with Ctrl (⌘ on a Mac), one finger scrolls the page, two fingers move the map, and a hint shows over the map. `map.cooperativeGestures` has `enable()`, `disable()`, `isEnabled()` and `isBypassed()`.
- This library does the same behavior and the same hint. The option `locale` changes the text of the hint, with the keys of MapLibre GL JS (`CooperativeGesturesHandler.WindowsHelpText`, `MacHelpText` and `MobileHelpText`). The event `cooperativegestureprevented` fires with `gestureType` (`'wheel_zoom'` or `'touch_pan'`) and `originalEvent`. The code of the hint loads on demand when the option is on. Until it has loaded, the gestures are blocked and the hint does not show. The hint has its look in its `style` attribute, and the class `maplibregl-cooperative-gesture-screen` for stylesheets. MapLibre GL JS changes the pitch with three fingers while the option is on; this library does not change the pitch by touch while the option is on, and two fingers that move up or down in parallel pan the map in both libraries. MapLibre GL JS fires `cooperativegestureprevented` for each movement of one finger; this library fires it from 150 ms after the first finger touches the map, and not at all for a touch that has had two fingers by then.

### The `hash` option

- **MapLibre GL JS:** The camera in the fragment of the URL.
- This library does the same, with the same format.

### Tile URLs

- **MapLibre GL JS:** `{z}`, `{x}`, `{y}`, `{bbox-epsg-3857}`, `{quadkey}`, `{ratio}`, `{prefix}`; the `scheme` `tms`.
- This library does the same. `{bbox-epsg-3857}` is for WMS servers. `{ratio}` is `@2x` when the pixel ratio of the map is above 1, for every kind of source, as in MapLibre GL JS.

### The `bounds` of a source

- **MapLibre GL JS:** A tile outside the bounds is not requested.
- This library does the same, for bounds in the style and in the TileJSON. Not for the bounds in the header of a PMTiles file.

### An image tile that the server does not have (404)

- **MapLibre GL JS:** The nearest tile above it is drawn in its place.
- This library does the same, for raster and elevation tiles.

### An empty tile (204) and the source property `emptyResponse`

- **MapLibre GL JS:** A response of HTTP 204 is an empty tile, and nothing is drawn there. Version 6.17 does not read the source property `emptyResponse`, so `"missing"` has the same result as the default `"blank"`.
- This library does the same. The value `"missing"` writes a warning one time for each source.

### A tile whose request fails

- **MapLibre GL JS:** The failure fires `error` once. The tile is not requested again while it stays in the view. It
  is requested again when it leaves the view and comes back, or when the source loads again (MapLibre GL JS 6.17).
- **This library:** A tile whose request fails with a network error or an HTTP status 5xx is requested again after
  0.5 s, 1 s and 2 s. Each of these four failures fires `error`, and `idle` waits for the retries.
- After the fourth failure, the map is idle without the tile, and the tile is requested again every 15 s while the
  view or the overview needs it. These later requests run in the background: they do not make the map leave `idle`,
  they fire no `error` when they fail, and a tile that one of them loads is drawn.
- A status 4xx other than 404, a rejection by a custom protocol and an error of `transformRequest` are final, as in
  MapLibre GL JS.

### GeoJSON sources

- **MapLibre GL JS:** `setData`, `getData`, `updateData`, the cluster methods.
- This library does the same. `updateData` makes the new data from the old data and the changes, and then replaces the data of the source in one step. The `buffer` option sets how far past its edges a tile keeps the features, in pixels of a tile 512 pixels wide, as in MapLibre GL JS (at most 512). Without `buffer`, a tile keeps 128 pixels, as in MapLibre GL JS (the main entry `@map-jr/map-jr-gl` keeps 16). The `tolerance` option simplifies lines and polygons for each zoom level as geojson-vt does. The default is 0.375 in both entries, as in MapLibre GL JS. Unlike geojson-vt, a line or polygon smaller than the tolerance is not dropped.

### `Marker` and `Popup`

- **MapLibre GL JS:** Rotation, pitch alignment, offsets, class names.
- This library does the same methods. `pitchAlignment` is kept but has no effect: a marker is always upright on the screen. `Popup` has the options `focusAfterOpen`, `closeOnMove`, `trackPointer` and `subpixelPositioning` with the defaults of MapLibre GL JS, and the methods `trackPointer()` and `setSubpixelPositioning()`. A popup that follows the pointer does not move with a touch. With the worker renderer, a marker or popup moves in the same frame as the map during a drag, but it can trail an `easeTo`, `flyTo`, a fling or a pinch by about one frame, because the page learns the camera from the worker after the frame. A symbol layer never trails. See [How closely an element of the page follows the map](map.md#overlay).

### `Point`

- MapLibre GL JS re-exports `Point` of `@mapbox/point-geometry`, with about 30 methods.
- This library exports a smaller `Point` with `convert`, `clone`, `add`, `sub`, `mult`, `div`, `round`, `mag`, `dist` and `equals`. The other methods (for example `rotate`, `unit`, `angle`, `matMult`) do not exist.

### Private members that wrappers read

- **MapLibre GL JS:** `Marker._map`, `Marker._lngLat`, `Map._controls` are internal fields.
- **This library:** `Marker._map`, `Marker._lngLat` and `Map._controls` exist as read-only getters with the same values. `map.style` exists before the style has loaded (with `_loaded` `false`), has `updateImage` (svelte-maplibre-gl reads it), and has `_loaded`, and `tileManagers` (also named `sourceCaches`, as in MapLibre GL JS 5) with one entry for each source; the entry has only `_source` with `id`, `type` and `vectorLayerIds`, the ids of `vector_layers` of the TileJSON of a vector source (Maputnik reads them). `map.style.projection.subdivisionGranularity` has `fill`, `line`, `tile` and `stencil`, each with `getGranularityForZoomLevel(z)`, and `circle`, with the values of MapLibre GL JS 6.17 for the projection of the style (the example page "Add a custom layer with tiles to a globe" reads it); the map draws a custom layer only while the projection is Mercator. `map.transform` and `getTransformForUpdate()` (also `_getTransformForUpdate()`, and `_stop(true)`, which is `stop()`) give a copy of the camera with `center`, `zoom`, `bearing`, `pitch`, `roll` (always 0), `elevation` and `isPaddingEqual`, which svelte-maplibre-gl reads. Other private members do not exist.

### TypeScript types

- MapLibre GL JS exports types and classes such as `MapMouseEvent`, `StyleSpecification`, `GeoJSONSource`.
- This library exports types with the same names (`src/compat-types.ts`). The event names are types only: you cannot use them with `new` or `instanceof`. The source names are also values for `instanceof`, which tests the `type` of the source, and `new` does not make a source. `new Event(type, data)` works, but the events that the map fires are not instances of `Event`. The style types do not check each property: `LayerSpecification` accepts any string as `type` and any names in `paint` and `layout`. `map.on`, `map.once` and `map.off` give the listener the event type that belongs to the name of the event (`MapEventType`, `MapLayerEventType`), and an event name that is not in those lists gets an event of the type `any`. The geometry of a queried feature is the library's own `Geometry` type, which has no `GeometryCollection`. The compat types accept values that are typed with `maplibre-gl`, such as a `StyleSpecification`, a layer, a source or a filter. The reverse direction does not work: a value typed with the compat entry is not always assignable to a type of `maplibre-gl`, and a compat `MapLayerMouseEvent` is not assignable to the one of react-map-gl. A project that uses react-map-gl therefore keeps `maplibre-gl` installed and imports its types from `maplibre-gl`.

### `isSourceLoaded`

- MapLibre GL JS gives a result for one source. An id that the style does not have fires `error`, and the result is `undefined`.
- This library does the same. The message of the error is `There is no source with ID "<id>"`, and MapLibre GL JS 6.17 writes `There is no tile manager with ID '<id>'`.

### `addImage`

- MapLibre GL JS accepts images and pixel data.
- This library accepts the same, and also an SVG string or a URL. It returns a promise.

### `easeTo`, `flyTo`

- Both accept an `easing` function and an `offset`.
- Both accept both, as MapLibre GL JS does. `offset` ([x, y] or {x, y}, in CSS pixels) puts `center` at that distance from the center of the view at the end, also with `bearing` and `pitch`. The library samples the `easing` function at 65 points when the call is made and interpolates linearly between them, so a curve with a change that is narrower than 1/64 of the duration is smoothed. `flyTo` zooms out and back in along the curve of MapLibre GL JS 6.17 (van Wijk and Nuij), with the options `curve`, `speed`, `screenSpeed`, `minZoom` and `maxDuration`; without `duration`, the duration follows from the distance. When the system asks for reduced motion and `essential` is not `true`, `flyTo` jumps, as in MapLibre GL JS. `fitBounds` and `fitScreenCoordinates` fly in the same way, or ease as `easeTo` does when the options set `linear`, as in MapLibre GL JS.

### Events

- **MapLibre GL JS:** Event classes.
- **This library:** Simple objects with `type`, `target`, `point` and `lngLat`. `point` (and each of `points` of touch events) is a `Point`, as is the result of `project()`.

### Data events of tiles

- **MapLibre GL JS:** `data` and `sourcedata` fire with `dataType: 'source'` and `e.tile` for each tile that loads. `e.tile` is a `Tile` object.
- This library does the same events fire for each tile that loads, after a listener for `data` or `sourcedata` has been added (tiles that loaded before do not fire). `e.tile` is a plain object with `tileID` (`canonical` with `z`, `x`, `y` and `key`, `overscaledZ`, `wrap` that is always `0`, `key`) and `state` that is `'loaded'`; it has no other member of the `Tile` class. This is a decision and will stay. `e.coord` is the same `tileID`, and `e.source` is the result of `getSource(sourceId)`.

### Events for one layer

- **MapLibre GL JS:** `map.on('click', layerId, fn)` calls the listener synchronously.
- This library does the same call works, also with an array of layer ids (`map.on('mouseenter', ['a', 'b'], fn)`). A second argument that is neither a layer id, an array of layer ids nor a function makes `on` throw a `[map-jr-gl]` error. The event fires shortly after the pointer event, because the library reads the tile data.

### Interaction handlers

- **MapLibre GL JS:** `map.dragPan`, `map.scrollZoom`, `map.boxZoom` and others, each with `enable()` and `disable()`.
- This library does the same objects are available: `dragPan`, `scrollZoom`, `doubleClickZoom`, `dragRotate`, `touchZoomRotate`, `touchPitch`, `keyboard`, `boxZoom`. `isActive()` is `true` during the gesture for `dragPan` (from the press of the mouse button, or from the first movement of one finger), `dragRotate` (from the first movement of a rotate drag), `touchZoomRotate` (a pinch, or a double tap held and dragged), `touchPitch` (a tilt with two fingers) and `boxZoom` (from the press of the mouse button with Shift held). `dragPan` is also active during a pinch. It is `false` again when a pointer of the gesture lifts, and during the movement that follows a drag. `scrollZoom.isActive()` is `true` from a wheel event until 200 ms after the zoom has ended (for a mouse wheel, about 400 ms after the last event). `doubleClickZoom.isActive()` is `true` after a double tap only until the next task. As in MapLibre GL JS, `doubleClickZoom.isActive()` is `false` for a double click of the mouse, and `keyboard.isActive()` is always `false`. `isActive()` of `cooperativeGestures` always returns `false`. Box zoom works as in MapLibre GL JS: a drag with Shift held and the left mouse button draws a box, zooms to it, and fires `boxzoomstart`, `boxzoomend` (with `boxZoomBounds`) or `boxzoomcancel`. Box zoom does not work with touch input. With `interactive: false`, every handler is off, and the map still fires `click`, `mousemove` and the events of layers, as in MapLibre. The `interactive` option of `@map-jr/map-jr-gl` behaves the same.

### Rotate drag (the right mouse button, or Ctrl with the left one)

- **MapLibre GL JS:** More than 100 pixels above or below the center of the map, the map turns by the angle that the pointer makes around that center. Nearer to the center, the map turns by 0.8 degrees for each pixel sideways: a drag to the right increases the bearing below the center and decreases it above the center. The map pitches by 0.5 degrees for each pixel up. After the drag, the map turns on with inertia. A drag with Ctrl and the right button rolls the map. The compass of `NavigationControl` turns the map by the angle around the center of the button.
- **This library:** In both entries, the drag turns and pitches the map by the same angles as MapLibre GL JS 6.17.0. After a drag that is released while it moves, the map turns and pitches on with the inertia of MapLibre GL JS (the speed of the last 60 ms, at most 360 degrees per second for the bearing and 90 for the pitch). A drag with Ctrl and the right button turns and pitches the map as a drag with the right button does, because the map has no roll. The options `rotateSpeed`, `pitchSpeed` and `aroundCenter`, an object as `dragPan` or `dragRotate`, and the options of `map.dragPan.enable(options)` and `map.dragRotate.enable(options)` have no effect. Each warns once for any object, and for a value other than the default. The compass of both entries turns the map by 0.4 degrees for each pixel sideways, and a drag to the right decreases the bearing: an angle around the center of the button makes the map jump when the pointer passes near that center.

### Pointer events

- **MapLibre GL JS:** `mousedown`, `mouseup`, `touchstart` and others, with `preventDefault()`.
- This library does the same events. A listener that calls `preventDefault()` on `mousedown`, `touchstart`, `wheel` or `dblclick` stops the map from acting on that gesture.

### `setWorkerUrl`

- MapLibre GL JS sets the URL of the worker file of MapLibre GL JS.
- This library sets `workerUrl` of `configure`. The URL must point to `map-jr-gl-worker.js`. A URL whose file name contains `maplibre-gl` and `worker` (such as `maplibre-gl-worker.mjs`) is ignored with one warning, and `getWorkerUrl()` then still returns `''`. Remove the call: the library finds its worker file itself.

### Requests

- **MapLibre GL JS:** The `transformRequest` option and `addProtocol`.
- This library does the same. The functions run on the page; the workers ask the page for each request that they apply to. A protocol named `pmtiles` is not used: the library reads `pmtiles://` URLs itself, and `addProtocol('pmtiles', …)` warns once in every build. Remove that call. A tile of a `raster` or `raster-dem` source, an image of `loadImage`, of `addImage` with a URL or of an `image` source, and the image of a sprite have the request type `image`, as in MapLibre GL JS, and the protocol can answer with an `ImageBitmap`, an `HTMLImageElement` or the bytes of an image file. `transformRequest` receives the requests of `loadImage` with the resource type `Image`, as in MapLibre GL JS.

### `Marker`, `Popup`

- **MapLibre GL JS:** Full API.
- **This library:** The usual parts of the API: position, popup, drag, anchor, offset. `Map.remove()` removes the popups and the markers of the map from the page at once, and each open popup fires `close`, as in MapLibre GL JS. `offset` and `setOffset` take `[x, y]`, `{x, y}` or a `Point`. `getOffset()` returns a `Point`, as in MapLibre GL JS.

### The Escape key in a `Popup`

- MapLibre GL JS does not close the popup. An application adds a listener for the key.
- This library closes a popup that has a close button while the keyboard focus is inside the popup, as a click on the button does: the popup fires `close`, and the focus returns to the marker of the popup, or to the canvas of the map. The popup calls `preventDefault()` and `stopPropagation()` on that `keydown` event. A popup with `closeButton: false` does not react, and neither does a popup whose content called `preventDefault()` on the event.

### `addImage` with an image that draws with WebGL

- MapLibre GL JS accepts an image whose `data` has `renderWithWebGL` (`StyleImageWebGLData`).
- **This library:** Not supported. The promise rejects with an error that names the image, and the map keeps working.

### `updateImage`

- MapLibre GL JS replaces the pixels of an image in place and keeps its options. New pixels of another size fire an `error` event, and the image stays as it was.
- This library replaces the pixels in place and keeps the options, as MapLibre GL JS does, and the icons keep their places. New pixels of another size replace the image as `addImage` would, with the old options. It accepts a URL and an SVG string as `addImage` does, and it returns a promise. Pixels, ImageData and drawables are sent to the map at the end of the task, so of several calls in one task only the last is drawn.

### `getImage`

- MapLibre GL JS returns the decoded RGBA pixels.
- This library returns `{width, height, data: Uint8Array}` RGBA pixels for an image added as pixels, a canvas, an image element or a bitmap. For an image added as a URL or as SVG text, `data` is the string that `addImage` was given, because decoding it again is asynchronous.

### The option `bearingSnap` after a rotate drag with inertia

- MapLibre GL JS sets the bearing of the inertia to 0 when a rotate drag ends closer to north than `bearingSnap`, so the map turns north while it keeps turning.
- The entry `@map-jr/map-jr-gl/maplibre-compat` lets the inertia of a rotate drag end first and then turns the map north with `resetNorth`. The inertia of a pan turns north as in MapLibre GL JS.

### `setStyle`

- MapLibre GL JS returns the map.
- This library returns a promise that settles when the new style has loaded.

### `setFeatureState`, `getFeatureState` without an `id`

- Both fire `error`.
- Both warn once. `setFeatureState` changes nothing, and `getFeatureState` returns `{}`.

### `coveringTiles`

- MapLibre GL JS returns `OverscaledTileID` objects.
- This library returns plain objects with the same fields: `{canonical: {z, x, y, key}, wrap, overscaledZ, key}`.

### Touch gestures

- **MapLibre GL JS:** You can configure each gesture.
- This library does the same gestures. `touchZoomRotate` and `touchPitch` have `enable()`, `disable()` and `isEnabled()`, and the constructor options of the same names turn them off. `touchZoomRotate.disableRotation()` keeps the pinch zoom and stops the rotation.

### Expressions

- MapLibre GL JS checks the types.
- This library does not check the types. An expression that is not correct can give no error. This difference is a decision and will stay in the production build. Checks in the development build are possible later. `number-format` with a `locale` that is not text, or with a `locale`, a `currency`, a `unit` or a number of fraction digits that `Intl.NumberFormat` of the browser does not accept gives the number as plain text (`1234.5`), and each such expression writes one warning. A zoom-based `step` or `interpolate` that is nested in another expression, a second one in the same expression, and a `["zoom"]` that is not the input of one (for example `["/", ["zoom"], 10]`) are drawn as they read, where MapLibre GL JS rejects the style, or the call of `addLayer`, `setPaintProperty` or `setLayoutProperty`. The development build of `@map-jr/map-jr-gl` writes one warning for each such property, with the layer and the property. The development build of `@map-jr/map-jr-gl/maplibre-compat` fires `error` with the text of MapLibre GL JS (for example `layers.roads.paint.line-width: "zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.`), once for each layer, property and value, and keeps the style. The production builds of both entries say nothing.

### Style validation

- MapLibre GL JS reports errors in the style.
- This library does not validate the style. It writes a warning for each layer or property that it cannot draw. Five calls fire `error` and change nothing, as in MapLibre GL JS: `addLayer` with an id that exists, `addLayer` with a source that the style does not have, `addLayer` with a source object when the style has a source with the id of the layer, `addSource` with an id that exists, and `removeSource` of a source that a layer uses. (MapLibre GL JS throws in the third case.) That the production build does not validate the style is a decision and will stay. The development build (`dist/*.dev.js`) checks the required fields of the style: the `id`, `type` and `source` of a layer, the `source-layer` of a layer of a vector source, the `type` of a source, `data` of a GeoJSON source, and `urls` and `coordinates` of an image or video source. It also checks the types of the values: a layer `type` that the style specification does not have, `minzoom` and `maxzoom`, a source of the wrong type for a layer (for example `layer "hills" requires a raster-dem source` for a `hillshade` or `color-relief` layer), and each paint and layout value that is not an expression or a function (an enum value, a color, a number and its minimum and maximum, a boolean, and an array and its length). It checks each expression of a paint or layout property as MapLibre GL JS compiles it: an unknown operator, the number and the types of the arguments, a result type that does not fit the property (for example `Expected number but found string instead.`), a data expression (such as `["get", "w"]`) for a property that takes none, and `"feature-state"` in a layout property. For each fault it fires `error` with the text of MapLibre GL JS 6.17, once for each place and text, and draws what it can, where MapLibre GL JS does not load the style. The map option `validate: false` turns these checks off. It does not check an expression of a filter, the check of MapLibre GL JS that the output values of an expression of `text-font` are literals, a value of `icon-image`, `text-field` or `text-variable-anchor-offset`, or the values of a source.
- A paint or layout property that the style specification does not have for the type of the layer (for example `circle-radious`) has no effect in both entries, where MapLibre GL JS rejects the style, or the call of `addLayer`, `setPaintProperty` or `setLayoutProperty`. The development build of `@map-jr/map-jr-gl` writes one warning for each layer and property, and the development build of `@map-jr/map-jr-gl/maplibre-compat` fires `error` with the text of MapLibre GL JS (`layers.<id>.paint.circle-radious: unknown property "circle-radious"`). Both name the nearest property of that layer type when one is near, such as `circle-radius`. The production build checks nothing. A property in the wrong group (a layout property in `paint`) is not reported, and the map reads it from either group.

### Reading the canvas

- **MapLibre GL JS:** `canvasContextAttributes: {preserveDrawingBuffer: true}` keeps the image, so `getCanvas().toDataURL()` works at any time.
- **This library:** `preserveDrawingBuffer` has no effect, and `new Map()` warns once and names `map.toBlob()` (see the next row). With the worker renderer, `drawImage(map.getCanvas())`, `createImageBitmap(map.getCanvas())`, `getCanvas().toDataURL()` and `getCanvas().toBlob()` give the last frame once the map has fired `idle`, and at any time after that. In WebKit the first task that reads such a canvas after its first frame gets blank pixels, and the tasks after it get the frame. The map makes that first read itself, at its first frame and when it becomes idle, so a read of the application at `idle` or later gets the frame. In WebKit a read inside the `render` listener of the first frame still gives a blank image (6 of 6 loads); the `render` events after it give the frame (in Playwright's WebKit on macOS). With the main renderer, the browser may clear the drawing buffer after each frame (WebGL allows this, and the reviews of 2026-11-12 saw a blank image), so they give the frame reliably only inside a `render` listener (call `triggerRepaint()` to get one). Use `map.toBlob()`, which works with both renderers and waits for the tiles. Read the canvas after `idle`, not after `loaded()` returns true.

### Options and layers with no effect

- **MapLibre GL JS:** 
- **This library:** The constructor options `projection` (which MapLibre GL JS 6.17 does not have either: use the style or `setProjection`), `canvasContextAttributes` (other than `antialias`), and `logoPosition` have no effect. Each writes one warning. For `canvasContextAttributes` and `logoPosition`, this is a decision and will stay. The globe: the root property `projection` of a style, `setProjection` and `GlobeControl` take `globe`, `vertical-perspective` and expressions of them, and `getProjection` returns the projection of the style as it was given, or `undefined` when the style has none, as in MapLibre GL JS. `projectiontransition` fires with `newProjection` for each new style and when the name of the projection changes. On the globe, 3D terrain is drawn on the sphere and the camera looks at the ground under the center, as in MapLibre GL JS; the camera is not lifted clear of a mountain beside the center, and positions on the screen away from the center (labels, `queryRenderedFeatures`, `unproject`) are those of a sphere at the height of the center, `fill-extrusion` layers stand along the normal of the sphere as in MapLibre GL JS, with the light of Mercator, and their roofs and walls are cut along the grid of the globe so that they follow the sphere, as in MapLibre GL JS, `maxBounds` has no effect (as in MapLibre GL JS), a drag turns the globe as MapLibre GL JS 6.17 does (the center after a drag agrees within 0.3°), and `queryRenderedFeatures` is less exact near the horizon. On the globe, `jumpTo`, `easeTo`, `flyTo`, `panBy` and `setCenter` without a `zoom` keep the size of the globe and change the zoom, as in MapLibre GL JS, and `flyTo` follows MapLibre's curve on the globe (the lowest zoom of a flight agrees within 0.01). A drag toward a pole at `minZoom` stops at `minZoom`, where MapLibre GL JS goes slightly below it (to about -2.035 against -2). A switch from Mercator to the globe shows the globe when the tiles of the view are built again with the cut for the globe (or after 1 s at most), so the edge of the globe does not show the background in wedges; MapLibre GL JS switches at once and shows such wedges for a moment. A label whose anchor turns behind the globe is not drawn from that frame on; MapLibre GL JS 6.17 hides it only at its next placement and fades it out, so that during a fast drag its labels show through the globe for a moment (for 160 ms or more in a drag at 1500 px/s). The server renderer draws Mercator. Another name (for example `identity`) writes a different warning, and the map draws Mercator. `NavigationControl` follows `visualizePitch` as MapLibre GL JS does: by default (false) dragging the compass only rotates the map, a click resets only the bearing, and the compass does not show the pitch; with `visualizePitch: true` the compass shows the pitch, dragging it also pitches the map, and a click resets both. A drag of more than 3 pixels that ends on the compass does not reset the bearing. A drag that starts on the compass turns the map as a drag on the map with the right mouse button does: 0.4 degrees of bearing for each pixel sideways, wherever the pointer is. MapLibre GL JS turns the map by the angle of the pointer around the center of the compass, which changes little once the pointer is far from it. The map option `fadeDuration` (other than 300) has no effect and writes one warning, because labels fade for a fixed time. The map option `pitchWithRotate: false` has no effect and writes one warning, because a drag with the right mouse button always turns and tilts the map. The option `locationOccludedOpacity` of `Popup` has no effect, and writes one warning per page when it is given. A `Marker` on the far side of the globe takes `opacityWhenCovered` (default 0.2) and the class `maplibregl-marker-covered`, as in MapLibre GL JS; 3D terrain does not cover a marker. `setStyle` always replaces the whole style, as MapLibre GL JS does with `diff: false`. The option `diff: true` (the default of MapLibre GL JS) gives the same style, but without the shorter update, and it writes no warning, because wrappers such as react-map-gl pass it on every style change. The events are those of MapLibre GL JS 6.17. With `diff`, a style that is equal to the style of the map, apart from `center`, `zoom`, `bearing`, `pitch` and `roll`, changes nothing and fires no event. Any other style, including one with another sprite or one changed paint value, fires `style.load` once. With `diff: false`, every style fires `style.load`.

### `setTransformCameraUpdate`

- MapLibre GL JS calls the function before each frame and draws the camera that it returns. react-map-gl 8 gives every map such a function, so that a controlled map (`viewState` with `onMove`) never draws a camera that differs from `viewState`.
- This library calls the function after each `move` event and does not apply what it returns. A controlled react-map-gl map works when `onMove` sets `viewState` to `e.viewState`, and a change of `viewState` from outside moves the map. When `onMove` changes the camera (for example when it limits the latitude), the map draws the camera of the gesture, and goes to the camera of `viewState` when the movement ends. The map writes one warning the first time the function changes the camera, and no warning for a map where it does not. To keep the map in a region, use the option `maxBounds`.

### A listener that throws

- **MapLibre GL JS:** The error leaves `fire`, and the listeners after it do not get the event.
- **This library:** Each listener gets the event, and what a listener threw is an `error` event.

### A query and `remove()`

- **MapLibre GL JS:** The result is synchronous.
- **This library:** The promise of a query that has no answer yet, or that is asked after `remove()`, rejects with the error `[map-jr-gl] The query has no answer: the map was removed.` After a lost WebGL context it rejects in the same way, and the message says to ask again. A result whose promise nobody awaits gives no unhandled rejection.

### `strict`

- **MapLibre GL JS:** 
- **This library:** The constructor option `strict: true` makes each of these warnings and `error` events an error that is thrown. Use it in tests and while you change from MapLibre GL JS. The default is `false`.

### CSS class names

- **MapLibre GL JS:** `maplibregl-*`
- **This library:** `map-jr-*`. Each element also has the `maplibregl-*` name, so stylesheets and plugins for MapLibre GL JS continue to work. In `@map-jr/map-jr-gl/maplibre-compat`, the container has `maplibregl-map`, the canvas has `maplibregl-canvas`, and the buttons of the controls have `maplibregl-ctrl-zoom-in`, `maplibregl-ctrl-zoom-out`, `maplibregl-ctrl-compass`, `maplibregl-ctrl-fullscreen`, `maplibregl-ctrl-geolocate` and `maplibregl-ctrl-terrain`. There is no `maplibregl-canvas-container` element: `getCanvasContainer()` returns the container. As in MapLibre GL JS, that element has `maplibregl-touch-drag-pan` while `dragPan` is enabled and `maplibregl-touch-zoom-rotate` while `touchZoomRotate` is enabled. There is no `maplibregl-control-container` element either: the four corners of the controls (`maplibregl-ctrl-top-left` and the others) are children of the container, so a selector that contains `.maplibregl-control-container` matches nothing. That the compat entry has neither element is a decision and will stay. A popup has no `maplibregl-popup-anchor-*` class, and its tip is a rotated square inside the box of the popup, so CSS that targets the anchor classes or styles the tip as a border triangle has no effect. As in MapLibre GL JS, each button has a `maplibregl-ctrl-icon` child, the fullscreen button has `maplibregl-ctrl-shrink` in place of `maplibregl-ctrl-fullscreen` while the map fills the screen, the terrain button has `maplibregl-ctrl-terrain-enabled` in place of `maplibregl-ctrl-terrain` while the map has terrain (the `map-jr-*` base names stay), and the geolocate button has the `maplibregl-ctrl-geolocate-*` state names. A control from a plugin gets the `map-jr-*` names when you add it. As in MapLibre GL JS, the container sets the font (`12px/1.3 system-ui, sans-serif`, where MapLibre uses Helvetica Neue) and the controls inherit it, and the canvas of an interactive map has `maplibregl-interactive` and shows the `grab` cursor, or `grabbing` while a button is down.

### `setStyle` in the constructor

- **MapLibre GL JS:** The constructor calls `this.setStyle(options.style)`, so a subclass or a patch of `Map.prototype.setStyle` sees the first style.
- **This library:** The constructor loads the first style without a call of `setStyle`. A patched `setStyle` runs only for later calls. To change the first style, change `options.style` before you construct the map. This is a decision and will stay.

### Images added at run time

- **MapLibre GL JS:** 
- **This library:** All images that `addImage` adds share one texture of 2048 by 2048 pixels (in device pixels, so an image takes four times its area on a screen with a pixel ratio of 2). When a new image finds no free place, the map packs all of its images again; when they still do not fit, it reports one error, and later images are not drawn. Remove images that the map no longer needs.

### Methods of sources

- **MapLibre GL JS:** `getSource()` returns an object of a source class with methods for its type.
- **This library:** `getSource()` returns the specification of the source with these methods added. A GeoJSON source has `setData`, `getData`, `updateData`, `getBounds`, `setClusterOptions`, `getClusterExpansionZoom`, `getClusterChildren` and `getClusterLeaves`, which give promises, and `getClusterOptions`. An image source has `updateImage` and `setCoordinates`. A video source has `getVideo`, `play`, `pause`, `seek` and `setCoordinates`. A canvas source has `getCanvas`, `play`, `pause` and `setCoordinates`. A vector, raster or raster-dem source has `setTiles`, `setUrl` and `reload` (see [Source methods](#source-methods)). The object is a new copy at each call.

### Methods of controls

- **MapLibre GL JS:** Each control class has its own methods, for example `GeolocateControl.trigger`.
- **This library:** Each control has `onAdd` and `onRemove`. `AttributionControl`, `ScaleControl`, `GlobeControl` and `LogoControl` also have `getDefaultPosition`, `ScaleControl` has `setUnit('metric'

### `addControl` with a value that is not a control

- MapLibre GL JS fires `error` when a position is given. Without a position, `addControl(undefined)` throws a `TypeError`.
- **This library:** In `@map-jr/map-jr-gl/maplibre-compat`, fires `error` and returns the map, with or without a position. A position that does not exist throws an error that names it, before `onAdd` runs; MapLibre GL JS calls `onAdd` and then throws a `TypeError`.

### The `locale` option

- MapLibre GL JS changes the UI strings, with keys such as `'NavigationControl.ZoomIn'` (see `src/ui/default_locale.ts` of MapLibre GL JS). A missing key keeps the English text.
- This library does the same keys as MapLibre GL JS 6.17.0, for the buttons of the controls, the units of `ScaleControl` and the hint of `cooperativeGestures`. A missing key keeps the English text of this library, which differs from MapLibre's in places (the compass is "Reset bearing to north"). `map._getUIString(key)` returns the text of the option, or `undefined` for a key that the option does not have. The close button of `Popup` (`Popup.Close`) and the name of the default `Marker` (`Marker.Title`) take the text when they are added to the map; a `Marker` with an element of your own keeps its attributes. The `aria-label` of the canvas takes `Map.Title` when the map is made. A value that is not an object writes a warning and is ignored.

### `FullscreenControl`

- MapLibre GL JS uses the Fullscreen API, and falls back to "pseudo fullscreen" (the class `maplibregl-pseudo-fullscreen`, which makes the container fill the window) where the browser has none, or with `pseudo: true`.
- This library does the same, with the options `pseudo` and `container` (the element that goes fullscreen, by default the container of the map) and the same class (that element has `map-jr-pseudo-fullscreen` too). `fullscreenstart` and `fullscreenend` fire in both modes. The control does not use the prefixed `webkitRequestFullscreen`, so Safari on an iPad older than 16.4 gets the pseudo fullscreen. Removing the control ends a pseudo fullscreen. As in MapLibre GL JS, `cooperativeGestures` is off while the map is fullscreen (in both modes), and on again when it leaves fullscreen if it was on before.

### `GeolocateControl`

- MapLibre GL JS can track the position, shows a dot at it, and draws an accuracy circle.
- **This library:** Without `trackUserLocation`, moves the map to the position once per click or `trigger()` call. With `trackUserLocation`, the button turns tracking on and off as in MapLibre GL JS: the map follows the position until it moves for another reason, and a click returns to the position. The button gets the classes `maplibregl-ctrl-geolocate-waiting`, `-active`, `-active-error`, `-background` and `-background-error`, and `showUserLocation` (default `true`) shows the element `maplibregl-user-location-dot` while tracking is on. `showAccuracyCircle` (default `true`) also shows the element `maplibregl-user-location-accuracy-circle`, whose diameter is twice `coords.accuracy` in meters at the current zoom and latitude, as in MapLibre GL JS. As in MapLibre GL JS, the circle is never shown when `showUserLocation` is `false`. The circle stays round when the map is pitched, where MapLibre GL JS lays it flat on the map. The control fires `geolocate`, `error`, `outofmaxbounds`, `trackuserlocationstart`, `trackuserlocationend`, `userlocationfocus` and `userlocationlostfocus` on itself (`on`, `off`, `once`), and `geolocate` and `error` also on the map. A position outside `maxBounds` fires `outofmaxbounds` and does not move the map. The code of tracking loads on demand at the first click or `trigger()` call, so the first step of tracking happens once that file has loaded. With `zoom`, the map zooms in to it. Without it, the map fits the accuracy circle with `fitBounds` and `fitBoundsOptions`, as in MapLibre GL JS. The default of `fitBoundsOptions` is `{maxZoom: 15}`, and a `fitBoundsOptions` that you pass replaces it as a whole, so `{padding: 10}` fits with no limit of the zoom.

### Plugins

- **MapLibre GL JS:** 
- **This library:** A plugin that only uses public methods usually works. A plugin that reads `map.style` or `map.painter` does not.

### Members that are not available

- **MapLibre GL JS:** Every class has its public members.
- **This library:** In the development build (the `development` export condition, `dist/*.dev.js`), reading a public member of the MapLibre class that `Map`, `Marker`, `Popup` or a control of `@map-jr/map-jr-gl/maplibre-compat` does not have warns once for each name, for example `[map-jr-gl] ScaleControl.setUnit is not available in @map-jr/map-jr-gl/maplibre-compat.` Reading `map.transform` says that it is private state of MapLibre GL JS and what to call instead. Symbols and names that start with `_` or `$` do not warn. The value is `undefined`, as before, and the production build does not warn.

### `maxPitch`, `setMaxPitch`

- **MapLibre GL JS:** Up to 180. Above 90 the camera looks up and is placed with `setCenterElevation`.
- **This library:** Up to 180; a higher value writes one warning and gives 180, where MapLibre GL JS throws an error. Above 90 the camera looks up, and `setCenterElevation` (after `setCenterClampedToGround(false)`) places it as in MapLibre GL JS. Above the horizon the map draws the `sky` of the style, or nothing when the style has none.

### `unproject`

- **MapLibre GL JS:** A point of the screen gives the position where its line of sight meets the plane of the map center, or with 3D terrain the first ground along it. Above the horizon that position is behind the camera.
- **This library:** The same in Mercator: the positions agree within 0.0001° at pitch 60 to 85 and 100 to 120, above, at and below the horizon. From pitch 89.5 to 90.1 they differ by up to 0.005°. With 3D terrain, a point below the horizon gives the nearest ground along the line of sight, which can differ from MapLibre GL JS near the horizon. `getBounds` takes the top corners of the screen at the horizon when the horizon is in view, as MapLibre GL JS does. With 3D terrain, `getBounds` takes the four corners on the plane at the height of the map center, as MapLibre GL JS does, so a mountain at the top of the screen can be partly outside the box.

### The root property `sky`, `setSky`, `getSky`

- MapLibre GL JS draws a gradient above the horizon, fog on 3D terrain, and the atmosphere around the globe. The values can change with a transition.
- **This library:** In Mercator, the map draws the gradient from `sky-color` to `horizon-color` above the horizon (`sky-horizon-blend`), and on 3D terrain the fog (`fog-color`, `fog-ground-blend`, `horizon-fog-blend`) above a pitch of 60, as MapLibre GL JS does. The values can be zoom functions and expressions with global state. A change of the values takes effect at once, with no transition. On the globe the map draws the sky as MapLibre GL JS 6.17 does: the gradient starts at the edge of the sphere instead of the horizon of Mercator, in proportion to the change from Mercator to the globe, and it is drawn only where a ray passes through the atmosphere, with the opacity 1 - `atmosphere-blend`. As in MapLibre GL JS, the globe draws no fog on 3D terrain while the change to the globe is above 0. Over the globe it draws the atmosphere as MapLibre GL JS does: the scattering of the light of the sun, whose direction comes from the `position` and `anchor` of `light`, with the opacity `atmosphere-blend` (default 0.8) times the change from Mercator to the globe, fading out as the camera comes within 1 000 km of the ground. A style with no `sky` draws no atmosphere, as in MapLibre GL JS. The 14 render tests of `atmosphere-blend` and `projection/globe/atmosphere` match. The server renderer draws no sky. `setSky` replaces the `sky` of the style, and `setSky(null)` removes it. `getSky` returns the `sky` of the style, `undefined` when the style has none, and `null` after `setSky(null)`, as in MapLibre GL JS.

### Custom layers

- **MapLibre GL JS:** `addLayer` takes a custom layer (`CustomLayerInterface`, `type: 'custom'`) on every map.
- **This library:** `addLayer` takes a custom layer on a map that was made with `renderer: 'main'` (or after `configure({renderer: 'main'})`), because only the renderer on the main thread shares its WebGL context with the page. With another renderer, `addLayer` fires `error` with a message that says to pass `renderer: 'main'`, and adds nothing. `onAdd(map, gl)` runs once. `onRemove(map, gl)` runs on `removeLayer` and on `remove()`. As in MapLibre GL JS 6.17, `setStyle` keeps the custom layers with `diff` (the default), each before the layer that came after it, and drops them with `diff: false`; neither calls `onRemove`. `render(gl, args)` gets the same fields as in MapLibre GL JS 6 for the Mercator projection: `defaultProjectionData.mainMatrix` (for the x, y and z of a `MercatorCoordinate`), `modelViewProjectionMatrix`, `projectionMatrix`, `nearZ`, `farZ`, `fov`, `shaderData` and `getProjectionData`. The matrices are `Float64Array`s. They put a point on the same pixel as in MapLibre GL JS, but some values are close and not equal: the near and the far plane are those of this library (at pitch 0 on a map 300 pixels high, `nearZ` and `farZ` are 45 and 1800, where MapLibre GL JS gives 6 and 454.5), so the depth rows of `projectionMatrix` and of the other matrices differ; a height in `mainMatrix` is 0.11 % lower, because the map turns meters into pixels with the radius of Web Mercator (6,378,137 m) and `MercatorCoordinate` uses 6,371,008.8 m; and the depth range of a `'3d'` layer is 0 to 1, where MapLibre GL JS uses 0 to 0.99915. `prerender(gl, args)` runs directly before `render` of the same layer, and not before the whole frame. A layer with `renderingMode: '3d'` draws with the depth test and shares the depth buffer with 3D terrain and with the fill-extrusion layers below it; a fill-extrusion layer above it does not see its depth. A custom layer follows the rule of "Order of symbol layers" above, and with 3D terrain it draws in 3D, below all labels. After the code of the layer, the map restores the GL state that it needs. After a lost WebGL context, the map restores it and the custom layers keep their places: `onAdd` runs again with the new context, and `render` gets that context. (MapLibre GL JS does not call `onAdd` again.) `getStyle()` leaves custom layers out, and `getLayer(id).implementation` is the object of the layer, as in MapLibre GL JS. On the globe (below zoom 12, and while the map changes between the globe and Mercator), `render` gets the data of the globe, as in MapLibre GL JS 6.17: `shaderData` has the variant `globe`, the define `#define GLOBE` and a prelude with the functions of MapLibre's globe prelude (`projectTile`, `projectTileWithElevation`, `projectTileFor3D`, `projectToSphere`, `projectLineThickness` and the uniforms `u_projection_*`), and `defaultProjectionData` and `getProjectionData` give the matrix from the unit sphere to clip space, the plane of the horizon as `clippingPlane`, the globeness as `projectionTransition` (`getProjectionData` gives 0 unless `applyGlobeMatrix` is true, as MapLibre GL JS does) and the Mercator matrix as `fallbackMatrix`. `modelViewProjectionMatrix` is the matrix of the unit sphere. The depth is not that of MapLibre GL JS: it is the depth of the `fill-extrusion` layers on the globe, so that a `'3d'` custom layer and the buildings below it hide each other. It is a projection with no far plane, so `farZ` is `Infinity` and `nearZ` is a small number of pixels (MapLibre GL JS gives 0.5 and the distance of the camera plus the diameter of the globe); the 2D functions of the prelude give the depth of MapLibre's horizon plane, as in MapLibre GL JS. The globe prelude leaves out the cut at the antimeridian of a tile at zoom 0 and the animation of the poles during the change to Mercator. `renderToTerrainTile` and `renderTerrainHeightMap` are not available. The code of custom layers is a file that loads with the first custom layer. `MercatorCoordinate` is exported with `fromLngLat`, `toLngLat`, `toAltitude` and `meterInMercatorCoordinateUnits`, and gives the values of MapLibre GL JS. `createTileMesh(options, forceIndicesSize)` is exported and gives the same vertices and indices as in MapLibre GL JS 6.17 (the example page "Add a custom layer with tiles to a globe" calls it).

### The layer type `color-relief`

- **MapLibre GL JS:** `color-relief-color` is an `interpolate` expression of `["elevation"]`. The color between two stops is a linear mix, also when the expression names another interpolation.
- This library does the same, with up to 2048 stops. The stops after these are not used. A `color-relief-color` that is not an `interpolate` expression draws nothing, as in MapLibre GL JS. A `raster-dem` source with `encoding: 'custom'` uses `redFactor`, `greenFactor`, `blueFactor` (default 1) and `baseShift` (default 0) for every layer of the source; when one of them is not a finite number, the library warns and reads the source as `mapbox`. The server renderer does not draw the layer.

### `hillshade-method` `multidirectional`

- **MapLibre GL JS:** The number of lights is the number of values of `hillshade-highlight-color`. There is no limit.
- **This library:** The layer has a light for each value of the longest list of `hillshade-illumination-direction`, `hillshade-illumination-altitude`, `hillshade-highlight-color` and `hillshade-shadow-color`. The layer draws at most 8 lights: with more, it writes one warning and draws the first 8.

### `map.painter` and `GPUInitializationError`

- **MapLibre GL JS:** The map has a `painter`. When WebGL cannot start, the constructor throws a `GPUInitializationError`.
- **This library:** The map has no `painter`, so a check such as `if (!map.painter) throw new GPUInitializationError(...)` throws for every map, and `supported()` gives the answer that such a check looks for. In the development build (the `development` export condition, `dist/*.dev.js`), reading `map.painter` warns once per map and says what to write instead; the value is `undefined` in both builds. `@map-jr/map-jr-gl/maplibre-compat` exports `GPUInitializationError` (also on the default export). When the map cannot start, the constructor does not throw: the map fires `error` with a `GPUInitializationError` and shows a message in the container.

## What is not available

Sources:

- MapLibre Tiles (MLT). A `vector` source with `encoding: 'mlt'` is not drawn, and the map reports one error for it, as for a source that has no `tiles` and no `url`. The other sources are drawn.

Layers:

- Custom layers with the worker renderer (see "Custom layers" in [What is different](#what-is-different))

Properties:

- `line-gradient` together with `line-dasharray`
- Circle stroke and blur that are different for each feature
- `line-gap-width` that is different for each feature. The line is drawn without a gap, and nothing warns.
- `line-round-limit` in the server renderer. Its SVG does not apply the property, because SVG has no equivalent, so a round join rounds every corner.
- `heatmap-radius` that is different for each feature. The layer uses the default radius of 30 pixels, and nothing warns.
- `text-writing-mode`
- `text-pitch-alignment` and `icon-pitch-alignment` with `map` at a point are approximations. The symbol lies on the ground with the slant of the ground at its anchor, so a large symbol near the horizon is not as wide at its far edge as MapLibre GL JS draws it. Images inside text lie on the ground with their text. An icon with `icon-text-fit` faces the screen. The SVG output of the server renderer (`renderToSVG`) draws point text, icons and images inside text with `map` on the ground in the same way, and it draws images inside text. In the SVG, text along a line keeps its characters upright to the screen, and an icon with `icon-text-fit` faces the screen.
- On a rotated icon, the four sides of `icon-padding` are added to the screen-aligned box of the rotated icon, and not before the rotation as in MapLibre GL JS. With no rotation, the box is the same as in MapLibre GL JS.
- `symbol-z-order` sorts the symbols within each tile by the y of their anchor in the tile, turned with the map, as MapLibre GL JS does. The order is found at each placement (about four times a second while the map moves), so it can lag behind a map that rotates. Icons without text that always show (`icon-allow-overlap` with no `text-field`, at a point) keep their order while the map turns, and are sorted again in the first frame after the turn.
- `symbol-avoid-edges` has no effect, as in MapLibre GL JS 6.17, which does not read it. The development build of the main API warns one time for each layer that has it.
- The root property `centerAltitude` of a style has no effect, as in MapLibre GL JS 6.17, which does not read it. The development build of the main API warns one time for each map whose style has it.
- `symbol-height-offset`. The property is not read, and nothing warns.
- `fill-extrusion-rounded-corner-distance`. The property is not read, and nothing warns: the corners of an extrusion are sharp.
- `raster-fade-duration`. A raster tile shows at once when it has loaded. A value other than 0 has no effect and writes one warning. (`raster-resampling`, `resampling` and `raster-layer-blend` are read as in MapLibre GL JS; the SVG output of the server renderer gives `nearest` to the browser as `image-rendering: pixelated`.)
- Paint transitions of symbol layers, of fill-extrusion layers and of `fill-outline-color`. The tiles hold these values, so a new value shows when the tiles are built again, with no transition, and nothing warns. Paint transitions of the other layer types are available: see [Paint transitions](map.md#update).
- An icon together with text that follows a curved line. The text is drawn without the icon.
- `vertical-align` in `format` text. Sizes, fonts, colors and images in `format` text are available. The SVG output of the server draws each line in one size.

Expressions:

- `within` and `distance`. Each writes one warning (`[map-jr-gl] Unsupported expression "within"`) and gives `null`, so a property takes its default value, and a filter that is `["within", ...]` alone lets no feature through.

Layers that the server renderer does not draw:

- The layer types `heatmap`, `hillshade` and `color-relief`

Other:

- Projections other than `mercator`, `globe` and `vertical-perspective` (`addProjection`)
- The map option `crossSourceCollisions: false` of `@map-jr/map-jr-gl/maplibre-compat`. The option has no effect and warns once: labels of different sources always collide with each other, as with the default (`true`) of MapLibre GL JS.
- The right-to-left text plugin. The browser draws right-to-left text correctly without it, so `setRTLTextPlugin` is accepted and does nothing. This is a decision and will stay.
- The debug drawing of MapLibre GL JS: collision boxes, padding lines, tile borders and the overdraw view (`showCollisionBoxes`, `showPadding`, `showTileBoundaries`, `showOverdrawInspector`). This is a decision and will stay.

## Map methods

The camera methods of the entry `@map-jr/map-jr-gl/maplibre-compat` (`jumpTo`, `easeTo`, `flyTo`, `fitBounds`, `fitScreenCoordinates`, `panTo`, `panBy`, `zoomTo`, `zoomIn`, `zoomOut`, `rotateTo`, `resetNorth`, `resetNorthPitch`, `snapToNorth`, `setCenter`, `setZoom`, `setBearing`, `setPitch` and `setPadding`) take `eventData` as the last argument, as in MapLibre GL JS. Its fields are on the `move`, `zoom`, `rotate` and `pitch` events of that move, from `movestart` to `moveend`. A later camera call replaces it.

The option `zoomSnap` and `setZoomSnap` work as in MapLibre GL JS: with a value above 0, the zoom of `jumpTo`, `easeTo`, `flyTo`, `zoomIn`, `zoomOut`, the double-click, the keyboard and the navigation buttons goes to the nearest multiple of the value, and `cameraForBounds` and `fitBounds` go to the multiple below. A turn of a mouse wheel ends at the next multiple in the direction of the turn, as in MapLibre GL JS. A trackpad and a pinch do not snap, in either library.

`setEventedParent(parent, data)` passes each event of the map to `parent.fire` while `parent.listens(type)` is true, as one object with the fields of the event and of `data` (an object, or a function that returns one). The parent gets a `click` after the listeners of the map.

The methods `calculateCameraOptionsFromTo`, `calculateCameraOptionsFromCameraLngLatAltRotation` and `calculateAnchoredCameraOptions` compute camera options without changing the map, with the math of MapLibre GL JS for the Mercator projection. On a globe they also use the Mercator math: MapLibre GL JS follows the sphere there, so the results differ. `calculateCameraOptionsFromCameraLngLatAltRotation` returns the `roll` that it is given, and `setRoll` has no effect.

`setTransformConstrain(fn)` and the option `transformConstrain` replace the constraint of the camera, as in MapLibre GL JS: `fn(lngLat, zoom)` returns `{center, zoom}`, and `null` restores the default, which keeps the view inside the world and inside `maxBounds`. `minZoom` and `maxZoom` still apply. The function runs in the engine on each change of the camera, so it needs `renderer: 'main'`. With the option and no `renderer`, the map draws on the main thread. On a map that draws in a worker, `setTransformConstrain(fn)` has no effect and warns once.

`coveringTiles({tileSize, minzoom, maxzoom, roundZoom})` returns the tiles that the library loads for the view, synchronously, as objects with the fields `canonical` (`z`, `x`, `y`, `key`), `wrap`, `overscaledZ` and `key`. The objects are plain and do not have the methods of MapLibre's `OverscaledTileID`, and that is a decision and will stay. `key` is a string, not MapLibre's number.

`overscaledZ` equals `canonical.z`, as in MapLibre GL JS for this method. The default of `maxzoom` is 30. A pitched view and a globe use the tile cover of this library, which can choose other tiles at the edges than MapLibre GL JS.

`setSourceTileLodParams(maxZoomLevelsOnScreen, tileCountMaxMinRatio, sourceId?)` changes the level of detail of a pitched view for one source, or for all sources of the style when `sourceId` is left out, with the rule of MapLibre GL JS: each value below 1 counts as 1, and an unknown `sourceId` throws an error. The parameters apply above a pitch of 60° and with 3D terrain, as in MapLibre GL JS, and then near tiles can go deeper than the zoom of the center, up to the `maxzoom` of the source.

Without them, a pitched view without terrain uses the tile cover of this library. The parameters stay with the source ID when the style changes, while MapLibre GL JS drops them with a new source object. `coveringTiles` does not use them.

<!-- api:start -->
The table counts the 138 public methods of the MapLibre `Map` class in the entry `@map-jr/map-jr-gl/maplibre-compat`. The lists below it have the names.

| Methods of `Map` | Number | Share |
|---|---:|---:|
| Available | 132 | 95.7% |
| Accepted, with no effect | 6 | 4.3% |
| Not available | 0 | 0.0% |
| Only in this library | 11 |  |
| Internal to MapLibre GL JS, not counted | 15 |  |

- **Available:** `addControl`, `addImage`, `addLayer`, `addSource`, `addSprite`, `areTilesLoaded`, `calculateAnchoredCameraOptions`, `calculateCameraOptionsFromCameraLngLatAltRotation`, `calculateCameraOptionsFromTo`, `cameraForBounds`, `coveringTiles`, `easeTo`, `fire`, `fitBounds`, `fitScreenCoordinates`, `flyTo`, `getAnisotropicFilterPitch`, `getBearing`, `getBounds`, `getCameraTargetElevation`, `getCanvas`, `getCanvasContainer`, `getCenter`, `getCenterClampedToGround`, `getCenterElevation`, `getContainer`, `getFeatureState`, `getFilter`, `getFontFaces`, `getGlobalState`, `getGlyphs`, `getImage`, `getLayer`, `getLayersOrder`, `getLayoutProperty`, `getLight`, `getMaxBounds`, `getMaxPitch`, `getMaxZoom`, `getMinPitch`, `getMinZoom`, `getPadding`, `getPaintProperty`, `getPitch`, `getPixelRatio`, `getProjection`, `getRenderWorldCopies`, `getRoll`, `getSky`, `getSource`, `getSprite`, `getStyle`, `getStyleUrl`, `getTerrain`, `getVerticalFieldOfView`, `getZoom`, `getZoomSnap`, `hasControl`, `hasImage`, `isMoving`, `isRotating`, `isSourceLoaded`, `isStyleLoaded`, `isZooming`, `jumpTo`, `listImages`, `listens`, `loadImage`, `loaded`, `moveLayer`, `off`, `on`, `once`, `panBy`, `panTo`, `project`, `queryRenderedFeatures`, `querySourceFeatures`, `queryTerrainElevation`, `redraw`, `refreshTiles`, `remove`, `removeControl`, `removeFeatureState`, `removeImage`, `removeLayer`, `removeSource`, `removeSprite`, `resetNorth`, `resetNorthPitch`, `resize`, `rotateTo`, `setBearing`, `setCenter`, `setEventedParent`, `setFeatureState`, `setFilter`, `setFontFaces`, `setGlobalStateProperty`, `setGlyphs`, `setLayerZoomRange`, `setLayoutProperty`, `setLight`, `setMaxBounds`, `setMaxPitch`, `setMaxZoom`, `setMinPitch`, `setMinZoom`, `setMissingStyleImageResolver`, `setPadding`, `setPaintProperty`, `setPitch`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setSky`, `setSourceTileLodParams`, `setSprite`, `setStyle`, `setTerrain`, `setTransformConstrain`, `setTransformRequest`, `setZoom`, `setZoomSnap`, `snapToNorth`, `stop`, `triggerRepaint`, `unproject`, `updateImage`, `zoomIn`, `zoomOut`, `zoomTo`
- **Accepted, with no effect** (a value that the library cannot do gives one warning, except for `setAnisotropicFilterPitch`, which gives none): `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setCenterElevation`, `setRoll`, `setTransformCameraUpdate`, `setVerticalFieldOfView`
- **Only in this library:** `addFonts`, `getAttributions`, `getTransformForUpdate`, `isLocationOccluded`, `isPitching`, `isRolling`, `queryElevation`, `queryFeatures`, `querySource`, `setCursor`, `toBlob`
- **Not available:** none
- **Internal to MapLibre GL JS, not counted** (the declaration tags the method `@internal`, or only the class `Camera` has it, which the package does not export): `applyTerrainChange`, `applyTransformChange`, `applyUpdatedTransform`, `captureRotationPivot`, `clampCenterToGround`, `getTransformForUpdate`, `holdElevation`, `isPitching`, `isRolling`, `migrateProjection`, `moveCenterOntoTerrain`, `orbitRotationPivot`, `prepareNextFrame`, `putCenterBackOnTerrain`, `releaseElevation`
<!-- api:end -->

## Source methods

`map.getSource(id)` in the entry `@map-jr/map-jr-gl/maplibre-compat` returns an object with the source's specification, its `id` and these methods. In the entry `@map-jr/map-jr-gl`, a vector, raster or raster-dem source is the plain specification without methods.

### `vector`, `raster`, `raster-dem`

- **Available:** `setTiles(tiles)`, `setUrl(url)`. Each one replaces the tiles of the source (the other of `tiles` and `url` is removed) and loads them again. A TileJSON that fails to load gives an `error` event, and the layers of the source are not drawn. An argument of the wrong type throws an error. `reload()` loads the tiles of the source again, as `map.refreshTiles(id)` does, and returns nothing. MapLibre GL JS 6.17 has no `reload`: the method is here for code that was written for Mapbox GL JS. `loaded()` gives what `map.isSourceLoaded(id)` gives, and `serialize()` gives a copy of the specification. `minzoom`, `maxzoom` and `tiles` have the values of the specification. A source with a TileJSON `url` has the values of its TileJSON after that has loaded, and `undefined` before.
- **Not available:** `load`, `hasTile`, `setSourceProperty`, `setPremultiplyAlpha`, `loadTile`, `abortTile`, `unloadTile`, `hasTransition`, `bounds`, `tileBounds`, `scheme`, `map` and the event methods (`on`, `once`, `off`, `fire`). For `load`, `hasTile`, `loadTile`, `abortTile`, `unloadTile`, `hasTransition` and `map`, this is a decision and will stay. The members that the specification does not give (`scheme`, `tileSize`, `encoding`) have no default value.

### `geojson`

- **Available:** `setData`, `getData`, `updateData`, `getClusterExpansionZoom`, `getClusterChildren`, `getClusterLeaves`. `setClusterOptions({cluster, clusterMaxZoom, clusterRadius})` changes the options that it is given, builds the clusters again and gives a promise. An argument that is not an object rejects the promise with a message. `getClusterOptions()` gives the three options, with the defaults `false`, `maxzoom - 1` (17 without `maxzoom`) and 50. `getBounds()` gives a promise of the `LngLatBounds` of all positions of the data, and empty bounds for data without positions. It loads a URL as `getData` does. `loaded()` and `serialize()` work as on a tile source.
- **Not available:** `load`, `loadTile`, `abortTile`, `unloadTile`, `shouldReloadTile`, `hasTransition`, `workerOptions`, `map` and the event methods. For all of these except `shouldReloadTile` and the event methods, this is a decision and will stay. `minzoom`, `maxzoom`, `tileSize` and `promoteId` have no default value.

### `image`

- **Available:** `updateImage`, `setCoordinates`
- **Not available:** `getImage` and the other members of MapLibre's `ImageSource`

### `video`

- **Available:** `getVideo()` returns the `<video>` element. `play()`, `pause()` and `seek(seconds)` act on that element. The code of video sources (a file shared with canvas sources) loads with the first style that has a video source, and until it has loaded, `getSource(id)` returns the specification without these methods. That is one request after the style with the source has loaded; MapLibre GL JS has the methods at once. `setCoordinates` moves the corners. As in MapLibre GL JS, the video is muted, plays in a loop and starts when the source is added. A video of another origin needs CORS headers. When none of `urls` loads, the map fires `error`. The URLs do not go through `transformRequest`. A frame reaches the map only when the video shows a new one, so a paused video costs nothing. As in MapLibre GL JS, while a video plays `loaded()` is `false`, `idle` does not fire and `isMoving()` is unchanged; after `pause()` the map fires `idle`. `areTilesLoaded()` is `false` for a moment after each frame, where MapLibre GL JS gives `true`. `seek` outside the range that the video can seek does not fire `error`.
- **Not available:** `hasTransition`, `prepare`, `serialize` and the event methods. For `hasTransition`, `prepare` and `serialize`, this is a decision and will stay.

### `canvas`

- **Available:** `canvas` is the id of a `<canvas>` of the page or the element. As in MapLibre GL JS, the map copies the canvas when the source is added, and in each frame of the page while the source plays. With `animate: true` (the default) it plays from the start; with `animate: false` it is copied once, until `play()`. `pause()` copies it one more time and stops. While it plays, `loaded()` is `false` and `idle` does not fire; after `pause()` the map fires `idle`. `getCanvas()` returns the element. A canvas that the page does not have, or a canvas of width or height 0, fires `error`. The code is the file of video sources, loaded with the first style that has one of them; until it has loaded, `getSource(id)` returns the specification without these methods.
- **Not available:** A change of the size of the canvas while it is paused is not copied. `hasTransition`, `prepare`, `serialize` and the event methods. For `hasTransition`, `prepare` and `serialize`, this is a decision and will stay.

## Types

The entry `@map-jr/map-jr-gl/maplibre-compat` exports types under the names of MapLibre GL JS 6.17 (`src/compat-types.ts`). Each type describes what this library accepts, so a type can have fewer members than the type of MapLibre GL JS. The row "TypeScript types" in [What is different](#what-is-different) describes the event, source and style types.

These types differ from MapLibre GL JS:

| Type | In this library |
|---|---|
| `NavigationControlOptions` | It has no `visualizeRoll`. |
| `GeolocateControlOptions` | It has `zoom`. |
| `LogoControlOptions` | `compact` has no effect and writes one warning, because this library has no logo. This is a decision and will stay. |
| `Offset` | It is a number, `[x, y]`, or `[x, y]` for each anchor. It does not accept a `Point`. |
| `Listener` | Its type parameter is the type of the event, and the default is `MapLibreEvent`. |
| `FullscreenControlEventType`, `GeolocateControlEventType`, `PopupEventType`, `EventTypeMap` | An event is a plain object with `type` and `target`, and not an instance of the class `Event`. The event of `geolocate` has `coords` and `timestamp`, and the event of `error` has `code` and `message`. |
| `DragPanOptions`, `DragRotateOptions`, `AroundCenterOptions` | They have no effect and warn once: `enable(options)` of a handler turns it on, and an object as the option `dragPan` or `dragRotate` of `new Map()` counts as `true`. |
| `UpdateImageOptions` | It has `url` and `coordinates`, and no `image`. |
| `CanvasSourceSpecification` | The type exists. The library draws canvas sources (see `canvas` in "Source methods"). |
| `StyleImageInterface` | `data` is RGBA pixels. `render`, `onAdd` and `onRemove` have no effect: the map reads the pixels once. |
| `StyleImageData` | It has only `data`, which is what `map.addImage` accepts. |
| `StyleOptions` | `validate`, `localIdeographFontFamily` and `globalState` have no effect in `map.setStyle`. For `localIdeographFontFamily`, this is a decision and will stay. |
| `ResourceType` | It is a union of strings and not a `const enum`. It also has `Font`. |
| `AddProtocolAction` | It is the type `ProtocolFunction` of this library: the request has `url`, `type` and `headers`, and the result has `data`. |
| `CustomLayerProjectionData`, `ProjectionData` | `ProjectionData` has no type parameters, and the matrices are `Float32Array` or `Float64Array`. |

The entry does not export these names of MapLibre GL JS:

- **`Actor`, `ActorMessage`, `IActor`, `Dispatcher`, `GlobalDispatcher`, `GlobalDispatcherEventType`, `MessageHandler`, `CustomMessageHandler`, `MessageType`, `RequestResponseMessageMap`, `WorkerGlobalScopeInterface`, `WorkerTileResult`, `LoadTileResult`, `importScriptInWorkers`**: They belong to the workers of MapLibre GL JS. The workers of this library have another protocol and do not load scripts of the page. This is a decision and will stay.
- **`Painter`, `Bucket`, `Tile`, `TileMesh`, `CreateTileMeshOptions`, `IndicesType`, `FeatureIndex`, `CollisionBoxArray`, `StyleLayer`, `PaintPropertyEntry`, `ImageAtlas`, `AlphaImage`, `DashEntry`, `GlyphMap`, `GlyphPosition`, `GlyphPositions`, `StyleGlyph`, `TextFit`, `RendererProjectionData`, `ProjectionMatrix`, `Mat4f32`, `Mat4f64`, `WebGLContextAttributesWithType`**: They are internals of the renderer of MapLibre GL JS, which this library does not have. This is a decision and will stay.
- **`OverscaledTileID`, `UnwrappedTileIDLiteral`, `CanonicalTileRange`, `CoveringTilesOptions`, `CalculateTileZoomFunction`, `ProjectionDataParams`, `CRS`, `TileMatrixSet`**: They describe the tiles and the tile grid inside MapLibre GL JS. This is a decision and will stay.
- **`SourceClass`, `SourceEventType`, `EventedParentData`**: A source of this library is not a class and fires no events of its own, so there is no `addSourceType`. This is a decision and will stay.
- **`Event` as the class of fired events**: `new Event(type, data)` works, but the events that the map fires are plain objects, so `instanceof Event` is false for them.
- **`AJAXError`, `EdgeInsets`, `GeolocateEvent` as the classes of the library's own objects**: The three classes exist for `new` and `instanceof`, but a failed request of this library rejects with an `Error` and not with an `AJAXError`, and `instanceof GeolocateEvent` tests only the `type` of the event. `EdgeInsets` has only its four fields and none of the methods. `prewarm` and `clearPrewarmedResources` are accepted and do nothing, because the workers start with the first map. They do not warn, unlike other names that have no effect, because `@maptiler/sdk` calls `prewarm()` in every map constructor and a warning would reach every user of the SDK.
- **`Handler`, `HandlerResult`, `BoxZoomHandlerOptions`, `BoxZoomEndHandler`**: The library has no custom handlers, and its handlers have only `enable`, `disable`, `isEnabled` and `isActive`.
- **`AnchoredCameraOptions`, `CameraUpdateTransformFunction`, `TransformConstrainFunction`**: The library has no `transformCameraUpdate`. `setTransformConstrain` works, and the package does not export the type of its function.
- **`StyleImage`, `StyleImageSource`, `StyleImageWebGLData`, `StyleImageWebGLTarget`, `CustomTerrainRenderInput`, `TerrainHeightMapTarget`, `ImageSourceImage`, `ImageSourceWarp`**: Images that draw themselves with WebGL, custom layers that draw into the height map of the terrain, and the `image` and `warp` of an image source are not available.
- **`AddProtocolResponseData`, `GetResourceResponse`, `ExpiryData`**: A protocol function returns `{data}`. Use `ProtocolFunction` or `AddProtocolAction`.
- **`Complete`, `RequireAtLeastOne`, `DistributiveKeys`, `DistributiveOmit`**: They are helper types for the declarations of MapLibre GL JS.
