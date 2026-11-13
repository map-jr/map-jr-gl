# Changelog

Each version has one entry. While the version is 0.x, a version that breaks code that worked increases the second
number, and its entry starts with a section "Breaking changes". See
[How a release is made](docs/development.md#how-a-release-is-made).

`#12` is a link to pull request 12. A change without a number comes from before 2026-11-11, when the repository had
no pull requests.

## 0.2.0 (not published yet)

This is the first entry. It covers the repository from its first commit (2026-11-10) to 2026-11-12. The package is
not on npm yet, and the repository has no tag for an earlier version.

The name of the package is `@map-jr/map-jr-gl`
([issue 17](https://github.com/map-jr/map-jr-gl/issues/17)). Install it with `npm install @map-jr/map-jr-gl`.

### What the library does

- It draws a MapLibre style with WebGL2: fill, line, symbol, circle, heatmap, raster, hillshade, 3D building and
  background layers, from vector, raster, elevation, GeoJSON, image and PMTiles sources.
- It has two entries. `@map-jr/map-jr-gl` is the main API: `createMap` makes a map from one description (`MapSpec`),
  `update` changes it, and queries return promises. `@map-jr/map-jr-gl/maplibre-compat` has the `Map` class of
  MapLibre GL JS. [MapLibre compatibility](docs/maplibre-compatibility.md) lists the differences.
- The map draws in a worker when the browser can do that, and on the main thread when it cannot.
  [Browser support](docs/browser-support.md) says what each renderer needs.
- The field `images` of the description gives images (SVG, a URL or pixels) to the style layers by name (#120).
- A symbol layer draws icons that are always shown (no text, `icon-allow-overlap` and `icon-ignore-placement`) from
  buffers on the GPU. The cost of a frame does not grow with their number (#122).
- The adapters for Vue and React have the component `MapImage`: an image for the style layers, with the SVG
  written in the template and its parameters as the props of the slot (#128).
- An SVG image with slots (`{{name}}`) is a template. Each feature gives the slots their values, from its
  properties or from `params` of the `image` expression (#125).
- A marker layer draws markers on the canvas. `Marker` and `Popup` are also available as elements of the page.
- 3D terrain, hillshade, contour lines and elevation queries use one elevation source.
- The entry `@map-jr/map-jr-gl/server` renders the first view as SVG or as an image on Node.js 22 and on Cloudflare Workers.
- The adapters are `@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/nuxt`, `@map-jr/map-jr-gl/react` and `@map-jr/map-jr-gl/svelte`.
- The package has type declarations for each entry and a source map beside each built file ([#85], [#87], [#98]).
- The package has a development build of each entry beside the production build. In the development build, the main
  API writes one warning for each common mistake in a description or in a query, for example a container with the
  height 0 or an id in `interactiveLayers` that the style does not have. `package.json` names the development
  build under the `development` export condition, so a bundler that sets this condition uses it in development.
  The production build does not contain the checks ([#90], [#106]).
- `supported()` of both entries says whether the browser can show a map ([#116]).
- The page file and the worker file each contain the version of the package. The page writes one warning when the
  two versions differ, which can happen behind a CDN or a cache ([#116]).
- The [status table](README.md#status) of the README has the test results and the sizes of the built files.

### Behaviour that changed during 0.2.0

These changes matter if you used a build of the repository from before 2026-11-12.

- Text uses the glyph files of the style, as MapLibre GL JS does. `glyphs: false` uses the fonts of the browser
  instead.
- The main API has one `queryFeatures` for all queries, and `watchFeatures` keeps an answer up to date.
- `queryFeatures` has the same meaning in both entries ([#117]). With `sources`, it reads the tile data of those
  sources. Without `sources`, it returns the features that the style layers draw, and it does not read other data.
  Before, `map.queryFeatures` of `@map-jr/map-jr-gl/maplibre-compat` always read the tile data: add `sources` to
  such a call.
- `radius` of `queryFeatures` is the distance around the place in pixels of the screen, in both kinds of query.
  Without `sources`, the default is 0. With `sources`, the default is 3 ([#117]).
- The methods `queryLayers` and `querySources` of the map are gone. Use `queryFeatures` without `sources` in
  place of `queryLayers`, and `queryFeatures` with `sources` in place of `querySources` ([#117]).
- In TypeScript, a call of `queryFeatures` that writes `sources` gives `QueriedFeature[]`, and a call without
  `sources` gives `RenderedFeature[]` ([#117]).
- In the main API, `queryFeatures` with a place of the form `{lng, lat}` and without `sources` is rejected with a
  message that names the accepted forms ([#90]).
- `createMap()` and `update()` throw when the description has no `style` ([#57]).
- A style or a source that fails fires `error`, and the map continues with the other sources ([#63]). The main API
  reports each error to `onError`, or to the console when the description has no `onError` ([#65]).
- `idle` fires after changed data is drawn. Directly after `setData`, the source is not loaded ([#62]).
- When two styles are requested in quick succession, the map uses the later one, also when the earlier one answers
  later ([#61]). The same is true for two `setData` calls with URLs ([#81]).
- A query is rejected when the map is removed or loses its WebGL context. When a listener throws, the map fires
  `error`, and the listeners after it get the event ([#109]).
- A map with the worker renderer goes to the main thread and writes one warning when the worker loses its WebGL
  context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after its first
  start ([issue 119](https://github.com/map-jr/map-jr-gl/issues/119)) or after the map has started it again. Before, the map started a worker again without end and did not load. When the main thread
  fails in the same way after a restart, the map fires `error`
  ([issue 78](https://github.com/map-jr/map-jr-gl/issues/78), [#110]).
- A map that cannot start, for example without WebGL2, fires one `error` that says what to do, and it shows a
  message in the container (an element with the class `map-jr-unavailable`). Before, the container stayed empty
  ([#116]).
- `getVersion()` of `@map-jr/map-jr-gl/maplibre-compat` returns the version of the package ([#116]).
- The `queryFeatures` example of the gallery gives an answer for each click, and its forms for the main API pass
  `sources` ([#115]).
- A camera animation that is not `essential` does not run when the system asks for less motion
  (`prefers-reduced-motion: reduce`). The container of the map has a role and shows the keyboard focus ([#71]).
- In `@map-jr/map-jr-gl/maplibre-compat`, an option that has no effect writes one warning, and a style call that the library
  refuses fires `error` ([#70]). `setMaxBounds` moves the centre into the bounds at once ([#93]).
- The server renderer has time limits, a size limit and a list of allowed hosts for its requests ([#96]).
- Two ways for HTML from data to reach the page are closed: the colour of a marker, and the attribution of the
  first view from a server.

### What is known not to work

- **Without WebGL2** no map can be shown. `supported()` of both entries says so before a map is made. A map that is
  made anyway fires one `error` and shows a message in the container.
- **Not available:** globe and other projections, sky, fog, custom layers, color relief, video and canvas sources,
  MapLibre Tiles (MLT), and the properties in
  [What is not available](docs/maplibre-compatibility.md#what-is-not-available).
- **`queryRenderedFeatures` and `querySourceFeatures`** give the complete result as a promise, because the tile
  data is in a worker. Code from MapLibre GL JS needs `await`.
- **Plugins** that read `map.style` or `map.painter` do not work.
- **The server renderer** does not draw heatmap and hillshade layers.
- **Terrain, hillshade and contour lines** need `OffscreenCanvas` in a worker. No automatic run covers a browser
  without it, a real iPhone or Android. See [Browser support](docs/browser-support.md).
- **Safari 27.2 on a hosted macOS runner** cannot use the worker renderer: a worker draws one frame and then
  stops, and its WebGL context is lost. Since [#110] the map goes to the main thread there and loads (seen in one
  run of the Safari job). The cause is not known. A worker that stops with no lost context at the first start is
  not detected. The same Safari draws in a worker on a Mac with a GPU.
- The package contains ES modules only. `require('@map-jr/map-jr-gl')` does not work.
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
[#106]: https://github.com/map-jr/map-jr-gl/pull/106
[#109]: https://github.com/map-jr/map-jr-gl/pull/109
[#110]: https://github.com/map-jr/map-jr-gl/pull/110
[#115]: https://github.com/map-jr/map-jr-gl/pull/115
[#116]: https://github.com/map-jr/map-jr-gl/pull/116
[#117]: https://github.com/map-jr/map-jr-gl/pull/117
