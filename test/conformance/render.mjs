// Runs MapLibre GL JS's render tests (a style and an expected image each) against this renderer and reports how many match.
// A full run writes the totals to render-result.json and the status of each test to render-tests.json. The labels for
// tests that differ by a decision are in render-expectations.json (see "Render tests" in docs/development.md).
//   node test/conformance/render.mjs [--filter=<regex>] [--limit=<n>] [--list] [--min=<pass count>] [--save=<dir>]
// The tests come from a checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js (cloned on first use, not vendored).
import {createRequire} from 'node:module';
import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromiumOptions} from '../launch.mjs';
import {ensureCheckout} from './maplibre-checkout.mjs';
import {summarize, readExpectations, report, changes, skipReason} from './render-summary.mjs';

const root = path.resolve(import.meta.dirname, '../..'), repo = ensureCheckout();
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const filter = arg('filter') ? new RegExp(arg('filter')) : null, limit = +(arg('limit') ?? Infinity), saveDir = arg('save');
const testsDir = path.join(repo, 'test/integration/render/tests'), assets = path.join(repo, 'test/integration/assets');

// Serves this library's build, the tests' assets (what their styles call local://) and the expected images.
const types = {'.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.pbf': 'application/x-protobuf', '.mvt': 'application/x-protobuf', '.geojson': 'application/json', '.html': 'text/html'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    const file = p.startsWith('/dist/') ? path.join(root, p) : p.startsWith('/fonts/') ? path.join(fontDir, p.slice(7)) : p.startsWith('/tests/') ? path.join(testsDir, p.slice(7)) : p === '/' ? null : path.join(assets, p);
    if (!file) { res.writeHead(200, {'content-type': 'text/html'}); return res.end('<body style="margin:0;background:#fff"><div id="map"></div>'); }
    // A style or a TileJSON file of the assets names MapLibre's test server (local:// or port 2900): it gets this server.
    try { let body = readFileSync(file); if (file.startsWith(assets) && file.endsWith('.json')) body = body.toString().replaceAll('local://', origin + '/').replaceAll('http://localhost:2900', origin); res.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'}); res.end(body); } catch { res.writeHead(p.includes('/sparse204/') ? 204 : 404, {'access-control-allow-origin': '*'}); res.end(); } // (204 for those tiles, as the test server of MapLibre answers)
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

// MapLibre's tests draw text from glyph files for Open Sans and Noto Sans. This renderer uses web fonts, so the same
// typefaces are fetched once and handed to each test's style; otherwise every test with a label would differ by font.
const fontDir = path.join(root, '.cache/fonts');
const fontFiles = {'open-sans.woff2': 'https://fonts.gstatic.com/s/opensans/v44/memvYaGs126MiZpBA-UvWbX2vVnXBbObj2OVTS-muw.woff2', 'noto-sans.woff2': 'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A-9a6VI.woff2'};
mkdirSync(fontDir, {recursive: true});
for (const [name, url] of Object.entries(fontFiles)) {
    if (existsSync(path.join(fontDir, name))) continue;
    try { execSync(`curl -sfL -o "${path.join(fontDir, name)}" "${url}"`); } catch { console.warn(`Could not fetch ${name}; text will be drawn in a fallback font`); }
}
const fontFaces = {};
if (existsSync(path.join(fontDir, 'open-sans.woff2'))) for (const n of ['Open Sans Semibold', 'Open Sans Bold', 'Open Sans Regular']) fontFaces[n] = `${origin}/fonts/open-sans.woff2`;
if (existsSync(path.join(fontDir, 'noto-sans.woff2'))) for (const n of ['Noto Sans Regular', 'Noto Sans Latin']) fontFaces[n] = `${origin}/fonts/noto-sans.woff2`;

const tests = [];
const walk = dir => {
    for (const name of readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        if (!statSync(p).isDirectory()) continue;
        if (existsSync(path.join(p, 'style.json'))) tests.push(path.relative(testsDir, p)); else walk(p);
    }
};
walk(testsDir);
const selected = tests.filter(t => !filter || filter.test(t)).slice(0, limit);

const {chromium} = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({...chromiumOptions(chromium), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const results = [];
async function worker(queue) {
    // One page for each pixel ratio: the page has the pixel ratio of the test, so that the screenshot has the pixels
    // of the expected image.
    const pages = new Map();
    const pageFor = async ratio => {
        if (pages.has(ratio)) return pages.get(ratio);
        const context = await browser.newContext({viewport: {width: 1024, height: 1024}, deviceScaleFactor: ratio});
        const page = await context.newPage();
        pages.set(ratio, page);
        await open(page);
        return page;
    };
    const open = async page => {
    if (process.env.RENDER_DEBUG) { page.on('response', r => { if (r.status() !== 200) console.log('HTTP', r.status(), r.url()); }); page.on('requestfailed', r => console.log('request failed', r.url(), r.failure()?.errorText)); page.on('console', m => console.log('console', m.text().slice(0, 300))); page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300))); }
    await page.goto(origin + '/');
    await page.addScriptTag({type: 'module', content: `import * as t from '/dist/map-jr-gl-maplibre-compat.js'; window.mapjr = t;`});
    await page.waitForFunction(() => window.mapjr);
    };
    for (let id; (id = queue.shift());) {
        const style = JSON.parse(readFileSync(path.join(testsDir, id, 'style.json'), 'utf8').replaceAll('local://', origin + '/')), meta = style.metadata?.test ?? {};
        style['font-faces'] = {...fontFaces, ...style['font-faces']};
        const width = meta.width ?? 512, height = meta.height ?? 512;
        // A test stays skipped when it has an operation that this run cannot do. The reason is the name of the operation.
        const why = skipReason(meta, name => { try { return readFileSync(path.join(assets, name), 'utf8'); } catch { return ''; } });
        if (why) { results.push({id, status: 'skipped', why}); continue; }
        // The time that the test waits by its own operations is added to the limit.
        const timeout = 8000 + (meta.operations ?? []).reduce((sum, o) => sum + ((o[0] === 'wait' || o[0] === 'sleep') && typeof o[1] === 'number' ? o[1] : 0), 0);
        try {
            const page = await pageFor(meta.pixelRatio ?? 1);
            const outcome = await page.evaluate(async ({style, width, height, meta, origin, fontFaces, timeout}) => {
                // A fresh container per test, so nothing left behind by the previous map can affect this one.
                window.map?.remove();
                document.body.innerHTML = '<div id="map"></div>';
                const el = document.getElementById('map');
                Object.assign(el.style, {width: width + 'px', height: height + 'px', position: 'relative'});
                const errors = [];
                const image = async url => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; await img.decode(); return img; };
                // The canvas of a canvas source (`addFakeCanvas`, `updateFakeCanvas`), drawn from an image as in MapLibre's harness.
                const paint = async (id, file) => {
                    const img = await image(`${origin}/${file}`), c = document.getElementById(id) ?? document.body.appendChild(Object.assign(document.createElement('canvas'), {id}));
                    Object.assign(c, {width: img.naturalWidth, height: img.naturalHeight});
                    c.getContext('2d').drawImage(img, 0, 0);
                };
                if (meta.addFakeCanvas) await paint(meta.addFakeCanvas.id, meta.addFakeCanvas.image);
                // MapLibre's harness counts the time of `wait` with a clock of its own. Here, after a `wait` of a number of
                // ms, `performance.now()` stays at that much later than the time when the operations before it ran, until
                // the next operation, so that a paint transition is drawn at that point of its course (#960).
                const clock = window.clock ??= (() => { const real = performance.now.bind(performance), c = {at: null}; performance.now = () => c.at ?? real(); return c; })();
                clock.at = null;
                const map = window.map = new window.mapjr.Map({container: el, style, renderer: 'main', attributionControl: false, interactive: false, tileWorkers: 1, ...(meta.maxPitch === undefined ? {} : {maxPitch: meta.maxPitch}), ...(meta.pixelRatio === undefined ? {} : {pixelRatio: meta.pixelRatio})});
                map.on('error', e => errors.push(String(e.error?.message ?? e.error)));
                let idle = false, at = '';
                map.on('idle', () => { idle = true; });
                const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                const sleep = ms => new Promise(r => setTimeout(r, ms));
                // MapLibre's harness draws without a stop and reads the pixels once the map has loaded. A video or canvas
                // source that plays keeps this map from `idle`, as it keeps MapLibre GL JS from it. So the run waits until
                // each such source has its methods and a picture, pauses it (a video at its first frame) and then waits for
                // `idle`. (`updateFakeCanvas` plays the canvas again.)
                const pictures = async () => {
                    for (const [id, src] of Object.entries(style.sources ?? {})) {
                        if (src.type !== 'video' && src.type !== 'canvas') continue;
                        let s;
                        while (!(s = map.getSource(id))?.pause) await frames();
                        if (src.type === 'video') {
                            const v = s.getVideo();
                            while (v.readyState < 2) await frames();
                            v.pause();
                            if (v.currentTime) { v.currentTime = 0; await new Promise(r => v.addEventListener('seeked', r, {once: true})); }
                        } else s.pause();
                    }
                };
                // The operations of the test, applied as the harness of MapLibre GL JS applies them (applyOperations in
                // test/integration/render/render.test.ts of that project). Two things are different. MapLibre's harness
                // draws without a stop (map.repaint) and reads the pixels at once; this run lets the map draw two frames
                // after the last operation. And a method that the map does not have is an error here, where MapLibre's
                // harness goes on to the next operation.
                const operate = async () => {
                    for (const op of meta.operations ?? []) {
                        at = ` in the operation ${op[0]}`;
                        const from = performance.now();
                        if (!(op[0] === 'wait' && op.length > 1)) clock.at = null;
                        if (op[0] === 'wait') {
                            if (op.length <= 1) while (!map.loaded()) await Promise.race([map.once('render'), map.once('idle')]); // (`idle` can come after the last frame, for example at the end of a paint transition)
                            else { await sleep(op[1]); clock.at = from + op[1]; map._render(); }
                        } else if (op[0] === 'idle') {
                            // MapLibre's harness waits for the next "idle" event, which its map fires when the harness stops
                            // the drawing without a stop. Here the wait ends also when the map fired the event after the last
                            // change, or when the map is loaded and still after two frames.
                            if (!idle) await Promise.race([map.once('idle'), frames().then(async () => { while (!map.loaded() || map.isMoving()) await frames(); })]);
                        } else if (op[0] === 'sleep') await sleep(op[1]);
                        else if (op[0] === 'updateFakeCanvas') {
                            // As in MapLibre's harness: a change while the source plays is drawn, a change after the pause is not.
                            idle = false;
                            map.getSource(op[1]).play();
                            await paint(meta.addFakeCanvas.id, op[2]);
                            await frames();
                            map.getSource(op[1]).pause();
                            await paint(meta.addFakeCanvas.id, op[3]);
                        } else {
                            idle = false;
                            if (op[0] === 'addImage') map.addImage(op[1], await image(`${origin}/${op[2]}`), op[3] || {});
                            else if (op[0] === 'setStyle') map.setStyle(typeof op[1] === 'object' && op[1] ? {...op[1], 'font-faces': {...fontFaces, ...op[1]['font-faces']}} : op[1], {localIdeographFontFamily: false});
                            else if (typeof map[op[0]] === 'function') map[op[0]](...op.slice(1));
                            else throw new Error(`map.${op[0]} is not a function`);
                        }
                    }
                    at = '';
                };
                await Promise.race([
                    (Object.values(style.sources ?? {}).some(s => s.type === 'video' || s.type === 'canvas') ? map.once('load').then(pictures).then(() => idle || map.once('idle')) : new Promise(r => map.once('idle', r))).then(operate).then(frames),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timed out' + at + (errors.length ? ': ' + errors[0] : ''))), timeout)),
                ]);
                return {errors, view: `zoom ${style.zoom} -> ${map.getZoom().toFixed(3)}, centre ${JSON.stringify(style.center)} -> ${map.getCenter().lng.toFixed(5)},${map.getCenter().lat.toFixed(5)}`};
            }, {style, width, height, meta, origin, fontFaces, timeout});
            if (process.env.RENDER_DEBUG) console.log(id, outcome.view);
            const shot = await page.screenshot({clip: {x: 0, y: 0, width, height}});
            const expected = readdirSync(path.join(testsDir, id)).filter(f => /^expected.*\.png$/.test(f));
            // Compare against each accepted image and keep the best: the fraction of pixels that differ noticeably.
            // The size of the comparison is the size of the expected image, which is the size of the test times its pixel ratio.
            const diff = await page.evaluate(async ({actual, urls}) => {
                const load = async src => { const img = new Image(); img.src = src; await img.decode(); return img; };
                const images = await Promise.all(urls.map(load)), width = images[0].naturalWidth, height = images[0].naturalHeight;
                const pixels = async src => { const img = typeof src === 'string' ? await load(src) : src; const c = new OffscreenCanvas(width, height).getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, width, height); c.drawImage(img, 0, 0, width, height); return c.getImageData(0, 0, width, height).data; };
                const a = await pixels('data:image/png;base64,' + actual);
                let best = 1;
                for (const u of images) {
                    const b = await pixels(u);
                    let bad = 0;
                    for (let i = 0; i < a.length; i += 4) {
                        // Perceptual (YIQ) colour distance, the measure pixelmatch uses, with its default-ish tolerance.
                        const dr = a[i] - b[i], dg = a[i + 1] - b[i + 1], db = a[i + 2] - b[i + 2];
                        const y = dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223, ii = dr * 0.59597799 - dg * 0.2741761 - db * 0.32180189, q = dr * 0.21147017 - dg * 0.52261711 + db * 0.31114694;
                        if (0.5053 * y * y + 0.299 * ii * ii + 0.1957 * q * q > 35215 * 0.1285 * 0.1285) bad++;
                    }
                    best = Math.min(best, bad / (a.length / 4));
                }
                return best;
            }, {actual: shot.toString('base64'), urls: expected.map(f => `${origin}/tests/${id.split("/").map(encodeURIComponent).join("/")}/${f}`)});
            results.push({id, status: diff <= 0.01 ? 'match' : diff <= 0.05 ? 'near' : 'differ', diff, errors: outcome.errors});
            if (saveDir) { mkdirSync(path.join(saveDir, id), {recursive: true}); writeFileSync(path.join(saveDir, id, 'actual.png'), shot); }
        } catch (err) {
            results.push({id, status: 'error', why: String(err.message).split('\n')[0].slice(0, 120)});
        }
    }
    for (const page of pages.values()) await page.context().close();
}
const queue = [...selected];
await Promise.all(Array.from({length: 4}, () => worker(queue)));
await browser.close();
server.close();
// The ids have "/" between their parts on each system, so that the tracked files are the same everywhere.
for (const r of results) r.id = r.id.split(path.sep).join('/');
const dir = path.join(root, 'test/conformance'), allIds = tests.map(t => t.split(path.sep).join('/'));
const summary = summarize(results, readExpectations(JSON.parse(readFileSync(path.join(dir, 'render-expectations.json'), 'utf8'))), allIds);
const lines = report(summary);
console.log(lines[0]);
const groups = {};
for (const r of results) { const g = groups[r.id.split('/')[0]] ??= {match: 0, near: 0, differ: 0, error: 0, skipped: 0}; g[r.status]++; }
console.log('By group (match/run): ' + Object.entries(groups).filter(([, g]) => g.match + g.near + g.differ + g.error).map(([name, g]) => `${name} ${g.match}/${g.match + g.near + g.differ + g.error}`).join(', '));
const reasons = {};
for (const r of results) if (r.status === 'skipped') reasons[r.why] = (reasons[r.why] ?? 0) + 1;
if (summary.totals.skipped) console.log('Skipped, by reason: ' + Object.entries(reasons).map(([why, n]) => `${why} ${n}`).join(', '));
for (const line of lines.slice(1)) console.log(line);
// The tests whose status is not the one in the tracked file. A test near a limit can change with the machine.
const perTest = path.join(dir, 'render-tests.json');
if (existsSync(perTest)) for (const line of changes(JSON.parse(readFileSync(perTest, 'utf8')), summary.tests)) console.log(line);
// A full run (no filter) records its totals, which the status table of the README is written from, and the status
// of each test. The second file has no percentages and is sorted by id, so that its diff shows the tests that changed.
// The files are written only from Playwright's own build of Chromium, which CI runs: another build draws some tests a
// little differently (text-local-glyphs/cjk is a match in the build of the cloud VM image and near in CI's, #1462).
const pinned = !chromiumOptions(chromium).executablePath;
if (!filter && limit === Infinity && !pinned) console.warn(`Not writing render-result.json and render-tests.json: this run used ${chromiumOptions(chromium).executablePath}, not the Chromium of Playwright that CI runs. Install it with \`pnpm exec playwright install chromium\` and run again.`);
if (!filter && limit === Infinity && pinned) {
    writeFileSync(path.join(dir, 'render-result.json'), JSON.stringify(summary.totals, null, 2) + '\n');
    writeFileSync(perTest, '{\n' + Object.entries(summary.tests).map(([id, status]) => `${JSON.stringify(id)}: ${JSON.stringify(status)}`).join(',\n') + '\n}\n');
}
if (process.argv.includes('--list')) for (const r of results.filter(r => r.status !== 'match' && r.status !== 'skipped')) console.log(`${r.status.padEnd(6)} ${r.id} ${r.diff !== undefined ? (r.diff * 100).toFixed(1) + '%' : r.why}${r.errors?.length ? ' [' + r.errors[0].slice(0, 80) + ']' : ''}`);
const min = +(arg('min') ?? 0);
if (summary.totals.match < min) { console.error(`FAIL: expected at least ${min} matching`); process.exit(1); }
