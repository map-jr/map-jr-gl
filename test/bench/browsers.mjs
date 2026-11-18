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

// 2. The benchmark page: every scenario, for this library and MapLibre GL JS.
// (Where the map did not load at all, for example a browser without WebGL, the benchmark would only wait for its time limit.)
if (!result.checks.some(c => c.loaded)) result.errors.push('bench: not run, because the map did not load');
else try {
    // (The page runs each scenario once. The machines of the workflow share their GPU with others, and one measurement
    // can be far off, so the page runs again, up to BENCH_RUNS times (3), while another run, as long as the longest so
    // far, still ends within BENCH_BUDGET_MIN minutes (15) of the first start. The job has a limit of 55 minutes: setup
    // takes up to 4, the checks 1, and the behaviour tests after this script up to 25 (run 44352973623, #947), so about
    // 10 are left in the worst case. One run takes 5 to 7.5 minutes on the machines of the workflow, so they get two runs.
    // A run that does not end by then is stopped, and the rows that its page has are kept. The medians are over all the runs.)
    const budget = +(process.env.BENCH_BUDGET_MIN ?? 15) * 60000, most = +(process.env.BENCH_RUNS ?? 3), t0 = Date.now(), lists = [];
    let page, longest = 0, partial = null;
    do {
        await page?.close();
        page = await browser.newPage({viewport: {width: 1000, height: 700}});
        page.on('pageerror', e => result.errors.push(e.message));
        const start = Date.now();
        await page.goto(`${base}/bench?auto&seconds=${process.env.BENCH_SECONDS ?? 4}&runs=1`);
        try {
            await page.waitForFunction(() => window.benchResults, null, {timeout: Math.max(60000, t0 + budget - Date.now()), polling: 1000});
        } catch (e) {
            result.errors.push(`bench: run ${lists.length + 1} of the page did not end within ${budget / 60000} min; the page says: ${await page.textContent('#status').catch(() => '?')}`);
            if (!lists.length) partial = await page.$$eval('#results tr', trs => trs.map(tr => [...tr.cells].map(c => c.textContent)));
            break;
        }
        lists.push(await page.evaluate(() => window.benchResults));
        longest = Math.max(longest, Date.now() - start);
    } while (lists.length < most && Date.now() + longest - t0 < budget);
    result.env = await page.textContent('#env');
    if (lists.length) Object.assign(result, await page.evaluate(lists => window.benchMerge(lists), lists));
    else result.table = partial;
    result.runs = lists.length; result.minutes = +((Date.now() - t0) / 60000).toFixed(1);
    console.log(`bench: ${lists.length} runs of the page in ${result.minutes} min`);
    await page.close();
} catch (e) { result.errors.push('bench: ' + String(e.message).split('\n')[0]); }
await browser.close();

writeFileSync(path.join(out, `${name}.json`), JSON.stringify(result, null, 1));
const rows = (result.table ?? []).filter(r => r.length > 1);
const md = [`### ${name} (${result.browser} ${result.version})`, '', `${result.os}, ${result.cpu ?? ''}`, '', result.env ?? '', '', ...(result.runs ? [`Runs of the page: ${result.runs} in ${result.minutes} min.`, ''] : []),
    ...result.checks.map(c => `- ${c.mode}: ${c.error ? 'FAILED: ' + c.error : `loaded, renderer ${c.renderer}, ${c.features} features at the centre, terrain ${c.terrain ? 'on' : 'off'} (centre ${c.elevation} m)`}${c.errors.length ? ' — errors: ' + c.errors.join(' | ') : ''}`), '',
    ...(rows.length ? [`| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map(r => `| ${r.join(' | ')} |`)] : ['(no benchmark results)']),
    ...(result.errors.length ? ['', 'Errors: ' + result.errors.join(' | ')] : []), ''].join('\n');
writeFileSync(path.join(out, `${name}.md`), md);
console.log(md);
