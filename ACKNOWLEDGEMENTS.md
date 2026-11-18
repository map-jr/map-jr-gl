# Acknowledgements

Map Jr. GL is possible because of the work of other projects. Thank you to the people who made them.

## MapLibre GL JS

[MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) is the model for this library. Its licence is
BSD-3-Clause.

- Map Jr. GL reads the MapLibre style specification and has an API that follows the API of MapLibre GL JS.
- Map Jr. GL contains no files of MapLibre GL JS. All the code is new, except the CSS named below.
- `update()` of the main API changes the layers of a new style object in place where only their `paint`, `layout` and
  `filter` differ, and moves the layers of `layers` to a new order without a new style. This follows the method of `diff` in the MapLibre style specification (BSD-3-Clause). The code is new.
- At a high pitch, the line of the horizon (`getMercatorHorizon`) and the cutoff of labels far from the camera
  (`perspectiveRatioCutoff`) follow MapLibre GL JS (BSD-3-Clause). The code is new.
- The sky and the fog of the root property `sky` follow the formulas of MapLibre GL JS (BSD-3-Clause; the shaders `sky` and `terrain` and `fog` in `shaders/_prelude_fog`). The code in `src/gl.ts` is new. The atmosphere on the globe is a close translation of `atmosphere.fragment.glsl` of MapLibre GL JS (BSD-3-Clause), changed, and follows its `drawAtmosphere`, `getSunPos` and `getAtmosphereAltitudeBlend`; the notice is in `THIRD-PARTY-LICENSES.md`.
- glsl-atmosphere (github.com/wwwtyro/glsl-atmosphere, Unlicense): the atmosphere shader of MapLibre GL JS, which the shader of the atmosphere on the globe copies, follows its scattering method.
- Some methods follow MapLibre GL JS, so that a map looks the same in the two libraries. Examples: the line breaks
  in labels, the light on buildings, the size of dashes, the size of circles on a map with pitch, and the movement of the camera
  on 3D terrain.
- The layer type `color-relief` follows the method of MapLibre GL JS (BSD-3-Clause; `color_relief_style_layer.ts` and
  the shader `color_relief`): the stops of the `interpolate` expression go to the GPU, and the shader searches the two
  stops around an elevation and mixes their colours. The code in `src/style.ts` and `src/gl.ts` is new.
- The methods of `hillshade-method` (`basic`, `combined`, `igor`, `multidirectional`) and
  `hillshade-illumination-altitude` follow the formulas of MapLibre GL JS (BSD-3-Clause; the shader `hillshade` and
  `hillshade_style_layer.ts`), which says that it bases them on `gdaldem` of GDAL (MIT). The code in `src/style.ts`
  and `src/gl.ts` is new.
- The tile URL tokens `{prefix}` and `{ratio}` follow the rules of `CanonicalTileID.url` in `src/source/tile_id.ts`
  of MapLibre GL JS (BSD-3-Clause). The code in `src/resolve.ts` is new.
- New data of a GeoJSON source follows the method of `GeoJSONSource` in `src/source/geojson_source.ts` of MapLibre
  GL JS (BSD-3-Clause): one update of each source is on its way to the workers at a time, and a newer one replaces the
  update that waits. The code in `src/map.ts`, `src/engine.ts` and `src/tiles.ts` is new.
- The texts and the CSS of the hint of `cooperativeGestures` in the compat entry follow MapLibre GL JS
  (BSD-3-Clause): `src/ui/handler/cooperative_gestures.ts` and `maplibre-gl.css`.
- The option `locale` of the compat entry reads the keys of `src/ui/default_locale.ts` of MapLibre GL JS 6.17.0
  (BSD-3-Clause), so that a `locale` object for MapLibre GL JS works unchanged. The English texts are not copied.
- The rotate drag on the map (the right mouse button, or Ctrl with the left one) follows the method of
  `generateMouseRotationHandler` in `src/ui/handler/mouse.ts` of MapLibre GL JS (BSD-3-Clause). The code in
  `src/map.ts` is new.
- A map at rest places labels in the next frame after a tile arrives and shows the labels of a newly loaded tile
  without a fade. This follows the method of `skipFade` in the placement of MapLibre GL JS (BSD-3-Clause); the code
  is new.
- The development build of the compat entry contains the names of the public members of the classes of MapLibre GL
  JS (BSD-3-Clause). `build.mjs` reads them from its type declarations (`dist/maplibre-gl.d.ts`), so that reading a
  member that this library does not have can warn. No code is copied.
- The "pseudo fullscreen" of `FullscreenControl` follows MapLibre GL JS 6.17.0 (`src/ui/control/fullscreen_control.ts`).
  The code is new. The rule for `.map-jr-pseudo-fullscreen` copies the CSS of `.maplibregl-pseudo-fullscreen` in
  `maplibre-gl.css`.
- The curve of `flyTo` (and of `moveTo` with `fly` in the main API) follows `flyTo` of MapLibre GL JS 6.17
  (`src/ui/camera.ts`), which implements the method of van Wijk and Nuij, "Smooth and efficient zooming and panning"
  (2003), with the same options and defaults.
- `fitScreenCoordinates` of the compat entry follows the method of `_cameraForBoxAndBearing` of MapLibre GL JS 6.17
  (`src/ui/camera.ts`, BSD-3-Clause) for the zoom and the centre of a box at a bearing. The code is new.
- The check for a canvas that adds noise to `getImageData` (`src/exact-pixels.ts`) follows `isOffscreenCanvasDistorted`
  of MapLibre GL JS 6.17.0 (`src/util/offscreen_canvas_distorted.ts`, BSD-3-Clause), and so does reading elevation
  tiles through WebGL when the canvas is distorted. The code is new.
- Custom layers of the compat entry (`src/custom-layers.ts`) follow `drawCustom`, `getProjectionDataForCustomLayer`
  and `setCustomLayerDefaults` of MapLibre GL JS 6.17.0 (`src/webgl/draw/draw_custom.ts`,
  `src/geo/projection/mercator_transform.ts`, `src/webgl/context.ts`, BSD-3-Clause): the values that `render` gets,
  the GL state before the code of the layer, and the names of the functions of the shader prelude for the Mercator
  projection. `MercatorCoordinate` follows `src/geo/mercator_coordinate.ts` and uses the same radius of the earth.
  The code is new.
- The cut of fills and lines for the globe (`src/subdivide.ts`) follows the subdivision of MapLibre GL JS 6.17
  (`src/render/subdivision.ts`, BSD-3-Clause): the triangles of a polygon are clipped to the cells of a grid and share
  their vertices, and a tile at the north or south edge of the world gets triangles to the pole, with the y values
  -32768 and 32767 for the pole vertices. The code is new, and the size of the grid is not that of MapLibre.
- The globe (`src/globe.ts` and the `GLOBE` variant of the programs in `src/gl.ts`) follows the globe of MapLibre GL JS
  6.17 (`src/geo/projection/vertical_perspective_transform.ts`, `globe_utils.ts`, `_projection_globe.vertex.glsl`,
  BSD-3-Clause): the radius that keeps the scale of Mercator at the centre, the matrix from the unit sphere to clip
  space, the plane of the horizon as clip-space z, the mix with Mercator between zoom 11 and 12, the formula with
  `exp` for the sphere, the width of lines toward the poles, and the change of zoom with the latitude during a drag.
  A drag on the globe (`drag` in `src/globe.ts`) follows `versorSetLocationAtPoint` and `panSurfaceLocation` in
  `globe_utils.ts`: the rotation from the last pointer to the new one, the eased curve near the edge of the globe, and
  the dial near a pole. The fling follows `computeGlobePanCenter` in the same file, and the latitude that the centre
  can reach follows `_getMaxLatitude` in `vertical_perspective_transform.ts`. The size of the globe during `jumpTo`, `easeTo` and `flyTo` follows `getZoomAdjustment` and `VerticalPerspectiveCameraHelper` (`vertical_perspective_camera_helper.ts`): the zoom of the same size at the equator, the length of a flight on the great circle, and the way of the centre (`interpolateLngLatForGlobe`). The code is new.
- The tests of MapLibre GL JS and of the MapLibre style specification measure the compatibility of this library.
  The tests are not part of this repository. The test commands download them. `test/conformance/render.mjs` applies
  the operations of a render test in the order and with the arguments of `applyOperations` in
  `test/integration/render/render.test.ts` of MapLibre GL JS (BSD-3-Clause). The code is new, and it is not part of
  the built files.

MapLibre GL JS started from Mapbox GL JS (version 1.13 and earlier, BSD-3-Clause, Mapbox).

## Libraries in the built files

- [earcut](https://github.com/mapbox/earcut) (ISC, Mapbox) triangulates polygons. It is the only library
  that the built files contain.
- [Material Symbols](https://github.com/google/material-design-icons) (Apache-2.0, Google): the button of the
  compact attribution of the main API draws the icon "info i" (rounded). Its path is copied unchanged, in the form
  on a grid of 24 by 24 units. The licence text is in `THIRD-PARTY-LICENSES.md`.

## Methods from other projects

- The compass of the main API takes the idea of the compass of Apple Maps (maps.apple.com): a dial with ticks, a
  mark of north on the rim and the letter of the direction in the centre. The drawing is new and copies no file or
  code of Apple.

- [supercluster](https://github.com/mapbox/supercluster) (ISC, Mapbox): the method that makes clusters of points.
  The code in this library is new.
- [@mapbox/point-geometry](https://github.com/mapbox/point-geometry) (ISC, Mapbox): the `Point` class of the
  compat entry has the names and results of some of its methods. The code in this library is new.
- [maplibre-contour](https://github.com/onthegomap/maplibre-contour) (BSD-3-Clause): the form of the `thresholds`
  option of a contour source is the same as in this plugin. The code in this library is new.

## Tools and data for development, tests and the gallery

These are not part of the built library.

- [Vite](https://vite.dev/), [esbuild](https://esbuild.github.io/), [TypeScript](https://www.typescriptlang.org/)
  and [Playwright](https://playwright.dev/): build and tests.
- [Takumi](https://github.com/kane50613/takumi): images from the server renderer.
- [OpenFreeMap](https://openfreemap.org/), [OpenMapTiles](https://openmaptiles.org/) and
  [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors: the styles and map data of the examples.
- [Mapterhorn](https://mapterhorn.com/): the elevation tiles of the examples.

## How this project is made

An AI coding assistant (Claude Code) wrote almost all the code, the tests and the documents of this project. A
person gave the directions, reviewed the results on real devices and made the decisions. Some people call this
"vibe coding". We say this so that you can decide how much to trust the code.

- The automatic tests and the comparison with the tests of MapLibre GL JS are the primary checks of the code.
- Nobody reviewed every line of the code.
- Review the code and run your own tests before you use the library for important work.

The full licence texts of the other projects are in `THIRD-PARTY-LICENSES.md`.
