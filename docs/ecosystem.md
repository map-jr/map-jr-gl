# Plugins and frameworks

This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and
framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl`, the map events and the methods
of controls, `Marker` and `Popup` that each package uses, and compares them with the entry
`@map-jr/map-jr-gl/maplibre-compat` of this library.

A method of a control, `Marker` or `Popup` is found when the package keeps the new instance in a name and calls the
method on that name in the same file (for example `const gc = new maplibregl.GeolocateControl(); gc.on(...)`).

The script reads the code as text. It does not run the packages. So a package with "none" in each column can still
have a problem, and a method in the list is possibly used only in a part of the package that you do not use.

**23 of 27 packages** use only parts of the API that this library has.

A missing method throws a `TypeError` when the package calls it. A method that is "accepted, with no effect" exists and
does nothing, so the package goes on, and it does not count as missing. Most of these methods warn once when they get a
value that the library cannot do (see "Accepted, with no effect" in `docs/reference/maplibre-differences.md`).

react-map-gl 7 does not work with this library, and the tables below read version 8 only. Version 7 reads the private
`map.transform` of MapLibre GL JS and throws a `TypeError`. Version 8 works (the field test of #187).

<!-- plugins:start -->
## Plugins that were run

These plugins were run with this library in a browser by `node test/conformance/plugins.mjs --write`. Each one has a
short scenario in `test/conformance/plugins/`. The plugin imports `maplibre-gl` and gets this library.

**16 of 16 scenarios pass.**

| Scenario | Plugin | Result |
|---:|---|---|
| 1 | @mapbox/mapbox-gl-draw 1.5.2 | Pass |
| 2 | terra-draw 1.39.0, terra-draw-maplibre-gl-adapter 1.5.0 | Pass |
| 3 | @maplibre/maplibre-gl-compare 0.5.0 | Pass |
| 4 | @mapbox/mapbox-gl-sync-move 0.4.0 | Pass |
| 5 | pmtiles 4.5.0 | Pass |
| 6 | maplibre-gl-opacity 1.8.0 | Pass |
| 7 | @maplibre/maplibre-gl-inspect 1.9.0 | Pass |
| 8 | @watergis/maplibre-gl-export 6.0.0 | Pass |
| 9 | @vis.gl/react-maplibre 8.1.3, react 19.3.1, react-dom 19.3.1 | Pass |
| 10 | @vis.gl/react-maplibre 8.1.3, react 19.3.1, react-dom 19.3.1 | Pass |
| 11 | @indoorequal/vue-maplibre-gl 9.0.1, vue 3.5.45 | Pass |
| 12 | @deck.gl/mapbox 9.4.1, @deck.gl/layers 9.4.1, @deck.gl/core 9.4.1 | Pass |
| 13 | @maplibre/maplibre-gl-geocoder 1.9.4 | Pass |
| 14 | @maplibre/maplibre-gl-directions 0.10.1 | Pass |
| 15 | @mapbox/mapbox-gl-language 1.0.1 | Pass |
| 16 | @geoman-io/maplibre-geoman-free 0.10.8 | Pass |

What each scenario found:

1. added 1, selected by a click: 1, moved by a drag: true, the map panned: false
2. features after one click: 1
3. slider at 200, zooms 14.00 and 14.00
4. the second map is at 10.00, 50.00, zoom 6.00
5. a layer of a pmtiles:// source draws 92 features; the library read the archive itself (the protocol of the plugin was called 0 times)
6. the control is in the page: true; fill-opacity after the slider: 0.7
7. the inspect view is on; the style has 49 layers
8. the control is in the page (an export of an image is not tested: the plugin reads map._requestManager, which the compat map does not have)
9. events: move, load; layer from <Layer>: true; marker: true; control: true; popup: true; zoom after jumpTo: 13.00
10. drag followed by the state: true; state change from outside: true; onMove that limits the latitude: true (after the drag: map 40.72000, limit 40.72000; during the drag the map went 0.01991° past the limit); warnings about setTransformCameraUpdate: 0 before the limit, 1 after it
11. events: load; layer from <MglCircleLayer>: true; marker: true; control: true
12. deck.gl canvas: true; frames drawn: 3 then 4; the point at the map center was picked there: true
13. the control is in the page: true; result: Eiffel Tower; the map went to the place: true; marker: true
14. routes: 1; layers of the plugin: 11; features under the first waypoint, read at once: 7; waypoints added by a click on the map: 1
15. the plugin changes the text fields: true; the map has the changed fields: true; style.load fired: true
16. features after the import: 1; after a marker was drawn with a click: 2; layers of the plugin: 33
<!-- plugins:end -->

<!-- maputnik:start -->
## Maputnik, the style editor

`node test/conformance/maputnik.mjs --write` runs Maputnik in a browser two times: with MapLibre GL JS, and with the
entry `@map-jr/map-jr-gl/maplibre-compat` of this library in its place. It uses the fork
[map-jr/maputnik](https://github.com/map-jr/maputnik), whose preview renders with this library; the fork also accepts `params` of the
`image` expression. Each build runs the end-to-end tests of Maputnik and the scenarios below, which test what those
tests do not.

The run used Maputnik 3.1.0 (2ca0ccc) and MapLibre GL JS 6.18.0.

| Tests | Passing | Total | Share |
|---|---:|---:|---:|
| Maputnik's own tests, with this library | 194 | 194 | 100.0% |
| Maputnik's own tests, with MapLibre GL JS | 194 | 194 | 100.0% |

| Scenario | This library | MapLibre GL JS |
|---|---|---|
| Loads the style elevation of map-jr-styles | Pass | Pass |
| Loads the style liberty of OpenFreeMap | Pass | Pass |
| Opens with the empty default style | Pass | Pass |
| Suggests the properties of a source layer in the filter editor | Pass | Pass |
| Shows the icons of the navigation control in the colors of the editor | Pass | Pass |

What each scenario found:

- Loads the style elevation of map-jr-styles. Both libraries: layers: 113; messages of the editor: 0; errors: 0.
- Loads the style liberty of OpenFreeMap. Both libraries: layers: 111; errors: 0.
- Opens with the empty default style. Both libraries: errors: 0.
- Suggests the properties of a source layer in the filter editor. Both libraries: properties of the layer "building": render_height, render_min_height, colour, hide_3d.
- Shows the icons of the navigation control in the colors of the editor. Both libraries: icons with the color of the editor: 3 of 3.
<!-- maputnik:end -->

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

**122 of 142 pages work.**

| Result | Pages | Share |
|---|---:|---:|
| Works | 122 | 85.9% |
| Gives an error | 13 | 9.2% |
| Draws a different image | 7 | 4.9% |
| Not compared | 0 | 0.0% |

The pages that do not work:

| Example page | Result | Pixels that differ, % |
|---|---|---:|
| add-3d-tiles-3d-objects-and-models-using-threejs | error | 41.7 |
| add-a-3d-model-with-babylonjs | error | 0.8 |
| add-a-custom-layer-with-tiles-to-a-globe | error | 42.5 |
| add-a-custom-style-layer | error | 3.4 |
| add-a-simple-custom-layer-on-a-globe | error | 5.2 |
| add-a-video | differs | 28.1 |
| add-custom-layers-that-follow-the-terrain | error | 15.7 |
| add-live-realtime-data | differs | 45.8 |
| animate-an-icon-on-the-gpu | error | 0.7 |
| create-a-heatmap-layer-on-a-globe-with-terrain-elevation | differs | 20.7 |
| customize-the-map-transform-constrain | differs | 23 |
| display-a-hybrid-satellite-map-with-terrain-elevation | differs | 13.7 |
| display-a-map-in-a-polar-stereographic-projection | error | 87.3 |
| display-a-map-in-utm-zone-32n | error | 69.5 |
| display-a-map-with-mlt | error | 11.1 |
| display-geojson-in-a-polar-stereographic-projection | error | 86.9 |
| enter-a-360-photosphere | error | 7.2 |
| navigate-the-map-with-game-like-controls | differs | 36.4 |
| raycast-3d-tiles-using-threejs | error | 88.8 |
| set-center-point-above-ground | differs | 95.6 |

The first error that this library gives on each of these pages:

- add-3d-tiles-3d-objects-and-models-using-threejs: Error: [map-jr-gl] addLayer: the custom layer "maplibre-gl-three-1" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- add-a-3d-model-with-babylonjs: Error: [map-jr-gl] addLayer: the custom layer "3d-model" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- add-a-custom-layer-with-tiles-to-a-globe: Error: [map-jr-gl] addLayer: the custom layer "highlight" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- add-a-custom-style-layer: Error: [map-jr-gl] addLayer: the custom layer "highlight" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- add-a-simple-custom-layer-on-a-globe: Error: [map-jr-gl] addLayer: the custom layer "highlight" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- add-custom-layers-that-follow-the-terrain: Error: [map-jr-gl] addLayer: the custom layer "grid" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- animate-an-icon-on-the-gpu: [map-jr-gl] addImage("rainbow-triangle"): images that draw themselves with WebGL (renderWithWebGL) are not supported. Pass pixels, a canvas, an image or SVG tex
- display-a-map-in-a-polar-stereographic-projection: maplibregl.addProjection is not a function
- display-a-map-in-utm-zone-32n: maplibregl.addProjection is not a function
- display-a-map-with-mlt: [map-jr-gl] Error: Unsupported protobuf wire type 6
- display-geojson-in-a-polar-stereographic-projection: maplibregl.importScriptInWorkers is not a function
- enter-a-360-photosphere: Error: [map-jr-gl] addLayer: the custom layer "photosphere-2286828-48856625" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
- raycast-3d-tiles-using-threejs: Error: [map-jr-gl] addLayer: the custom layer "agi-hq-3d" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().
<!-- examples:end -->

Most of the pages that do not work need a globe, another projection or a custom 3D layer.

Custom layers need `renderer: 'main'`, which the example pages do not pass, so the pages with a custom layer give the
error that says so. `node test/conformance/examples.mjs --renderer=main` gives each map of this library that option.
On 2026-11-15 it ran the 10 pages that use custom layers, three.js, Babylon.js or deck.gl: 8 work. The page
add-custom-layers-that-follow-the-terrain draws a different image (15.7 percent) because it needs
`renderTerrainHeightMap`, which this library does not have. The page add-a-custom-layer-with-tiles-to-a-globe gives an
error because it reads `map.style.projection`, a private member of MapLibre GL JS for the globe.

## What is missing most often

| Missing | Kind | Packages | Names of the packages |
|---|---|---:|---|
| `addSourceType` | export | 1 | @maptiler/sdk |
| `AJAXError` | export | 1 | @maptiler/sdk |
| `BoxZoomHandler` | export | 1 | @maptiler/sdk |
| `CanvasSource` | export | 1 | svelte-maplibre-gl |
| `clearPrewarmedResources` | export | 1 | @maptiler/sdk |
| `CooperativeGesturesHandler` | export | 1 | @maptiler/sdk |
| `DoubleClickZoomHandler` | export | 1 | @maptiler/sdk |
| `DragPanHandler` | export | 1 | @maptiler/sdk |
| `DragRotateHandler` | export | 1 | @maptiler/sdk |
| `EdgeInsets` | export | 1 | @maptiler/sdk |
| `GeoJSONSource` | export | 1 | svelte-maplibre-gl |
| `GeolocateEvent` | export | 1 | @maptiler/sdk |
| `ImageSource` | export | 1 | svelte-maplibre-gl |
| `importScriptInWorkers` | export | 1 | @maptiler/sdk |
| `KeyboardHandler` | export | 1 | @maptiler/sdk |
| `prewarm` | export | 1 | @maptiler/sdk |
| `RasterDEMTileSource` | export | 1 | svelte-maplibre-gl |
| `RasterTileSource` | export | 1 | svelte-maplibre-gl |
| `ScrollZoomHandler` | export | 1 | @maptiler/sdk |
| `Style` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchPitchHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchRotateHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchZoomHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchZoomRotateHandler` | export | 1 | @maptiler/sdk |
| `VectorTileSource` | export | 1 | svelte-maplibre-gl |
| `VideoSource` | export | 1 | svelte-maplibre-gl |
| `Marker.setSubpixelPositioning` | method of an instance | 2 | @indoorequal/vue-maplibre-gl, svelte-maplibre-gl |
| `Popup.setPadding` | method of an instance | 2 | svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |

## What is accepted with no effect

| Method of `Map` | Packages | Names of the packages |
|---|---:|---|
| `setRenderWorldCopies` | 4 | vue-maplibre-gl, @indoorequal/vue-maplibre-gl, svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setTransformCameraUpdate` | 3 | react-map-gl, @vis.gl/react-maplibre, svelte-maplibre-gl |
| `setAnisotropicFilterPitch` | 2 | svelte-maplibre-gl, @maplibre/ngx-maplibre-gl |
| `setCenterClampedToGround` | 1 | svelte-maplibre-gl |
| `setCenterElevation` | 1 | @maplibre/ngx-maplibre-gl |
| `setRoll` | 1 | @maptiler/sdk |
| `setVerticalFieldOfView` | 1 | svelte-maplibre-gl |

## Each package

### Drawing and editing

| Package | Version | Methods in use | Exports in use | Events in use | Missing methods | Accepted, with no effect | Missing exports | Missing events | Missing methods of instances |
|---|---|---:|---:|---:|---|---|---|---|---|
| @mapbox/mapbox-gl-draw | 1.5.2 | 14 | 0 | 8 | none | none | none | none | none |
| terra-draw-maplibre-gl-adapter | 1.5.0 | 13 | 0 | 0 | none | none | none | none | none |
| @watergis/maplibre-gl-terradraw | 1.17.0 | 25 | 1 | 2 | none | none | none | none | none |
| maplibre-gl-measures | 0.0.21 | 18 | 0 | 0 | none | none | none | none | none |

### Search and directions

| Package | Version | Methods in use | Exports in use | Events in use | Missing methods | Accepted, with no effect | Missing exports | Missing events | Missing methods of instances |
|---|---|---:|---:|---:|---|---|---|---|---|
| @maplibre/maplibre-gl-geocoder | 1.9.5 | 9 | 3 | 3 | none | none | none | none | none |
| @maplibre/maplibre-gl-directions | 0.10.1 | 13 | 0 | 9 | none | none | none | none | none |

### Controls and tools

| Package | Version | Methods in use | Exports in use | Events in use | Missing methods | Accepted, with no effect | Missing exports | Missing events | Missing methods of instances |
|---|---|---:|---:|---:|---|---|---|---|---|
| @maplibre/maplibre-gl-compare | 0.5.0 | 11 | 0 | 2 | none | none | none | none | none |
| @maplibre/maplibre-gl-inspect | 1.9.0 | 7 | 1 | 6 | none | none | none | none | none |
| @watergis/maplibre-gl-export | 6.0.0 | 29 | 2 | 2 | none | none | none | none | none |
| maplibre-gl-opacity | 1.8.0 | 2 | 0 | 0 | none | none | none | none | none |
| @mapbox/mapbox-gl-sync-move | 0.4.0 | 7 | 0 | 1 | none | none | none | none | none |
| maplibre-gl-basemaps | 0.1.3 | 5 | 0 | 1 | none | none | none | none | none |
| maplibre-gl-style-flipper | 1.0.9 | 9 | 0 | 1 | none | none | none | none | none |

### Data and layers

| Package | Version | Methods in use | Exports in use | Events in use | Missing methods | Accepted, with no effect | Missing exports | Missing events | Missing methods of instances |
|---|---|---:|---:|---:|---|---|---|---|---|
| pmtiles | 4.5.0 | 2 | 0 | 0 | none | none | none | none | none |
| maplibre-contour | 0.2.0 | 0 | 1 | 0 | none | none | none | none | none |
| @deck.gl/mapbox | 9.4.2 | 18 | 0 | 12 | none | none | none | none | none |
| @maplibre/maplibre-gl-leaflet | 0.1.4 | 13 | 0 | 2 | none | none | none | none | none |
| maplibre-gl-vector-text-protocol | 0.0.5 | 1 | 0 | 0 | none | none | none | none | none |
| @americana/maplibre-shield-generator | 0.2.1 | 7 | 0 | 1 | none | none | none | none | none |

### Frameworks

| Package | Version | Methods in use | Exports in use | Events in use | Missing methods | Accepted, with no effect | Missing exports | Missing events | Missing methods of instances |
|---|---|---:|---:|---:|---|---|---|---|---|
| react-map-gl | 8.1.3 | 54 | 20 | 8 | none | `setTransformCameraUpdate` | none | none | none |
| @vis.gl/react-maplibre | 8.1.3 | 48 | 15 | 6 | none | `setTransformCameraUpdate` | none | none | none |
| vue-maplibre-gl | 5.6.1 | 40 | 6 | 17 | none | `setRenderWorldCopies` | none | none | none |
| @indoorequal/vue-maplibre-gl | 9.0.1 | 39 | 9 | 5 | none | `setRenderWorldCopies` | none | none | `Marker.setSubpixelPositioning` |
| svelte-maplibre-gl | 2.2.1 | 55 | 26 | 5 | none | `setAnisotropicFilterPitch`, `setCenterClampedToGround`, `setRenderWorldCopies`, `setTransformCameraUpdate`, `setVerticalFieldOfView` | `CanvasSource`, `GeoJSONSource`, `ImageSource`, `RasterDEMTileSource`, `RasterTileSource`, `VectorTileSource`, `VideoSource` | none | `Marker.setSubpixelPositioning`, `Popup.setPadding` |
| svelte-maplibre | 2.0.1 | 37 | 19 | 26 | none | none | none | none | none |
| @maplibre/ngx-maplibre-gl | 22.3.1 | 51 | 11 | 46 | none | `setAnisotropicFilterPitch`, `setCenterElevation`, `setRenderWorldCopies` | none | none | `Popup.setPadding` |
| @maptiler/sdk | 5.0.0 | 71 | 57 | 20 | none | `setRoll` | `AJAXError`, `BoxZoomHandler`, `CooperativeGesturesHandler`, `DoubleClickZoomHandler`, `DragPanHandler`, `DragRotateHandler`, `EdgeInsets`, `GeolocateEvent`, `KeyboardHandler`, `ScrollZoomHandler`, `Style`, `TwoFingersTouchPitchHandler`, `TwoFingersTouchRotateHandler`, `TwoFingersTouchZoomHandler`, `TwoFingersTouchZoomRotateHandler`, `addSourceType`, `clearPrewarmedResources`, `importScriptInWorkers`, `prewarm` | none | none |
