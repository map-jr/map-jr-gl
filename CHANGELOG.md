# Changelog

Each version has one entry. While the version is 0.x, a version that breaks code that worked increases the second
number, and its entry starts with a section "Breaking changes". See
[How a release is made](docs/development.md#how-a-release-is-made).

`#12` is a link to pull request 12. A change without a number comes from before 2026-11-11, when the repository had
no pull requests.

## 0.2.0 (not published yet)

This is the first entry. It covers the repository from its first commit (2026-11-10) to 2026-11-12. The package is
not on npm yet, and the repository has no tag for an earlier version.

### What the library does

- It draws a MapLibre style with WebGL2: fill, line, symbol, circle, heatmap, raster, hillshade, 3D building and
  background layers, from vector, raster, elevation, GeoJSON, image and PMTiles sources.
- It has two entries. `map-jr-gl` is the main API: `createMap` makes a map from one description (`MapSpec`),
  `update` changes it, and queries return promises. `map-jr-gl/maplibre-compat` has the `Map` class of
  MapLibre GL JS. [MapLibre compatibility](docs/maplibre-compatibility.md) lists the differences.
- The map draws in a worker when the browser can do that, and on the main thread when it cannot.
  [Browser support](docs/browser-support.md) says what each renderer needs.
- A marker layer draws markers on the canvas. `Marker` and `Popup` are also available as elements of the page.
- 3D terrain, hillshade, contour lines and elevation queries use one elevation source.
- The entry `map-jr-gl/server` renders the first view as SVG or as an image on Node.js 22 and on Cloudflare Workers.
- The adapters are `map-jr-gl/vue`, `map-jr-gl/nuxt`, `map-jr-gl/react` and `map-jr-gl/svelte`.
- The package has type declarations for each entry, a source map beside each built file, and a development build
  that warns about common mistakes ([#85], [#87], [#90], [#98]).
- The [status table](README.md#status) of the README has the test results and the sizes of the built files.

### Behaviour that changed during 0.2.0

These changes matter if you used a build of the repository from before 2026-11-12.

- Text uses the glyph files of the style, as MapLibre GL JS does. `glyphs: false` uses the fonts of the browser
  instead.
- The main API has one `queryFeatures` for all queries, and `watchFeatures` keeps an answer up to date.
- `createMap()` and `update()` throw when the description has no `style` ([#57]).
- A style or a source that fails fires `error`, and the map continues with the other sources ([#63]). The main API
  reports each error to `onError`, or to the console when the description has no `onError` ([#65]).
- `idle` fires after changed data is drawn. Directly after `setData`, the source is not loaded ([#62]).
- When two styles are requested in quick succession, the map uses the later one, also when the earlier one answers
  later ([#61]). The same is true for two `setData` calls with URLs ([#81]).
- A query is rejected when the map is removed or loses its WebGL context ([#109]).
- A camera animation that is not `essential` does not run when the system asks for less motion
  (`prefers-reduced-motion: reduce`). The container of the map has a role and shows the keyboard focus ([#71]).
- In `map-jr-gl/maplibre-compat`, an option that has no effect writes one warning, and a style call that the library
  refuses fires `error` ([#70]). `setMaxBounds` moves the centre into the bounds at once ([#93]).
- The server renderer has time limits, a size limit and a list of allowed hosts for its requests ([#96]).
- Two ways for HTML from data to reach the page are closed: the colour of a marker, and the attribution of the
  first view from a server.

### What is known not to work

- **Without WebGL2** the map fires `error` and the container stays empty. The library has no function yet that
  says whether a browser is supported ([issue 17](https://github.com/map-jr/map-jr-gl/issues/17)).
- **Not available:** globe and other projections, sky, fog, custom layers, color relief, video and canvas sources,
  MapLibre Tiles (MLT), and the properties in
  [What is not available](docs/maplibre-compatibility.md#what-is-not-available).
- **`queryRenderedFeatures` and `querySourceFeatures`** give the complete result as a promise, because the tile
  data is in a worker. Code from MapLibre GL JS needs `await`.
- **Plugins** that read `map.style` or `map.painter` do not work.
- **The server renderer** does not draw heatmap and hillshade layers.
- **Terrain, hillshade and contour lines** need `OffscreenCanvas` in a worker. No automatic run covers a browser
  without it, a real iPhone or Android. See [Browser support](docs/browser-support.md).
- **Safari 27.2 on a hosted macOS runner** loses the WebGL context of a worker, and the map with the worker
  renderer does not load there ([issue 78](https://github.com/map-jr/map-jr-gl/issues/78)). The same Safari draws
  in a worker on a Mac with a GPU.
- The package contains ES modules only. `require('map-jr-gl')` does not work.
- The [open issues](https://github.com/map-jr/map-jr-gl/issues) list the other known faults by priority.

[#57]: https://github.com/map-jr/map-jr-gl/pull/57
[#61]: https://github.com/map-jr/map-jr-gl/pull/61
[#62]: https://github.com/map-jr/map-jr-gl/pull/62
[#63]: https://github.com/map-jr/map-jr-gl/pull/63
[#65]: https://github.com/map-jr/map-jr-gl/pull/65
[#70]: https://github.com/map-jr/map-jr-gl/pull/70
[#71]: https://github.com/map-jr/map-jr-gl/pull/71
[#81]: https://github.com/map-jr/map-jr-gl/pull/81
[#85]: https://github.com/map-jr/map-jr-gl/pull/85
[#87]: https://github.com/map-jr/map-jr-gl/pull/87
[#90]: https://github.com/map-jr/map-jr-gl/pull/90
[#93]: https://github.com/map-jr/map-jr-gl/pull/93
[#96]: https://github.com/map-jr/map-jr-gl/pull/96
[#98]: https://github.com/map-jr/map-jr-gl/pull/98
[#109]: https://github.com/map-jr/map-jr-gl/pull/109
