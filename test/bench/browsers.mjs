// Runs the in-browser benchmark (/bench) and a short check of the map in one browser, and writes the results.
//   BROWSER=webkit node test/bench/browsers.mjs out-dir     (needs the demo server: pnpm demo)
// The GitHub workflow "Browsers" runs this on Linux, macOS and Windows for Chromium, Firefox and WebKit, so the
// library is measured on machines and browsers that the development machine does not have.
import {mkdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {browserName, launch} from '../launch.mjs';

const out = process.argv[2] ?? '.cache/bench', name = `${os.platform()}-${browserName}`;
const base = process.env.BENCH_BASE ?? 'http://localhost:8080';
mkdirSync(out, {recursive: true});
const result = {name, os: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, browser: browserName, date: new Date().toISOString(), commit: process.env.GITHUB_SHA ?? '', checks: [], bench: [], errors: []};
const browser = await launch();
result.version = browser.version();

// 1. A short check in each renderer: the map loads, draws something, moves, and answers a query.
for (const mode of ['worker', 'main']) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const check = {mode, loaded: false};
    try {
        await page.goto(`${base}/?renderer=${mode}&nomarkers`);
        await page.waitForFunction(() => window.map?.loaded?.(), null, {timeout: 90000});
        Object.assign(check, await page.evaluate(async () => {
            const m = window.map, wait = ms => new Promise(r => setTimeout(r, ms));
            const t0 = performance.now();
            m.easeTo({zoom: m.getZoom() + 1, bearing: 30, duration: 800});
            await wait(1200);
            await new Promise(r => { if (m.areTilesLoaded()) r(); else m.once('idle', r); setTimeout(r, 20000); });
            const features = await m.queryRenderedFeatures(m.project(m.getCenter()));
            m.setTerrain?.({source: 'dem', exaggeration: 1.5}); m.easeTo({pitch: 55, duration: 500});
            await wait(4000);
            return {loaded: true, renderer: m.renderer, zoom: +m.getZoom().toFixed(2), features: features.length, terrain: !!m.getTerrain(), elevation: Math.round(m.getCenterElevation?.() ?? NaN), ms: Math.round(performance.now() - t0)};
        }));
        // Is anything drawn? A screenshot that is one flat colour means that the canvas is empty.
        const png = await page.screenshot({path: path.join(out, `${name}-${mode}.png`)});
        check.screenshotBytes = png.length;
    } catch (e) { check.error = String(e.message).split('\n')[0]; }
    check.errors = errors.slice(0, 5);
    result.checks.push(check);
    await page.close();
}

// 2. The benchmark page: this library and MapLibre GL JS, with and without 3D terrain, and markers.
// (Where the map did not load at all, for example a browser without WebGL, the benchmark would only wait for its time limit.)
if (!result.checks.some(c => c.loaded)) result.errors.push('bench: not run, because the map did not load');
else try {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    page.on('pageerror', e => result.errors.push(e.message));
    await page.goto(`${base}/bench?auto&seconds=${process.env.BENCH_SECONDS ?? 4}`);
    await page.waitForFunction(() => window.benchResults, null, {timeout: 15 * 60000, polling: 1000});
    result.env = await page.textContent('#env');
    result.bench = await page.evaluate(() => window.benchResults);
    result.table = await page.evaluate(() => [...document.querySelectorAll('#results tr')].map(tr => [...tr.cells].map(c => c.textContent)));
    await page.close();
} catch (e) { result.errors.push('bench: ' + String(e.message).split('\n')[0]); }
await browser.close();

writeFileSync(path.join(out, `${name}.json`), JSON.stringify(result, null, 1));
const rows = (result.table ?? []).filter(r => r.length > 1);
const md = [`### ${name} (${result.browser} ${result.version})`, '', `${result.os}, ${result.cpu ?? ''}`, '', result.env ?? '', '',
    ...result.checks.map(c => `- ${c.mode}: ${c.error ? 'FAILED: ' + c.error : `loaded, renderer ${c.renderer}, ${c.features} features at the centre, terrain ${c.terrain ? 'on' : 'off'} (centre ${c.elevation} m)`}${c.errors.length ? ' — errors: ' + c.errors.join(' | ') : ''}`), '',
    ...(rows.length ? [`| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map(r => `| ${r.join(' | ')} |`)] : ['(no benchmark results)']),
    ...(result.errors.length ? ['', 'Errors: ' + result.errors.join(' | ')] : []), ''].join('\n');
writeFileSync(path.join(out, `${name}.md`), md);
console.log(md);
