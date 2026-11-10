# Tessera (working name)

An experimental vector map renderer for the web: a small, modern take on what MapLibre GL JS does, with
server-side rendering and canvas-drawn SVG markers built in. It reads standard MapLibre style JSON and
Mapbox Vector Tiles.

**Status: a spike.** It draws real maps and is tested in Chromium only. It is not ready for production.

## What works

- **Style spec subset:** `background`, `fill`, `line`, `circle`, `symbol`, `raster` and `hillshade` layers;
  `fill-extrusion` drawn as flat footprints. Filters and expressions (including legacy filters and `stops`
  functions); zoom- and data-driven colour, opacity, width and radius.
- **Lines:** round, square and butt caps; miter, bevel and round joins; dash arrays; gap width.
- **Symbols:** text and sprite icons, icons stretched around text (road shields), icons along lines, variable
  text anchors, point labels and straight labels along lines, wrapping, halos, collision.
- **Sources:** vector tiles (MVT), raster tiles, Terrarium-encoded elevation tiles.
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
- **Queries from tile data:** `map.queryFeatures(lngLatOrPoint, {sourceLayers, filter, radius, zoom, geometry})`
  returns features whether or not any layer draws them, even off screen. `map.queryElevation(lngLat)` reads
  metres from a `raster-dem` source (Terrarium or Mapbox encoding). Both return promises.
- **Fonts and images:** the `fonts` option (or `addFonts`) loads web fonts on the rendering thread; a style's
  `text-font` of "Open Sans Semibold" maps to family Open Sans at weight 600, with `fontFamily` as fallback.
  `map.addImage(name, svgOrUrlOrBitmap)` adds icons at runtime, SVG included, rasterised at screen density.
  A `styleimagemissing` event reports icon names nothing provides.
- **Labels** are re-decided about four times a second while the map moves, stay pinned to the map in between,
  and fade in and out. A coarse overview of the current area is kept loaded so fast pans land on map, not blank.
- **Camera and input:** wheel and trackpad handling and pan inertia follow MapLibre's model and constants. drag, inertia, wheel and pinch zoom, rotate, keyboard, `jumpTo` / `easeTo` / `flyTo`.

## Not there yet

Labels that curve along lines, `queryRenderedFeatures` (see `queryFeatures`), GeoJSON sources, pattern fills,
SDF icons, pitch, 3D terrain, sky, globe, heatmap. Hillshade and runtime-added images are not in server output,
and hillshade tile edges can show faint seams. Symbol layers always draw above all other layers.

## Try it

```bash
pnpm install
pnpm build
pnpm demo
```

Then open `http://localhost:8080/` (client only; add `?renderer=main` or `?renderer=worker`),
`/ssr` (server-rendered SVG, then hydrated; `/ssr?image` for a server-rendered JPEG) or `/static` (server output alone).
Add `?style=<url>` to load any MapLibre style. The demo proxies and caches
tiles from OpenFreeMap. `pnpm test` runs the browser checks against a running demo server.

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
