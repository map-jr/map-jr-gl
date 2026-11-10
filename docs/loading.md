# Loading

This document tells you how the library loads its files and how to change that.

## The default configuration

Import the library. No settings are necessary.

```js
import {Map} from 'tessera-map';

const map = new Map({container: 'map', style: 'https://example.com/style.json', center: [-74, 40.7], zoom: 12});
```

The library then does these steps:

1. The page loads `tessera.js`. This file is small because it does not contain the renderer.
2. The library starts a worker from `tessera-worker.js`. The worker contains the renderer.
3. The worker draws the map on the canvas. The page thread only sends commands, for example "move" or "zoom".

The library finds `tessera-worker.js` adjacent to `tessera.js`. The code for this is
`new URL('./tessera-worker.js', import.meta.url)`. Vite, webpack 5, Rollup and Parcel know this code. They copy the
worker file to your build automatically.

All maps on a page use the same group of workers to read tiles.

## The files

| File | What loads it | When |
|---|---|---|
| `tessera.js` and one shared part | The page | Always |
| `tessera-worker.js` | A worker | Always, at the same time as the page script |
| `tessera-engine-entry-*.js` | The page | Only when the map draws on the main thread |
| `tessera-standalone.js` | The page | Only when you import the one-file build |

The [status table](../README.md#status) gives the current sizes.

## If a worker cannot start

A worker cannot start in these conditions:

- The worker file is not at the expected address.
- A Content Security Policy does not permit workers.
- The browser cannot draw WebGL2 in a worker.

In these conditions the library draws on the main thread. It loads the renderer as a separate file. It also writes
a warning to the console that tells you what to change. A map always appears.

## Other configurations

| You want to | Do this |
|---|---|
| Put the worker file at a different address | `new Map({workerUrl: '/assets/tessera-worker.js'})` |
| Use the worker syntax of your bundler | `new Map({createWorker: () => new Worker(new URL('tessera-map/worker', import.meta.url))})` |
| Use the same settings for all maps | Call `configure({workerUrl, createWorker, tileWorkers})` one time at the start |
| Use one file only | `import {Map} from 'tessera-map/standalone'` |
| Draw on the main thread | `new Map({renderer: 'main'})` |
| Change the number of tile workers | `new Map({tileWorkers: 2})` |

### One file only

The standalone build contains the worker. Use it where more than one file is a problem, for example in an embedded
widget or a sandbox. It is larger, and the page must load all of it before the map starts.

### A content delivery network

A browser does not start a worker from a different origin. When `tessera.js` comes from a different origin, the
library starts the worker through a small script on your origin. No setting is necessary.

If your page has a strict Content Security Policy, add `worker-src blob:` to it.

### Vite in development

In development, Vite puts dependencies in a cache folder. The worker file is not in that folder. Add this to your
Vite configuration:

```js
export default {
  optimizeDeps: {exclude: ['tessera-map']},
};
```

If you do not, the map draws on the main thread and writes a warning. A production build does not have this
problem.

### Frameworks that render on the server

It is safe to import the library on the server. The library does not use a browser API until you call `new Map()`.
Create the map in the function that runs after the component is in the page, for example `onMounted` or
`useEffect`.

To show a picture before the script runs, see [Server rendering](server-rendering.md).

### TypeScript

The package contains type declarations. No more packages are necessary.
