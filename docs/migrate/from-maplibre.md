# From MapLibre GL JS

The entry `@map-jr/map-jr-gl/maplibre-compat` has the API of MapLibre GL JS: `new Map({...})`, `map.on(...)`,
`map.addLayer(...)`, the controls, `Marker` and `Popup`. An application changes its imports and a few calls, and
keeps the rest of its code.

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

3. Remove the CSS file and the worker file of MapLibre GL JS. The library adds its own styles and finds its own
   worker file.

   ```js
   // Before
   import 'maplibre-gl/dist/maplibre-gl.css';
   import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
   maplibregl.setWorkerUrl(workerUrl);

   // After: nothing
   ```

4. Add `await` to each call of `queryRenderedFeatures` and `querySourceFeatures`. See
   [Queries return a promise](#queries-return-a-promise).

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

5. Make the map with `strict: true` while you migrate, and run your application. The map then throws an error where
   it would write a warning for an option or a method that has no effect in this library. Remove the option
   when the application runs.

   ```js
   const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', strict: true});
   ```

6. Read the console of the browser. The map writes a warning for each layer type and each expression of the style
   that it does not have.

7. If a wrapper or a plugin imports `maplibre-gl` itself, see
   [Wrappers and plugins](#wrappers-and-plugins).

## Names that change

| MapLibre GL JS | Map Jr. GL | Notes |
|---|---|---|
| `'maplibre-gl'` | `'@map-jr/map-jr-gl/maplibre-compat'` | The same named exports, and a default export with the same names. |
| `maplibre-gl/dist/maplibre-gl.css` | None | The map adds its styles to the page. |
| `setWorkerUrl(url)`, `workerUrl` of react-map-gl | None | A URL of the worker file of MapLibre GL JS is ignored with one warning. |
| `map.queryRenderedFeatures(...)` | `await map.queryRenderedFeatures(...)` | The arguments and the features are the same. |
| `map.querySourceFeatures(...)` | `await map.querySourceFeatures(...)` | The arguments and the features are the same. |
| `map.getCanvas().toDataURL()` with `preserveDrawingBuffer` | `await map.toBlob()` | See [Read the canvas with `toBlob`](#read-the-canvas-with-toblob). |
| `map.addImage(name, image)` | `await map.addImage(name, image)` | It returns a promise. It also takes an SVG document or a URL as the image. |
| `maxPitch` up to 180 | `maxPitch` up to 90 | A higher value gives 90 and one warning. The default is 60 in both. |
| `setRoll`, `setVerticalFieldOfView` | None | Accepted with no effect. A value other than the default warns once. |
| The `pmtiles` protocol of the PMTiles library | None | A source URL that starts with `pmtiles://` works with no plugin. |
| `setRTLTextPlugin(...)` | None | Accepted with no effect. The browser shapes right-to-left text. |
| `maplibregl-*` class names | `maplibregl-*` and `map-jr-*` | Every element has both names, so the CSS of an application still matches. |
| `MapMouseEvent`, `GeoJSONSource` and the other event and source classes | Types of the same names | They are types only: `new` and `instanceof` do not work with them. |

## Differences that most applications meet

### Queries return a promise

The complete result of `queryRenderedFeatures` and `querySourceFeatures` is a promise. The value is also an array, for code that reads it at once, but that array can lack the features of tile
sources. `await` also works in MapLibre GL JS, so the same code runs with both.

```js
map.on('mousemove', async event => {
  const features = await map.queryRenderedFeatures(event.point, {layers: ['places']});
  map.getCanvas().style.cursor = features.length ? 'pointer' : '';
});
```

### Read the canvas with `toBlob`

`canvasContextAttributes: {preserveDrawingBuffer: true}` has no effect and warns once. Read the image with
`map.toBlob(type, quality)`: it waits until the map is idle and resolves to a `Blob` of the canvas.

```js
const blob = await map.toBlob('image/png');
const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: 'map.png'});
link.click();
```

### A custom layer needs the main-thread renderer

The map draws in a worker where the browser permits it, and a custom layer (`type: 'custom'`) cannot draw there.
Make the map with `renderer: 'main'`. Without it, `addLayer` fires an `error` event and adds nothing.

```js
const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', renderer: 'main'});
map.on('load', () => map.addLayer(customLayer));
```

### Private members do not exist

The map has no `map.transform` and no `map.painter`. A plugin that reads private members of MapLibre GL JS does not
work, and a plugin that uses only public methods usually does. The development build warns once for each public
member of MapLibre GL JS that the code reads and this library does not have.

```js
// Before
const zoom = map.transform.zoom;

// After
const zoom = map.getZoom();
```

### The style is not validated

The library does not validate the style and does not check the types of expressions. A mistake that MapLibre GL JS
reports with an `error` event can pass here with no message. Validate a style that you write yourself with
`@maplibre/maplibre-gl-style-spec`.

```js
// 'circle-colour' is not a paint property. No error event and no warning come: the circles have the default colour.
map.addLayer({id: 'stops', type: 'circle', source: 'stops', paint: {'circle-colour': '#d6453d'}});
```

## Wrappers and plugins

A wrapper (react-map-gl, for example) or a plugin imports `maplibre-gl` itself. Map that name to this library in your
bundler. The alias must match the name `maplibre-gl` exactly: an alias that also matches `maplibre-gl/dist/...`
stops the build.

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
| Next.js | See [Next.js](../loading.md#nextjs). |
| Vite 5 in development | See [Vite in development](../loading.md#vite-in-development). |
| react-map-gl 8 (`react-map-gl/maplibre`, `@vis.gl/react-maplibre`) | It works through the alias. |
| react-map-gl 7 | It does not work, because it reads `map.transform`. Upgrade to version 8 first. |
| TypeScript with a wrapper | Keep `maplibre-gl` installed for its types. Values that are typed with `maplibre-gl` fit the types of this library, but not always the reverse. |

[Ecosystem](../ecosystem.md) lists the plugins and wrappers that are tested.

## What is not available

These parts of MapLibre GL JS are used most often among those that the library does not have:

- Video and canvas sources, and MapLibre Tiles (MLT).
- `promoteId` in vector sources.
- The expressions `within` and `distance`.
- `text-writing-mode`.
- Roll, a field of view other than the default, and a pitch above 90 degrees.
- Custom layers with the worker renderer.

[MapLibre compatibility](../maplibre-compatibility.md) has the full list of differences, every method of `Map` and
what is not available.

## See also

- [Markers and popups](../guide/markers-and-popups.md) for markers with both entries.
- [The main API](../api.md) for a map from one description, which new code can use in place of the compat entry.
