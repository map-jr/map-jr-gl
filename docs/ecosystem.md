# Plugins and frameworks

This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and
framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl` and the map events that each
package uses, and compares them with this library.

The script reads the code as text. It does not run the packages. So a package with "none" in each column can still
have a problem, and a method in the list is possibly used only in a part of the package that you do not use.

**17 of 26 packages** use only parts of the API that this library has.

react-map-gl 7 does not work with this library, and the tables below read version 8 only. Version 7 reads the private
`map.transform` of MapLibre GL JS and throws a `TypeError`. Version 8 works (the field test of #187).

<!-- plugins:start -->
## Plugins that were run

These plugins were run with this library in a browser by `node test/conformance/plugins.mjs --write`. Each one has a
short scenario in `test/conformance/plugins/`. The plugin imports `maplibre-gl` and gets this library.

**15 of 15 scenarios pass.**

| Plugin | Result | What the scenario found |
|---|---|---|
| @mapbox/mapbox-gl-draw 1.5.2 | Pass | added 1, selected by a click: 1, moved by a drag: true, the map panned: false |
| terra-draw 1.39.0, terra-draw-maplibre-gl-adapter 1.5.0 | Pass | features after one click: 1 |
| @maplibre/maplibre-gl-compare 0.5.0 | Pass | slider at 200, zooms 14.00 and 14.00 |
| @mapbox/mapbox-gl-sync-move 0.4.0 | Pass | the second map is at 10.00, 50.00, zoom 6.00 |
| pmtiles 4.5.0 | Pass | addProtocol and removeProtocol accepted the protocol |
| maplibre-gl-opacity 1.8.0 | Pass | the control is in the page: true; fill-opacity after the slider: 0.7 |
| @maplibre/maplibre-gl-inspect 1.9.0 | Pass | the inspect view is on; the style has 49 layers |
| @watergis/maplibre-gl-export 6.0.0 | Pass | the control is in the page |
| @vis.gl/react-maplibre 8.1.3, react 19.3.1, react-dom 19.3.1 | Pass | events: move, load; layer from <Layer>: true; marker: true; control: true; popup: true; zoom after jumpTo: 13.00 |
| @indoorequal/vue-maplibre-gl 9.0.1, vue 3.5.45 | Pass | events: load; layer from <MglCircleLayer>: true; marker: true; control: true |
| @deck.gl/mapbox 9.4.1, @deck.gl/layers 9.4.1, @deck.gl/core 9.4.1 | Pass | deck.gl canvas: true; frames drawn: 3 then 4; the point at the map centre was picked there: true |
| @maplibre/maplibre-gl-geocoder 1.9.4 | Pass | the control is in the page: true; result: Eiffel Tower; the map went to the place: true; marker: true |
| @maplibre/maplibre-gl-directions 0.10.1 | Pass | routes: 1; layers of the plugin: 11; features under the first waypoint, read at once: 7; waypoints added by a click on the map: 1 |
| @mapbox/mapbox-gl-language 1.0.1 | Pass | the plugin changes the text fields: true; the map has the changed fields: true; style.load fired: true |
| @geoman-io/maplibre-geoman-free 0.10.8 | Pass | features after the import: 1; after a marker was drawn with a click: 2; layers of the plugin: 33 |
<!-- plugins:end -->

<!-- styles:start -->
## Public styles that were drawn

These styles were drawn with MapLibre GL JS and with this library by `node test/conformance/styles.mjs --write`, at
the same places. Each number is the percentage of pixels that differ clearly between the two images. The two
libraries draw text in different ways and can select different labels, so 2 to 7 percent is usual for a view with
many labels. A larger number shows something that the library draws wrongly or not at all.

| Style | world | country | city | streets | close | tilted |
|---|---|---|---|---|---|---|
| [liberty](https://tiles.openfreemap.org/styles/liberty) | 3.4 | 2.8 | 2.5 | 5.9 | 1.1 | 5.2 |
| [bright](https://tiles.openfreemap.org/styles/bright) | 3.3 | 2.7 | 2.5 | 5.5 | 1 | 5.6 |
| [positron](https://tiles.openfreemap.org/styles/positron) | 3.3 | 2.7 | 2.4 | 2.5 | 0.7 | 3.5 |
| [versatiles](https://tiles.versatiles.org/assets/styles/colorful/style.json) | 0 | 4.1 | 2.6 | 4.3 | 0.6 | 4 |
| [demotiles](https://demotiles.maplibre.org/style.json) | 0.7 | 0.6 | 0 | 0 | 0 | 0 |
| [voyager](https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json) | 0 | 1 | 0.4 | 1.2 | 0.4 | 2 |
| [darkmatter](https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json) | 0 | 1.1 | 0.4 | 1.3 | 0.3 | 1 |
| [dark](https://tiles.openfreemap.org/styles/dark) | 1.7 | 1.6 | 1 | 0.8 | 0.1 | 0.9 |
| [shortbread](https://vector.openstreetmap.org/styles/shortbread/colorful.json) | 0 | 4 | 2.8 | 4 | 0.3 | 3.8 |

The views: world (zoom 1.6), country (zoom 5.3), city (zoom 11.2), streets (zoom 14.6), close (zoom 17.4), tilted (zoom 15.7, tilted).
<!-- styles:end -->

<!-- examples:start -->
## The example pages of MapLibre GL JS

The documentation of MapLibre GL JS has an example page for each common task. `node test/conformance/examples.mjs --write`
runs each page two times: with MapLibre GL JS, and with this library in its place (the page itself is not changed).
A page works when this library gives no error that MapLibre GL JS does not give, and at most 12 percent of the
pixels of the two images differ clearly (labels and controls are drawn in different ways).

**110 of 142 pages work.** 23 give an error, 9 draw a different image, 0 were not compared.

| Example page | Result | Pixels that differ | First error of this library |
|---|---|---|---|
| add-3d-terrain-from-quantized-mesh-tiles | error | 65.2 | [map-jr-gl] Error: The source image could not be decoded. |
| add-3d-tiles-3d-objects-and-models-using-threejs | error | 49.9 | The requested module 'maplibre-gl' does not provide an export named 'MercatorCoordinate' |
| add-a-3d-model-with-babylonjs | error | 0.8 | Cannot read properties of undefined (reading 'fromLngLat') |
| add-a-cog-raster-source | error | 49.8 | [map-jr-gl] AggregateError: Request failed |
| add-a-color-relief-layer | differs | 99.1 |  |
| add-a-custom-layer-with-tiles-to-a-globe | error | 49.3 | [map-jr-gl] TypeError: map.setProjection is not a function |
| add-a-multidirectional-hillshade-layer | differs | 56.4 |  |
| add-a-simple-custom-layer-on-a-globe | error | 14.6 | [map-jr-gl] TypeError: map.setProjection is not a function |
| add-a-video | differs | 28.3 |  |
| add-custom-layers-that-follow-the-terrain | error | 81.4 | Cannot read properties of undefined (reading 'fromLngLat') |
| add-live-realtime-data | differs | 44.8 |  |
| animate-an-icon-on-the-gpu | error | 0.7 | Failed to construct 'ImageData': The input data has zero elements. |
| animate-map-camera-around-a-point | differs | 50.1 |  |
| animate-symbol-to-follow-the-mouse | error | 2.2 | maplibregl.GlobeControl is not a constructor |
| create-a-heatmap-layer-on-a-globe-with-terrain-elevation | error | 19.7 | maplibregl.GlobeControl is not a constructor |
| customize-the-map-transform-constrain | differs | 94.6 |  |
| display-a-globe-with-a-fill-extrusion-layer | error | 14.2 | maplibregl.GlobeControl is not a constructor |
| display-a-globe-with-a-vector-map | error | 23 | [map-jr-gl] TypeError: map.setProjection is not a function |
| display-a-globe-with-an-atmosphere | differs | 47.2 |  |
| display-a-hybrid-satellite-map-with-terrain-elevation | error | 19.2 | maplibregl.GlobeControl is not a constructor |
| display-a-map-in-a-polar-stereographic-projection | error | 87.2 | maplibregl.addProjection is not a function |
| display-a-map-in-utm-zone-32n | error | 69.4 | maplibregl.addProjection is not a function |
| display-a-map-with-mlt | error | 11.1 | [map-jr-gl] Error: Unsupported protobuf wire type 3 |
| display-geojson-in-a-polar-stereographic-projection | error | 86.8 | maplibregl.importScriptInWorkers is not a function |
| enter-a-360-photosphere | error | 69.1 | The requested module 'maplibre-gl' does not provide an export named 'MercatorCoordinate' |
| level-of-detail-control | error | 28.1 | map.setSourceTileLodParams is not a function |
| navigate-the-map-with-game-like-controls | differs | 37.6 |  |
| raycast-3d-tiles-using-threejs | error | 93.7 | The requested module 'maplibre-gl' does not provide an export named 'MercatorCoordinate' |
| set-center-point-above-ground | differs | 95.6 |  |
| sky-fog-terrain | error | 26.7 | maplibregl.GlobeControl is not a constructor |
| walk-around-a-map-in-first-person | error | 47.3 | Cannot read properties of undefined (reading 'fromLngLat') |
| zoom-and-planet-size-relation-on-globe | error | 21.5 | [map-jr-gl] TypeError: map.setProjection is not a function |
<!-- examples:end -->

## What is missing most often

| Missing | Kind | Packages that use it |
|---|---|---|
| `GlobeControl` | export | 4: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `CanvasSource` | export | 1: svelte-maplibre-gl |
| `config` | export | 1: svelte-maplibre |
| `Event` | export | 1: svelte-maplibre-gl |
| `GeoJSONSource` | export | 1: svelte-maplibre-gl |
| `GPUInitializationError` | export | 1: svelte-maplibre |
| `Hash` | export | 1: svelte-maplibre-gl |
| `ImageSource` | export | 1: svelte-maplibre-gl |
| `RasterDEMTileSource` | export | 1: svelte-maplibre-gl |
| `RasterTileSource` | export | 1: svelte-maplibre-gl |
| `VectorTileSource` | export | 1: svelte-maplibre-gl |
| `VideoSource` | export | 1: svelte-maplibre-gl |
| `setProjection` | method of `Map` | 6: react-map-gl, vue-maplibre-gl, svelte-maplibre-gl, svelte-maplibre, @maplibre/ngx-maplibre-gl, @maptiler/sdk |
| `setRenderWorldCopies` | method of `Map` | 4: vue-maplibre-gl, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setSky` | method of `Map` | 3: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl |
| `setTransformCameraUpdate` | method of `Map` | 3: react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl |
| `setTransformConstrain` | method of `Map` | 3: @maplibre/maplibre-gl-leaflet, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setAnisotropicFilterPitch` | method of `Map` | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setZoomSnap` | method of `Map` | 2: svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `fitScreenCoordinates` | method of `Map` | 1: @maplibre/ngx-maplibre-gl |
| `getZoomSnap` | method of `Map` | 1: svelte-maplibre-gl |
| `setCenterClampedToGround` | method of `Map` | 1: svelte-maplibre-gl |
| `setCenterElevation` | method of `Map` | 1: @maplibre/ngx-maplibre-gl |
| `setRoll` | method of `Map` | 1: @maptiler/sdk |
| `setVerticalFieldOfView` | method of `Map` | 1: svelte-maplibre-gl |
| `projectiontransition` | event | 1: @maptiler/sdk |

## Each package

### Drawing and editing

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @mapbox/mapbox-gl-draw | 1.5.2 | 13 methods, 0 exports, 8 events | none | none | none |
| terra-draw-maplibre-gl-adapter | 1.5.0 | 13 methods, 0 exports, 0 events | none | none | none |
| @watergis/maplibre-gl-terradraw | 1.17.0 | 25 methods, 1 exports, 2 events | none | none | none |
| maplibre-gl-measures | 0.0.21 | 17 methods, 0 exports, 0 events | none | none | none |

### Search and directions

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-geocoder | 1.9.4 | 9 methods, 3 exports, 3 events | none | none | none |
| @maplibre/maplibre-gl-directions | 0.10.1 | 12 methods, 0 exports, 9 events | none | none | none |

### Controls and tools

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| @maplibre/maplibre-gl-compare | 0.5.0 | 10 methods, 0 exports, 2 events | none | none | none |
| @maplibre/maplibre-gl-inspect | 1.9.0 | 7 methods, 1 exports, 6 events | none | none | none |
| @watergis/maplibre-gl-export | 6.0.0 | 29 methods, 2 exports, 2 events | none | none | none |
| maplibre-gl-opacity | 1.8.0 | 2 methods, 0 exports, 0 events | none | none | none |
| @mapbox/mapbox-gl-sync-move | 0.4.0 | 7 methods, 0 exports, 1 events | none | none | none |
| maplibre-gl-basemaps | 0.1.3 | 5 methods, 0 exports, 1 events | none | none | none |
| @maplibre/maplibre-gl-style-flipper | not found on npm | | | | |

### Data and layers

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| pmtiles | 4.5.0 | 1 methods, 0 exports, 0 events | none | none | none |
| maplibre-contour | 0.1.1 | 0 methods, 1 exports, 0 events | none | none | none |
| @deck.gl/mapbox | 9.4.1 | 18 methods, 0 exports, 12 events | none | none | none |
| @maplibre/maplibre-gl-leaflet | 0.1.4 | 13 methods, 0 exports, 2 events | `setTransformConstrain` | none | none |
| maplibre-gl-vector-text-protocol | 0.0.5 | 1 methods, 0 exports, 0 events | none | none | none |
| @americana/maplibre-shield-generator | 0.2.1 | 7 methods, 0 exports, 1 events | none | none | none |

### Frameworks

| Package | Version | API in use | Missing methods | Missing exports | Missing events |
|---|---|---|---|---|---|
| react-map-gl | 8.1.3 | 53 methods, 20 exports, 8 events | `setProjection`, `setSky`, `setTransformCameraUpdate` | `GlobeControl` | none |
| @vis.gl/react-maplibre | 8.1.3 | 47 methods, 15 exports, 6 events | `setSky`, `setTransformCameraUpdate` | `GlobeControl` | none |
| vue-maplibre-gl | 5.6.1 | 40 methods, 6 exports, 17 events | `setProjection`, `setRenderWorldCopies` | none | none |
| @indoorequal/vue-maplibre-gl | 9.0.1 | 39 methods, 9 exports, 5 events | `setRenderWorldCopies` | none | none |
| svelte-maplibre-gl | 2.2.1 | 55 methods, 26 exports, 5 events | `getZoomSnap`, `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setProjection`, `setRenderWorldCopies`, `setSky`, `setTransformCameraUpdate`, `setTransformConstrain`, `setVerticalFieldOfView`, `setZoomSnap` | `CanvasSource`, `Event`, `GeoJSONSource`, `GlobeControl`, `Hash`, `ImageSource`, `RasterDEMTileSource`, `RasterTileSource`, `VectorTileSource`, `VideoSource` | none |
| svelte-maplibre | 2.0.1 | 37 methods, 19 exports, 26 events | `setProjection` | `GPUInitializationError`, `config` | none |
| @maplibre/ngx-maplibre-gl | 22.3.1 | 51 methods, 11 exports, 46 events | `fitScreenCoordinates`, `setAnisotropicFilterPitch`, `setCenterElevation`, `setProjection`, `setRenderWorldCopies`, `setTransformConstrain`, `setZoomSnap` | `GlobeControl` | none |
| @maptiler/sdk | 4.2.1 | 66 methods, 1 exports, 18 events | `setProjection`, `setRoll` | none | `projectiontransition` |
