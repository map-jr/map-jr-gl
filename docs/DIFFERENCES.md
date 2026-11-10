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
| Runtime style changes | Applied incrementally. | `addLayer`, `setPaintProperty` and similar rebuild the visible tiles, which can flash. |
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
- Layers: heatmap, color-relief, custom layers. `fill-pattern` and `line-pattern` layers are hidden.
- 3D terrain, sky, globe and other projections.
- SDF (recolourable) sprite icons, `icon-color`, `icon-text-fit`, `text-halo-blur`, `circle-pitch-alignment`, `circle-pitch-scale`, data-driven circle stroke and blur, `line-offset`, `line-blur`, `line-gradient`.
- Feature state (`setFeatureState`), global state, `transformRequest`, `addProtocol`.
- Hillshade and runtime-added bitmap images in server output.
- Right-to-left text is handled by the browser, so the RTL plugin API does not exist.

## Conformance numbers

Measured by the test scripts in this repository:

- **Expressions:** `pnpm test:expressions` runs MapLibre's own expression fixtures. 279 of 425 runnable fixtures pass.
  The main gaps are `distance` and `within` (58 fixtures), collators, rich-text `format` objects, `feature-state`
  and `global-state`.
- **Rendering:** `pnpm test:render` runs MapLibre's render tests (a style and an expected image each). Of 1,429
  runnable tests, 422 match (at most 1% of pixels differ), 268 are close (at most 5%) and 739 differ; 331 are
  skipped because they script the map or need a high pixel density. Text is drawn with browser fonts rather than
  the tests' glyph files, so most tests with labels cannot match exactly. The largest feature gaps are
  `icon-text-fit`, patterns, projections, sky, heatmap, global state and pitch-aligned circles.
- **Map API:** see below.

<!-- api:start -->
## Map API coverage

73 of 150 public methods of MapLibre's `Map` exist here (49%).

**Supported:** `addControl`, `addImage`, `addLayer`, `addSource`, `areTilesLoaded`, `cameraForBounds`, `easeTo`, `fitBounds`, `flyTo`, `getBearing`, `getBounds`, `getCanvas`, `getCanvasContainer`, `getCenter`, `getContainer`, `getFilter`, `getLayer`, `getLayersOrder`, `getLayoutProperty`, `getMaxPitch`, `getMaxZoom`, `getMinPitch`, `getMinZoom`, `getPaintProperty`, `getPitch`, `getSource`, `getStyle`, `getZoom`, `hasControl`, `hasImage`, `isMoving`, `isStyleLoaded`, `jumpTo`, `listImages`, `loadImage`, `loaded`, `moveLayer`, `off`, `on`, `once`, `panBy`, `panTo`, `project`, `redraw`, `remove`, `removeControl`, `removeImage`, `removeLayer`, `removeSource`, `resetNorth`, `resetNorthPitch`, `resize`, `rotateTo`, `setBearing`, `setCenter`, `setFilter`, `setLayerZoomRange`, `setLayoutProperty`, `setMaxPitch`, `setMaxZoom`, `setMinZoom`, `setMissingStyleImageResolver`, `setPaintProperty`, `setPitch`, `setStyle`, `setZoom`, `snapToNorth`, `stop`, `triggerRepaint`, `unproject`, `zoomIn`, `zoomOut`, `zoomTo`

**Only here:** `addFonts`, `addMarkerLayer`, `fire`, `getAttributions`, `queryElevation`, `queryFeatures`, `queryMarkers`, `removeMarkerLayer`, `setCursor`

**Missing:** `addSprite`, `applyTerrainChange`, `applyTransformChange`, `applyUpdatedTransform`, `calculateAnchoredCameraOptions`, `calculateCameraOptionsFromCameraLngLatAltRotation`, `calculateCameraOptionsFromTo`, `captureRotationPivot`, `clampCenterToGround`, `coveringTiles`, `fitScreenCoordinates`, `getAnisotropicFilterPitch`, `getCameraTargetElevation`, `getCenterClampedToGround`, `getCenterElevation`, `getFeatureState`, `getFontFaces`, `getGlobalState`, `getGlyphs`, `getImage`, `getLight`, `getMaxBounds`, `getPadding`, `getPixelRatio`, `getProjection`, `getRenderWorldCopies`, `getRoll`, `getSky`, `getSprite`, `getStyleUrl`, `getTerrain`, `getTransformForUpdate`, `getVerticalFieldOfView`, `getZoomSnap`, `holdElevation`, `isPitching`, `isRolling`, `isRotating`, `isSourceLoaded`, `isZooming`, `migrateProjection`, `moveCenterOntoTerrain`, `orbitRotationPivot`, `prepareNextFrame`, `putCenterBackOnTerrain`, `queryRenderedFeatures`, `querySourceFeatures`, `queryTerrainElevation`, `refreshTiles`, `releaseElevation`, `removeFeatureState`, `removeSprite`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setCenterElevation`, `setFeatureState`, `setFontFaces`, `setGlobalStateProperty`, `setGlyphs`, `setLight`, `setMaxBounds`, `setMinPitch`, `setPadding`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setRoll`, `setSky`, `setSourceTileLodParams`, `setSprite`, `setTerrain`, `setTransformCameraUpdate`, `setTransformConstrain`, `setTransformRequest`, `setVerticalFieldOfView`, `setZoomSnap`, `updateImage`
<!-- api:end -->
