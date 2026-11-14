# Acknowledgements

Map Jr. GL is possible because of the work of other projects. Thank you to the people who made them.

## MapLibre GL JS

[MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) is the model for this library. Its licence is
BSD-3-Clause.

- Map Jr. GL reads the MapLibre style specification and has an API that follows the API of MapLibre GL JS.
- Map Jr. GL contains no files of MapLibre GL JS. All the code is new.
- Some methods follow MapLibre GL JS, so that a map looks the same in the two libraries. Examples: the line breaks
  in labels, the light on buildings, the size of dashes, and the movement of the camera on 3D terrain.
- The tests of MapLibre GL JS and of the MapLibre style specification measure the compatibility of this library.
  The tests are not part of this repository. The test commands download them.

MapLibre GL JS started from Mapbox GL JS (version 1.13 and earlier, BSD-3-Clause, Mapbox).

## Libraries in the built files

- [earcut](https://github.com/mapbox/earcut) (ISC, Mapbox) triangulates polygons. It is the only library
  that the built files contain.

## Methods from other projects

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
