# From MapLibre GL JS

The entry `@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS 6: `new Map({...})`, `map.on(...)`,
`map.addLayer(...)`, the controls, `Marker` and `Popup`. To migrate an application, change its imports and the calls
that this page lists.

## Steps

1. Install the package.

   ```sh
   npm install @map-jr/map-jr-gl
   ```

2. Change the name of the module in each import.

   ```js
   // Before
   import {Map, Marker, Popup} from 'maplibre-gl';
   import * as maplibregl from 'maplibre-gl';

   // After
   import {Map, Marker, Popup} from '@map-jr/map-jr-gl/maplibre-compat';
   import * as maplibregl from '@map-jr/map-jr-gl/maplibre-compat';
   ```

3. Remove the CSS file and the worker file of MapLibre GL JS. The library adds its own styles and loads its own
   worker file. See [Loading](../loading.md) for a page with a Content Security Policy or files on a CDN.

   ```js
   // Before
   import 'maplibre-gl/dist/maplibre-gl.css';
   import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
   maplibregl.setWorkerUrl(workerUrl);

   // After: nothing
   ```

4. Add `await` to each call of `queryRenderedFeatures` and `querySourceFeatures`. See
   [Queries return a promise](#queries-return-a-promise) for what the result holds without `await`.

   ```js
   // Before
   map.on('click', event => {
     const features = map.queryRenderedFeatures(event.point, {layers: ['places']});
   });

   // After
   map.on('click', async event => {
     const features = await map.queryRenderedFeatures(event.point, {layers: ['places']});
   });
   ```

5. Create the map with `strict: true`, and run your application. With `strict: true`, the map throws an error for
   an option or a method that has no effect in this library, where it otherwise writes a warning. Remove
   `strict: true` after the migration.

   ```js
   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', strict: true});
   ```

6. Read the console of the browser. The map writes a warning for a layer type and for an expression that it does
   not support. It does not draw such a layer, and such an expression returns `null`. See
   [What is not available](#what-is-not-available) for the list.

7. If a wrapper or a plugin imports `maplibre-gl` itself, set an alias for that name: see
   [Wrappers and plugins](#wrappers-and-plugins).

## Names that change

| MapLibre GL JS | Map Jr. GL | Notes |
|---|---|---|
| `'maplibre-gl'` | `'@map-jr/map-jr-gl/maplibre-compat'` | The same named exports. The default export is an object with the same names, for `import maplibregl from 'maplibre-gl'`. |
| `maplibre-gl/dist/maplibre-gl.css` | None | The map adds its styles to the page. |
| `setWorkerUrl(url)`, `workerUrl` of react-map-gl | None | A URL of the worker file of MapLibre GL JS is ignored with one warning. |
| `map.queryRenderedFeatures(...)` | `await map.queryRenderedFeatures(...)` | The arguments and the features are the same. |
| `map.querySourceFeatures(...)` | `await map.querySourceFeatures(...)` | The arguments and the features are the same. |
| `map.getCanvas().toDataURL()` with `preserveDrawingBuffer` | `await map.toBlob()` | See [Read the canvas with `toBlob`](#read-the-canvas-with-toblob). |
| `map.addImage(name, image)` | `map.addImage(name, image)` | It also accepts an SVG document or a URL as the image, and returns a promise that resolves when the image is loaded. |
| `maxPitch` up to 180 | `maxPitch` up to 90 | A higher value is limited to 90, with one warning. The default is 60 in both. |
| `setRoll`, `setVerticalFieldOfView` | None | Accepted with no effect. A value other than the default warns once. |
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
map.on('mousemove', async event => {
  const features = await map.queryRenderedFeatures(event.point, {layers: ['places']});
  map.getCanvas().style.cursor = features.length ? 'pointer' : '';
});
```

### Read the canvas with `toBlob`

`canvasContextAttributes: {preserveDrawingBuffer: true}` has no effect and warns once. To read the image of the
map, call `map.toBlob(type, quality)`. It waits until the map is idle and resolves to a `Blob` of the canvas.

```js
const blob = await map.toBlob('image/png');
const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: 'map.png'});
link.click();
```

### A custom layer needs the main-thread renderer

The map draws in a worker where the browser permits it, and a custom layer (`type: 'custom'`) cannot draw there.
Create the map with `renderer: 'main'`. Without it, `addLayer` fires an `error` event and adds nothing.

```js
const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', renderer: 'main'});
map.on('load', () => map.addLayer(customLayer));
```

### Private members do not exist

The map has no `map.transform` and no `map.painter`. A plugin that reads private members of MapLibre GL JS does not
work, and a plugin that uses only public methods usually does. The development build, which a bundler uses in
development (see [Change the map](../api.md#change-the-map)), warns once for each public member of MapLibre GL JS
that the code reads and this library does not have.

```js
// Before
const zoom = map.transform.zoom;

// After
const zoom = map.getZoom();
```

### The style is not validated

The library does not validate the style and does not check the types of expressions. It warns only for a layer type
or an expression that it does not support. Any other mistake that MapLibre GL JS reports with an `error` event gets
no message here. Validate a style that you write yourself with `@maplibre/maplibre-gl-style-spec`.

```js
// 'circle-colour' is not a paint property. No error event and no warning come: the circles have the default colour.
map.addLayer({id: 'stops', type: 'circle', source: 'stops', paint: {'circle-colour': '#d6453d'}});
```

## Wrappers and plugins

A wrapper (react-map-gl, for example) or a plugin imports `maplibre-gl` itself. Map that name to this library in your
bundler. The alias must match the name `maplibre-gl` exactly. An alias that also matches `maplibre-gl/dist/...`
makes the bundler look for those files in this package, which does not have them, and the build stops.

```js
// vite.config.js
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {
    alias: [{find: /^maplibre-gl$/, replacement: '@map-jr/map-jr-gl/maplibre-compat'}],
  },
});
```

Without a bundler, use an import map:

```html
<script type="importmap">{"imports": {"maplibre-gl": "/node_modules/@map-jr/map-jr-gl/dist/map-jr-gl-maplibre-compat.js"}}</script>
```

| Case | What to do |
|---|---|
| Next.js | See [Next.js](../loading.md#nextjs) for the alias in webpack and in Turbopack. |
| Vite 5 in development | See [Vite in development](../loading.md#vite-in-development) for the option `optimizeDeps` that it needs. |
| react-map-gl 8 (`react-map-gl/maplibre`, `@vis.gl/react-maplibre`) | It works through the alias. |
| react-map-gl 7 | It does not work, because it reads `map.transform`. Upgrade to version 8 first. |
| TypeScript with a wrapper | Keep `maplibre-gl` installed for its types. Values that are typed with `maplibre-gl` fit the types of this library, but not always the reverse. |

See [Ecosystem](../ecosystem.md) for the plugins and wrappers that are tested.

## What is not available

The library does not have these parts of MapLibre GL JS, among others:

- Video and canvas sources, and MapLibre Tiles (MLT).
- `promoteId` in vector sources. It works in GeoJSON sources.
- The expressions `within` and `distance`.
- `text-writing-mode`.
- Roll, a field of view other than the default, and a pitch above 90 degrees.
- Custom layers with the worker renderer.

See [MapLibre compatibility](../maplibre-compatibility.md) for the full list of differences, for every method of
`Map`, and for everything that is not available.

## See also

- [Markers and popups](../guide/markers-and-popups.md) for markers with both entries.
- [The main API](../api.md) for a map from one description, which new code can use in place of the compat entry.
