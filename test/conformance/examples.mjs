// Runs the example pages of MapLibre GL JS (the pages of its documentation) two times: with MapLibre GL JS, and with
// this library in its place. For each page it records the errors and how much the two images differ.
//   node test/conformance/examples.mjs [out-dir] [--filter=<regex of the page name without .html>] [--write]      (--write puts the results in docs/ecosystem.md)
//   --again uses the images and errors of the last run (to write the results again without a browser).
//   --renderer=main gives each map of this library `renderer: 'main'` (custom layers need it); --write is then ignored.
// The pages come from the checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js, which the tool clones when it is
// missing. The comparison needs python3 with Pillow; the tool checks for it before it takes any page.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {launch} from '../launch.mjs';
import {examplesBlock} from './report.mjs';
import {ensureCheckout} from './maplibre-checkout.mjs';

const root = path.resolve(import.meta.dirname, '../..'), pages = path.join(ensureCheckout(), 'test/examples');
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(root, '.cache/examples');
const filter = new RegExp(process.argv.find(a => a.startsWith('--filter='))?.slice(9) ?? '');
const renderer = process.argv.find(a => a.startsWith('--renderer='))?.slice(11);
if (!process.argv.includes('--again')) {
    try { execFileSync('python3', ['-c', 'import PIL'], {stdio: 'ignore'}); } catch {
        console.error('[map-jr-gl] examples.mjs compares the images with python3 and Pillow, and python3 cannot import PIL. Install Pillow (python3 -m venv <dir> && <dir>/bin/pip install Pillow, then put <dir>/bin first on PATH) and run again.');
        process.exit(1);
    }
}
mkdirSync(out, {recursive: true});

// One server for the two variants of each page. A page imports `../../dist/maplibre-gl-dev.mjs`; that import goes to
// MapLibre GL JS (with its worker) or to this library. The style sheet of MapLibre is left out for this library,
// which brings its own styles.
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    const send = (body, type) => { res.writeHead(200, {'content-type': type, 'access-control-allow-origin': '*'}); res.end(body); };
    try {
        const page = /^\/(maplibre|mapjr)\/test\/examples\/([\w-]+\.html)$/.exec(p);
        if (page) {
            let html = readFileSync(path.join(pages, page[2]), 'utf8');
            if (page[1] === 'mapjr') html = html.replace(/<link[^>]*maplibre-gl\.css[^>]*>/g, '');
            return send(html, 'text/html');
        }
        // (The map of the page is kept in `window.shownMap`, so that the runner can wait until it has loaded.)
        const keep = (lib, options = 'options') => `import * as lib from '${lib}';\nexport * from '${lib}';\nexport class Map extends lib.Map { constructor(options) { super(${options}); window.shownMap = this; } }\n`;
        if (p === '/maplibre/dist/maplibre-gl-dev.mjs') return send(keep('/ml/maplibre-gl.mjs') + `lib.setWorkerUrl('/ml/maplibre-gl-worker.mjs');`, 'text/javascript');
        if (p === '/mapjr/dist/maplibre-gl-dev.mjs') return send(keep('/dist/map-jr-gl-maplibre-compat.js', renderer ? `{renderer: '${renderer}', ...options}` : undefined) + `export {default} from '/dist/map-jr-gl-maplibre-compat.js';`, 'text/javascript');
        const file = p.startsWith('/ml/') ? path.join(root, 'node_modules/maplibre-gl/dist', p.slice(4)) : p.startsWith('/dist/') ? path.join(root, p)
            : /^\/(maplibre|mapjr)\/dist\/maplibre-gl\.css$/.test(p) ? path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.css')
            : path.join(root, '.cache/maplibre-gl-js', p.replace(/^\/(maplibre|mapjr)\//, '')); // other files of the repository that a page uses
        send(readFileSync(file), types[path.extname(file)] ?? 'application/octet-stream');
    } catch { res.writeHead(404, {'access-control-allow-origin': '*'}); res.end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

const names = readdirSync(pages).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5)).filter(n => filter.test(n)); // the filter sees the name without ".html"
const again = process.argv.includes('--again');
const browser = again ? null : await launch(), rows = again ? JSON.parse(readFileSync(path.join(out, 'result.json'), 'utf8')) : [], queue = again ? [] : [...names];
/** Loads one variant of a page, waits until the network is quiet and the map has had time to draw, and takes an image. */
async function shoot(context, name, variant) {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) errors.push(m.text().split('\n')[0]); });
    const file = path.join(out, `${name}-${variant}.png`);
    try {
        // A page that asks random.org for numbers (add-live-realtime-data) gets the same numbers in both runs, so that
        // both images show the same place (#669).
        await page.route(/^https:\/\/(www\.)?random\.org\//, r => r.fulfill({status: 200, contentType: 'text/plain', headers: {'access-control-allow-origin': '*'}, body: '0.3141592654\n0.2718281828'}));
        await page.goto(`${origin}/${variant}/test/examples/${name}.html`, {waitUntil: 'load', timeout: 30000});
        await page.waitForLoadState('networkidle', {timeout: 15000}).catch(() => {});
        // The map has loaded, all its tiles are there and it does not move. (A page that animates the map never gets
        // there: its image is taken after the time limit.)
        await page.waitForFunction(() => { const m = window.shownMap; return m && m.loaded() && m.areTilesLoaded() && !m.isMoving(); }, null, {timeout: 20000, polling: 250}).catch(() => {});
        await page.waitForTimeout(2500);
        await page.screenshot({path: file});
    } catch (e) { errors.push('the page did not load: ' + String(e.message).split('\n')[0]); }
    await page.close();
    return {file: existsSync(file) ? file : null, errors: [...new Set(errors)]};
}
if (browser) await Promise.all(Array.from({length: 2}, async () => {
    const context = await browser.newContext({viewport: {width: 800, height: 500}});
    for (let name; (name = queue.shift());) {
        const theirs = await shoot(context, name, 'maplibre'), ours = await shoot(context, name, 'mapjr');
        rows.push({name, theirs, ours});
    }
    await context.close();
}));
await browser?.close();
server.close();

// The share of pixels that differ clearly between the two images of a page.
const py = `
import sys, json
from PIL import Image, ImageChops
out = []
for i in range(1, len(sys.argv), 2):
    try:
        a = Image.open(sys.argv[i]).convert('RGB'); b = Image.open(sys.argv[i + 1]).convert('RGB')
        d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 40 else 0)
        out.append(round(100 * sum(1 for v in d.getdata() if v) / (a.size[0] * a.size[1]), 1))
    except Exception: out.append(None)
print(json.dumps(out))`;
const both = rows.filter(r => r.theirs.file && r.ours.file);
const diffs = JSON.parse(execFileSync('python3', ['-W', 'ignore', '-c', py, ...both.flatMap(r => [r.theirs.file, r.ours.file])], {encoding: 'utf8'}));
both.forEach((r, i) => { r.diff = diffs[i]; });
rows.sort((a, b) => a.name < b.name ? -1 : 1);
// A page works when this library gives no error that MapLibre does not give, and the images are near to each other.
const LIMIT = 12;
for (const r of rows) {
    // (The two libraries word the same error differently, so the numbers of errors are compared, not their texts.)
    r.newErrors = r.ours.errors.length > r.theirs.errors.length ? r.ours.errors.filter(e => !r.theirs.errors.includes(e)) : [];
    r.state = r.theirs.errors.length && !r.theirs.file ? 'not run' : r.newErrors.length ? 'error' : r.diff === undefined || r.diff === null ? 'no image' : r.diff > LIMIT ? 'differs' : 'works';
}
writeFileSync(path.join(out, 'result.json'), JSON.stringify(rows, null, 1));
const count = s => rows.filter(r => r.state === s).length;
console.log(`${rows.length} example pages: ${count('works')} work, ${count('differs')} draw a different image, ${count('error')} give an error, ${count('no image') + count('not run')} were not compared`);
for (const r of rows.filter(r => r.state !== 'works')) console.log(`${r.state.padEnd(8)} ${r.name} ${r.diff ?? ''}${r.diff !== undefined ? '% ' : ''}${r.newErrors[0]?.slice(0, 140) ?? ''}`);

if (process.argv.includes('--write') && !process.argv.some(a => a.startsWith('--filter=')) && !renderer) {
    const file = path.join(root, 'docs/ecosystem.md'), doc = readFileSync(file, 'utf8'), block = examplesBlock(rows, LIMIT);
    writeFileSync(file, doc.includes('<!-- examples:start -->') ? doc.replace(/<!-- examples:start -->[\s\S]*<!-- examples:end -->/, block) : doc.replace('## What is missing most often', block + '\n\n## What is missing most often'));
}
