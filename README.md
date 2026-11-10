# Tessera (working name)

An experimental vector map renderer for the web: a small, modern take on what MapLibre GL JS does, with
server-side rendering and canvas-drawn SVG markers built in. It reads standard MapLibre style JSON and
Mapbox Vector Tiles.

**Status: a spike.** It draws real maps and is tested in Chromium only. It is not ready for production.

## What works

- **Style spec subset:** `background`, `fill`, `line`, `circle`, `symbol`, `raster` and `hillshade` layers;
  `fill-extrusion` (3D buildings). Filters and expressions (including legacy filters and `stops`
  functions); zoom- and data-driven colour, opacity, width and radius.
- **Lines:** round, square and butt caps; miter, bevel and round joins; dash arrays; gap width.
- **Symbols:** text and sprite icons, icons stretched around text (road shields), icons along lines, variable
  text anchors, point labels and straight labels along lines, wrapping, halos, collision.
- **Rendering engine with no DOM access.** It runs in a worker with `OffscreenCanvas` (the default when
  available) or on the main thread, behind the same message interface. `renderer: 'main' | 'worker' | 'auto'`.
- **Text:** glyphs are rasterised from local fonts into a distance-field atlas, one grapheme at a time, and
  laid out by our own code. Arabic, Hebrew, Indic and Thai text is rasterised a line at a time so the browser
  does the shaping. A style's `glyphs` URL is not used; set `fontFamily` (and load a web font) to control the face.
- **Marker layers:** an SVG template with `{{slots}}` per layer, drawn on the map canvas as textured quads,
  with hit testing, hover/click events and optional label avoidance.
- **Server rendering:** `renderToSVG()` produces the first frame as SVG in plain JavaScript (Node, Cloudflare
  Workers), and `renderToImage()` rasterises it to JPEG, WebP or PNG through [takumi](https://takumi.kane.tw).
  The client replaces the server output once its canvas shows the same view.
- **Sources:** vector tiles, raster tiles, elevation tiles (Terrarium or Mapbox encoding), GeoJSON (with
  `setData`), and PMTiles archives (`url: "pmtiles://https://..."`).
- **Markers:** canvas marker layers from SVG templates, including raster images inside the SVG; per-layer zoom
  ranges that cross-fade (dots when zoomed out, pins when zoomed in); optional hiding of overlapping markers;
  `select()` to grow a marker and `openPopup()` for a pointed callout that map labels reflow around. DOM `Marker`
  and `Popup` classes with MapLibre's API for rich or draggable content.
- **Touch:** one-finger pan with inertia, pinch zoom, rotation only past a twist threshold, two-finger tilt,
  double-tap, two-finger tap and tap-and-drag zoom, as in MapLibre. Controls are finger-sized on touch screens,
  respect safe areas, and attribution collapses to a button on small maps.
- **Contour lines:** a `contour` source derives labelled contour lines from an elevation source in the tile
  workers, with intervals by zoom, a unit multiplier and overzoom, in the manner of maplibre-contour. They are
  drawn in server output too: PNG and lossless WebP elevation tiles are decoded by the library, with no
  browser or native module, so this works on Cloudflare; other formats go through a `decodeImage` option.
- **Text along lines:** road and contour labels follow the curve of their line.
- **Queries from tile data:** `map.queryFeatures(lngLatOrPoint, {sourceLayers, filter, radius, zoom, geometry})`
  returns features whether or not any layer draws them, even off screen. `map.queryElevation(lngLat)` reads
  metres from a `raster-dem` source (Terrarium or Mapbox encoding). Both return promises.
- **Fonts and images:** the `fonts` option (or `addFonts`) loads web fonts on the rendering thread; a style's
  `text-font` of "Open Sans Semibold" maps to family Open Sans at weight 600, with `fontFamily` as fallback.
  `map.addImage(name, svgOrUrlOrBitmap)` adds icons at runtime, SVG included, rasterised at screen density.
  A `styleimagemissing` event reports icon names nothing provides.
- **Labels** are re-decided about four times a second while the map moves, stay pinned to the map in between,
  and fade in and out. A coarse overview of the current area is kept loaded so fast pans land on map, not blank.
- **Camera and input:** wheel and trackpad handling and pan inertia follow MapLibre's model and constants.
  Pitch up to 60 degrees (right- or ctrl-drag), with `fill-extrusion` layers drawn as lit 3D buildings.
- **Controls:** `map.addControl()` with MapLibre's control contract; `NavigationControl`, `ScaleControl`,
  `FullscreenControl` and `GeolocateControl` are built in, themed with CSS custom properties.
- **Generated icons:** `map.setMissingStyleImageResolver()` supplies images on demand, e.g. SVG highway shields
  built from a name the style computes (`demo/shields.mjs`); `resolveImage` does the same on the server.
- **Server-only style overrides:** a layer's `metadata["tessera:ssr"]` can hide it, filter it or coarsen it for
  server output. drag, inertia, wheel and pinch zoom, rotate, keyboard, `jumpTo` / `easeTo` / `flyTo`.

See [docs/DIFFERENCES.md](docs/DIFFERENCES.md) for a maintained list of additions, behaviour differences and gaps
relative to MapLibre GL JS, including generated API coverage.

## Not there yet

`queryRenderedFeatures` (see `queryFeatures`), clustering (shown in the gallery as application code), line patterns, SDF icons, 3D terrain, sky, globe, heatmap. Hillshade is not in server output, and its tile edges can show
faint seams. Symbol layers always draw above all other layers.

## Loading the library

**The default needs no configuration**, whether you import the built file directly or go through a bundler:

```js
import {Map} from 'tessera-map';            // in a built project
// import {Map} from '/vendor/tessera/tessera.js';   // or straight from files you host, or a CDN
new Map({container: 'map', style: 'https://example.com/style.json', center: [-74, 40.7], zoom: 12});
```

What happens by default, and why:

- **The page loads a small script** (about 26 KB gzipped). The rendering engine is not in it.
- **The engine runs in a worker**, loaded from `tessera-worker.js`, which the library finds next to its own file
  (`new URL('./tessera-worker.js', import.meta.url)`). Bundlers that understand that pattern (Vite, webpack 5,
  Parcel, Rollup) copy the file for you. Tile-parsing workers are shared by every map on the page.
- **From another origin** (a CDN), browsers refuse to start a worker directly, so the library starts it through a
  small same-origin stub. Nothing to configure, but a strict Content-Security-Policy must allow `worker-src blob:`.
- **If workers cannot start** (the file was not copied, a policy forbids them, or the browser cannot draw WebGL2
  in a worker), the map falls back to rendering on the main thread, fetches the engine as a separate chunk then, and
  logs a warning saying what to change. A map always appears.

When you want control:

| Need | Use |
|---|---|
| Worker file lives somewhere else | `new Map({workerUrl: '/assets/tessera-worker.js'})` |
| Your bundler has its own worker syntax | `createWorker: () => new Worker(new URL('tessera-map/worker', import.meta.url))`, or with Vite `import W from 'tessera-map/worker?worker'` and `createWorker: () => new W()` |
| Same settings for every map | `configure({workerUrl, createWorker, tileWorkers})` once at start-up |
| One file, no siblings (embeds, sandboxes, quick demos) | `import {Map} from 'tessera-map/standalone'` (94 KB gzipped; the worker is embedded and started from a blob) |
| Render on the main thread on purpose | `renderer: 'main'` |
| Number of tile-parsing workers | `tileWorkers: 2` |
| Server rendering | `import {renderToSVG, renderToImage} from 'tessera-map/server'` |

Notes for particular set-ups:

- **Vite** pre-bundles dependencies in development, which hides the worker file from the automatic lookup. Add
  `optimizeDeps: {exclude: ['tessera-map']}`, or pass `workerUrl`/`createWorker` as above. (If neither is done, the
  fallback still gives you a working map on the main thread, with a console warning.)
- **Frameworks that render on the server** (Next.js, Nuxt, SvelteKit, Astro): importing the library on the server is
  safe, as it touches no browser API until `new Map()`. Create the map in a mount/effect hook. To show something
  before JavaScript runs, render the first frame with `tessera-map/server` and let the map take over.
- **TypeScript:** types ship with the package.

| File | Loaded by | Gzip |
|---|---|---|
| `tessera.js` plus its shared chunk | the page, up front | 26 KB |
| `tessera-worker.js` | a worker, in parallel | 40 KB |
| `tessera-engine-entry-*.js` | the page, only for main-thread rendering | 29 KB |
| `tessera-standalone.js` | the page, instead of all of the above | 94 KB |

Importing selectively saves little (controls, markers and popups are about a kilobyte each: `Map` alone is 24 KB
against 26 KB for everything), so there is no need to plan imports around size. `pnpm build --sizes` prints these.

## Performance compared with MapLibre GL JS

**On a real GPU.** Run `pnpm demo` and open `/bench`: it runs both libraries in your browser, one after another,
with the same style, view and five-second pan, zoom and rotate. These results are from an Apple M4 in Chrome 157
(Metal), at screen pixel ratio 2, reported by the project owner:

| Scenario | Load to idle | Frames per second | Main-thread script per frame (median / worst) | Main thread blocked |
|---|---|---|---|---|
| MapLibre GL JS 6.17 | 781 ms | 60 | 3.0 / 9.3 ms | 0 ms |
| This library, main thread | 469 ms | 60 | 2.2 / 11.3 ms | 0 ms |
| This library, worker | 490 ms | 60 | 0 / 0 ms | 0 ms |
| 1,000 markers: MapLibre `Marker` (DOM), added in 18 ms | | 60 | 2.6 / 9.8 ms | 0 ms |
| 1,000 markers: marker layer, worker, added in 2 ms | | 60 | 0 / 0 ms | 0 ms |
| 10,000 markers: MapLibre `Marker` (DOM), added in 194 ms | | 5.7 | 20.1 / 32.4 ms | 5220 ms |
| 10,000 markers: marker layer, main thread, added in 11 ms | | 60 | 2.5 / 10.1 ms | 0 ms |
| 10,000 markers: marker layer, worker, added in 10 ms | | 60 | 0 / 0 ms | 0 ms |
| 100,000 markers: marker layer, worker, added in 141 ms | | 60 | 0 / 0 ms | 0 ms |

Both libraries hold the display's 60 frames per second on this style; the differences are load time, how much of
the main thread each uses, and what happens with many markers. (That run's page reported 59.2 for this library
because it averaged over a short stretch after the animation ended, during which a stopped map rightly draws
nothing; the page now counts only frames during the animation.) This library draws less than MapLibre for this
style (no pattern fills), which helps it a little. MapLibre can also draw many points cheaply with a symbol or
circle layer; the marker rows compare the two libraries' marker APIs.

**In software rendering.** `pnpm bench` runs a similar comparison in headless Chromium, where WebGL is drawn on the
CPU. Frame counts there are low for both and only relative, but it is a useful check for machines without a usable
GPU (virtual machines, remote desktops):

| | Load to idle | Frames in 3 s | Main-thread script per frame (median / worst) |
|---|---|---|---|
| MapLibre GL JS 6.17 | 2117 ms | 22 | 7.3 / 19.0 ms |
| This library, main thread | 1731 ms | 20 | 4.3 / 16.8 ms |
| This library, worker | 1395 ms | 19 | 0 / 0 ms |

## Try it

```bash
pnpm install
pnpm build
pnpm demo
```

Then open `http://localhost:8080/gallery` for a page of small live maps, one per feature, or
`http://localhost:8080/bench` to compare speed with MapLibre in your own browser, or
`http://localhost:8080/` (full page; add `?renderer=main` or `?renderer=worker`, `?markers=50000`, `?photos`, `?standalone`),
`/ssr` (server-rendered SVG, then hydrated; `/ssr?image` for a server-rendered JPEG) or `/static` (server output alone).
Add `?style=<url>` to load any MapLibre style. The demo proxies and caches
tiles from OpenFreeMap. `pnpm test` runs unit tests, MapLibre's expression fixtures and an API coverage check. With the demo server
running, `pnpm test:browser` exercises the map in Chromium, `pnpm test:loading` checks each way of loading the
library, and `pnpm test:cloudflare` runs the server renderer inside Cloudflare's runtime. `pnpm test:render` runs
MapLibre GL JS's own render tests (a style and an expected image each) against this renderer and reports how many
match; it clones MapLibre's repository into `.cache/` on first use.

## Server rendering

`renderToSVG` has no dependencies. `renderToImage` takes a takumi renderer that you create, so the same code
runs with the native build on Node and the WebAssembly build on Cloudflare Workers:

```js
import {renderToImage} from './dist/server.js';
import {Renderer} from '@takumi-rs/core';            // Node, Bun
const {image, contentType} = await renderToImage({style, center, zoom, width: 1000, height: 700, rasteriser: new Renderer()});
```

```js
import init, {Renderer} from '@takumi-rs/wasm';      // Cloudflare Workers
import wasm from '@takumi-rs/wasm/takumi_wasm_bg.wasm';
await init({module_or_path: wasm});
```

`test/cloudflare/` holds a complete Worker and a script that runs it in workerd through Miniflare
(`pnpm test:cloudflare`, with the demo server running). The WebAssembly build is about 1.9 MB gzipped and only
encodes lossy JPEG (its WebP is lossless), so use `format: 'jpeg'` there. A render takes a few hundred
milliseconds of CPU, so cache the result.

Dense city views produce large SVG (hundreds of KB); the image form is a fixed, smaller payload. Register fonts
with the takumi renderer to control label typefaces and cover non-Latin scripts.

## Usage

```js
import {Map} from 'tessera-map';

const map = new Map({container: 'map', style: 'https://tiles.openfreemap.org/styles/positron', center: [-74.006, 40.7128], zoom: 14});

const pins = map.addMarkerLayer({
    id: 'pins', width: 36, height: 46, anchor: 'bottom', collide: true,
    svg: '<svg viewBox="0 0 36 46"><circle cx="18" cy="18" r="14" fill="{{color}}"/></svg>',
    data: [{lngLat: [-74.006, 40.7128], props: {color: '#d6453d'}}],
});
map.on('markerclick', e => console.log(e.marker));
```

```js
import {renderToSVG} from './dist/server.js';
const {svg, tiles} = await renderToSVG({style, center: [-74.006, 40.7128], zoom: 14, width: 1000, height: 700, markers: [pinsOptions]});
```

## Layout

| File | Role |
|---|---|
| `src/geo.ts` | Camera maths, tile coverage; one tile-to-screen matrix feeds both backends |
| `src/mvt.ts`, `src/expr.ts`, `src/style.ts` | Tile decoding, expression compiler, style subset |
| `src/tile.ts` | Renderer-neutral tile geometry, and tessellation into GPU buffers |
| `src/text.ts`, `src/placement.ts` | Glyph atlas, shaping, label collision, tile fallback selection |
| `src/gl.ts`, `src/svg.ts` | The two backends: WebGL2 and SVG |
| `src/engine.ts` | Per-frame work; DOM-free, driven by commands |
| `src/map.ts`, `src/worker.ts`, `src/server.ts` | Public `Map`, worker entry, server renderer |
