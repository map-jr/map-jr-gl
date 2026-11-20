# Wrappers and plugins

A wrapper of MapLibre GL JS for a framework (react-map-gl, for example) or a plugin imports the module `maplibre-gl`
itself. To run it with this library, map that module name to the compat entry `@map-jr/map-jr-gl/maplibre-compat`
in the bundler or in an import map. The code of the wrapper does not change.

## Steps

1. Install the package. Keep `maplibre-gl` installed when the project uses TypeScript: see
   [Types](#types).

   ```sh
   npm install @map-jr/map-jr-gl
   ```

2. Set an alias for the name `maplibre-gl`. The alias must match that name exactly. An alias that also matches
   `maplibre-gl/dist/...` makes the bundler look for those files in this package, which does not have them, and the
   build stops.

   ```js
   // vite.config.js
   import {defineConfig} from 'vite';

   export default defineConfig({
     resolve: {
       alias: [
         {find: /^maplibre-gl$/, replacement: '@map-jr/map-jr-gl/maplibre-compat'},
       ],
     },
   });
   ```

   Without a bundler, use an import map:

   ```html
   <script type="importmap">
     {"imports": {"maplibre-gl":
       "/node_modules/@map-jr/map-jr-gl/dist/map-jr-gl-maplibre-compat.js"}}
   </script>
   ```

3. Remove the imports of `maplibre-gl/dist/maplibre-gl.css` and of the worker file, and the `workerUrl` prop of
   react-map-gl. The library adds its own styles and loads its own worker file.

4. Run the application. The table of [Wrappers](#wrappers) lists the methods of each wrapper that have no effect
   here.

| Bundler | What to do |
|---|---|
| Vite 5 and Vite 8 | The alias, and in development `optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']}`: see [Vite in development](../loading.md#vite-in-development). Without it, the map draws on the main thread. |
| Vite 6 and 7 | Not checked. Use the settings of Vite 8. |
| Next.js | The alias in webpack and in Turbopack: see [Next.js](../loading.md#nextjs). |
| webpack, Rollup, esbuild | Not checked. Set an alias that matches the name `maplibre-gl` exactly. |
| An import map | Serve every file of `dist/` of the package from one folder. The map loads `map-jr-gl-worker.js` from the folder of the file that the page imports. |

## Wrappers

| Wrapper | Version | Result |
|---|---|---|
| `@vis.gl/react-maplibre` | 8.1.3 | Runs with a map, a source, a layer, a marker, a popup and a control, and with a controlled view. |
| `react-map-gl/maplibre` of react-map-gl | 8 | Runs in one application. The components of the table row above were not run with it. |
| react-map-gl | 7 | Does not work: it reads the private `map.transform` and throws a `TypeError`. Upgrade to version 8. |
| `@indoorequal/vue-maplibre-gl` | 9.0.1 | Runs with a map, a source, a layer, a marker and a control. |
| `vue-maplibre-gl` | 5.6.1 | Not run. It calls `setRenderWorldCopies`, which has no effect here. |
| `svelte-maplibre` | 2.0.1 | Not run. It imports `config`, which the entry does not export. |
| `svelte-maplibre-gl` | 2.2.1 | Not run. It imports `Hash`, `Event` and the source classes, which the entry does not export. |
| `@maplibre/ngx-maplibre-gl` | 22.3.1 | Not run. It calls `setRenderWorldCopies`, `setAnisotropicFilterPitch` and `setCenterElevation`, which have no effect here. |
| `@maptiler/sdk` | 4.2.1 | Not run. It calls `setRoll`, which has no effect here. |

"Runs" means that a page with the wrapper renders the map with this library and that its components work. "Not run"
means that only the code of the wrapper was read for the methods and exports that it uses. An import of a name that
the entry does not export fails when the application is built. See
[The compat entry](../reference/maplibre-compat.md#exports-of-maplibre-gl-that-the-entry-lacks) for those names.

### A controlled map of react-map-gl

A map with `viewState` and `onMove` works when `onMove` sets `viewState` to `e.viewState`. When `onMove` changes the
view, for example to limit the latitude, the map renders the view of the gesture during the gesture, and moves to
`viewState` when the gesture ends. To keep the view inside a box, set `maxBounds`.

```jsx
import {useState} from 'react';
import Map from 'react-map-gl/maplibre';

export function StationMap() {
  const [viewState, setViewState] = useState({
    longitude: -74.0065,
    latitude: 40.7085,
    zoom: 13,
  });
  return (
    <Map
      {...viewState}
      onMove={e => setViewState(e.viewState)}
      maxBounds={[
        [-74.3, 40.5],
        [-73.7, 40.95],
      ]}
      mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
      style={{width: '100%', height: 400}}
    />
  );
}
```

## Plugins

A plugin that calls only public methods of MapLibre GL JS usually works. A plugin that reads private members, such
as `map.transform` or `map.painter`, does not. These plugins run with this library:

| Plugin | Version |
|---|---|
| `@mapbox/mapbox-gl-draw` | 1.5.2 |
| `terra-draw` with `terra-draw-maplibre-gl-adapter` | 1.39.0, 1.5.0 |
| `@geoman-io/maplibre-geoman-free` | 0.10.8 |
| `@maplibre/maplibre-gl-geocoder` | 1.9.4 |
| `@maplibre/maplibre-gl-directions` | 0.10.1 |
| `@maplibre/maplibre-gl-compare` | 0.5.0 |
| `@mapbox/mapbox-gl-sync-move` | 0.4.0 |
| `@maplibre/maplibre-gl-inspect` | 1.9.0 |
| `@watergis/maplibre-gl-export` | 6.0.0 |
| `maplibre-gl-opacity` | 1.8.0 |
| `@mapbox/mapbox-gl-language` | 1.0.1 |
| `@deck.gl/mapbox` with `interleaved: false` | 9.4.1 |
| `pmtiles` | 4.5.0 |

A source URL that starts with `pmtiles://` works without the `pmtiles` plugin. deck.gl with `interleaved: true` is not checked. See [Ecosystem](../ecosystem.md) for the
methods that more plugins use.

## Types

The types of the compat entry accept values that are typed with `maplibre-gl`, such as a style, a layer or a filter.
The reverse is not always true: a value that is typed with the compat entry, such as a `MapLayerMouseEvent`, does not
always fit a type of a wrapper. Keep `maplibre-gl` installed for its types, and import the types from `maplibre-gl`
in code that passes them to the wrapper.

## See also

- [From MapLibre GL JS](from-maplibre.md) for the calls that change in the code of the application.
- [The compat entry](../reference/maplibre-compat.md) for every member of the compat `Map`.
