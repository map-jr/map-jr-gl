# From MapLibre GL JS

The entry `@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS 6: `new Map({...})`, `map.on(...)`,
`map.addLayer(...)`, the controls, `Marker` and `Popup`. To migrate an application, change its imports and the calls
that this page lists. The page is written for an application that uses MapLibre GL JS 6.

## Steps

1. Install the package.

   ```sh
   npm install @map-jr/map-jr-gl
   ```

2. Change the name of the module in each import. An import of all names (`import * as maplibregl from …`) and a
   default import change in the same way.

   Before:

   ```js
   import {Map, Marker, Popup} from 'maplibre-gl';
   ```

   After:

   ```js
   import {Map, Marker, Popup} from '@map-jr/map-jr-gl/maplibre-compat';
   ```

3. Remove the CSS file and the worker file of MapLibre GL JS. The library adds its own styles and loads its own
   worker file. See [Loading](../guide/loading.md) for a page with a Content Security Policy or files on a CDN.

   Before:

   ```js
   import {Map, setWorkerUrl} from 'maplibre-gl';
   import 'maplibre-gl/dist/maplibre-gl.css';
   import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

   setWorkerUrl(workerUrl);
   ```

   After:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';
   ```

4. Add `await` to each call of `queryRenderedFeatures` and `querySourceFeatures`. See
   [Queries return a promise](#queries-return-a-promise) for what the result holds without `await`.

   Before:

   ```js
   import {Map} from 'maplibre-gl';

   const map = new Map({
     container: 'map',
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
   });
   map.on('click', event => {
     const features = map.queryRenderedFeatures(event.point, {
       layers: ['building'],
     });
     console.log(features);
   });
   ```

   After:

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({
     container: 'map',
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
   });
   map.on('click', async event => {
     const features = await map.queryRenderedFeatures(event.point, {
       layers: ['building'],
     });
     console.log(features);
   });
   ```

5. Create the map with `strict: true`, and run your application. With `strict: true`, an option or a call that the
   map cannot carry out throws an error, so the application stops where it relies on one: see
   [`strict`](../reference/maplibre-compat.md#strict). Remove `strict: true` after the migration.

   ```js
   import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

   const map = new Map({
     container: 'map',
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     strict: true,
   });
   ```

6. Compare the layer types and the expressions of your style with [What is not available](#what-is-not-available).
   The map does not draw a layer type that it does not support, and an expression that it does not support returns
   `null`.

7. If a wrapper or a plugin imports `maplibre-gl` itself, set an alias for that name: see
   [Wrappers and plugins](wrappers.md).

## Names that change

| MapLibre GL JS | Map Jr. GL | Notes |
|---|---|---|
| `'maplibre-gl'` | `'@map-jr/map-jr-gl/maplibre-compat'` | It exports `Map`, `Marker`, `Popup`, the control classes, `LngLat`, `LngLatBounds`, `Point`, `addProtocol` and `setWorkerUrl`, and a default export with the same names. |
| Other exports, such as `addSourceType` and `prewarm` | None | An import of a name that the entry does not export fails when the application is built. |
| `maplibre-gl/dist/maplibre-gl.css` | None | The map adds its styles to the page. |
| `setWorkerUrl(url)`, `workerUrl` of react-map-gl | None | A URL of the worker file of MapLibre GL JS is ignored. |
| `map.queryRenderedFeatures(...)` | `await map.queryRenderedFeatures(...)` | The arguments and the features are the same. |
| `map.querySourceFeatures(...)` | `await map.querySourceFeatures(...)` | The arguments and the features are the same. |
| `map.getCanvas().toDataURL()` with `preserveDrawingBuffer` | `await map.toBlob()` | See [Read the canvas with `toBlob`](#read-the-canvas-with-toblob). |
| `map.addImage(name, image)` | `map.addImage(name, image)` | It also accepts an SVG document or a URL as the image, and returns a promise that resolves when the image is loaded. |
| `maxPitch` up to 180 | `maxPitch` up to 90 | A higher value is limited to 90. The default is 60 in both. |
| `setRoll`, `setVerticalFieldOfView` | None | Accepted with no effect. |
| The `pmtiles` protocol of the PMTiles library | None | A source URL that starts with `pmtiles://` works with no plugin. |
| `setRTLTextPlugin(...)` | None | Accepted with no effect. The browser shapes right-to-left text. |
| `maplibregl-*` class names | `maplibregl-*` and `map-jr-*` | Every element has both names, so the CSS of an application still matches. |
| `MapMouseEvent`, `GeoJSONSource` and the other event and source classes | Types of the same names | They are types only: `new` and `instanceof` do not work with them. |

## Differences that most applications meet

### Queries return a promise

`queryRenderedFeatures` and `querySourceFeatures` return a promise of the complete result. Without `await`, the
value is an array that has the features of GeoJSON sources and can lack the features of tile sources. `await` also
works in MapLibre GL JS, so the same code runs with both.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 15,
});
map.on('mousemove', async event => {
  const features = await map.queryRenderedFeatures(event.point, {
    layers: ['building'],
  });
  map.getCanvas().style.cursor = features.length ? 'pointer' : '';
});
```

### Read the canvas with `toBlob`

`canvasContextAttributes: {preserveDrawingBuffer: true}` has no effect. To read the image of the
map, call `map.toBlob(type, quality)`. It waits until the map is idle and resolves to a `Blob` of the canvas.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});

async function download() {
  const blob = await map.toBlob('image/png');
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'map.png',
  });
  link.click();
}
```

### A custom layer needs the main-thread renderer

The map draws in a worker where the browser permits it, and a custom layer (`type: 'custom'`) cannot draw there.
Create the map with `renderer: 'main'`. Without it, `addLayer` adds nothing.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const overlay = {
  id: 'overlay',
  type: 'custom',
  render(gl) {
    // Draw with `gl`, the WebGL context of the map.
  },
};

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  renderer: 'main',
});
map.on('load', () => map.addLayer(overlay));
```

### Private members do not exist

The map has no `map.transform` and no `map.painter`. A plugin that reads private members of MapLibre GL JS does not
work, and a plugin that uses only public methods usually does.

Before:

```js
import {Map} from 'maplibre-gl';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
map.on('moveend', () => console.log(map.transform.zoom));
```

After:

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
});
map.on('moveend', () => console.log(map.getZoom()));
```

### The style is not validated

The library does not validate the style and does not check the types of expressions. A mistake in the style that
MapLibre GL JS reports with an `error` event, such as the wrong name of a property, has no effect here and fires no
`error` event. Validate a style that you write yourself with `@maplibre/maplibre-gl-style-spec`.

```js
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 12,
});
map.on('load', () => {
  map.addSource('stops', {
    type: 'geojson',
    data: {type: 'Point', coordinates: [-74.0065, 40.7085]},
  });
  // 'circle-colour' is not a paint property. The map fires no error event,
  // and the circle has the default colour.
  map.addLayer({
    id: 'stops',
    type: 'circle',
    source: 'stops',
    paint: {'circle-colour': '#d6453d'},
  });
});
```

## Wrappers and plugins

A wrapper (react-map-gl, for example) or a plugin imports `maplibre-gl` itself. Map that name to this library with an
alias in your bundler or an import map. See [Wrappers and plugins](wrappers.md) for the alias in each bundler, the
wrappers and plugins that run with this library, and their types.

## What is not available

The library does not have these parts of MapLibre GL JS, among others:

- MapLibre Tiles (MLT). A vector source with `encoding: 'mlt'` draws nothing and writes a `[map-jr-gl]` warning.
- The expressions `within` and `distance`.
- `text-writing-mode`.
- Roll, a field of view other than the default, and a pitch above 90 degrees.
- Custom layers with the worker renderer.

See [Differences from MapLibre GL JS](../reference/maplibre-differences.md) for the full list of differences and of everything that
is not available, and [The compat entry](../reference/maplibre-compat.md) for every member of `Map`.

## A coding agent

The [migration prompt](prompt.md) lets a coding agent do these steps. The package contains these docs as Markdown in
`node_modules/@map-jr/map-jr-gl/docs/`, and an `AGENTS.md` for agents.

## See also

- [Markers and popups](../guide/markers-and-popups.md) for markers with both entries.
- [The main API](../reference/create-map.md) for a map from one description, which new code can use in place of the compat entry.
