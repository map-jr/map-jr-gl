# Plugins and frameworks

This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and
framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl`, the map events and the methods
of controls, `Marker` and `Popup` that each package uses, and compares them with the entry
`@map-jr/map-jr-gl/maplibre-compat` of this library.

A method of a control, `Marker` or `Popup` is found when the package keeps the new instance in a name and calls the
method on that name in the same file (for example `const gc = new maplibregl.GeolocateControl(); gc.on(...)`).

The script reads the code as text. It does not run the packages. So a package with "none" in each column can still
have a problem, and a method in the list is possibly used only in a part of the package that you do not use.

**26 of 27 packages** use only parts of the API that this library has.

A missing method throws a `TypeError` when the package calls it. A method that is "accepted, with no effect" exists and
does nothing, so the package goes on, and it does not count as missing. Most of these methods warn once when they get a
value that the library cannot do (see "Accepted, with no effect" in `docs/reference/maplibre-differences.md`).

react-map-gl 7 does not work with this library, and the tables below read version 8 only. Version 7 reads the private
`map.transform` of MapLibre GL JS and throws a `TypeError`. Version 8 works (the field test of #187).

<!-- plugins:start -->
## Plugins that were run

These plugins were run with this library in a browser by `node test/conformance/plugins.mjs --write`. Each one has a
short scenario in `test/conformance/plugins/`. The plugin imports `maplibre-gl` and gets this library.

**16 of 17 scenarios pass.**

| Scenario | Plugin | Result |
|---:|---|---|
| 1 | @mapbox/mapbox-gl-draw 1.5.2 | Pass |
| 2 | terra-draw 1.40.0, terra-draw-maplibre-gl-adapter 1.5.0 | Pass |
| 3 | @maplibre/maplibre-gl-compare 0.5.0 | Pass |
| 4 | @mapbox/mapbox-gl-sync-move 0.4.0 | Pass |
| 5 | pmtiles 4.5.0 | Pass |
| 6 | maplibre-gl-opacity 1.8.0 | Pass |
| 7 | @maplibre/maplibre-gl-inspect 1.9.0 | Pass |
| 8 | @watergis/maplibre-gl-export 6.0.0 | Pass |
| 9 | @vis.gl/react-maplibre 8.1.3, react 19.3.1, react-dom 19.3.1 | Pass |
| 10 | @vis.gl/react-maplibre 8.1.3, react 19.3.1, react-dom 19.3.1 | Fail |
| 11 | @indoorequal/vue-maplibre-gl 9.0.1, vue 3.5.46 | Pass |
| 12 | @deck.gl/mapbox 9.4.2, @deck.gl/layers 9.4.2, @deck.gl/core 9.4.2 | Pass |
| 13 | @maplibre/maplibre-gl-geocoder 1.9.5 | Pass |
| 14 | @maplibre/maplibre-gl-directions 0.10.1 | Pass |
| 15 | @mapbox/mapbox-gl-language 1.0.1 | Pass |
| 16 | @geoman-io/maplibre-geoman-free 0.10.10 | Pass |
| 17 | svelte-maplibre-gl 2.2.1, svelte 5.59.2, esbuild-svelte 0.9.5 | Pass |

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
10. default renderer: drag followed by the state: true; state change from outside: true; onMove that limits the latitude: true (after the drag: map 40.72000, limit 40.72000; during the drag the map went 0.01685° past the limit); warnings about setTransformCameraUpdate: 0 before the limit, 0 after it. renderer 'main': drag followed by the state: true; state change from outside: true; onMove that limits the latitude: true (after the drag: map 40.72000, limit 40.72000; during the drag the map went 0.00000° past the limit); warnings about setTransformCameraUpdate: 0 before the limit, 0 after it Errors: Error: Minified React error #185; visit https://react.dev/errors/185 for the full message or use the non-minified dev environment for full errors and additional
11. events: load; layer from <MglCircleLayer>: true; marker: true; control: true
12. deck.gl canvas: true; frames drawn: 3 then 4; the point at the map center was picked there: true
13. the control is in the page: true; result: Eiffel Tower; the map went to the place: true; marker: true
14. routes: 1; layers of the plugin: 11; features under the first waypoint, read at once: 7; waypoints added by a click on the map: 1
15. the plugin changes the text fields: true; the map has the changed fields: true; in 5 s, style.load fired 2 times and setStyle was called 3 times
16. features after the import: 1; after a marker was drawn with a click: 2; layers of the plugin: 33
17. load: true; layer from <CircleLayer>: true; marker: true; control: true; the fragment has the camera from <Hash>: true (#12/40.7085/-74.0065)
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
| [liberty](https://tiles.openfreemap.org/styles/liberty) | 0.9 | 0.7 | 0.3 | 1.4 | 0.3 | 0.8 |
| [bright](https://tiles.openfreemap.org/styles/bright) | 0.9 | 0.7 | 0.3 | 1.3 | 0.2 | 1.1 |
| [positron](https://tiles.openfreemap.org/styles/positron) | 0.9 | 0.7 | 0.3 | 0.3 | 0.1 | 0.5 |
| [versatiles](https://tiles.versatiles.org/assets/styles/colorful/style.json) | 0 | 0 | 0.2 | 0.7 | 0 | 0.6 |
| [demotiles](https://demotiles.maplibre.org/style.json) | 0 | 0 | 0 | 0 | 0 | 0 |
| [voyager](https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json) | 0 | 0 | 0.1 | 0.4 | 0 | 0.5 |
| [darkmatter](https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json) | 0 | 0 | 0.1 | 0.3 | 0 | 0.3 |
| [dark](https://tiles.openfreemap.org/styles/dark) | 0.3 | 0.2 | 0.1 | 0.1 | 0 | 0.1 |
| [shortbread](https://vector.openstreetmap.org/styles/shortbread/colorful.json) | 0 | 0.3 | 0.2 | 0.3 | 0 | 0.8 |

The views: world (zoom 1.6), country (zoom 5.3), city (zoom 11.2), streets (zoom 14.6), close (zoom 17.4), tilted (zoom 15.7, tilted).
<!-- styles:end -->

<!-- examples:start -->
## The example pages of MapLibre GL JS

The documentation of MapLibre GL JS has an example page for each common task. `node test/conformance/examples.mjs --write`
runs each page two times: with MapLibre GL JS, and with this library in its place (the page itself is not changed).
A page works when this library gives no error that MapLibre GL JS does not give, and at most 12 percent of the
pixels of the two images differ clearly (labels and controls are drawn in different ways).

**125 of 142 pages work.**

| Result | Pages | Share |
|---|---:|---:|
| Works | 125 | 88.0% |
| Gives an error | 5 | 3.5% |
| Draws a different image | 12 | 8.5% |
| Not compared | 0 | 0.0% |

The pages that do not work:

| Example page | Result | Pixels that differ, % |
|---|---|---:|
| 3d-terrain | differs | 22.9 |
| add-3d-terrain-from-quantized-mesh-tiles | differs | 20.1 |
| add-a-raster-tile-source | differs | 61.8 |
| add-custom-layers-that-follow-the-terrain | differs | 14.2 |
| animate-an-icon-on-the-gpu | error | 0.5 |
| create-a-heatmap-layer-on-a-globe-with-terrain-elevation | differs | 12.4 |
| display-a-map-in-a-polar-stereographic-projection | error | 87.3 |
| display-a-map-in-utm-zone-32n | error | 69.5 |
| display-a-map-with-mlt | error | 11.1 |
| display-geojson-in-a-polar-stereographic-projection | error | 86.9 |
| draw-a-circle | differs | 50.4 |
| elevate-symbols-above-the-terrain | differs | 57.9 |
| enter-a-360-photosphere | differs | 64.9 |
| extrude-polygons-for-3d-indoor-mapping | differs | 44.8 |
| navigate-the-map-with-game-like-controls | differs | 36.3 |
| set-center-point-above-ground | differs | 18.6 |
| sky-fog-terrain | differs | 18.2 |

The first error that this library gives on each of these pages:

- animate-an-icon-on-the-gpu: [map-jr-gl] E464 https://map-jr.org/e/464 image="rainbow-triangle"
- display-a-map-in-a-polar-stereographic-projection: maplibregl.addProjection is not a function
- display-a-map-in-utm-zone-32n: maplibregl.addProjection is not a function
- display-a-map-with-mlt: Error: [map-jr-gl] E2106 https://map-jr.org/e/2106 source="maplibre" Unsupported protobuf wire type 6
- display-geojson-in-a-polar-stereographic-projection: maplibregl.importScriptInWorkers is not a function
<!-- examples:end -->

Most of the pages that do not work need a globe, another projection or a custom 3D layer.

A map that draws in a worker moves to the main thread at its first custom layer (#1987), so the example pages with a
custom layer need no option. On 2026-11-26 the 10 pages that use custom layers, three.js, Babylon.js or deck.gl were
run without `renderer: 'main'`: 8 work and none gives an error. The page add-custom-layers-that-follow-the-terrain
draws a different image (14.2 percent) because it needs `renderTerrainHeightMap`, which this library does not have.
The page enter-a-360-photosphere draws a different image (64.9 percent), and its cause is not examined.

In the run of 2026-11-26 the image of this library for add-a-raster-tile-source (61.8 percent) shows the tile
"Access blocked" (HTTP 403) of tile.openstreetmap.org, while MapLibre GL JS drew the map. The difference of that page
comes from the tile server, and the cause of the refusal is not examined. The other pages that are new in the list of
different images in that run (3d-terrain, draw-a-circle and four more) were not examined.

## What is missing most often

| Missing | Kind | Packages | Names of the packages |
|---|---|---:|---|
| `addSourceType` | export | 1 | @maptiler/sdk |
| `BoxZoomHandler` | export | 1 | @maptiler/sdk |
| `CooperativeGesturesHandler` | export | 1 | @maptiler/sdk |
| `DoubleClickZoomHandler` | export | 1 | @maptiler/sdk |
| `DragPanHandler` | export | 1 | @maptiler/sdk |
| `DragRotateHandler` | export | 1 | @maptiler/sdk |
| `importScriptInWorkers` | export | 1 | @maptiler/sdk |
| `KeyboardHandler` | export | 1 | @maptiler/sdk |
| `ScrollZoomHandler` | export | 1 | @maptiler/sdk |
| `Style` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchPitchHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchRotateHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchZoomHandler` | export | 1 | @maptiler/sdk |
| `TwoFingersTouchZoomRotateHandler` | export | 1 | @maptiler/sdk |

## What is accepted with no effect

| Method of `Map` | Packages | Names of the packages |
|---|---:|---|
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
| react-map-gl | 8.1.3 | 54 | 20 | 8 | none | none | none | none | none |
| @vis.gl/react-maplibre | 8.1.3 | 48 | 15 | 6 | none | none | none | none | none |
| vue-maplibre-gl | 5.6.1 | 40 | 6 | 17 | none | none | none | none | none |
| @indoorequal/vue-maplibre-gl | 9.0.1 | 39 | 9 | 5 | none | none | none | none | none |
| svelte-maplibre-gl | 2.2.1 | 55 | 26 | 5 | none | `setCenterClampedToGround`, `setVerticalFieldOfView` | none | none | none |
| svelte-maplibre | 2.0.1 | 37 | 19 | 26 | none | none | none | none | none |
| @maplibre/ngx-maplibre-gl | 22.3.1 | 51 | 11 | 46 | none | `setCenterElevation` | none | none | none |
| @maptiler/sdk | 5.0.0 | 71 | 57 | 20 | none | `setRoll` | `BoxZoomHandler`, `CooperativeGesturesHandler`, `DoubleClickZoomHandler`, `DragPanHandler`, `DragRotateHandler`, `KeyboardHandler`, `ScrollZoomHandler`, `Style`, `TwoFingersTouchPitchHandler`, `TwoFingersTouchRotateHandler`, `TwoFingersTouchZoomHandler`, `TwoFingersTouchZoomRotateHandler`, `addSourceType`, `importScriptInWorkers` | none | none |
