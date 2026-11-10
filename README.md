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

Labels that curve along lines, `queryRenderedFeatures` (see `queryFeatures`), clustering (shown in the gallery
as application code), contour lines, pattern fills, SDF icons, 3D terrain, sky, globe, heatmap. Hillshade is not in server output, and its tile edges can show
faint seams. Symbol layers always draw above all other layers.

## Performance compared with MapLibre GL JS

Measured by `pnpm bench` (`test/bench/compare.mjs`): both libraries in the same headless Chromium, the same style
(OpenFreeMap Liberty), the same 1000 × 700 view of lower Manhattan, and the same three-second pan, zoom and rotate.

**Read these with care.** Headless Chromium draws WebGL in software, so frame counts are low for both libraries and
mostly reflect CPU rasterisation, not what a GPU would do; treat them as relative. Main-thread figures (script time,
long tasks) are CPU work and carry over to real devices much better. Numbers are from a single run on one machine.
This library also draws less than MapLibre for this style (no pattern fills, straight road labels only), which
flatters it somewhat.

| | Download (gzip) | Load to idle | Main thread blocked during load | Frames in 3 s | Main-thread script per frame (median / worst) |
|---|---|---|---|---|---|
| MapLibre GL JS 6.17 | 434 KB + 10 KB CSS | 2117 ms | 1044 ms | 22 | 7.3 / 19.0 ms |
| This library, main thread | 84 KB | 1731 ms | 1140 ms | 20 | 4.3 / 16.8 ms |
| This library, worker | 84 KB (or 22 KB + 35 KB worker, see below) | 1395 ms | 0 ms | 19 | 0 / 0 ms |

With worker rendering the page's main thread does no map work at all, which is the point of it: the map cannot make
the page janky and the page cannot make the map janky. MapLibre is a few frames ahead in raw frame count here.

**Markers.** MapLibre's `Marker` is one DOM element per marker; a marker layer here is drawn on the canvas.

| Markers | | Time to add | Frames in 3 s | Main-thread script per frame (median / worst) |
|---|---|---|---|---|
| 1,000 | MapLibre `Marker` (DOM) | 44 ms | 18 | 14.6 / 34.9 ms |
| 1,000 | Marker layer, main thread | 3 ms | 20 | 3.9 / 10.5 ms |
| 1,000 | Marker layer, worker | 5 ms | 18 | 0 / 0 ms |
| 10,000 | MapLibre `Marker` (DOM) | 453 ms | 8 | 64.9 / 125 ms |
| 10,000 | Marker layer, main thread | 29 ms | 19 | 4.7 / 21.4 ms |
| 10,000 | Marker layer, worker | 21 ms | 18 | 0 / 0 ms |
| 100,000 | Marker layer, worker | 209 ms | 16 | 0 / 0 ms |

MapLibre can also draw many points cheaply with a symbol or circle layer; this compares the two libraries' marker
APIs, which is what most applications reach for first.

### Bundle sizes and what importing less buys

`pnpm build --sizes` prints these (minified, then gzip):

| What the page loads | Minified | Gzip |
|---|---|---|
| `tessera.js`: everything in one file, worker embedded | 228 KB | 84 KB |
| `tessera-slim.js`: no engine on the main thread | 63 KB | 22 KB |
| `tessera-worker.js`: fetched separately by the slim build | 94 KB | 35 KB |
| Slim, importing only `Map` (tree-shaken by your bundler) | 58 KB | 20 KB |
| Slim, `Map` plus navigation and scale controls | 60 KB | 21 KB |
| Slim, `Map` plus `Marker` and `Popup` | 60 KB | 21 KB |

Two conclusions. Picking individual imports saves very little, because controls, markers and popups are about a
kilobyte each: nearly all the weight is the rendering engine. What does matter is where the engine goes. The
all-in-one file carries it twice (once to run on the main thread as a fallback, once as embedded worker source);
the slim build carries it zero times on the main thread and loads it as a worker file in parallel, so the page's own
script is about a quarter of the size. The slim build needs `workerUrl` and a browser that supports worker rendering.

```js
import {Map} from './dist/tessera-slim.js';
new Map({container: 'map', style, workerUrl: '/dist/tessera-worker.js'});
```

## Try it

```bash
pnpm install
pnpm build
pnpm demo
```

Then open `http://localhost:8080/gallery` for a page of small live maps, one per feature, or
`http://localhost:8080/` (full page; add `?renderer=main` or `?renderer=worker`, `?markers=50000`, `?photos`, `?slim`),
`/ssr` (server-rendered SVG, then hydrated; `/ssr?image` for a server-rendered JPEG) or `/static` (server output alone).
Add `?style=<url>` to load any MapLibre style. The demo proxies and caches
tiles from OpenFreeMap. `pnpm test` runs unit tests, MapLibre's expression fixtures and an API coverage check; `pnpm test:browser` and
`pnpm test:cloudflare` run against a running demo server.

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
import {Map} from './dist/tessera.js';

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
