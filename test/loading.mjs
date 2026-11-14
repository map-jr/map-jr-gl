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

const port = process.env.PORT || 8080; // (the demo server; PORT lets two runs use two servers)
const base = `http://localhost:${port}/?nomarkers&nocontrols&nofonts`;
await load('default: small entry, worker found beside it, no main-thread engine downloaded', base, {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-worker.js'], not: ['map-jr-gl-engine-entry.js', 'map-jr-gl-maplibre-compat-standalone.js']}});
await load('renderer "main": the engine chunk is fetched on demand', base + '&renderer=main', {expect: {renderer: 'main', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-engine-entry.js', 'map-jr-gl-worker.js']}});
await load('standalone: one file, nothing else requested', base + '&standalone', {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat-standalone.js'], not: ['map-jr-gl-worker.js', 'map-jr-gl-maplibre-compat.js']}});
await load('served from another origin (as from a CDN): worker starts through a same-origin stub', base + `&from=http://127.0.0.1:${port}`, {expect: {renderer: 'worker', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-worker.js']}});
await load('worker file missing: falls back to the main thread and explains', base, {block: '**/map-jr-gl-worker.js', expect: {renderer: 'main', files: ['map-jr-gl-maplibre-compat.js', 'map-jr-gl-engine-entry.js'], warns: 'Workers are unavailable'}});

// Start-up in parallel: the map asks for the worker file while the style is still on its way, not after its answer.
// With the main renderer, the engine chunk is asked for at the same time too (#325).
for (const [what, file, query] of [['the worker file', /map-jr-gl-worker\.js/, ''], ['renderer "main": the engine chunk', /map-jr-gl-engine-entry-[\w-]{8}\.js/, '&renderer=main']]) {
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    let fileAsked = 0, styleAsked = 0, styleAnswered = 0;
    page.on('request', r => { if (file.test(r.url())) fileAsked ||= Date.now(); });
    await page.route(u => /style[^/]*\.json/.test(u.pathname) || /\/styles\//.test(u.pathname), async r => {
        styleAsked ||= Date.now();
        await new Promise(res => setTimeout(res, 700));
        styleAnswered ||= Date.now();
        r.continue().catch(() => {});
    });
    await page.goto(base + query);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    check(`start-up: ${what} is asked for before the style has answered`, ok && !!styleAsked && !!fileAsked && fileAsked < styleAnswered, `loaded=${ok} asked ${fileAsked - styleAsked} ms after the style was asked; the style answered after ${styleAnswered - styleAsked} ms`);
    await page.close();
}

// The worker file is requested once, although the tile workers and the engine worker all start from it (#325).
for (const [what, query] of [['same origin', ''], ['another origin', `&from=http://127.0.0.1:${port}`]]) {
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    let asked = 0;
    page.on('request', r => { if (/map-jr-gl-worker\.js/.test(r.url())) asked++; });
    await page.goto(base + query);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    const renderer = ok ? await page.evaluate(() => window.map.renderer) : 'did not load';
    check(`start-up (${what}): the worker file is requested once`, ok && renderer === 'worker' && asked === 1, `renderer=${renderer} requests=${asked}`);
    await page.close();
}
// A policy without blob: workers: the first blob worker fails, and the other workers start from the URL (#325).
// (The demo server sends no-store, so each of the 3 workers requests the file, plus the one fetch for the blob.)
{
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    let asked = 0, blocked = 0;
    page.on('request', r => { if (/map-jr-gl-worker\.js$/.test(r.url())) asked++; });
    page.on('console', m => { if (m.type() === 'error' && /blob:/.test(m.text())) blocked++; });
    await page.route(u => u.pathname === '/', async r => {
        const res = await r.fetch();
        await r.fulfill({response: res, headers: {...res.headers(), 'content-security-policy': "worker-src 'self'"}});
    });
    await page.goto(base);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    const renderer = ok ? await page.evaluate(() => window.map.renderer) : 'did not load';
    check('start-up under worker-src \'self\': one blocked blob worker at most, and one request more than the workers', ok && renderer === 'worker' && asked <= 4 && blocked <= 1, `renderer=${renderer} requests=${asked} errors=${blocked}`);
    await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
