# Loading

This page shows which files a map loads, how to serve them from another place, and how to set up a bundler, a
Content Security Policy and TypeScript for the library.

## The files that a map loads

A production build needs no setting of the bundler. In development, Vite needs one setting: see
[Vite in development](#vite-in-development). The page script finds the worker file next to itself with
`new URL('./map-jr-gl-worker.js', import.meta.url)`, and Vite, webpack 5, Rollup and Parcel copy the worker file
into the build when they read that line. The page script names the parts of the worker in the same way, so the
bundler copies them too.

| File | When the map loads it |
|---|---|
| The page script: the file of the entry and the files that it imports, called its parts | When the page imports the entry |
| `map-jr-gl-worker.js` | When the map is created, together with the style. The same file starts the worker of the renderer and the tile workers. |
| `map-jr-gl-worker-<name>.js`, where `<name>` is `geojson`, `dem`, `pmtiles`, `within`, `globe`, `subdivide` or `layers` | The parts of the worker. A worker loads each one once, when a map needs it (see [Serve the worker files yourself](#serve-the-worker-files-yourself)). |
| `map-jr-gl-engine-entry-<hash>.js` | Only when the map draws on the main thread: with `renderer: 'main'`, or when a worker cannot draw |
| `map-jr-gl-custom-layers-<hash>.js` | Only in `@map-jr/map-jr-gl/maplibre-compat`, when `addLayer` adds the first custom layer |
| `map-jr-gl-standalone.js` | Only when the page imports the one-file build instead of the entry |

The tile workers decode the tiles. All maps on a page that use the same worker file share them. [Size and speed](size-and-speed.md#download-size) gives the
size of each file.

## Change where and how the map loads its files

`configure` sets the loading options for each map that is created after the call. Both entries
export it. In `@map-jr/map-jr-gl/maplibre-compat`, each option is also an option of `new Map()`, and the option of
`new Map()` overrides `configure` for that map. The reference describes each option under
[`LoadOptions`](../reference/exports.md#loadoptions).

| Option | Type | Default | Description |
|---|---|---|---|
| `workerUrl` | `string \| URL` | The worker file next to the page script | The URL of `map-jr-gl-worker.js`. The parts of the worker (`map-jr-gl-worker-*.js`) must be in the same folder. |
| `createWorker` | `() => Worker` | | A function that starts the worker, for the worker syntax of a bundler. It overrides `workerUrl`. |
| `tileWorkers` | `number` | Two fewer than the processor cores, from 1 to 4 | The number of tile workers. While a map with the same worker file exists, a new value is ignored. |
| `renderer` | `'auto' \| 'worker' \| 'main'` | `'auto'` | The thread that draws the map. See [What each renderer needs](browser-support.md#what-each-renderer-needs). |

To change `tileWorkers`, destroy every map of the page (`destroy()` in `@map-jr/map-jr-gl`, `remove()` in
`@map-jr/map-jr-gl/maplibre-compat`), then call `configure`, then create the maps again.

In `@map-jr/map-jr-gl`, `renderer` is also a field of the [description](../reference/description.md), and the field
overrides `configure` for that map.

**Map Jr**

```js [Map Jr]
import {configure, createMap} from '@map-jr/map-jr-gl';

configure({workerUrl: '/assets/map-jr-gl-worker.js', tileWorkers: 2});

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  workerUrl: '/assets/map-jr-gl-worker.js',
  tileWorkers: 2,
});
```

To use the worker syntax of the bundler, pass `createWorker`. The map calls it for the worker of the renderer and
for each tile worker. The package exports the worker file as `@map-jr/map-jr-gl/worker`. Vite 8 then writes the
worker file twice into the build, and the map requests only one of the two.

```js
import {configure, createMap} from '@map-jr/map-jr-gl';

configure({
  createWorker: () =>
    new Worker(new URL('@map-jr/map-jr-gl/worker', import.meta.url)),
});

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

### Serve the worker files yourself

The folder of the worker file that `workerUrl` names needs each part of the worker too. The worker loads a part only
when a map needs it, from the folder of the worker file.

| File | What the worker loads it for |
|---|---|
| `map-jr-gl-worker.js` | Every map |
| `map-jr-gl-worker-geojson.js` | A GeoJSON source |
| `map-jr-gl-worker-dem.js` | Contour lines and 3D terrain. With `renderer: 'main'`, the page loads 3D terrain as a chunk of the library instead. |
| `map-jr-gl-worker-pmtiles.js` | A PMTiles source |
| `map-jr-gl-worker-within.js` | The expressions `within` and `distance` |
| `map-jr-gl-worker-globe.js` | A style whose `projection` draws a globe. With `renderer: 'main'`, the page loads the globe as a chunk of the library instead. |
| `map-jr-gl-worker-subdivide.js` | A style whose `projection` draws a globe: the tile workers cut the tiles along the grid of the globe with it |
| `map-jr-gl-worker-layers.js` | A style with a layer of the type `heatmap`, `hillshade` or `color-relief`. With `renderer: 'main'`, the page loads it as a chunk of the library instead. |

Copy every `map-jr-gl-worker*.js` file of `node_modules/@map-jr/map-jr-gl/dist/` into one folder under its own name, so that a part
that a later version adds is there too. When a part is missing, the worker reports an error that names the file
`map-jr-gl-worker-<name>.js` that it could not load.

Do not rename the files, and do not let a bundler add a hash to their names: the worker finds each part by its name
in the folder of the worker file. Set `workerUrl` to the URL of the copied worker file. A bundler that gives the URL
of a file, such as Vite with `?url`, writes the file under a hashed name, so it does not work for the parts.

The package exports the parts as `@map-jr/map-jr-gl/worker-*`, next to `@map-jr/map-jr-gl/worker`. These exports only
let tools, such as a plugin that copies files, find the files in the package.

## When a worker cannot start

The map draws on the main thread when the worker file is not at its URL, when a Content Security Policy does not
allow workers, or when the browser cannot draw WebGL2 in a worker. It then loads the renderer as one more file and
writes a warning to the console that says what to change.

With `renderer: 'auto'`, a browser that cannot draw WebGL2 in a worker gets no warning.
[Browser support](browser-support.md#what-each-renderer-needs) lists what each renderer needs.

The page script and the worker file must come from the same version of the package. When a CDN or a cache serves
a worker file of another version, the map still starts, but it can fail later. Serve both files from the same
version, or set `workerUrl` to the worker file of the version of the page script.

## Preload the parts of the page script

The browser finds the names of the parts only after it has read the file of the entry. When a page loads the files
of `dist/` as they are, list the entry and its parts in the `<head>` with `<link rel="modulepreload">`, so that the
browser requests them together. The names of the parts have a hash that changes with each version. This script
prints the lines for an entry from the files of the installed package:

```js uses=process
// preload-links.mjs: prints the <link rel="modulepreload"> lines for an entry
// of the library.
// Run it with: node preload-links.mjs map-jr-gl.js /assets/
import {readFileSync} from 'node:fs';

const dist = 'node_modules/@map-jr/map-jr-gl/dist/';
const [entry = 'map-jr-gl.js', base = '/assets/'] = process.argv.slice(2);
const seen = new Set();
const visit = file => {
  if (seen.has(file)) return;
  seen.add(file);
  // The static imports of a built file are its parts.
  for (const [, part] of readFileSync(dist + file, 'utf8').matchAll(
    /\bimport\s*(?:[^'"();]*?from\s*)?["']\.\/([^"']+)["']/g,
  ))
    visit(part);
};
visit(entry);
for (const file of seen)
  console.log(`<link rel="modulepreload" href="${base}${file}">`);
```

The file of `@map-jr/map-jr-gl` is `map-jr-gl.js`, and the file of `@map-jr/map-jr-gl/maplibre-compat` is
`map-jr-gl-maplibre-compat.js`. Run the script again after each update of the library. A bundler puts the parts
into the files of the application and preloads them itself. The worker file is not a module of the page, so
`modulepreload` does not apply to it.

## Load one file

The standalone build contains the page script and the worker in one file. Use it where a second file is a problem,
for example in an embedded widget. The page loads all of it before the map starts.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl/standalone';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat/standalone';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
});
```

## Load the library from a CDN

Import the entry from the CDN with the version in the URL. The map finds the worker file next to it on the CDN.

```js
const {createMap} = await import(
  'https://unpkg.com/@map-jr/map-jr-gl@0.11.0/dist/map-jr-gl.js'
);

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

A browser does not start a worker from another origin, so the map starts it from a `blob:` URL. A page with a
Content Security Policy therefore needs `blob:` in `worker-src`.

## Content Security Policy

The map needs no `'unsafe-eval'` and no `'unsafe-inline'`. Both entries need these directives:

| Directive | What the map needs |
|---|---|
| `script-src` | The origin of the library files. With `blob:`, a worker loads a part of the worker without waiting: without it, the worker loads the part from its URL and writes one console error. |
| `worker-src` | The origin of the worker file, and `blob:`. |
| `connect-src` | The origin of the worker file, and the hosts of the style, the TileJSON, the tiles, the glyphs, the sprite and the `fonts` of the description. |
| `img-src` | The URL of each image that `images` of the description or `addImage` loads, and `data:` for an image passed as SVG text. |
| `style-src` | Nothing for the map itself in Chrome and Edge 73, Firefox 101 and Safari 16.4 or later. In an older browser, pass the nonce of the policy as `nonce`. |

`nonce` is a field of the [description](../reference/description.md) in `@map-jr/map-jr-gl`, and an option of
`new Map()` in `@map-jr/map-jr-gl/maplibre-compat`.

Without `blob:` in `worker-src`, the map starts its workers from the URL of the file and still draws with the worker
renderer. The first map of the page then writes one console error for each worker that it starts, and requests the
worker file once more for each. On a device with 4 cores, which starts 2 tile workers and the worker of the
renderer, that is 3 errors and 4 requests.

Two things of the application need `style-src 'unsafe-inline'`, because the policy blocks `style` attributes:

- the markup of the [server renderer](server-rendering.md) in the page;
- a `style` attribute in HTML that the application passes to a popup or a marker. Use classes instead.

## Referrer policy

Most requests of the map are made in its workers. Each of them sends the URL of the page as its referrer under the
referrer policy of the page, as a request of the page does, in both entries. Some tile servers, such as
tile.openstreetmap.org, refuse a tile request that has no `Referer`.

The map reads the policy from the last `<meta name="referrer">` of the page that has a valid value, when the map
starts. Chrome and Edge do not apply a `Referrer-Policy` header of the page to the requests of the workers: these
requests use the default policy `strict-origin-when-cross-origin`, which sends the origin of the page to another
origin. To keep the policy of the header in every browser, repeat it in a `<meta name="referrer">` element. Firefox
and Safari apply the header. MapLibre GL JS behaves the same way.

## Vite in development

In development, Vite 5 serves the library from its cache of dependencies, which does not contain the worker file.
The map then draws on the main thread. Vite 8 needs no setting for the library alone, and Vite 6 and 7 are not
tested. With Vite 5, exclude the library from the cache:

```js
// vite.config.js
import {defineConfig} from 'vite';

export default defineConfig({
  optimizeDeps: {exclude: ['@map-jr/map-jr-gl']},
});
```

When an alias maps `maplibre-gl` to the compat entry and a wrapper or a plugin imports `maplibre-gl`, exclude both
names. This applies to Vite 8 as well:

```js
// vite.config.js
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {
    alias: [
      {find: /^maplibre-gl$/, replacement: '@map-jr/map-jr-gl/maplibre-compat'},
    ],
  },
  optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']},
});
```

The module for Nuxt excludes `@map-jr/map-jr-gl` itself. With the alias in a Nuxt app, add
`vite: {optimizeDeps: {exclude: ['maplibre-gl']}}` to `nuxt.config`. A production build (`vite build`) needs neither
setting.

## Next.js

The configuration of this section is for Next.js 15 and 16, with Turbopack and with webpack. Create the map in `useEffect` of a client component. The server can import the library, so `next/dynamic` is not
needed. webpack and Turbopack load the worker file with no setting.

```jsx
'use client';
import {useEffect, useRef} from 'react';
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

export default function MapView() {
  const container = useRef(null);
  useEffect(() => {
    const map = new Map({
      container: container.current,
      style: 'https://styles.map-jr.org/1/elevation-zero.json',
      center: [-74.0065, 40.7085],
      zoom: 13.6,
    });
    // StrictMode runs each effect twice in development, so the cleanup removes
    // the map.
    return () => map.remove();
  }, []);
  return <div ref={container} style={{height: 400}} />;
}
```

Code that imports `maplibre-gl` itself, such as react-map-gl or a plugin, needs an alias. The key of the webpack
alias ends with `$`, so that it matches `maplibre-gl` and not `maplibre-gl/dist/...`:

```js
// next.config.mjs (Next.js 15 and 16)
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {'maplibre-gl': '@map-jr/map-jr-gl/maplibre-compat'},
  },
  webpack(config) {
    config.resolve.alias['maplibre-gl$'] = '@map-jr/map-jr-gl/maplibre-compat';
    return config;
  },
};

export default nextConfig;
```

In Next.js 14.2, the Turbopack setting is `experimental: {turbo: {resolveAlias: {...}}}`. The alias does not change
the types that TypeScript reads: see [Types](../migrate/wrappers.md#types) for the types to import.

## Frameworks that render on the server

The server can import both entries. The library uses no browser API until `createMap()` or `new Map()` runs, so
create the map in the function that runs after the component is in the page, such as `onMounted` or `useEffect`. To
show a map before the script runs, see [Server rendering](server-rendering.md).

## TypeScript

The package contains its type declarations. TypeScript finds the types of every entry with each of these values of
`moduleResolution`, with no `paths`:

| `moduleResolution` | TypeScript |
|---|---|
| `"bundler"`, `"node16"`, `"nodenext"` | 5 and later |
| `"node"` (or `"node10"`) | 5 and 6 |

Under `"node"`, TypeScript reads the subpaths from `typesVersions` of `package.json`, so you do not need `paths`
entries for them. TypeScript 7 removed `"node"`.

## The development build

The development build of `@map-jr/map-jr-gl` writes warnings for common mistakes, such as an id in
`interactiveLayers` that is not in the style. The development build of `@map-jr/map-jr-gl/maplibre-compat` writes the
warnings for mistakes and for options and methods of MapLibre GL JS that have no effect, such as the option
`fadeDuration` or `setRoll(10)`; the production build of that entry writes none of them. With the map option
`strict: true`, these cases throw in both builds, and in the production build the error names only the option or
method.

`package.json` names the development build under the `development` export condition, so a bundler that sets
the condition takes it in development and takes the production build otherwise.

| How the page gets `@map-jr/map-jr-gl` | Checks |
|---|---|
| A bundler in development that sets the `development` condition | Yes. The map loads the file of the checks after it has started. |
| A bundler that builds for production | No. |
| The file `dist/map-jr-gl.js` by URL, with no bundler | No. Import `dist/map-jr-gl.dev.js` instead while you develop. |
| The file `dist/map-jr-gl-maplibre-compat.js` by URL, with no bundler | No. Import `dist/map-jr-gl-maplibre-compat.dev.js` instead while you develop. |

The development server of Vite takes the development build, and `vite build` takes the production build. Node.js
takes it with `--conditions=development`. The production build makes no request for the checks
and writes none of their warnings.

Of the other warnings, these are in both builds:

- A warning about what the map does at run time, such as a failed request, a style that cannot load or a layer type
  that the library does not draw.
- A warning about a logic error at run time, such as `setCenterElevation(NaN)` or `setFeatureState` with a text id on
  a vector source.

In both entries, four warnings for a mistake of configuration or for a call with no effect are in the development
build only: a `maxPitch` above 180, a `pixelRatio` that is not a number above 0, `configure({tileWorkers})` after the
tile workers exist, and `addProtocol('pmtiles')`. The warnings about how the files are served (`workerUrl`, a worker
file of another version) and about a source (`"emptyResponse": "missing"`, a contour source with no `"thresholds"`)
are in both builds.

## See also

- [Getting started](getting-started.md) to install the package and show a first map.
- [Browser support](browser-support.md) for what each renderer needs.
- [Size and speed](size-and-speed.md) for the size of each file.
- [Wrappers and plugins](../migrate/from-maplibre.md#wrappers-and-plugins) for the alias of `maplibre-gl`.
