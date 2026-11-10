# Tessera (working name)

An experimental vector map renderer for the web: a small, modern take on what MapLibre GL JS does, with
server-side rendering and canvas-drawn SVG markers built in. It reads standard MapLibre style JSON and
Mapbox Vector Tiles.

**Status: a spike.** It draws real maps and is tested in Chromium only. It is not ready for production.

## What works

- **Style spec subset:** `background`, `fill`, `line`, `circle` and `symbol` (text) layers; filters and
  expressions (including legacy filters and `stops` functions); zoom- and data-driven colour, opacity,
  width and radius.
- **Rendering engine with no DOM access.** It runs in a worker with `OffscreenCanvas` (the default when
  available) or on the main thread, behind the same message interface. `renderer: 'main' | 'worker' | 'auto'`.
- **Text:** glyphs are rasterised from local fonts into a distance-field atlas, one grapheme at a time, and
  laid out by our own code. Arabic, Hebrew, Indic and Thai text is rasterised a line at a time so the browser
  does the shaping. Point labels, straight labels along lines, wrapping, halos, collision.
- **Marker layers:** an SVG template with `{{slots}}` per layer, drawn on the map canvas as textured quads,
  with hit testing, hover/click events and optional label avoidance.
- **Server rendering:** `renderToSVG()` produces the first frame as SVG in plain Node (no browser, no GPU),
  plus the list of tiles to preload. The client replaces the SVG once its canvas shows the same view.
- **Camera and input:** drag, inertia, wheel and pinch zoom, rotate, keyboard, `jumpTo` / `easeTo` / `flyTo`.

## Not there yet

Icons and sprites, pattern fills, dashed lines, labels that curve along lines, label fade animations,
`queryRenderedFeatures`, GeoJSON and raster sources, pitch, terrain, globe, fill-extrusion, heatmap.
Symbol layers always draw above all other layers.

## Try it

```bash
pnpm install
pnpm build
pnpm demo
```

Then open `http://localhost:8080/` (client only; add `?renderer=main` or `?renderer=worker`),
`/ssr` (server-rendered, then hydrated) or `/static` (server output alone). The demo proxies and caches
tiles from OpenFreeMap. `pnpm test` runs the browser checks against a running demo server.

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
