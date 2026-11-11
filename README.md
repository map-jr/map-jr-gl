# Map Jr. GL

A small, fast map library for the web. It reads MapLibre styles and has an API that is almost the same as
MapLibre GL JS.

![A 3D terrain map with relief shading and contour lines](docs/images/terrain.jpg)

**[Open the live gallery](https://map-jr.github.io/map-jr-gl/)** to see each feature with the code that makes it.

## Why use this library

- **It is small.** The page loads about 26 KB of script (gzip). MapLibre GL JS loads more than 250 KB.
- **It does not block your page.** The map draws in a worker. Your page stays responsive while the map moves.
- **It draws many markers.** A marker layer draws 100,000 SVG markers at 60 frames per second.
- **It draws on the server.** You can render the first view of a map as SVG or as an image, without a browser.
  This works on Node.js and on Cloudflare Workers.
- **It includes elevation tools.** 3D terrain, relief shading, contour lines and elevation queries use one
  elevation source. You do not need a plugin.
- **It answers questions about the data.** `queryFeatures` reads the tile data directly. You do not need a style
  layer.
- **It uses web fonts.** Text is drawn with the fonts of the browser. You do not need glyph files.
- **It is easy to change to.** Most MapLibre GL JS code works after you change the import.

## Status

<!-- status:start -->
These figures are written by `pnpm status`. They compare this library with MapLibre GL JS 6.17.0.

| Measure | Result |
|---|---|
| Unit tests | 31 pass, 0 fail |
| MapLibre expression tests | 330 of 425 pass |
| MapLibre `Map` methods | 111 of 150 are available |
| MapLibre render tests | 645 of 1429 are the same (1% of pixels or less are different). 333 more are near (5% or less). |
| Page script (gzip) | 27 KB. MapLibre GL JS: 299 KB. |
| Worker script (gzip) | 57 KB. MapLibre GL JS: 145 KB. |
| Server renderer (gzip) | 34 KB |
<!-- status:end -->

The library is new. Read [MapLibre compatibility](docs/maplibre-compatibility.md) before you use it in production.

## Install

The package is not on npm yet. Build it from this repository:

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
  (`pnpm add ../map-jr-gl`). Then import from `map-jr-gl`.
- **Without a bundler:** copy the `dist` folder to your web server. Then import `dist/map-jr-gl.js` in a module script.

## Use

### Show a map

```html
<div id="map" style="height: 400px"></div>
<script type="module">
  import {Map, NavigationControl} from 'map-jr-gl';

  const map = new Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-74.0065, 40.7085],
    zoom: 13.6,
  });
  map.addControl(new NavigationControl());
</script>
```

You do not need a CSS file. The library adds the styles for its controls.

![A street map with zoom, compass and scale controls](docs/images/basic.jpg)

### Change from MapLibre GL JS

1. Change the import:

   ```js
   // import maplibregl from 'maplibre-gl';
   import * as maplibregl from 'map-jr-gl';
   ```

2. Remove the import of `maplibre-gl.css`.
3. Start your application and read the browser console. The library writes a warning for each style layer or
   property that it cannot draw.
4. Read [MapLibre compatibility](docs/maplibre-compatibility.md) for the differences.

### Add markers

A marker layer draws many markers on the map canvas. Each marker is an SVG template with values from your data.

```js
const places = map.addMarkerLayer({
  id: 'places',
  svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>',
  width: 24,
  height: 24,
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
    {lngLat: [-73.9857, 40.7484], props: {color: '#2f7fd1', name: 'Empire State Building'}},
  ],
});

map.on('markerclick', event => {
  event.layer.openPopup(event.index, event.marker.props.name);
});
```

For a small number of markers with HTML content, use `Marker` and `Popup`. They have the same API as MapLibre GL JS.
See [Markers](docs/markers.md).

![Fifty thousand markers on a map](docs/images/markers.jpg)

### Show terrain, relief and contour lines

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

```js
map.on('click', async event => {
  const features = await map.queryFeatures(event.lngLat, {radius: 8});
  console.log(features.map(feature => feature.properties));
});
```

`queryFeatures` reads the tiles. It finds data that the style does not draw. It also works for a position that is
not on the screen.

![Buildings that change colour below the pointer](docs/images/query.jpg)

### Render the first view on the server

```js
import {renderToSVG} from 'map-jr-gl/server';

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

![A map that was drawn on the server](docs/images/server.jpg)

### Use highway shields and other icons that are generated on demand

```js
map.setMissingStyleImageResolver(name => {
  if (name.startsWith('shield|')) return map.addImage(name, drawShieldAsSVG(name));
});
```

The OSM Americana shield library works with this library without changes. The gallery shows it.

A label can contain images (`format` with `image`). So a road with two routes shows two shields side by side.

![Highway shields on a road map](docs/images/shields.jpg)

## How the library loads

The default configuration needs no settings.

- The page loads `map-jr-gl.js`. This file is small.
- The library starts a worker from `map-jr-gl-worker.js`. It finds this file next to `map-jr-gl.js`. Bundlers copy
  the file automatically.
- If a worker cannot start, the library draws on the main thread and writes a warning. A map always appears.

See [Loading](docs/loading.md) for a CDN, a strict Content Security Policy, the one-file
build and other configurations.

## Speed

These results are from an Apple M4 computer with Chrome 157. Each test moved the map for five seconds.

| Test | Time to load | Frames per second | Page script for each frame |
|---|---|---|---|
| MapLibre GL JS 6.17 | 781 ms | 60 | 3.0 ms |
| This library, in a worker | 490 ms | 60 | 0 ms |
| This library, on the main thread | 469 ms | 60 | 2.2 ms |
| 10,000 markers, MapLibre `Marker` | | 5.7 | 20.1 ms |
| 10,000 markers, marker layer | | 60 | 0 ms |
| 100,000 markers, marker layer | | 60 | 0 ms |
| 3D terrain, MapLibre GL JS 6.17 | 1061 ms | 60 | 2.9 ms |
| 3D terrain, this library, in a worker | 785 ms | 60 | 0 ms |

On an iPhone (Safari, iOS 27), 3D terrain is slower than MapLibre GL JS: 54 to 58 frames per second, compared
with 60.

To run the benchmark on your computer, run `pnpm demo` and open `http://localhost:8080/bench`.

## Documents

- [Loading](docs/loading.md): how the files load, and how to change that.
- [Markers](docs/markers.md): marker layers, callouts, and DOM markers.
- [Terrain and elevation](docs/terrain-and-elevation.md): terrain, relief shading, contour lines, elevation queries.
- [Server rendering](docs/server-rendering.md): SVG and images on Node.js and Cloudflare Workers.
- [MapLibre compatibility](docs/maplibre-compatibility.md): what is the same, what is different, what is not
  available.
- [Plugins and frameworks](docs/ecosystem.md): which popular MapLibre plugins find the API that they use.
- [Development](docs/development.md): how to build, test and measure the library.
- [Decisions for review](docs/review.md): what was left out, and why.

## How this project is made

An AI coding assistant wrote almost all the code of this project ("vibe coding"). A person gave the directions and
reviewed the results. Nobody reviewed every line of the code. Read [Acknowledgements](ACKNOWLEDGEMENTS.md) for
more information, and run your own tests before you use the library for important work.

## Licence and acknowledgements

The licence is MIT. See [LICENSE](LICENSE).

The library follows [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) (BSD-3-Clause) but contains none of
its files. [Acknowledgements](ACKNOWLEDGEMENTS.md) lists the projects that this library uses or follows.
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) contains their licence texts.
