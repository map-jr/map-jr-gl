// Builds the gallery site into site-dist/ (what GitHub Pages serves). Run after the library is built: pnpm site
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {cpSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {Renderer} from '@takumi-rs/core';
import {renderToSVG, renderToImage} from '../dist/server.js';
import makeStyle from '../demo/style.mjs';
import {markers, images, view} from '../demo/markers.mjs';
import {shield} from '../demo/shields.mjs';

// The "server rendering" row shows pictures made here, at build time, with no browser involved.
const tileJSON = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const style = makeStyle(tileJSON.tiles[0], '');
// ssrOverrides: false: the row compares the server renders with a live map, so the server uses the complete style.
// (A page that shows a server render only until the live map is ready keeps the simpler render, which is smaller.)
const options = {style, ...view, width: 800, height: 520, resolveImage: shield, images, markers: [markers], ssrOverrides: false};
mkdirSync(new URL('../site/public', import.meta.url), {recursive: true});
// inlineImages: the picture is shown through <img>, where an SVG may not fetch anything else (its icon sheet, here).
const {svg} = await renderToSVG({...options, inlineImages: true});
writeFileSync(new URL('../site/public/ssr.svg', import.meta.url), svg);
const {image} = await renderToImage({...options, rasteriser: new Renderer(), pixelRatio: 2});
writeFileSync(new URL('../site/public/ssr.jpg', import.meta.url), image);
console.log(`server pictures: SVG ${(svg.length / 1024).toFixed(0)} KB, JPEG ${(image.length / 1024).toFixed(0)} KB`);

await build({configFile: fileURLToPath(new URL('../site/vite.config.mjs', import.meta.url)), logLevel: 'warn'}); // (fileURLToPath: a URL's pathname is not a path on Windows)

// The benchmark page (demo/bench.html) is part of the site, at bench/: a phone or a device farm can open it with no
// server of the project. It needs the built library, MapLibre GL JS and two files of the demo next to it.
const at = p => fileURLToPath(new URL(p, import.meta.url)), bench = at('../site-dist/bench/');
mkdirSync(bench + 'demo', {recursive: true});
mkdirSync(bench + 'ml', {recursive: true});
cpSync(at('../demo/bench.html'), bench + 'index.html');
for (const f of ['bench.mjs', 'markers.mjs']) cpSync(at('../demo/' + f), bench + 'demo/' + f);
cpSync(at('../dist'), bench + 'dist', {recursive: true, filter: src => !/[\\/]types([\\/]|$)/.test(src)});
for (const f of readdirSync(at('../node_modules/maplibre-gl/dist'))) if (/^maplibre-gl(-shared|-worker)?\.mjs$|\.css$/.test(f)) cpSync(at('../node_modules/maplibre-gl/dist/' + f), bench + 'ml/' + f);
console.log('site built in site-dist/ (with the benchmark page in site-dist/bench/)');
