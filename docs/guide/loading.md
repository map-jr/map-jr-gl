# Loading

This page shows which files a map loads, how to serve them from another place, and how to set up a bundler, a
Content Security Policy and TypeScript for the library.

## The files that a map loads

A bundler needs no setting. The page script finds the worker file next to itself with
`new URL('./map-jr-gl-worker.js', import.meta.url)`, and Vite, webpack 5, Rollup and Parcel copy the worker file
into the build when they read that line.

| File | When the map loads it |
|---|---|
| The page script: the file of the entry and its parts | When the page imports the entry |
| `map-jr-gl-worker.js` | When the map is created, together with the style. The worker renderer draws the map in it. |
| `map-jr-gl-engine-entry-<hash>.js` | Only when the map draws on the main thread: with `renderer: 'main'`, or when a worker cannot draw |
| `map-jr-gl-custom-layers-<hash>.js` | Only in `@map-jr/map-jr-gl/maplibre-compat`, when `addLayer` adds the first custom layer |
| `map-jr-gl-standalone.js` | Only when the page imports the one-file build instead of the entry |

All maps on a page share one group of tile workers. [Size and speed](size-and-speed.md#download-size) gives the
size of each file.

## Change where and how the map loads its files

`configure` sets the loading options for each map that is created after the call. Both entries
export it. In `@map-jr/map-jr-gl/maplibre-compat`, each option is also an option of `new Map()`, and the option of
`new Map()` overrides `configure` for that map.

| Option | Type | Default | Description |
|---|---|---|---|
| `workerUrl` | `string \| URL` | The worker file next to the page script | The URL of `map-jr-gl-worker.js`. |
| `createWorker` | `() => Worker` | | A function that starts the worker, for the worker syntax of a bundler. It overrides `workerUrl`. |
| `tileWorkers` | `number` | Two fewer than the processor cores, from 1 to 4 | The number of tile workers. It has no effect while a map that uses the same worker file exists. |
| `renderer` | `'auto' \| 'worker' \| 'main'` | `'auto'` | The thread that draws the map. See [What each renderer needs](browser-support.md#what-each-renderer-needs). |

In `@map-jr/map-jr-gl`, `renderer` is also a field of the [description](../reference/description.md), and the field
overrides `configure` for that map.

**Main API**

```js [Main API]
import {configure, createMap} from '@map-jr/map-jr-gl';

configure({workerUrl: '/assets/map-jr-gl-worker.js', tileWorkers: 2});

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

**MapLibre compat**

```js [MapLibre compat]
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

To use the worker syntax of the bundler, pass `createWorker`:

```js
import {configure, createMap} from '@map-jr/map-jr-gl';

configure({createWorker: () => new Worker(new URL('@map-jr/map-jr-gl/worker', import.meta.url))});

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

## When a worker cannot start

The map draws on the main thread when the worker file is not at its URL, when a Content Security Policy does not
allow workers, or when the browser cannot draw WebGL2 in a worker. It then loads the renderer as one more file and
writes a warning to the console that says what to change. With `renderer: 'auto'`, a browser that cannot draw WebGL2 in
a worker gets no warning, and the development build writes the text as a note with `console.info`. [Browser support](browser-support.md#what-each-renderer-needs) lists what each renderer needs.

The page script and the worker file must come from the same version of the package. When a CDN or a cache serves
a worker file of another version, the map writes this warning once and still starts, but it can fail later:

```text
[map-jr-gl] The worker file is version 0.1.0 and the page file is version 0.2.0. Serve map-jr-gl-worker.js from the
same version of the package as the page file, or pass `workerUrl` with the URL of that file.
```

## Preload the parts of the page script

The file of each entry imports parts that the entries share. The browser finds the names of the parts only after it
has read the file of the entry. When a page loads the files of `dist/` as they are, list the parts in the `<head>`
with `<link rel="modulepreload">`, so that the browser requests them together:

```html
<link rel="modulepreload" href="/assets/map-jr-gl.js">
<link rel="modulepreload" href="/assets/map-jr-gl-host-BxRbga7b.js">
<link rel="modulepreload" href="/assets/map-jr-gl-map-xyaVeUwQ.js">
```

| Entry | File | Parts |
|---|---|---|
| `@map-jr/map-jr-gl` | `map-jr-gl.js` | `map-jr-gl-host-<hash>.js`, `map-jr-gl-map-<hash>.js` |
| `@map-jr/map-jr-gl/maplibre-compat` | `map-jr-gl-maplibre-compat.js` | `map-jr-gl-map-<hash>.js`, `map-jr-gl-controls-more-<hash>.js` |

The hash changes with each version. Copy the names from the `import` statements at the start of the file of the
entry in `node_modules/@map-jr/map-jr-gl/dist/`. A bundler puts the parts into the files of the application and
preloads them itself. The worker file is not a module of the page, so `modulepreload` does not apply to it.

## Load one file

The standalone build contains the page script and the worker in one file. Use it where a second file is a problem,
for example in an embedded widget. It is larger, and the page loads all of it before the map starts.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl/standalone';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat/standalone';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13.6});
```

## Load the library from a CDN

A page script from a CDN needs no setting. A browser does not start a worker from another origin, so the map fetches
the worker file and starts the worker from a `blob:` URL. [Getting started](getting-started.md#load-the-library-without-a-bundler)
has a complete page.

## Content Security Policy

The map needs no `'unsafe-eval'` and no `'unsafe-inline'`. Both entries need these directives:

| Directive | What the map needs |
|---|---|
| `script-src` | The origin of the library files. |
| `worker-src` | The origin of the worker file, and `blob:`. |
| `connect-src` | The origin of the worker file, and the hosts of the style, the TileJSON, the tiles, the glyphs, the sprite and the `fonts` of the description. |
| `img-src` | The URL of each image that `images` of the description or `addImage` loads, and `data:` for an image passed as SVG text. |
| `style-src` | Nothing in Chrome and Edge 73, Firefox 101 and Safari 16.4 or later. In an older browser, pass the nonce of the policy as `nonce`, or allow `'unsafe-inline'`. |

The map fetches the worker file once and starts all workers from a `blob:` URL of it. Without `blob:` in
`worker-src`, the map starts the workers from the URL of the file. The first map on the page then writes one console
error for each worker, up to 5, and requests the file once more.

Two things still need `style-src 'unsafe-inline'`, because the policy blocks `style` attributes:

- the markup of the [server renderer](../server-rendering.md) in the page;
- a `style` attribute in HTML that the application passes to a popup or a marker. Use classes instead.

## Vite in development

In development, Vite 5 serves the library from its cache of dependencies, which does not contain the worker file.
The map then draws on the main thread and warns "Workers are unavailable". Exclude the library from the cache:

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
  resolve: {alias: [{find: /^maplibre-gl$/, replacement: '@map-jr/map-jr-gl/maplibre-compat'}]},
  optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']},
});
```

The module for Nuxt excludes `@map-jr/map-jr-gl` itself. With the alias in a Nuxt app, add
`vite: {optimizeDeps: {exclude: ['maplibre-gl']}}` to `nuxt.config`. A production build (`vite build`) needs neither
setting.

## Next.js

Create the map in `useEffect` of a client component. The server can import the library, so `next/dynamic` is not
needed. webpack and Turbopack load the worker file with no setting.

```jsx
'use client';
import {useEffect, useRef} from 'react';
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

export default function MapView() {
  const container = useRef(null);
  useEffect(() => {
    const map = new Map({container: container.current, style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 13.6});
    // StrictMode runs each effect twice in development, so the cleanup removes the map.
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
the types that TypeScript reads: see [Wrappers and plugins](../migrate/from-maplibre.md#wrappers-and-plugins).

## Frameworks that render on the server

The server can import both entries. The library uses no browser API until `createMap()` or `new Map()` runs, so
create the map in the function that runs after the component is in the page, such as `onMounted` or `useEffect`. To
show a map before the script runs, see [Server rendering](../server-rendering.md).

## TypeScript

The package contains its type declarations. TypeScript finds the types of every entry with each of these values of
`moduleResolution`, with no `paths`:

| `moduleResolution` | TypeScript |
|---|---|
| `"bundler"`, `"node16"`, `"nodenext"` | 5 and later |
| `"node"` (or `"node10"`) | 5 and 6 |

## See also

- [Getting started](getting-started.md) to install the package and show a first map.
- [Browser support](browser-support.md) for what each renderer needs.
- [Size and speed](size-and-speed.md) for the size of each file.
- [Wrappers and plugins](../migrate/from-maplibre.md#wrappers-and-plugins) for the alias of `maplibre-gl`.
