// Runs MapLibre GL JS's render tests (a style and an expected image each) against this renderer and reports how many match.
//   node test/conformance/render.mjs [--filter=<regex>] [--limit=<n>] [--list] [--min=<pass count>] [--save=<dir>]
// The tests come from a checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js (cloned on first use, not vendored).
import {createRequire} from 'node:module';
import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..'), repo = path.join(root, '.cache/maplibre-gl-js');
if (!existsSync(repo)) execSync(`git clone --depth 1 -q https://github.com/maplibre/maplibre-gl-js.git "${repo}"`, {stdio: 'inherit'});
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const filter = arg('filter') ? new RegExp(arg('filter')) : null, limit = +(arg('limit') ?? Infinity), saveDir = arg('save');
const testsDir = path.join(repo, 'test/integration/render/tests'), assets = path.join(repo, 'test/integration/assets');

// Serves this library's build, the tests' assets (what their styles call local://) and the expected images.
const types = {'.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.pbf': 'application/x-protobuf', '.mvt': 'application/x-protobuf', '.geojson': 'application/json', '.html': 'text/html'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    const file = p.startsWith('/dist/') ? path.join(root, p) : p.startsWith('/fonts/') ? path.join(fontDir, p.slice(7)) : p.startsWith('/tests/') ? path.join(testsDir, p.slice(7)) : p === '/' ? null : path.join(assets, p);
    if (!file) { res.writeHead(200, {'content-type': 'text/html'}); return res.end('<body style="margin:0;background:#fff"><div id="map"></div>'); }
    try { const body = readFileSync(file); res.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*'}); res.end(body); } catch { res.writeHead(p.includes('/sparse204/') ? 204 : 404, {'access-control-allow-origin': '*'}); res.end(); } // (204 for those tiles, as the test server of MapLibre answers)
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
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const results = [];
async function worker(queue) {
    const context = await browser.newContext({viewport: {width: 1024, height: 1024}});
    const page = await context.newPage();
    if (process.env.RENDER_DEBUG) { page.on('response', r => { if (r.status() !== 200) console.log('HTTP', r.status(), r.url()); }); page.on('requestfailed', r => console.log('request failed', r.url(), r.failure()?.errorText)); page.on('console', m => console.log('console', m.text().slice(0, 300))); page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300))); }
    await page.goto(origin + '/');
    await page.addScriptTag({type: 'module', content: `import * as t from '/dist/map-jr-gl.js'; window.mapjr = t;`});
    await page.waitForFunction(() => window.mapjr);
    for (let id; (id = queue.shift());) {
        const style = JSON.parse(readFileSync(path.join(testsDir, id, 'style.json'), 'utf8').replaceAll('local://', origin + '/')), meta = style.metadata?.test ?? {};
        style['font-faces'] = {...fontFaces, ...style['font-faces']};
        const width = meta.width ?? 512, height = meta.height ?? 512;
        // Tests that script the map (setStyle, panning, waiting on events...) need MapLibre's test harness operations; only plain renders are run.
        const ops = (meta.operations ?? []).filter(o => o[0] !== 'wait');
        if (ops.length || (meta.pixelRatio ?? 1) !== 1) { results.push({id, status: 'skipped', why: ops.length ? 'scripted: ' + ops[0][0] : 'pixel ratio'}); continue; }
        try {
            const outcome = await page.evaluate(async ({style, width, height}) => {
                // A fresh container per test, so nothing left behind by the previous map can affect this one.
                window.map?.remove();
                document.body.innerHTML = '<div id="map"></div>';
                const el = document.getElementById('map');
                Object.assign(el.style, {width: width + 'px', height: height + 'px', position: 'relative'});
                const errors = [];
                const map = window.map = new window.mapjr.Map({container: el, style, renderer: 'main', attributionControl: false, interactive: false, tileWorkers: 1});
                map.on('error', e => errors.push(String(e.error?.message ?? e.error)));
                await Promise.race([new Promise(r => map.once('idle', r)), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out' + (errors.length ? ': ' + errors[0] : ''))), 8000))]);
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                return {errors, view: `zoom ${style.zoom} -> ${map.getZoom().toFixed(3)}, centre ${JSON.stringify(style.center)} -> ${map.getCenter().lng.toFixed(5)},${map.getCenter().lat.toFixed(5)}`};
            }, {style, width, height});
            if (process.env.RENDER_DEBUG) console.log(id, outcome.view);
            const shot = await page.screenshot({clip: {x: 0, y: 0, width, height}});
            const expected = readdirSync(path.join(testsDir, id)).filter(f => /^expected.*\.png$/.test(f));
            // Compare against each accepted image and keep the best: the fraction of pixels that differ noticeably.
            const diff = await page.evaluate(async ({actual, urls, width, height}) => {
                const pixels = async src => { const img = new Image(); img.src = src; await img.decode(); const c = new OffscreenCanvas(width, height).getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, width, height); c.drawImage(img, 0, 0, width, height); return c.getImageData(0, 0, width, height).data; };
                const a = await pixels('data:image/png;base64,' + actual);
                let best = 1;
                for (const u of urls) {
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
            }, {actual: shot.toString('base64'), urls: expected.map(f => `${origin}/tests/${id.split("/").map(encodeURIComponent).join("/")}/${f}`), width, height});
            results.push({id, status: diff <= 0.01 ? 'pass' : diff <= 0.05 ? 'close' : 'fail', diff, errors: outcome.errors});
            if (saveDir) { mkdirSync(path.join(saveDir, id), {recursive: true}); writeFileSync(path.join(saveDir, id, 'actual.png'), shot); }
        } catch (err) {
            results.push({id, status: 'error', why: String(err.message).split('\n')[0].slice(0, 120)});
        }
    }
    await context.close();
}
const queue = [...selected];
await Promise.all(Array.from({length: 4}, () => worker(queue)));
await browser.close();
server.close();
// A full run (no filter) records its totals, which the README's status block is written from.
if (!filter && limit === Infinity) {
    const n = st => results.filter(r => r.status === st).length;
    writeFileSync(path.join(root, 'test/conformance/render-result.json'), JSON.stringify({match: n('pass'), close: n('close'), differ: n('fail'), errored: n('error'), skipped: n('skipped'), run: results.length - n('skipped')}, null, 2) + '\n');
}

const count = s => results.filter(r => r.status === s).length, ran = results.length - count('skipped');
console.log(`MapLibre render tests: ${count('pass')} match (within 1% of pixels), ${count('close')} close (within 5%), ${count('fail')} differ, ${count('error')} errored, of ${ran} run; ${count('skipped')} skipped (scripted or high-density)`);
const groups = {};
for (const r of results) { const g = groups[r.id.split(path.sep)[0]] ??= {pass: 0, close: 0, fail: 0, error: 0, skipped: 0}; g[r.status]++; }
console.log('By group (match/run): ' + Object.entries(groups).filter(([, g]) => g.pass + g.close + g.fail + g.error).map(([name, g]) => `${name} ${g.pass}/${g.pass + g.close + g.fail + g.error}`).join(', '));
if (process.argv.includes('--list')) for (const r of results.filter(r => r.status !== 'pass' && r.status !== 'skipped')) console.log(`${r.status.padEnd(6)} ${r.id} ${r.diff !== undefined ? (r.diff * 100).toFixed(1) + '%' : r.why}${r.errors?.length ? ' [' + r.errors[0].slice(0, 80) + ']' : ''}`);
const min = +(arg('min') ?? 0);
if (count('pass') < min) { console.error(`FAIL: expected at least ${min} matching`); process.exit(1); }
