# MapLibre compatibility

This document compares the library with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) version 6.

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
| Marker layers | `addMarkerLayer` draws many SVG markers on the canvas. See [Markers](markers.md). |
| SVG images | `addImage` accepts an SVG string. The image is sharp on each screen. |
| Web fonts | Text uses the fonts of the browser. The style can give font files in `font-faces`. Glyph files are not necessary. |
| `queryFeatures` | Finds features at a position from the tile data. A style layer is not necessary. |
| `queryElevation` | Gives the elevation at a position from a `raster-dem` source. |
| Contour source | `type: 'contour'` makes contour lines from an elevation source. See [Terrain and elevation](terrain-and-elevation.md). |
| PMTiles | A source address that starts with `pmtiles://` reads a PMTiles archive. No plugin is necessary. |
| Changes for the server in the style | `metadata["map-jr:ssr"]` on a layer changes that layer only on the server. |
| Icons made when necessary | `setMissingStyleImageResolver` supplies an image for a name that the sprite does not contain. |
| Frame data | The `stats` event gives the frames per second and the work for each frame. |
| Controls without a CSS file | The library adds the styles for its controls. You change the colours with `--map-control-*` custom properties. |

## What is different

| Subject | MapLibre GL JS | This library |
|---|---|---|
| Text | Reads glyph files from the `glyphs` address. | Draws text with web fonts. The `glyphs` address is not used. Line breaks are the same as in MapLibre GL JS. The weight of the text can look a small quantity different. |
| Text on lines | Each character follows the line. The style sets the largest permitted angle. | Each character follows the line. A label does not show where the line turns more than approximately 35 degrees between characters. |
| Order of symbol layers | A symbol layer draws at its position in the layer list. | All symbol layers draw above all other layers. |
| Label placement | Changes gradually, tile by tile. | The library decides approximately four times each second. Labels fade between decisions. |
| Feature queries | `queryRenderedFeatures` gives an immediate result. | Use `queryFeatures`. It gives a promise. It reads the tile data, not the picture. |
| Feature state | The graphics processor applies the state. An `id` can be text. | `setFeatureState` and the `feature-state` expression work. A change builds the tiles again in the background, thus it shows after a short time. A feature must have a number as its `id`. |
| Style changes | Applied step by step. | A paint value that is the same for all of a layer is applied immediately. Other changes build the tiles of that source again. The old tiles stay on the screen until the new tiles are ready. |
| 3D terrain | Draws terrain at each tilt. | Draws a flat map when you look vertically down. See [Terrain and elevation](terrain-and-elevation.md). |
| Camera | Tilt to 85 degrees. Roll. Field of view. | Tilt to 60 degrees. No roll. A fixed field of view. Padding is available. |
| `setMaxBounds` | Keeps all of the view in the bounds. | Keeps the map centre in the bounds. |
| `isSourceLoaded` | Gives a result for one source. | Gives a result for all sources together. |
| `addImage` | Accepts pictures and pixel data. | Accepts the same, and also an SVG string or an address. It gives a promise. The `sdf` option is not available; the sprite of the style can contain SDF icons. |
| `easeTo`, `flyTo` | Accept an `easing` function and an `offset`. | Use the default easing of MapLibre GL JS. The library ignores `easing` and `offset`. |
| Events | Event classes. | Simple objects with `type`, `target`, `point` and `lngLat`. |
| Events for one layer | `map.on('click', layerId, fn)` gives an immediate result. | The same call works. The event comes a short time after the pointer event, because the library reads the tile data. |
| `Marker`, `Popup` | Full API. | The usual parts of the API: position, popup, drag, anchor, offset. |
| Touch gestures | You can configure each gesture. | The same gestures. They are always on. |
| Expressions | Checks the types. | Does not check the types. An expression that is not correct can give no error. |
| Style validation | Reports errors in the style. | Does not validate. It writes a warning for each layer or property that it cannot draw. |
| CSS class names | `maplibregl-*` | `map-jr-*`. Each element also has the `maplibregl-*` name, thus stylesheets and plugins for MapLibre GL JS continue to work. A control from a plugin gets the `map-jr-*` names when you add it. |
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
- Icon halos
- `text-writing-mode`, `text-pitch-alignment`
- `symbol-z-order` and `symbol-avoid-edges`
- `vertical-align` in `format` text. Sizes, fonts, colours and images in `format` text are available. The SVG output of the server draws each line in one size.

Layers that the server renderer does not draw:

- Heatmap and relief shading

Other:

- Sky, fog, globe and other projections
- `queryRenderedFeatures` and `querySourceFeatures`
- `transformRequest` and `addProtocol`
- The right-to-left text plugin. The browser draws right-to-left text correctly without it.

## Map methods

<!-- api:start -->
106 of the 150 public methods of the MapLibre `Map` class are available (71%).

**Available:** `addControl`, `addImage`, `addLayer`, `addSource`, `areTilesLoaded`, `cameraForBounds`, `easeTo`, `fitBounds`, `flyTo`, `getBearing`, `getBounds`, `getCameraTargetElevation`, `getCanvas`, `getCanvasContainer`, `getCenter`, `getCenterElevation`, `getContainer`, `getFeatureState`, `getFilter`, `getFontFaces`, `getGlobalState`, `getGlyphs`, `getLayer`, `getLayersOrder`, `getLayoutProperty`, `getLight`, `getMaxBounds`, `getMaxPitch`, `getMaxZoom`, `getMinPitch`, `getMinZoom`, `getPadding`, `getPaintProperty`, `getPitch`, `getPixelRatio`, `getProjection`, `getRenderWorldCopies`, `getRoll`, `getSource`, `getSprite`, `getStyle`, `getTerrain`, `getZoom`, `hasControl`, `hasImage`, `isMoving`, `isPitching`, `isRotating`, `isSourceLoaded`, `isStyleLoaded`, `isZooming`, `jumpTo`, `listImages`, `loadImage`, `loaded`, `moveLayer`, `off`, `on`, `once`, `panBy`, `panTo`, `project`, `queryTerrainElevation`, `redraw`, `refreshTiles`, `remove`, `removeControl`, `removeFeatureState`, `removeImage`, `removeLayer`, `removeSource`, `resetNorth`, `resetNorthPitch`, `resize`, `rotateTo`, `setBearing`, `setCenter`, `setFeatureState`, `setFilter`, `setFontFaces`, `setGlobalStateProperty`, `setGlyphs`, `setLayerZoomRange`, `setLayoutProperty`, `setLight`, `setMaxBounds`, `setMaxPitch`, `setMaxZoom`, `setMinPitch`, `setMinZoom`, `setMissingStyleImageResolver`, `setPadding`, `setPaintProperty`, `setPitch`, `setSprite`, `setStyle`, `setTerrain`, `setZoom`, `snapToNorth`, `stop`, `triggerRepaint`, `unproject`, `updateImage`, `zoomIn`, `zoomOut`, `zoomTo`

**Only in this library:** `addFonts`, `addMarkerLayer`, `fire`, `getAttributions`, `queryElevation`, `queryFeatures`, `queryMarkers`, `removeMarkerLayer`, `setCursor`

**Not available:** `addSprite`, `applyTerrainChange`, `applyTransformChange`, `applyUpdatedTransform`, `calculateAnchoredCameraOptions`, `calculateCameraOptionsFromCameraLngLatAltRotation`, `calculateCameraOptionsFromTo`, `captureRotationPivot`, `clampCenterToGround`, `coveringTiles`, `fitScreenCoordinates`, `getAnisotropicFilterPitch`, `getCenterClampedToGround`, `getImage`, `getSky`, `getStyleUrl`, `getTransformForUpdate`, `getVerticalFieldOfView`, `getZoomSnap`, `holdElevation`, `isRolling`, `migrateProjection`, `moveCenterOntoTerrain`, `orbitRotationPivot`, `prepareNextFrame`, `putCenterBackOnTerrain`, `queryRenderedFeatures`, `querySourceFeatures`, `releaseElevation`, `removeSprite`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setCenterElevation`, `setPixelRatio`, `setProjection`, `setRenderWorldCopies`, `setRoll`, `setSky`, `setSourceTileLodParams`, `setTransformCameraUpdate`, `setTransformConstrain`, `setTransformRequest`, `setVerticalFieldOfView`, `setZoomSnap`
<!-- api:end -->
