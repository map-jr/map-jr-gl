// Checks every supported way of loading the library in a real browser: node test/loading.mjs (demo server running)
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

async function load(name, url, {expect, block} = {}) {
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    const requested = [], warnings = [];
    page.on('request', r => { if (/tessera/.test(r.url())) requested.push(r.url().split('/').pop().replace(/-[\w-]{8}\.js$/, '.js')); });
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
await load('default: small entry, worker found beside it, no main-thread engine downloaded', base, {expect: {renderer: 'worker', files: ['tessera.js', 'tessera-worker.js'], not: ['tessera-engine-entry.js', 'tessera-standalone.js']}});
await load('renderer "main": the engine chunk is fetched on demand', base + '&renderer=main', {expect: {renderer: 'main', files: ['tessera.js', 'tessera-engine-entry.js', 'tessera-worker.js']}});
await load('standalone: one file, nothing else requested', base + '&standalone', {expect: {renderer: 'worker', files: ['tessera-standalone.js'], not: ['tessera-worker.js', 'tessera.js']}});
await load('served from another origin (as from a CDN): worker starts through a same-origin stub', base + '&from=http://127.0.0.1:8080', {expect: {renderer: 'worker', files: ['tessera.js', 'tessera-worker.js']}});
await load('worker file missing: falls back to the main thread and explains', base, {block: '**/tessera-worker.js', expect: {renderer: 'main', files: ['tessera.js', 'tessera-engine-entry.js'], warns: 'Workers are unavailable'}});
await browser.close();
process.exit(failed ? 1 : 0);
