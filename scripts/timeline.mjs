// Timeline of the start of a map on the benchmark page (#371): MapLibre GL JS against this library, with both
// renderers, in Chromium. Every request waits LATENCY ms (100 by default) before its answer, as on a phone network.
// Answers from other hosts come from a cache on disk (.cache/timeline), so that runs compare the same bytes.
//
//   PORT=8127 node demo/serve.mjs &   # the demo server serves the page, the library and MapLibre GL JS
//   PORT=8127 node scripts/timeline.mjs [runs=10] [--only=maplibre,main,worker,main@18127,worker@18127]
//
// It prints, for each scenario, the median and the range of each step in ms after the map was made (as `load` on
// the benchmark page, the style is already an object then). The steps come from the network (worker script, TileJSON,
// sprite, glyphs, tiles) and from the map's own events (`render` for the first frame, `load`, `idle`).
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from '../test/launch.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = +(process.env.PORT || 8080), base = `http://localhost:${port}`;
const LATENCY = +(process.env.LATENCY ?? 100);
// CPU=4 slows the page's CPU four times (Chromium's CPU throttling, as in its developer tools), as on a phone.
const CPU = +(process.env.CPU ?? 1);
const runs = +(process.argv.find(a => /^\d+$/.test(a)) ?? 10);
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const cacheDir = path.join(root, '.cache/timeline');
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// The page: the scenario of `run` in demo/bench.mjs, up to `idle`.
const page = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/ml/maplibre-gl.css">
<div id="stage" style="width:1000px;height:700px;position:relative"></div>
<script type="module">
const q = new URLSearchParams(location.search), lib = q.get('lib');
const mod = lib === 'maplibre' ? await import('/ml/maplibre-gl.mjs') : await import('/dist/map-jr-gl-maplibre-compat.js');
if (lib === 'maplibre') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
const scriptAt = performance.timeOrigin + performance.now();
const style = await (await fetch(${JSON.stringify(STYLE)})).json();
delete style.terrain; delete style.sky;
const el = document.getElementById('stage');
const view = {center: [-74.0065, 40.7085], zoom: 14.3};
const t0 = performance.timeOrigin + performance.now(), at = () => performance.timeOrigin + performance.now();
const ev = window.ev = {t0, scriptAt};
const map = lib === 'maplibre' ? new mod.Map({container: el, style, ...view, attributionControl: false})
    : new mod.Map({container: el, style, ...view, renderer: lib, attributionControl: false});
map.once('render', () => ev.frame = at());
map.once('load', () => ev.load = at());
map.once('idle', () => { ev.idle = at(); });
</script>`;

async function cached(url) {
    const file = path.join(cacheDir, createHash('sha1').update(url).digest('hex'));
    try { return {meta: JSON.parse(await readFile(file + '.json', 'utf8')), body: await readFile(file)}; } catch {}
    const res = await fetch(url);
    const body = Buffer.from(await res.arrayBuffer());
    const meta = {status: res.status, type: res.headers.get('content-type') || 'application/octet-stream'};
    await mkdir(cacheDir, {recursive: true});
    await writeFile(file, body); await writeFile(file + '.json', JSON.stringify(meta));
    return {meta, body};
}

const TILE = /\.pbf/, GLYPH = /\/fonts\//;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch();

async function once(spec) {
    // ("main@18127": the main renderer of the library that a demo server on port 18127 serves, e.g. a build of main.)
    const [lib, other] = spec.split('@'), origin = other ? `http://localhost:${other}` : base;
    const context = await browser.newContext({viewport: {width: 1100, height: 800}});
    // (Requests of workers go through the context, so that they wait as well.)
    await context.route('**/*', async route => {
        const url = route.request().url();
        await sleep(LATENCY);
        if (url.startsWith(origin + '/timeline')) return route.fulfill({status: 200, contentType: 'text/html', body: page});
        if (url.startsWith(origin)) return route.continue();
        try {
            const {meta, body} = await cached(url);
            return route.fulfill({status: meta.status, contentType: meta.type, body, headers: {'access-control-allow-origin': '*'}});
        } catch { return route.abort(); }
    });
    const reqs = [];
    const note = (kind) => r => reqs.push({kind, url: r.url(), at: Date.now()});
    context.on('request', note('req'));
    context.on('requestfinished', note('done'));
    const p = await context.newPage();
    if (CPU > 1) await (await context.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', {rate: CPU});
    p.on('pageerror', e => console.error(lib, e.message));
    await p.goto(`${origin}/timeline?lib=${lib}`);
    await p.waitForFunction(() => window.ev?.idle, null, {timeout: 60000, polling: 50});
    const ev = await p.evaluate(() => window.ev);
    await context.close();
    // (Date.now() in node and timeOrigin + now() in the page are both wall-clock times, within a millisecond or two.)
    const t = x => x === undefined ? NaN : x - ev.t0;
    const first = (kind, re) => t(reqs.find(r => r.kind === kind && re.test(r.url) && !(re === TILE && GLYPH.test(r.url)) && r.at >= ev.t0 - 5)?.at);
    const lastBefore = (kind, re) => t(reqs.filter(r => r.kind === kind && re.test(r.url) && !(re === TILE && GLYPH.test(r.url)) && r.at <= ev.idle).at(-1)?.at);
    const tiles = reqs.filter(r => r.kind === 'req' && TILE.test(r.url) && !GLYPH.test(r.url) && r.at >= ev.t0 && r.at <= ev.idle).length;
    return {
        'worker script answered': first('done', /worker/),
        'TileJSON answered': first('done', /openfreemap\.org\/planet/),
        'first tile requested': first('req', TILE),
        'first tile answered': first('done', TILE),
        'last tile answered before idle': lastBefore('done', TILE),
        'sprite requested': first('req', /sprite.*\.json/),
        'sprite answered': first('done', /sprite.*\.png/),
        'first glyphs requested': first('req', GLYPH),
        'last glyphs answered before idle': lastBefore('done', GLYPH),
        'first frame (render)': t(ev.frame),
        'load': t(ev.load),
        'idle': t(ev.idle),
        'tile requests before idle': tiles,
    };
}

const median = a => { const s = a.filter(x => !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const libs = only ? only.split(',') : ['maplibre', 'main', 'worker'];
// Warm the cache (and the demo server) once, untimed.
for (const lib of libs) await once(lib);
const results = Object.fromEntries(libs.map(l => [l, []]));
for (let i = 0; i < runs; i++) for (const lib of libs) results[lib].push(await once(lib));
await browser.close();

console.log(`Chromium (software WebGL), ${LATENCY} ms per request, CPU ×${CPU}, ${runs} runs; ms after the map was made: median (min–max)`);
const keys = Object.keys(results[libs[0]][0]);
const f = v => Number.isNaN(v) ? '–' : v.toFixed(0);
console.log(`| Step | ${libs.join(' | ')} |\n|---|${libs.map(() => '---').join('|')}|`);
for (const k of keys) {
    console.log(`| ${k} | ${libs.map(l => { const v = results[l].map(r => r[k]).filter(x => !Number.isNaN(x)); return v.length ? `${f(median(v))} (${f(Math.min(...v))}–${f(Math.max(...v))})` : '–'; }).join(' | ')} |`);
}
