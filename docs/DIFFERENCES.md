# Differences from MapLibre GL JS

This document tracks how this library differs from [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/):
what it adds, what behaves differently, and what is missing. It is kept up to date as features land. The method
lists at the end are generated (`pnpm test:api --write`), so they always reflect the code.

Compared against MapLibre GL JS 6.x.

## Additions

| Feature | What it does |
|---|---|
| Worker rendering | `renderer: 'worker' \| 'main' \| 'auto'`. The whole engine (camera, tiles, labels, drawing) can run in a worker with `OffscreenCanvas`, so the map keeps animating while the page's main thread is busy. |
| Server rendering | `renderToSVG()` runs in plain JavaScript (Node, Cloudflare Workers) and returns the first frame as SVG plus the tile URLs it used. `renderToImage()` rasterises it to JPEG, WebP or PNG through a [takumi](https://takumi.kane.tw) renderer you supply. The client removes any `[data-tessera-ssr]` element once its own canvas shows the view. |
| Server overrides in the style | A layer's `metadata["tessera:ssr"]` can set `hidden`, an extra `filter`, `minzoom`/`maxzoom`, `paint`/`layout` overrides, `simplify` and `minSize` (pixels) for server output only. `metadata` is the spec's extension point, so MapLibre ignores it. |
| Marker layers on the canvas | `map.addMarkerLayer({svg, width, height, data})` draws thousands of markers from one SVG template with `{{slots}}`, with hit testing (`queryMarkers`), `markerclick` / `markerenter` / `markerleave` events and optional label avoidance. MapLibre's `Marker` is a DOM element per marker. |
| SVG images | `map.addImage(name, svgString)` rasterises at the screen's pixel density. MapLibre accepts bitmaps only. |
| Web fonts for labels | Text is drawn from ordinary fonts: a `text-font` of "Open Sans Semibold" means family Open Sans at weight 600. Fonts come from the style's `font-faces`, the `fonts` option or `map.addFonts()`, and are loaded on the rendering thread. No glyph server is needed. |
| `queryFeatures` | Finds features at a location from tile data. No style layer has to draw them, and the location may be off screen. Returns a promise. |
| `queryElevation` | Elevation in metres at a location from a `raster-dem` source, without enabling terrain. Returns a promise. |
| PMTiles built in | `url: "pmtiles://..."` on a vector, raster or elevation source reads a PMTiles v3 archive by range request. MapLibre needs a protocol plugin. |
| Marker layer extras | Raster images inside marker SVGs, per-layer zoom ranges with cross-fade, `overlap: 'hide'`, `select()` (animated growth) and `openPopup()` (a pointed callout that labels reflow around). |
| Frame statistics | A `stats` event reports frames per second and engine CPU time per frame. |
| Contour source | `type: "contour"` derives contour lines from a `raster-dem` source (`thresholds` by zoom, `multiplier`, `overzoom`, `contourLayer`, `elevationKey`, `levelKey`). MapLibre needs the maplibre-contour plugin. |
| Popup placement | A popup without an `anchor` picks its side from the space available, and `offset` may be given per anchor. A popup opened from a marker layer reserves its space so labels move out from under it. |
| Loading | The default entry is small and finds its worker file automatically; `workerUrl`, `createWorker`, `configure()` and a standalone single-file build cover other set-ups. MapLibre embeds or needs `setWorkerUrl`. |
| Generated icons on the server | `renderToSVG({resolveImage})` is the server counterpart of `setMissingStyleImageResolver`; resolved SVG is embedded as vector artwork (e.g. highway shields). |
| Themed controls without a stylesheet | Control styles are injected once and themed with `--map-control-*` custom properties. There is no CSS file to load. |

## Behaviour that differs

| Area | MapLibre GL JS | This library |
|---|---|---|
| Text rendering | Glyph ranges fetched from the style's `glyphs` URL as distance fields, shaped by the library; complex scripts need a plugin. | Glyphs are rasterised from local or loaded web fonts in the browser. Arabic, Hebrew, Indic and Thai lines are shaped by the browser. The `glyphs` URL is ignored. Text weight and line breaks can differ slightly from MapLibre's. |
| Labels along lines | Glyphs follow the curve of the line, with a configurable maximum angle. | Glyphs follow the curve; labels are dropped where the line bends more than about 35° between characters (`text-max-angle` is not read). Complex-script text stays straight. |
| Symbol layer order | Symbols draw at their position in the layer stack. | All symbol layers draw above all other layers. |
| Label placement | Incremental, with cross-tile fading. | Re-decided about four times a second (faster while zooming), labels stay pinned and fade between decisions. |
| Feature queries | `queryRenderedFeatures` is synchronous and returns what is drawn. | Not available. `queryFeatures` is asynchronous and returns what is in the tile data. |
| Feature state | Applied on the GPU without rebuilding tiles; ids may be numbers or strings (`promoteId`). | `setFeatureState`, `getFeatureState`, `removeFeatureState` and `feature-state` expressions work. A change rebuilds the source's visible tiles in the background (in place, without flashing), so it takes effect a moment later; rapid changes are combined. Features need a numeric `id`. |
| `setMaxBounds` | Keeps the whole visible area inside the bounds, raising the minimum zoom if needed. | Keeps the map centre inside the bounds. |
| `isSourceLoaded` | Per source. | Reports whether the tiles for the current view have loaded, for the map as a whole. |
| `setGlyphs`, `getGlyphs` | Glyph files are fetched from the URL. | Stored and returned for compatibility; text is drawn with web fonts, so glyph files are never fetched. |
| `addImage` | Image elements, bitmaps, `ImageData` or `{width, height, data}`, with `pixelRatio`, `sdf`, `stretchX`, `stretchY`, `content`. | The same forms and options except `sdf`, plus an SVG string or URL and an explicit `width`/`height`. Returns a promise. Plugins that draw icons on demand through `styleimagemissing` (e.g. `@americana/maplibre-shield-generator`) work; those that read the style's sprite through `map.style` need to be given a sprite source of their own, as `demo/americana.mjs` does. |
| 3D terrain | `terrain` in the style or `setTerrain`; drawn whenever set. | Same API (`terrain`, `setTerrain`, `getTerrain`). Looking straight down the map is drawn flat (sharper and cheaper); the relief grows in over the first ten degrees of tilt. Marker layers, DOM markers, popups, `project`/`unproject` and pointer positions all follow the surface. Labels hidden by a ridge are removed by a line-of-sight test (markers are not hidden). The camera follows MapLibre's model: while a gesture moves the map the centre keeps its height; when it ends the centre is put back on the ground the camera is looking at without moving the camera (so centre and zoom may read slightly differently afterwards, and nothing on screen shifts); a centre set through the API stays put and takes the ground's height. Dragging holds the grabbed point of ground under the pointer. Limits for now: buildings follow the slope under them; no `queryTerrainElevation` (use `queryElevation`); no sky or fog; terrain is not in server output. |
| Runtime style changes | Applied incrementally. | Paint values that are the same for a whole layer (a plain colour, width or opacity) are applied at once with no tile work. Changes that affect tile contents (filters, layout, per-feature paint values, adding or removing layers) rebuild only that source's tiles, in place: the old ones stay on screen until the new are ready. |
| `fill-extrusion-opacity` | Buildings are composited as one translucent layer. | Same visual result by a different method (depth pre-pass and stencil). No light configuration (`setLight`); shading is fixed. |
| Camera | Pitch up to 85°, roll, field-of-view control, padding. | Pitch up to 60°. No roll, field-of-view or padding options. |
| Tile selection when pitched | Level of detail by distance. | The same idea with a simpler rule; distant tiles may differ by a level. |
| Events | Typed event classes; layer-scoped `map.on('click', layerId, fn)`. | Plain objects with `type`, `target`, `point`, `lngLat`. Layer-scoped `click`, `mousemove`, `mouseenter`, `mouseleave` are supported and resolve asynchronously from tile data, so they arrive a moment after the pointer event. |
| `Marker`, `Popup` | DOM-based classes. | Provided with the common subset of the API (position, popup, drag, anchor, offset). Popups have a short pop animation and no `maxWidth: 'none'` handling, class toggling or tracking of the pointer. |
| Antialiasing | Off by default (`canvasContextAttributes.antialias`). | Off by default (`antialias: true` to enable). Polygon edges are smoothed in the shader either way. |
| Touch gestures | Handler objects that can be enabled, disabled and configured. | The same gestures, always on; no per-handler configuration or cooperative-gestures mode. |
| `easeTo` options | Accepts an `easing` function, `offset`, `padding`. | Uses MapLibre's default easing; those options are ignored (a function cannot be sent to a worker). |
| Expressions | Full specification with type checking. | Evaluated without type checking; see coverage below. Errors that MapLibre reports at load may pass silently. |
| Style validation | Validates styles and reports errors. | None. Unsupported layers and properties are skipped with a console warning. |

## Not supported yet

- Sources: image, video, canvas; MapLibre Tiles (MLT). GeoJSON sources have no clustering, `promoteId` or line metrics.
- Layers: heatmap, color-relief, custom layers. `fill-pattern` and `background-pattern` take a constant image (no per-feature patterns, no cross-fade between zoom levels, and a pitched background pattern is drawn flat); `line-pattern` layers are not drawn and `fill-extrusion-pattern` is ignored. Patterns are left out of server output.
- Sky, globe and other projections.
- SDF (recolourable) sprite icons, `icon-color`, the sprite `textFitWidth`/`textFitHeight` options, `circle-pitch-alignment`, `circle-pitch-scale`, data-driven circle stroke and blur, `line-offset`, `line-blur`, `line-gradient`.
- `transformRequest`, `addProtocol`.
- Hillshade and runtime-added bitmap images in server output. Contours are drawn there; elevation tiles other than PNG and lossless WebP need a `decodeImage` function (see `RenderOptions`).
- Right-to-left text is handled by the browser, so the RTL plugin API does not exist.

## Conformance numbers

Measured by the test scripts in this repository:

- **Expressions:** `pnpm test:expressions` runs MapLibre's own expression fixtures. 281 of 425 runnable fixtures pass.
  The main gaps are `distance` and `within` (58 fixtures), collators and rich-text `format` objects.
- **Rendering:** `pnpm test:render` runs MapLibre's render tests (a style and an expected image each). Of 1,429
  runnable tests, 433 match (at most 1% of pixels differ), 271 are close (at most 5%) and 725 differ; 331 are
  skipped because they script the map or need a high pixel density. Text is drawn with browser fonts rather than
  the tests' glyph files, so most tests with labels cannot match exactly. The largest feature gaps are
  line and per-feature patterns, projections, sky, heatmap, global state and pitch-aligned circles.
- **Map API:** see below.

<!-- api:start -->
## Map API coverage

102 of 150 public methods of MapLibre's `Map` exist here (68%).

**Supported:** `addControl`, `addImage`, `addLayer`, `addSource`, `areTilesLoaded`, `cameraForBounds`, `easeTo`, `fitBounds`, `flyTo`, `getBearing`, `getBounds`, `getCameraTargetElevation`, `getCanvas`, `getCanvasContainer`, `getCenter`, `getCenterElevation`, `getContainer`, `getFeatureState`, `getFilter`, `getFontFaces`, `getGlobalState`, `getGlyphs`, `getLayer`, `getLayersOrder`, `getLayoutProperty`, `getMaxBounds`, `getMaxPitch`, `getMaxZoom`, `getMinPitch`, `getMinZoom`, `getPaintProperty`, `getPitch`, `getPixelRatio`, `getProjection`, `getRenderWorldCopies`, `getRoll`, `getSource`, `getSprite`, `getStyle`, `getTerrain`, `getZoom`, `hasControl`, `hasImage`, `isMoving`, `isPitching`, `isRotating`, `isSourceLoaded`, `isStyleLoaded`, `isZooming`, `jumpTo`, `listImages`, `loadImage`, `loaded`, `moveLayer`, `off`, `on`, `once`, `panBy`, `panTo`, `project`, `queryTerrainElevation`, `redraw`, `refreshTiles`, `remove`, `removeControl`, `removeFeatureState`, `removeImage`, `removeLayer`, `removeSource`, `resetNorth`, `resetNorthPitch`, `resize`, `rotateTo`, `setBearing`, `setCenter`, `setFeatureState`, `setFilter`, `setFontFaces`, `setGlobalStateProperty`, `setGlyphs`, `setLayerZoomRange`, `setLayoutProperty`, `setMaxBounds`, `setMaxPitch`, `setMaxZoom`, `setMinPitch`, `setMinZoom`, `setMissingStyleImageResolver`, `setPaintProperty`, `setPitch`, `setSprite`, `setStyle`, `setTerrain`, `setZoom`, `snapToNorth`, `stop`, `triggerRepaint`, `unproject`, `updateImage`, `zoomIn`, `zoomOut`, `zoomTo`

**Only here:** `addFonts`, `addMarkerLayer`, `fire`, `getAttributions`, `queryElevation`, `queryFeatures`, `queryMarkers`, `removeMarkerLayer`, `setCursor`

**Missing:** `addSprite`, `applyTerrainChange`, `applyTransformChange`, `applyUpdatedTransform`, `calculateAnchoredCameraOptions`, `calculateCameraOptionsFromCameraLngLatAltRotation`, `calculateCameraOptionsFromTo`, `captureRotationPivot`, `clampCenterToGround`, `coveringTiles`, `fitScreenCoordinates`, `getAnisotropicFilterPitch`, `getCenterClampedToGround`, `getImage`, `getLight`, `getPadding`, `getSky`, `getStyleUrl`, `getTransformForUpdate`, `getVerticalFieldOfView`, `getZoomSnap`, `holdElevation`, `isRolling`, `migrateProjection`, `moveCenterOntoTerrain`, `orbitRotationPivot`, `prepareNextFrame`, `putCenterBackOnTerrain`, `queryRenderedFeatures`, `querySourceFeatures`, `releaseElevation`, `removeSprite`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setCenterElevation`, `setLight`, `setPadding`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setRoll`, `setSky`, `setSourceTileLodParams`, `setTransformCameraUpdate`, `setTransformConstrain`, `setTransformRequest`, `setVerticalFieldOfView`, `setZoomSnap`
<!-- api:end -->
