// Checks every supported way of loading the library in a real browser: node test/loading.mjs (demo server running)
import {existsSync, readFileSync as readFile} from 'node:fs';
import path from 'node:path';
import {buildElementPages} from './consumer/build-element.mjs';
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

// Vite in development serves the development build from its dependency cache, which has no worker file (#387).
{
    const page = await browser.newPage(), warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route('**/node_modules/.vite/deps/**', r => /worker/.test(r.request().url()) ? r.abort() : r.continue({url: r.request().url().replace('/node_modules/.vite/deps/', '/dist/')}));
    await page.goto(`http://localhost:${port}/style.json`);
    await page.evaluate(async () => {
        const {Map} = await import('/node_modules/.vite/deps/map-jr-gl-maplibre-compat.dev.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
        new Map({container: el, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
        await new Promise(r => setTimeout(r, 3000));
    });
    check('Vite dependency cache without the worker file: the warning names optimizeDeps', warnings.some(w => w.includes("Vite's dependency cache") && w.includes('optimizeDeps')), warnings.join(' | '));
    await page.close();
}

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
// The chunks of the page script load in one round: the entry names every chunk that it needs at start, also those that
// it reaches through another chunk, so the browser asks for all of them before any of them has answered (#325).
{
    const page = await browser.newPage({viewport: {width: 800, height: 500}});
    const asked = {}, answered = {};
    await page.route(/map-jr-gl-(?!worker|engine-entry)[\w-]+-[\w-]{8}\.js$/, async r => {
        const name = r.request().url().split('/').pop();
        asked[name] ??= Date.now();
        await new Promise(res => setTimeout(res, 400));
        answered[name] ??= Date.now();
        r.continue().catch(() => {});
    });
    await page.goto(base);
    const ok = await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).then(() => true, () => false);
    const names = Object.keys(asked), last = Math.max(...Object.values(asked)), first = Math.min(...Object.values(answered));
    check('start-up: the chunks of the page script are asked for in one round', ok && names.length > 1 && last < first, `loaded=${ok} chunks=${names.map(n => n.replace(/-[\w-]{8}\.js$/, '')).join(', ')}; the last was asked ${last - first} ms after the first answer`);
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
// A policy without blob: workers: each blob worker fails and starts from the URL (#325).
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
    check('start-up under worker-src \'self\': one error at most per start-up worker, and one request more than the workers', ok && renderer === 'worker' && asked <= 4 && blocked <= 3, `renderer=${renderer} requests=${asked} errors=${blocked}`);
    await page.close();
}
// A blob URL of a worker is never revoked while a worker still loads it, and a map made after the revoke starts (#782).
// The page shortens the 10 s timers to 0 ms and records each blob URL that is revoked before its worker answered.
{
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        const st = window.setTimeout, W = window.Worker, revoke = URL.revokeObjectURL, loading = new Map();
        window.setTimeout = (f, ms, ...a) => st(f, ms === 10000 ? 0 : ms, ...a);
        window.early = [];
        window.Worker = class extends W {
            constructor(u, o) {
                super(u, o);
                const k = String(u);
                if (!k.startsWith('blob:')) return;
                loading.set(k, (loading.get(k) ?? 0) + 1);
                let once = false; const done = () => { if (!once) { once = true; loading.set(k, loading.get(k) - 1); } };
                this.addEventListener('message', done); this.addEventListener('error', done);
            }
        };
        URL.revokeObjectURL = u => { if (loading.get(u) > 0) window.early.push(u); revoke.call(URL, u); };
    });
    await page.goto(`http://localhost:${port}/style.json`);
    const result = await page.evaluate(async () => {
        const {Map} = await import('/dist/map-jr-gl-maplibre-compat.js');
        const make = () => new Promise(res => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
            const m = new Map({container: el, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            m.on('load', () => res(m.renderer)); setTimeout(() => res('no load'), 20000);
        });
        const first = await make();
        await new Promise(r => setTimeout(r, 200));
        return {first, second: await make(), early: window.early.length};
    });
    check('worker blob URL: not revoked while a worker loads it, and a map made after the revoke starts', result.first === 'worker' && result.second === 'worker' && !result.early && !errors.length, `${JSON.stringify(result)} errors=${errors.join(' | ')}`);
    await page.close();
}
// The .js and .compat.js forms of the examples run as they are written: each is the module script of a bare page with
// <div id="map"> and an import map, and reaches idle with no page error (#1156). The route appends only
// `window.map = map` so that the test can read the map.
{
    const {readdirSync, readFileSync} = await import('node:fs');
    const imports = {'@map-jr/map-jr-gl': '/dist/map-jr-gl.js', '@map-jr/map-jr-gl/maplibre-compat': '/dist/map-jr-gl-maplibre-compat.js', '@map-jr/map-jr-gl/controls': '/dist/controls.js'};
    for (const file of readdirSync(new URL('../examples/', import.meta.url)).filter(f => f.endsWith('.js')).sort()) {
        const page = await browser.newPage({viewport: {width: 800, height: 600}}), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route(`**/example-page/${file}`, r => r.fulfill({contentType: 'text/javascript', body: readFileSync(new URL(`../examples/${file}`, import.meta.url), 'utf8') + '\nwindow.map = map;\n'}));
        await page.route('**/example-page/', r => r.fulfill({contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><script type="importmap">${JSON.stringify({imports})}</script><div id="map" style="height: 500px"></div><script type="module" src="./${file}"></script>`}));
        await page.goto(`http://localhost:${port}/example-page/`);
        const compat = file.endsWith('.compat.js');
        const ok = await page.waitForFunction(compat => window.map && (compat ? window.map.loaded() : window.map.state.get().idle), compat, {timeout: 30000}).then(() => true, () => false);
        check(`example ${file} runs as written on a bare page and reaches idle`, ok && !errors.length, `idle=${ok} errors=${errors.join(' | ')}`);
        await page.close();
    }
}
// The <map-jr> forms (.html) and the Svelte forms (.svelte) of the examples run too, and reach idle with no page error
// (#1115). A <map-jr> form is the page itself, with an import map put after its <meta charset>. A Svelte form is
// compiled with svelte/compiler and bundled with esbuild into a page that mounts it in <body>; its imports of the
// entry go to examples/harness/svelte.js, which keeps the map that the action makes. The Vue, Nuxt and React forms
// are only compiled (test/examples.mjs): running them needs an application of each framework.
{
    const {readdirSync, readFileSync} = await import('node:fs');
    const {build} = await import('esbuild'), {compile} = await import('svelte/compiler');
    const root = path.resolve(import.meta.dirname, '..'), dir = path.join(root, 'examples');
    const imports = {'@map-jr/map-jr-gl': '/dist/map-jr-gl.js', '@map-jr/map-jr-gl/controls': '/dist/controls.js', '@map-jr/map-jr-gl/element': '/dist/element.js', '@map-jr/map-jr-gl/svelte': '/dist/svelte.js'};
    const importMap = `<script type="importmap">${JSON.stringify({imports})}</script>`, shim = path.join(dir, 'harness/svelte.js');
    const svelte = {
        name: 'svelte-examples',
        setup(b) {
            b.onResolve({filter: /^@map-jr\/map-jr-gl\/svelte$/}, args => args.importer.endsWith('.svelte') ? {path: shim} : {path: args.path, external: true});
            b.onResolve({filter: /^@map-jr\//}, args => ({path: args.path, external: true}));
            b.onLoad({filter: /\.svelte$/}, args => ({contents: compile(readFileSync(args.path, 'utf8'), {filename: args.path, generate: 'client', css: 'injected'}).js.code, loader: 'js', resolveDir: path.dirname(args.path)}));
        },
    };
    const files = readdirSync(dir).filter(f => (f.endsWith('.html') && f !== 'run.html') || f.endsWith('.svelte')).sort();
    for (const file of files) {
        let body;
        if (file.endsWith('.html')) body = readFileSync(path.join(dir, file), 'utf8').replace('<meta charset="utf-8">', m => m + importMap);
        else {
            const entry = `import {mount, flushSync} from 'svelte'; import App from ${JSON.stringify(path.join(dir, file))}; import {made} from ${JSON.stringify(shim)};\nmount(App, {target: document.body}); flushSync(); window.map = made[0];`;
            const result = await build({stdin: {contents: entry, resolveDir: root, loader: 'js'}, bundle: true, format: 'esm', write: false, plugins: [svelte], logLevel: 'silent'});
            body = `<!doctype html><meta charset="utf-8">${importMap}<script type="module">${result.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`;
        }
        const page = await browser.newPage({viewport: {width: 800, height: 600}}), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/example-page/', r => r.fulfill({contentType: 'text/html', body}));
        await page.goto(`http://localhost:${port}/example-page/`);
        const ok = await page.waitForFunction(() => (window.map ?? document.querySelector('map-jr')?.map)?.state.get().idle, null, {timeout: 30000}).then(() => true, () => false);
        // The line of text below the map, where the example has one, says what the map does.
        const text = await page.evaluate(() => document.querySelector('p')?.textContent ?? 'none');
        check(`example ${file} runs as written and reaches idle`, ok && !errors.length && text.trim() !== '', `idle=${ok} text="${text}" errors=${errors.join(' | ')}`);
        if (file === 'color-scheme.html') {
            // The scheme that the button sets stays when the element sends its next description.
            await page.click('button[aria-label="Use dark colors"]');
            const dark = await page.waitForFunction(() => document.querySelector('.map-jr-dark'), null, {timeout: 5000}).then(() => true, () => false);
            await page.evaluate(() => { document.querySelector('map-jr').attribution = {compact: false}; });
            await page.waitForTimeout(500);
            const stays = await page.evaluate(() => !!document.querySelector('.map-jr-dark'));
            check('example color-scheme.html: the dark scheme of the button stays after another property changes', dark && stays, `dark=${dark} stays=${stays}`);
        }
        await page.close();
    }
}
// A page that only imports `@map-jr/map-jr-gl/element`, built with esbuild and with Vite against the built package,
// defines <map-jr> in the browser (#1256; `pnpm test:package` runs the same builds in Node against the tarball).
{
    const root = path.resolve(import.meta.dirname, '..');
    const dirs = await buildElementPages(root, path.join(root, '.cache/loading-element'));
    for (const [name, dir] of Object.entries(dirs)) {
        const page = await browser.newPage();
        await page.route(`**/element-page-${name}/**`, r => {
            const file = path.join(dir, new URL(r.request().url()).pathname.split(`/element-page-${name}/`)[1] || 'element.html');
            if (!file.startsWith(dir) || !existsSync(file)) return r.fulfill({status: 404});
            return r.fulfill({contentType: file.endsWith('.html') ? 'text/html' : 'text/javascript', body: readFile(file)});
        });
        await page.goto(`http://localhost:${port}/element-page-${name}/element.html`);
        const defined = await page.evaluate(() => Promise.race([customElements.whenDefined('map-jr').then(() => true), new Promise(r => setTimeout(() => r(false), 5000))]));
        check(`element: a page that only imports @map-jr/map-jr-gl/element, built with ${name}, defines <map-jr>`, defined);
        await page.close();
    }
}
await browser.close();
process.exit(failed ? 1 : 0);
