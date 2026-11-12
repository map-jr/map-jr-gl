# Loading

This document explains how the library loads its files and how to change that.

## The default configuration

Import the library. You do not need any settings.

```js
import {Map} from 'map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://example.com/style.json', center: [-74, 40.7], zoom: 12});
```

The library then does these steps:

1. The page loads `map-jr-gl.js`. This file is small because it does not contain the renderer.
2. The library starts a worker from `map-jr-gl-worker.js`. The worker contains the renderer.
3. The worker draws the map on the canvas. The page thread only sends commands, for example "move" or "zoom".

The library finds `map-jr-gl-worker.js` next to `map-jr-gl.js`. The code for this is
`new URL('./map-jr-gl-worker.js', import.meta.url)`. Vite, webpack 5, Rollup and Parcel know this code. They copy the
worker file to your build automatically.

All maps on a page use the same group of workers to read tiles.

## The files

| File | What loads it | When |
|---|---|---|
| The entry file and its parts (see [Preload the parts](#preload-the-parts)) | The page | Always |
| `map-jr-gl-worker.js` | A worker | Always. The map asks for it when it is made, at the same time as the style. |
| `map-jr-gl-engine-entry-*.js` | The page | Only when the map draws on the main thread |
| `map-jr-gl-standalone.js` | The page | Only when you import the one-file build |

The [status table](../README.md#status) gives the current sizes.

## If a worker cannot start

A worker cannot start in these conditions:

- The worker file is not at the expected URL.
- A Content Security Policy does not permit workers.
- The browser cannot draw WebGL2 in a worker.

In these conditions the library draws on the main thread. It loads the renderer as a separate file. It also writes
a warning to the console that says what to change. A map appears in each of these conditions. Only a browser that
has no WebGL2 on the main thread either shows no map: see
[A browser without WebGL2](api.md#a-browser-without-webgl2).

## If the worker file is of another version

The page file and the worker file must come from the same version of the package. A CDN or a cache can serve an old
worker file with a new page file. The library then writes one warning to the console for the page, with both
versions:

`[map-jr-gl] The worker file is version 0.1.0 and the page file is version 0.2.0. Serve map-jr-gl-worker.js from the
same version of the package as the page file, or pass `workerUrl` with the URL of that file.`

The map still starts, but it can fail later, because the messages between the two files can differ. A worker file
from before this check reports no version, and the warning says "unknown". The standalone files contain their
worker, so they cannot have this fault.

## Other configurations

The two entries take these settings in different places. In `map-jr-gl`, the description (`MapSpec`) has `renderer`
only, and the other settings go to `configure()`. In `map-jr-gl/maplibre-compat`, each setting is an option of
`new Map()`, and `configure()` sets the default for the maps that do not give the option.

| You want to | `map-jr-gl` | `map-jr-gl/maplibre-compat` |
|---|---|---|
| Put the worker file at a different URL | `configure({workerUrl: '/assets/map-jr-gl-worker.js'})` | `new Map({workerUrl: '/assets/map-jr-gl-worker.js'})` |
| Use the worker syntax of your bundler | `configure({createWorker: () => new Worker(new URL('map-jr-gl/worker', import.meta.url))})` | `new Map({createWorker: () => new Worker(new URL('map-jr-gl/worker', import.meta.url))})` |
| Change the number of tile workers | `configure({tileWorkers: 2})` | `new Map({tileWorkers: 2})` |
| Draw on the main thread | `createMap(container, {style, renderer: 'main'})`, or `configure({renderer: 'main'})` for all maps | `new Map({renderer: 'main'})` |
| Use one file only | `import {createMap} from 'map-jr-gl/standalone'` (the main API and its controls) | `import {Map} from 'map-jr-gl/maplibre-compat/standalone'` |

Both entries export `configure`. Call it before you make the first map:

```js
import {configure, createMap} from 'map-jr-gl';

configure({workerUrl: '/assets/map-jr-gl-worker.js', tileWorkers: 2});

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

`configure` changes the settings of the page, so it applies to each map that is made after the call. All maps on a
page share the tile workers, and the first map starts them: `tileWorkers` has no effect while a map exists that uses
the same worker file. Without `tileWorkers`, the library starts one to four tile workers, by the number of processor
cores of the device.

### Preload the parts

Each entry file is small and imports parts of the library that several entries share. The names of the parts have
a hash of eight characters that changes from one version of the library to the next:

| Entry | File | Parts that it imports |
|---|---|---|
| `map-jr-gl` | `map-jr-gl.js` | `map-jr-gl-host-<hash>.js`, `map-jr-gl-map-<hash>.js` |
| `map-jr-gl/maplibre-compat` | `map-jr-gl-maplibre-compat.js` | `map-jr-gl-map-<hash>.js`, `map-jr-gl-controls-more-<hash>.js` |

The browser learns the names of the parts only when it has read the entry file, so the parts are a second step of
requests. When your page loads the files of `dist/` as they are (from your server or from a CDN), name the parts in
the `<head>` of the page with `<link rel="modulepreload">`. The browser then requests them together with the entry
file:

```html
<link rel="modulepreload" href="/assets/map-jr-gl.js">
<link rel="modulepreload" href="/assets/map-jr-gl-host-BxRbga7b.js">
<link rel="modulepreload" href="/assets/map-jr-gl-map-xyaVeUwQ.js">
```

The two hashes in this example are those of one build. Copy the names for your version from the `import` statements
at the start of the entry file in `node_modules/map-jr-gl/dist/`, and change them when you update the library.

A bundler puts the parts into the files of your application. Then the names above are not in your build, and the
preloading is the task of the bundler.

`modulepreload` does not apply to `map-jr-gl-worker.js`, because the worker file is not a module of the page. The map
requests it when the map is made, at the same time as the style.

### One file only

The standalone build contains the worker. Use it where more than one file is a problem, for example in an embedded
widget or a sandbox. It is larger, and the page must load all of it before the map starts.

### A CDN

A browser does not start a worker from a different origin. When `map-jr-gl.js` comes from a different origin, the
library starts the worker through a small script on your origin. You do not need any settings.

If your page has a strict Content Security Policy, add `worker-src blob:` to it.

### Vite in development

In development, Vite puts dependencies in a cache folder. The worker file is not in that folder. Add this to your
Vite configuration:

```js
export default {
  optimizeDeps: {exclude: ['map-jr-gl']},
};
```

If you do not, the map draws on the main thread and writes a warning. A production build does not have this
problem.

### Frameworks that render on the server

It is safe to import the library on the server. The library does not use a browser API until you call `createMap()`
(`map-jr-gl`) or `new Map()` (`map-jr-gl/maplibre-compat`).
Create the map in the function that runs after the component is in the page, for example `onMounted` or
`useEffect`.

To show a map before the script runs, see [Server rendering](server-rendering.md).

### TypeScript

The package contains type declarations. You do not need other packages.
