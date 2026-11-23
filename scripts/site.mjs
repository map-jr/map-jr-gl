// Builds what the tests and the docs site need into site-dist/: the harness page of the examples (examples/), the
// benchmark page (bench/, which the docs site publishes at https://map-jr.org/bench/), and the picture of the server
// renderer (ssr.jpg). Run after the library is built: pnpm site
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {execSync} from 'node:child_process';
import {cpSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {Renderer} from '@takumi-rs/core';
import {renderToImage} from '../dist/server.js';
import makeStyle from '../demo/style.mjs';
import {markers, images, view, asSpec} from '../demo/markers.mjs';
import {shield} from '../demo/shields.mjs';
import {alias, examplesAsFunctions, svelteExamples} from './examples-plugins.mjs';

// The picture of the server renderer (pnpm screenshots copies it into docs/images/) is made here, at build time, with no browser involved.
// Each request (the TileJSON, and the tiles, sprites and glyphs of the renders) is tried three times, 2 s apart: the
// server sometimes resets a connection, and one reset must not fail CI. A 4xx answer is returned as it is.
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
async function fetchRetry(url, init, tries = 3) {
    for (let i = 1; ; i++) {
        try {
            const res = await fetch(url, init);
            if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
            return res;
        } catch (e) {
            const why = e.cause?.message ?? e.message, name = url?.url ?? url;
            if (i >= tries) throw new Error(`[site] could not fetch ${name} after ${tries} tries: ${why}`);
            console.warn(`[site] fetch ${name} failed (${why}); try ${i + 1} of ${tries} in 2 s`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
async function fetchJSON(url) {
    const res = await fetchRetry(url);
    if (!res.ok) throw new Error(`[site] could not fetch ${url}: HTTP ${res.status}`);
    return res.json();
}
const tileJSON = await fetchJSON(TILEJSON_URL);
const style = makeStyle(tileJSON.tiles[0], '');
// overrides: false: the picture shows the complete style, as a live map draws it.
const options = {style, ...view, width: 800, height: 520, resolveImage: shield, images, ...asSpec(markers), overrides: false, fetch: fetchRetry};
mkdirSync(new URL('../site-dist', import.meta.url), {recursive: true});
const {image} = await renderToImage({...options, rasteriser: new Renderer(), pixelRatio: 2});
// A map of 1600 x 1040 pixels with its tiles is about 330 KB; a picture under 50 KB has lost its tiles or its layers.
if (image.length < 50_000) throw new Error(`[site] the server picture has ${image.length} bytes, fewer than the 50,000 of a map with its tiles. Check the style and the tiles of ${TILEJSON_URL}.`);
writeFileSync(new URL('../site-dist/ssr.jpg', import.meta.url), image);
console.log(`server picture: JPEG ${(image.length / 1024).toFixed(0)} KB`);

// The harness page (examples/run.html?id=&form=) runs one form of one example, into site-dist/examples/.
// (fileURLToPath: a URL's pathname is not a path on Windows.)
await build({configFile: false, root: fileURLToPath(new URL('../examples', import.meta.url)), base: './', resolve: {alias}, plugins: [examplesAsFunctions, svelteExamples], logLevel: 'warn',
    build: {outDir: fileURLToPath(new URL('../site-dist/examples', import.meta.url)), emptyOutDir: true, target: 'es2022', rollupOptions: {input: fileURLToPath(new URL('../examples/run.html', import.meta.url))}}});

// The benchmark page (demo/bench.html), at bench/: a phone or a device farm can open it with no
// server of the project. It needs the built library, MapLibre GL JS and three files of the demo next to it.
const at = p => fileURLToPath(new URL(p, import.meta.url)), bench = at('../site-dist/bench/');
mkdirSync(bench + 'demo', {recursive: true});
mkdirSync(bench + 'ml', {recursive: true});
cpSync(at('../demo/bench.html'), bench + 'index.html');
for (const f of ['bench.mjs', 'markers.mjs', 'tile-report.mjs', 'start-timeline.mjs']) cpSync(at('../demo/' + f), bench + 'demo/' + f);
cpSync(at('../dist'), bench + 'dist', {recursive: true, filter: src => !/[\\/]types([\\/]|$)/.test(src)});
for (const f of readdirSync(at('../node_modules/maplibre-gl/dist'))) if (/^maplibre-gl(-shared|-worker)?\.mjs$|\.css$/.test(f)) cpSync(at('../node_modules/maplibre-gl/dist/' + f), bench + 'ml/' + f);
// (The commit that the copied results of the page name.)
try { writeFileSync(bench + 'commit.txt', process.env.GITHUB_SHA || execSync('git rev-parse HEAD', {encoding: 'utf8'}).trim()); } catch { /* without git, the page says "commit unknown" */ }
console.log('built site-dist/: the harness page in examples/, the benchmark page in bench/');
