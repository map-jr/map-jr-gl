// Builds the gallery site into site-dist/ (what GitHub Pages serves). Run after the library is built: pnpm site
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {Renderer} from '@takumi-rs/core';
import {renderToSVG, renderToImage} from '../dist/server.js';
import makeStyle from '../demo/style.mjs';
import {markers, view} from '../demo/markers.mjs';
import {shield} from '../demo/shields.mjs';

// The "server rendering" row shows pictures made here, at build time, with no browser involved.
const tileJSON = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const style = makeStyle(tileJSON.tiles[0], '');
const options = {style, ...view, width: 800, height: 520, resolveImage: shield, markers: [markers]};
mkdirSync(new URL('../site/public', import.meta.url), {recursive: true});
// inlineImages: the picture is shown through <img>, where an SVG may not fetch anything else (its icon sheet, here).
const {svg} = await renderToSVG({...options, inlineImages: true});
writeFileSync(new URL('../site/public/ssr.svg', import.meta.url), svg);
const {image} = await renderToImage({...options, rasteriser: new Renderer(), pixelRatio: 2});
writeFileSync(new URL('../site/public/ssr.jpg', import.meta.url), image);
console.log(`server pictures: SVG ${(svg.length / 1024).toFixed(0)} KB, JPEG ${(image.length / 1024).toFixed(0)} KB`);

await build({configFile: fileURLToPath(new URL('../site/vite.config.mjs', import.meta.url)), logLevel: 'warn'}); // (fileURLToPath: a URL's pathname is not a path on Windows)
console.log('site built in site-dist/');
