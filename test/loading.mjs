// Checks every supported way of loading the library in a real browser: node test/loading.mjs (demo server running)
import {launch} from './launch.mjs';
const browser = await launch();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

async function load(name, url, {expect, block} = {}) {
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    const requested = [], warnings = [];
    page.on('request', r => { if (/map-jr-gl/.test(r.url())) requested.push(r.url().split('/').pop().replace(/-[\w-]{8}\.js$/, '.js')); });
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    if (block) await page.route(block, r => r.abort());
    await page.goto(url);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    const renderer = ok ? await page.evaluate(() => window.map.renderer) : 'did not load';
    const files = [...new Set(requested)].sort();
    check(name, ok && renderer === expect.renderer && expect.files.every(f => files.includes(f)) && !(expect.not ?? []).some(f => files.includes(f)) && (!expect.warns || warnings.some(w => w.includes(expect.warns))),
        `renderer=${renderer} files=${files.join(', ')}${warnings.length ? ' warnings=' + warnings.length : ''}`);
    await page.close();
}

const base = 'http://localhost:8080/?nomarkers&nocontrols&nofonts';
await load('default: small entry, worker found beside it, no main-thread engine downloaded', base, {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-worker.js'], not: ['map-jr-gl-engine-entry.js', 'map-jr-gl-maplibre-compat-standalone.js']}});
await load('renderer "main": the engine chunk is fetched on demand', base + '&renderer=main', {expect: {renderer: 'main', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-engine-entry.js', 'map-jr-gl-worker.js']}});
await load('standalone: one file, nothing else requested', base + '&standalone', {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat-standalone.js'], not: ['map-jr-gl-worker.js', 'map-jr-gl-maplibre-compat.js']}});
await load('served from another origin (as from a CDN): worker starts through a same-origin stub', base + '&from=http://127.0.0.1:8080', {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-worker.js']}});
await load('worker file missing: falls back to the main thread and explains', base, {block: '**/map-jr-gl-worker.js', expect: {renderer: 'main', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-engine-entry.js'], warns: 'Workers are unavailable'}});

// Start-up in parallel: the map asks for the worker file while the style is still on its way, not after its answer.
{
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    let workerAsked = 0, styleAsked = 0, styleAnswered = 0;
    page.on('request', r => { if (/map-jr-gl-worker\.js/.test(r.url())) workerAsked ||= Date.now(); });
    await page.route(u => /style[^/]*\.json/.test(u.pathname) || /\/styles\//.test(u.pathname), async r => {
        styleAsked ||= Date.now();
        await new Promise(res => setTimeout(res, 700));
        styleAnswered ||= Date.now();
        r.continue().catch(() => {});
    });
    await page.goto(base);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    check('start-up: the worker file is asked for before the style has answered', ok && !!styleAsked && !!workerAsked && workerAsked < styleAnswered, `loaded=${ok} worker asked ${workerAsked - styleAsked} ms after the style was asked; the style answered after ${styleAnswered - styleAsked} ms`);
    await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
