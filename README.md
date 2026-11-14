# Map Jr. GL

A small, fast map library for the web. It reads MapLibre styles. It has two entries:

- `@map-jr/map-jr-gl`: a map from one description, with state that your code can watch. The adapters for frameworks
  (`@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/react`) use this entry.
- `@map-jr/map-jr-gl/maplibre-compat`: an API that is almost the same as MapLibre GL JS, for code and plugins that were
  written for that library.

![A 3D terrain map with relief shading and contour lines](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/terrain.jpg)

**[Open the live gallery](https://map-jr.github.io/map-jr-gl/)** to see each feature with the code that makes it.

Which entry to use:

| You have | Use | Why |
|---|---|---|
| A new application, or an application with Vue, Nuxt, React or Svelte | `@map-jr/map-jr-gl` and its adapters | New features go to this entry first. |
| Code or plugins that were written for MapLibre GL JS | `@map-jr/map-jr-gl/maplibre-compat` | The code keeps its calls (`new Map`, `map.on`, `map.addLayer`). |

The two entries have different methods. Each example below names its entry. The comparisons with MapLibre GL JS in
[Status](#status) (render tests, example pages, plugins) test `@map-jr/map-jr-gl/maplibre-compat`. The entry `@map-jr/map-jr-gl`
uses the same renderer and has its own tests in a browser.

## Why use this library

- **It is small.** A page with a map transfers about 90 KB of script (gzip): about 29 KB for the page script of
  `@map-jr/map-jr-gl` and about 61 KB for the worker file. MapLibre GL JS 6.17 transfers about 444 KB (page script, worker
  and CSS). The smaller size does not include a globe and other projections, sky, fog, custom layers and the other
  items in [What is not available](docs/maplibre-compatibility.md#what-is-not-available).
- **It does not block your page.** The map draws in a worker. Your page stays responsive while the map moves.
- **It draws many markers.** A marker layer draws 100,000 SVG markers at 60 frames per second. A marker layer is a
  symbol layer of the style with an SVG template as its image.
- **It draws on the server.** You can render the first view of a map as SVG or as an image, without a browser.
  This works on Node.js and on Cloudflare Workers.
- **It includes elevation tools.** 3D terrain, relief shading, contour lines and elevation queries use one
  elevation source. You do not need a plugin.
- **It answers questions about the data.** `queryFeatures` with `sources` reads the tile data directly. You do not
  need a style layer.
- **Fonts as the style gives them, or none to download.** Text uses the glyph files of the style, as MapLibre GL JS does. With `glyphs: false`, text uses the fonts of the browser: no requests for fonts.
- **It is easy to change to.** Most MapLibre GL JS code works after you change the import to
  `@map-jr/map-jr-gl/maplibre-compat`.
- **It works with MapLibre plugins.** mapbox-gl-draw, terra-draw, the compare and sync-move plugins and others run
  without changes. See [Plugins and frameworks](docs/ecosystem.md).

## Status

<!-- status:start -->
These figures are written by `pnpm status`. They compare this library with MapLibre GL JS 6.17.0.

| Measure | Result |
|---|---|
| Unit tests | 58 pass, 0 fail |
| MapLibre expression tests | 330 of 425 pass |
| MapLibre `Map` methods | 118 of 150 are available; 12 more are accepted and have no effect |
| MapLibre plugins, run in a browser | 15 of 15 work (see [Plugins and frameworks](docs/ecosystem.md)) |
| Plugins and frameworks, read from npm | 17 of 26 use only API that the library has |
| Example pages of the MapLibre documentation, with this library in place of MapLibre | 110 of 142 work. Most of the others need a globe, another projection or a custom 3D layer. |
| MapLibre render tests | 819 of 1429 are the same (1% of pixels or less are different). 280 more are near (5% or less). |
| Page script (gzip) | 32 KB. MapLibre GL JS: 299 KB. |
| Worker script (gzip) | 62 KB. MapLibre GL JS: 145 KB. |
| Server renderer (gzip) | 38 KB |
<!-- status:end -->

The library is new. Read [MapLibre compatibility](docs/maplibre-compatibility.md) before you use it in production.

## Install

The package is `@map-jr/map-jr-gl` on npm ([npmjs.com/package/@map-jr/map-jr-gl](https://www.npmjs.com/package/@map-jr/map-jr-gl)).
Install it with your package manager:

```bash
npm install @map-jr/map-jr-gl
```

Then import from `@map-jr/map-jr-gl`, or from `@map-jr/map-jr-gl/maplibre-compat` for the API of MapLibre GL JS.

Until then, build the package from this repository:

```bash
git clone https://github.com/map-jr/map-jr-gl.git
```

```bash
cd map-jr-gl
```

```bash
pnpm install
```

```bash
pnpm build
```

The build writes the library to the `dist` folder. Then use one of these methods:

- **With a bundler (Vite, webpack, Rollup, Parcel):** add the folder to your project as a dependency
  (`pnpm add ../map-jr-gl`). Then import from `@map-jr/map-jr-gl`.
- **Without a bundler:** copy the `dist` folder to your web server. Then import `dist/map-jr-gl.js` in a module
  script (or `dist/map-jr-gl-maplibre-compat.js` for the API of MapLibre GL JS).

The package contains ES modules only (`"type": "module"`). It has no CommonJS build, so `require('@map-jr/map-jr-gl')` does
not work: use `import`. The tests of the server renderer (`@map-jr/map-jr-gl/server`) run with Node.js 22, and `engines` in
`package.json` asks for Node.js 22 or later. The module for Nuxt (`@map-jr/map-jr-gl/nuxt`) imports `@nuxt/kit`, which a Nuxt
application has already. `package.json` names it as an optional peer dependency (version 3 or 4).

A browser must have WebGL2. [Browser support](docs/browser-support.md) says what each renderer needs and in which
browsers the library was run.

Each built file has a source map beside it (`dist/<file>.js.map`), so that an error tracker can show the lines of the
source for a stack trace.

## Use

### Show a map

This example uses the entry `@map-jr/map-jr-gl`.

```html
<div id="map" style="height: 400px"></div>
<script type="module">
  import {createMap} from '@map-jr/map-jr-gl';

  const map = createMap(document.getElementById('map'), {
    style: 'https://tiles.openfreemap.org/styles/liberty',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });

  // The state of the map is a store. This function runs when the view changes.
  map.state.subscribe(state => state.view, view => console.log(view.zoom));
</script>
```

To change the map, call `map.update` with the complete description again. The library finds what is different.
You do not need a CSS file. See [The main API](docs/api.md).

![A street map with zoom, compass and scale controls](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/basic.jpg)

### Use Vue or Nuxt

```vue
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://tiles.openfreemap.org/styles/liberty" v-model:view="view" ssr />
  </div>
</template>
```

With the `ssr` prop, a server (Nuxt) renders the first view as SVG into the page. The map takes over in the
browser. See [Vue and Nuxt](docs/vue.md).

### Change from MapLibre GL JS

The entry `@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS: `new Map({...})`, `map.on(...)`,
`map.addLayer(...)`, controls, `Marker` and `Popup`.

1. Change the name of the module in each import:

   ```js
   // import {Map, Marker, Popup} from 'maplibre-gl';
   import {Map, Marker, Popup} from '@map-jr/map-jr-gl/maplibre-compat';
   ```

   If your code uses one object for the library (`maplibregl.Map`), import all the names into that object:

   ```js
   import * as maplibregl from '@map-jr/map-jr-gl/maplibre-compat';
   ```

2. Remove the other imports from `maplibre-gl/...`: the CSS file (`maplibre-gl/dist/maplibre-gl.css`) and the
   worker file (`maplibre-gl/dist/maplibre-gl-worker...`). Remove each call of `setWorkerUrl(...)` and the
   `workerUrl` prop of react-map-gl. The library finds its own worker file.
3. Add `await` where your code calls `queryRenderedFeatures` or `querySourceFeatures`. The tile data is in a worker,
   so the complete result is a promise.
4. Start your application and read the browser console. The library writes a warning for each style layer or
   property that it cannot draw.
5. Read [MapLibre compatibility](docs/maplibre-compatibility.md) for the differences.

A plugin or a wrapper (react-map-gl, for example) that was written for MapLibre GL JS imports `maplibre-gl` itself.
Map that name to this library in your bundler or in an import map. The alias must match the name `maplibre-gl`
exactly: an alias that also matches `maplibre-gl/dist/...` makes the bundler look for those files in this package,
and the build stops. In Vite:

```js
// vite.config.js
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {
    alias: [{find: /^maplibre-gl$/, replacement: '@map-jr/map-jr-gl/maplibre-compat'}],
  },
});
```

With Vite 5 in development, also add `optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']}`, or the map
draws on the main thread; Vite 8 does not need it (see [Vite in development](docs/loading.md#vite-in-development)).
For Next.js (webpack and Turbopack), see [Next.js](docs/loading.md#nextjs). In an import map:

```html
<script type="importmap">{"imports": {"maplibre-gl": "/node_modules/@map-jr/map-jr-gl/dist/map-jr-gl-maplibre-compat.js"}}</script>
```

The library has a default export for such plugins only, because some of them contain
`import maplibregl from 'maplibre-gl'`. [Ecosystem](docs/ecosystem.md) lists the plugins that are tested.

- **react-map-gl.** Version 8 (`react-map-gl/maplibre` or `@vis.gl/react-maplibre`) works through the alias.
  Version 7 does not: it reads the private `map.transform` of MapLibre GL JS and throws a `TypeError`, through the
  alias and through its `mapLib` prop. Upgrade to version 8 first.
- **Types.** The alias does not change the types that TypeScript reads. A project that uses react-map-gl keeps
  `maplibre-gl` installed and keeps its `import type … from 'maplibre-gl'`, because react-map-gl's types refer to
  that package. The types of the compat entry reject some common MapLibre code (#208), so a change of the type
  imports can give errors that stop `next build` or `tsc`.

### Add markers

A marker layer draws many markers on the map canvas. It draws an image at each position, and the image can be an SVG
template that each marker fills with its values.

With `@map-jr/map-jr-gl`, an image is an entry of `images` in the description, and a marker layer is an entry of
`markers`:

```js
import {createMap} from '@map-jr/map-jr-gl';

const places = {
  id: 'places',
  image: 'disc',
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
    {lngLat: [-73.9857, 40.7484], props: {color: '#2f7fd1', name: 'Empire State Building'}},
  ],
};

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>'},
  markers: [places],
  // A marker is a feature of its layer: a click has it in `features`.
  interactiveLayers: ['places'],
  onClick: event => console.log(event.features[0]?.properties.name),
});
```

A marker layer is shorthand for a GeoJSON source and a symbol layer of the style. With
`@map-jr/map-jr-gl/maplibre-compat`, write those yourself, as with MapLibre GL JS (`map.addImage`, `map.addSource`,
`map.addLayer`). [Markers](docs/markers.md) has the code.

For a small number of markers with HTML content, use `map.overlay` (`@map-jr/map-jr-gl`) or `Marker` and `Popup`
(`@map-jr/map-jr-gl/maplibre-compat`, the same API as MapLibre GL JS). See [Markers](docs/markers.md).

![Fifty thousand markers on a map](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/markers.jpg)

### Show terrain, relief and contour lines

With `@map-jr/map-jr-gl`, the elevation source, the layers and the terrain are additions to the style (`extend`):

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
  extend: {
    sources: {
      dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
      contours: {type: 'contour', source: 'dem', thresholds: {11: [100, 500], 12: [50, 200], 14: [20, 100]}},
    },
    layers: [
      {id: 'relief', type: 'hillshade', source: 'dem'},
      {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours'},
    ],
    terrain: {source: 'dem', exaggeration: 1.5},
  },
});

const metres = await map.queryElevation([7.6586, 45.9763]);
```

With `@map-jr/map-jr-gl/maplibre-compat`, where `map` is a `Map` whose style has loaded:

```js
map.addSource('dem', {
  type: 'raster-dem',
  tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
  encoding: 'terrarium',
  tileSize: 512,
  maxzoom: 12,
});

map.addLayer({id: 'relief', type: 'hillshade', source: 'dem'});
map.setTerrain({source: 'dem', exaggeration: 1.5});

map.addSource('contours', {
  type: 'contour',
  source: 'dem',
  thresholds: {11: [100, 500], 12: [50, 200], 14: [20, 100]},
});
map.addLayer({id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours'});

const metres = await map.queryElevation([7.6586, 45.9763]);
```

See [Terrain and elevation](docs/terrain-and-elevation.md).

### Find what is at a position

With `@map-jr/map-jr-gl`, `queryFeatures` with `sources` reads the tile data of those sources. It finds data that the style
does not draw, and it also works for a position that is not on the screen. Without `sources`, it gives the features
that the style layers draw, and it never reads other data. `radius` is the distance around the place in pixels, in
both kinds of query. See [Queries](docs/api.md#queries).

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 16},
  onClick: async event => {
    // "openmaptiles" is the id of the vector source in this style.
    const features = await map.queryFeatures(event.lngLat, {sources: ['openmaptiles'], radius: 8});
    console.log(features.map(feature => feature.properties));
  },
});
```

With `@map-jr/map-jr-gl/maplibre-compat`, `map.queryFeatures` is the same method. `queryRenderedFeatures` and
`querySourceFeatures` are also available:

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-74.0065, 40.7085], zoom: 16});
map.on('click', async event => {
  const features = await map.queryFeatures(event.lngLat, {sources: ['openmaptiles'], radius: 8});
  console.log(features.map(feature => feature.properties));
});
```

![Buildings that change colour below the pointer](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/query.jpg)

### Render the first view on the server

This example uses the entry `@map-jr/map-jr-gl/server`.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
});
```

Put the SVG in the map container of your HTML page. The live map replaces it when the map is ready.
See [Server rendering](docs/server-rendering.md).

![A map that was drawn on the server](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/server.jpg)

### Use highway shields and other icons that are generated on demand

This example uses the entry `@map-jr/map-jr-gl/maplibre-compat`, where `map` is a `Map`. The description of `@map-jr/map-jr-gl` has
no field for this yet.

```js
map.setMissingStyleImageResolver(name => {
  if (name.startsWith('shield|')) return map.addImage(name, drawShieldAsSVG(name));
});
```

The OSM Americana shield library works with this library without changes.

A label can contain images (`format` with `image`). So a road with two routes shows two shields side by side.

![Highway shields on a road map](https://raw.githubusercontent.com/map-jr/map-jr-gl/main/docs/images/shields.jpg)

## How the library loads

The default configuration needs no settings.

- The page loads `map-jr-gl.js`. This file is small.
- The library starts a worker from `map-jr-gl-worker.js`. It finds this file next to `map-jr-gl.js`. Bundlers copy
  the file automatically.
- If a worker cannot start, or loses its WebGL context again directly after the map has started it again, the library draws on the main thread and writes a warning. A map always appears.

See [Loading](docs/loading.md) for a CDN, a strict Content Security Policy, the one-file
build and other configurations.

## Speed

<!-- speed:start -->
Measured by the workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) on 2026-11-13 (commit c547707). Each cell is MapLibre GL JS 6.17.0 / **this library** (worker renderer where the browser has it).

| System, browser | Load to idle, ms | Frames per second, map moving | Frames per second, 10,000 markers |
|---|---|---|---|
| macOS, Chromium | 1550 / **942** | 36 / **32** | 1 / **27** |
| macOS, Firefox | 6209 / **4547** |  | 3 / **3** |
| macOS, WebKit | 3805 / **1349** | 54 / **39** | 2 / **53** |
| Linux, Chromium | 875 / **1162** | 11 / **7** | 2 / **7** |
| Linux, Firefox | 1831 / **1898** | 18 / **59** | 5 / **56** |
| Linux, WebKit | 2054 / **1288** | 16 / **16** | 2 / **15** |
| Windows, Chromium | 1291 / **1421** | 42 / **32** | 2 / **37** |
| Windows, Firefox | 1331 / **1662** | 34 / **24** | 4 / **23** |
| Windows, WebKit | 1332 / **1414** | 20 / **19** | 3 / **17** |
<!-- speed:end -->

These computers are virtual machines, and those for Linux and Windows have no GPU: use the table to compare the
two libraries, not as the speed of a real device. On an Apple M4 the two libraries draw 60 frames each second;
this library loads faster (490 ms against 781 ms) and uses no page script for a frame.

To measure on your device, open [the benchmark page](https://map-jr.github.io/map-jr-gl/bench/) of the gallery site, or run `pnpm demo` and open `http://localhost:8080/bench`. `pnpm status` writes the table.

## Documents

- [The main API](docs/api.md): `createMap`, the description of a map, the state, queries.
- [Vue and Nuxt](docs/vue.md): the component, the composable, server rendering.
- [React](docs/react.md): the component, the hooks, server rendering.
- [Svelte](docs/svelte.md): an action and a store.
- [Loading](docs/loading.md): how the files load, and how to change that.
- [Markers](docs/markers.md): marker layers, images that are SVG templates, and DOM markers.
- [Terrain and elevation](docs/terrain-and-elevation.md): terrain, relief shading, contour lines, elevation queries.
- [Server rendering](docs/server-rendering.md): SVG and images on Node.js and Cloudflare Workers.
- [Accessibility](docs/accessibility.md): what the library does for keyboard users and assistive technology, and what it
  does not do yet.
- [MapLibre compatibility](docs/maplibre-compatibility.md): what is the same, what is different, what is not
  available.
- [Plugins and frameworks](docs/ecosystem.md): which popular MapLibre plugins find the API that they use.
- [Browser support](docs/browser-support.md): what a browser must have, what each renderer needs, and where the
  library was run.
- [Development](docs/development.md): how to build, test, measure and release the library.
- [Changelog](CHANGELOG.md): what each version contains, and what is known not to work.
- [Contributing](CONTRIBUTING.md) and the [open issues](https://github.com/map-jr/map-jr-gl/issues): what is known to be wrong or missing, by priority.

## How this project is made

An AI coding assistant wrote almost all the code of this project ("vibe coding"). A person gave the directions and
reviewed the results. Nobody reviewed every line of the code. Read [Acknowledgements](ACKNOWLEDGEMENTS.md) for
more information, and run your own tests before you use the library for important work.

## Licence and acknowledgements

The licence is MIT. See [LICENSE](LICENSE).

The library follows [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) (BSD-3-Clause) but contains none of
its files. [Acknowledgements](ACKNOWLEDGEMENTS.md) lists the projects that this library uses or follows.
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) contains their licence texts.
