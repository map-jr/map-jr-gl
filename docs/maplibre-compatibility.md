# MapLibre compatibility

This document compares the library with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) version 6.

The API of MapLibre GL JS is in the entry `@map-jr/map-jr-gl/maplibre-compat`. The main entry, `@map-jr/map-jr-gl`, has another
API: see [The main API](api.md).

It has four parts:

1. [What this library adds](#what-this-library-adds)
2. [What is different](#what-is-different)
3. [What is not available](#what-is-not-available)
4. [Map methods](#map-methods)

The [status table](../README.md#status) gives the current test results.

## What this library adds

| Feature | Description |
|---|---|
| Worker rendering | The renderer can run in a worker. The option is `renderer: 'auto'`, `'worker'` or `'main'`. |
| Server rendering | `renderToSVG` and `renderToImage` draw a map without a browser. See [Server rendering](server-rendering.md). |
| Many markers | A symbol layer draws icons that are always shown from a buffer on the GPU: the cost of a frame does not grow with their number. See [Which icons are fast](markers.md#which-icons-are-fast). |
| SVG images | `addImage` accepts an SVG string. The image is sharp on each screen. Its size in CSS pixels is the size of its `viewBox`, or else of its `width` and `height` attributes, or 24 by 24. |
| Many icons | A symbol layer draws an icon that is always shown (no text, `icon-allow-overlap`) from a buffer on the GPU. Such an icon is not hidden by ground in front of it with 3D terrain, does not fade in, and is drawn below the labels unless its layer is above each layer with labels. See [Markers](markers.md). |
| SVG templates | An SVG string with slots (`{{name}}`) is a template. Each feature gives the slots their values, from its properties or from `params` of the `image` expression: `['image', 'pin', {params: {color: ['get', 'color']}}]`. MapLibre GL JS does not have `params`. See [An image that is a template](api.md#an-image-that-is-a-template). |
| Fonts | Text uses the glyph files of the style (`glyphs`), as in MapLibre GL JS. A style without `glyphs` needs no glyph files: text then uses the fonts of the browser. The option `glyphs: false` selects that for each style. The style can also give font files in `font-faces`. |
| `queryFeatures` | Finds features, with the meaning that it has in `@map-jr/map-jr-gl`. With `sources`, it reads the tile data of those sources, and you do not need a style layer. Without `sources`, it gives what the style layers draw. See [Queries](api.md#queries). |
| `queryElevation` | Gives the elevation at a position from a `raster-dem` source. |
| Contour source | `type: 'contour'` makes contour lines from an elevation source. See [Terrain and elevation](terrain-and-elevation.md). |
| PMTiles | A source URL that starts with `pmtiles://` reads a PMTiles archive. You do not need a plugin. |
| Changes for the server in the style | `metadata["map-jr:ssr"]` on a layer changes that layer only on the server. |
| Icons generated on demand | `setMissingStyleImageResolver` supplies an image for a name that the sprite does not contain. |
| Frame data | The `stats` event gives the frames per second and the work for each frame. |
| `supported()` | A function of the module. It returns `false` in a browser without WebGL2. MapLibre GL JS has had no such function since version 2. A map that cannot start fires one `error` and shows a message in the container (the class is `map-jr-unavailable`). See [A browser without WebGL2](api.md#a-browser-without-webgl2). |
| Controls without a CSS file | The library adds the styles for its controls. You change the colours with `--map-control-*` custom properties. |

## What is different

| Subject | MapLibre GL JS | This library |
|---|---|---|
| Text | Reads glyph files from the `glyphs` URL. | The same: glyphs and their widths come from the glyph files. Three cases use the fonts of the browser: a character that the files do not have (most ideographs, emoji), text that the browser must shape (Arabic, Hebrew, Indic scripts), and a map with `glyphs: false` or with `fonts`. A label waits for its glyph file, as in MapLibre GL JS. |
| Text on lines | Each character follows the line. The style sets the largest angle. | Each character follows the line. A label does not show where the line turns more than about 35 degrees between characters. |
| Order of symbol layers | A symbol layer draws at its position in the layer list. | All symbol layers draw above all other layers. |
| Label placement | Changes gradually, tile by tile. | The library decides about four times each second. Labels fade between decisions. |
| Feature queries | `queryRenderedFeatures` and `querySourceFeatures` return their result synchronously. | The two methods have the same arguments and return the same features, but the complete result is a promise. Add `await`. The tile data is in a worker. Without `await`, the value of each of the two methods is an array. For `queryRenderedFeatures` the array has the answer of the engine to the same question before (the same view, place and layers). Two rules make that answer present for usual MapLibre code. The map asks the engine about the place of a `mousedown` or `touchstart` and where the pointer rests for 50 ms. A `click`, `dblclick` or `contextmenu` listener that queries `e.point` therefore gets the features at once. When the answer is not there yet, the event waits for it for at most 300 ms, and after that the array has GeoJSON features only. A `mousemove` listener that reads the array gets the same `mousemove` a second time when the answer arrives and the pointer has not moved since, so hover through react-map-gl (`interactiveLayerIds`, `onMouseEnter`, `cursor`) works; the listener sees the first event with an empty array. When an array did not have the complete result, the map fires `idle` again, so code that queries on `idle` gets the features on its next call. Without an answer before, the array has the features of GeoJSON sources only. The features of a GeoJSON source whose data the page has are always read from that data, so they are current after `setData`: this is sufficient for plugins such as mapbox-gl-draw and for code that makes HTML markers from clusters. (For a GeoJSON source with its data at a URL, the first call gives an empty array; the source then fires its data events again, and the next call has the features.) `queryFeatures` is also available: it reads data that the style does not draw. |
| Queries on labels | A label is found on the collision boxes of its text and of its icon. | The same for text at a point and for icons. Text that follows a line is found within 10 pixels of the point of its label, and so is a label whose text is not shown at the moment. |
| Feature state | The GPU applies the state. An `id` can be text. | `setFeatureState` and the `feature-state` expression work. A change builds the tiles of the source again in the background when a layer of that source reads feature state, so it shows after a short time. A feature must have a number as its `id`. |
| Style changes | Applied step by step. | A paint value that is the same for all of a layer is applied immediately. Other changes build the tiles of that source again. The old tiles stay on the screen until the new tiles are ready. |
| 3D terrain | Draws terrain at each tilt. | Draws a flat map when you look vertically down. See [Terrain and elevation](terrain-and-elevation.md). |
| Camera | Tilt to 85 degrees. Roll. Field of view. | Tilt to 60 degrees. No roll. A fixed field of view. Padding is available. |
| The lowest zoom | `minZoom` is -2 by default. The world is never less tall than the map. | The same. |
| `setMaxBounds` | Keeps all of the view in the bounds. | Keeps the map centre in the bounds. |
| The `hash` option | The camera in the fragment of the URL. | The same, with the same format. |
| Tile URLs | `{z}`, `{x}`, `{y}`, `{bbox-epsg-3857}`, `{quadkey}`, `{ratio}`, `{prefix}`; the `scheme` `tms`. | `{z}`, `{x}`, `{y}`, `{bbox-epsg-3857}` (for WMS servers), `{quadkey}`; the `scheme` `tms`. Not `{ratio}` and `{prefix}`. |
| The `bounds` of a source | A tile outside the bounds is not requested. | The same, for bounds in the style and in the TileJSON. Not for the bounds in the header of a PMTiles file. |
| An image tile that the server does not have (404) | The nearest tile above it is drawn in its place. | The same, for raster and elevation tiles. |
| GeoJSON sources | `setData`, `getData`, `updateData`, the cluster methods. | The same. `updateData` makes the new data from the old data and the changes, and then replaces the data of the source in one step. |
| `Marker` and `Popup` | Rotation, pitch alignment, offsets, class names. | The same methods. `pitchAlignment` is kept but has no effect: a marker is always upright on the screen. The keyboard focus moves into a popup only when Enter or the space bar on its marker opens it. MapLibre GL JS moves the focus each time a popup opens, unless `focusAfterOpen` is `false`. `Popup` does not read `focusAfterOpen`. |
| TypeScript types | Exports types and classes such as `MapMouseEvent`, `StyleSpecification`, `GeoJSONSource`. | Exports types with the same names (`src/compat-types.ts`). The event and source names are types only: you cannot use them with `new` or `instanceof`. The style types do not check each property: `LayerSpecification` accepts any string as `type` and any names in `paint` and `layout`. `map.on`, `map.once` and `map.off` give the listener the event type that belongs to the name of the event (`MapEventType`, `MapLayerEventType`), and an event name that is not in those lists gets an event of the type `any`. The geometry of a queried feature is the library's own `Geometry` type, which has no `GeometryCollection`. |
| `isSourceLoaded` | Gives a result for one source. | Gives a result for all sources together. |
| `addImage` | Accepts images and pixel data. | Accepts the same, and also an SVG string or a URL. It returns a promise. The `sdf` option is not available; the sprite of the style can contain SDF icons. |
| `easeTo`, `flyTo` | Accept an `easing` function and an `offset`. | Use the default easing of MapLibre GL JS. The library ignores `easing` and `offset`. |
| Events | Event classes. | Simple objects with `type`, `target`, `point` and `lngLat`. |
| Events for one layer | `map.on('click', layerId, fn)` calls the listener synchronously. | The same call works, also with an array of layer ids (`map.on('mouseenter', ['a', 'b'], fn)`). A second argument that is neither a layer id, an array of layer ids nor a function makes `on` throw a `[map-jr-gl]` error. The event fires shortly after the pointer event, because the library reads the tile data. |
| Interaction handlers | `map.dragPan`, `map.scrollZoom`, `map.boxZoom` and others, each with `enable()` and `disable()`. | The same objects are available: `dragPan`, `scrollZoom`, `doubleClickZoom`, `dragRotate`, `touchZoomRotate`, `touchPitch`, `keyboard`. `isActive()` always returns `false`. `boxZoom` is there but stays off: the library has no box zoom. |
| Pointer events | `mousedown`, `mouseup`, `touchstart` and others, with `preventDefault()`. | The same events. A listener that calls `preventDefault()` on `mousedown`, `touchstart`, `wheel` or `dblclick` stops the map from acting on that gesture. |
| `setWorkerUrl` | Sets the URL of the worker file of MapLibre GL JS. | Sets `workerUrl` of `configure`. The URL must point to `map-jr-gl-worker.js`. A URL whose file name contains `maplibre-gl` and `worker` (such as `maplibre-gl-worker.mjs`) is ignored with one warning, and `getWorkerUrl()` then still returns `''`. Remove the call: the library finds its worker file itself. |
| Requests | The `transformRequest` option and `addProtocol`. | The same. The functions run on the page; the workers ask the page for each request that they apply to. A protocol named `pmtiles` is not used: the library reads `pmtiles://` URLs itself. |
| `Marker`, `Popup` | Full API. | The usual parts of the API: position, popup, drag, anchor, offset. |
| Touch gestures | You can configure each gesture. | The same gestures. They are always on. |
| Expressions | Checks the types. | Does not check the types. An expression that is not correct can give no error. |
| Style validation | Reports errors in the style. | Does not validate the style. It writes a warning for each layer or property that it cannot draw. Four calls fire `error` and change nothing, as in MapLibre GL JS: `addLayer` with an id that exists, `addLayer` with a source that the style does not have, `addSource` with an id that exists, and `removeSource` of a source that a layer uses. |
| Options and layers with no effect | | The constructor options `cooperativeGestures`, `locale`, `projection` (other than mercator), `renderWorldCopies: false` and `canvasContextAttributes` (other than `antialias`) have no effect. Each writes one warning. The options `fadeDuration` and `pitchWithRotate` of the map, `focusAfterOpen` and `locationOccludedOpacity` of `Popup`, `opacityWhenCovered` of `Marker` and `diff` of `setStyle` are in the types and have no effect, and they write no warning yet. `setStyle` always replaces the whole style. A layer of the type `custom` is not added, and writes one warning. |
| A listener that throws | The error leaves `fire`, and the listeners after it do not get the event. | Each listener gets the event, and what a listener threw is an `error` event. |
| A query and `remove()` | The result is synchronous. | The promise of a query that has no answer yet, or that is asked after `remove()`, rejects with the error `[map-jr-gl] The query has no answer: the map was removed.` After a lost WebGL context it rejects in the same way, and the message says to ask again. |
| `strict` | | The constructor option `strict: true` makes each of these warnings and `error` events an error that is thrown. Use it in tests and while you change from MapLibre GL JS. The default is `false`. |
| CSS class names | `maplibregl-*` | `map-jr-*`. Each element also has the `maplibregl-*` name, so stylesheets and plugins for MapLibre GL JS continue to work. In `@map-jr/map-jr-gl/maplibre-compat`, the container has `maplibregl-map`, the canvas has `maplibregl-canvas`, and the buttons of the controls have `maplibregl-ctrl-zoom-in`, `maplibregl-ctrl-zoom-out`, `maplibregl-ctrl-compass`, `maplibregl-ctrl-fullscreen`, `maplibregl-ctrl-geolocate` and `maplibregl-ctrl-terrain`. There is no `maplibregl-canvas-container` element: `getCanvasContainer()` returns the container. The state names of the buttons (such as `maplibregl-ctrl-shrink`) and `maplibregl-ctrl-icon` are not set. A control from a plugin gets the `map-jr-*` names when you add it. |
| `GeolocateControl` | Can track the position and shows a dot at it. | Moves the map to the position once per click or `trigger()` call. It fires `geolocate`, `error` and `outofmaxbounds` on the control (`on`, `off`, `once`), and `geolocate` and `error` also on the map. A position outside `maxBounds` fires `outofmaxbounds` and does not move the map. `trackUserLocation` and `showUserLocation` have no effect and warn once, and `trackuserlocationstart` and `trackuserlocationend` never fire. |
| Plugins | | A plugin that only uses public methods usually works. A plugin that reads `map.style` or `map.painter` does not. |

## What is not available

Sources:

- Video and canvas sources
- MapLibre Tiles (MLT)
- `promoteId` in vector sources

Layers:

- Color relief and custom layers
- `fill-extrusion-pattern`
- Patterns that are different for each feature

Properties:

- `line-gradient` together with `line-dasharray`
- `line-offset` and `line-blur` that are different for each feature
- `circle-pitch-alignment` and `circle-pitch-scale`
- Circle stroke and blur that are different for each feature
- `icon-halo-blur`. Icon halos are available for distance-field (SDF) icons.
- `text-writing-mode`
- `text-pitch-alignment` with a value other than `auto`. On a tilted map, text along a line lies on the ground and other text is upright, which is what `auto` gives in MapLibre GL JS.
- `symbol-z-order` and `symbol-avoid-edges`
- An icon together with text that follows a curved line. The text is drawn without the icon.
- `vertical-align` in `format` text. Sizes, fonts, colours and images in `format` text are available. The SVG output of the server draws each line in one size.

Layers that the server renderer does not draw:

- Heatmap and relief shading

Other:

- Sky, fog, globe and other projections
- The layer type `color-relief`
- The right-to-left text plugin. The browser draws right-to-left text correctly without it.

## Map methods

<!-- api:start -->
118 of the 150 public methods of the MapLibre `Map` class are available in the entry `@map-jr/map-jr-gl/maplibre-compat` (79%).

**Available:** `addControl`, `addImage`, `addLayer`, `addSource`, `addSprite`, `areTilesLoaded`, `cameraForBounds`, `easeTo`, `fitBounds`, `flyTo`, `getAnisotropicFilterPitch`, `getBearing`, `getBounds`, `getCameraTargetElevation`, `getCanvas`, `getCanvasContainer`, `getCenter`, `getCenterClampedToGround`, `getCenterElevation`, `getContainer`, `getFeatureState`, `getFilter`, `getFontFaces`, `getGlobalState`, `getGlyphs`, `getImage`, `getLayer`, `getLayersOrder`, `getLayoutProperty`, `getLight`, `getMaxBounds`, `getMaxPitch`, `getMaxZoom`, `getMinPitch`, `getMinZoom`, `getPadding`, `getPaintProperty`, `getPitch`, `getPixelRatio`, `getProjection`, `getRenderWorldCopies`, `getRoll`, `getSky`, `getSource`, `getSprite`, `getStyle`, `getTerrain`, `getVerticalFieldOfView`, `getZoom`, `getZoomSnap`, `hasControl`, `hasImage`, `isMoving`, `isPitching`, `isRotating`, `isSourceLoaded`, `isStyleLoaded`, `isZooming`, `jumpTo`, `listImages`, `loadImage`, `loaded`, `moveLayer`, `off`, `on`, `once`, `panBy`, `panTo`, `project`, `queryRenderedFeatures`, `querySourceFeatures`, `queryTerrainElevation`, `redraw`, `refreshTiles`, `remove`, `removeControl`, `removeFeatureState`, `removeImage`, `removeLayer`, `removeSource`, `removeSprite`, `resetNorth`, `resetNorthPitch`, `resize`, `rotateTo`, `setBearing`, `setCenter`, `setFeatureState`, `setFilter`, `setFontFaces`, `setGlobalStateProperty`, `setGlyphs`, `setLayerZoomRange`, `setLayoutProperty`, `setLight`, `setMaxBounds`, `setMaxPitch`, `setMaxZoom`, `setMinPitch`, `setMinZoom`, `setMissingStyleImageResolver`, `setPadding`, `setPaintProperty`, `setPitch`, `setPixelRatio`, `setSprite`, `setStyle`, `setTerrain`, `setTransformRequest`, `setZoom`, `snapToNorth`, `stop`, `triggerRepaint`, `unproject`, `updateImage`, `zoomIn`, `zoomOut`, `zoomTo`

**Accepted, with no effect** (12; a value that the library cannot do gives one warning): `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setCenterElevation`, `setProjection`, `setRenderWorldCopies`, `setRoll`, `setSky`, `setSourceTileLodParams`, `setTransformCameraUpdate`, `setTransformConstrain`, `setVerticalFieldOfView`, `setZoomSnap`

**Only in this library:** `addFonts`, `fire`, `getAttributions`, `queryElevation`, `queryFeatures`, `setCursor`, `setEventedParent`

**Not available:** `applyTerrainChange`, `applyTransformChange`, `applyUpdatedTransform`, `calculateAnchoredCameraOptions`, `calculateCameraOptionsFromCameraLngLatAltRotation`, `calculateCameraOptionsFromTo`, `captureRotationPivot`, `clampCenterToGround`, `coveringTiles`, `fitScreenCoordinates`, `getStyleUrl`, `getTransformForUpdate`, `holdElevation`, `isRolling`, `migrateProjection`, `moveCenterOntoTerrain`, `orbitRotationPivot`, `prepareNextFrame`, `putCenterBackOnTerrain`, `releaseElevation`
<!-- api:end -->
