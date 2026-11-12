// Runs the in-browser benchmark (/bench) in a browser that is driven through WebDriver, and writes the results.
//   WD_URL=http://localhost:4444 WD_NAME=darwin-safari node test/bench/webdriver.mjs out-dir
// This is for browsers that Playwright cannot drive: Safari itself (safaridriver, on macOS and in the iOS Simulator),
// and the browsers of real phones on a device farm. The script speaks the W3C WebDriver protocol with `fetch`, so it
// needs no package. The workflow "Browsers" runs it; test/bench/browsers.mjs is the same for Playwright's browsers.
//
// Variables:
//   WD_URL       the WebDriver server (the default is http://localhost:4444)
//   WD_CAPS      the capabilities as JSON (the default is {"browserName":"safari"})
//   WD_NAME      the name of the result files (the default is the browser name that the server reports)
//   BENCH_BASE   where the demo server is (the default is http://localhost:8080). With BENCH_URL, the benchmark page
//                is opened there (for example the page of the gallery site), and the short checks are left out.
//   BENCH_SECONDS, BENCH_QUERY   the length of each animation, and more of the query of the benchmark page
import {mkdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = process.argv[2] ?? '.cache/bench';
const server = (process.env.WD_URL ?? 'http://localhost:4444').replace(/\/$/, '');
const caps = JSON.parse(process.env.WD_CAPS ?? '{"browserName":"safari"}');
const base = process.env.BENCH_BASE ?? 'http://localhost:8080';
const seconds = process.env.BENCH_SECONDS ?? 4, more = process.env.BENCH_QUERY ? '&' + process.env.BENCH_QUERY : '';
const benchURL = (process.env.BENCH_URL ?? `${base}/bench`) + `?auto&seconds=${seconds}${more}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, {recursive: true});

/** One command of the protocol. A failure of the browser is an error with the message of the server. */
async function wd(method, url, body) {
    const res = await fetch(server + url, {method, headers: {'content-type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.value?.error) throw new Error(`${method} ${url}: ${json.value?.message ?? json.value?.error ?? 'HTTP ' + res.status}`.split('\n')[0]);
    return json.value;
}

const session = await wd('POST', '/session', {capabilities: {alwaysMatch: caps}});
const id = session.sessionId, got = session.capabilities ?? {};
const name = process.env.WD_NAME ?? `${os.platform()}-${got.browserName ?? caps.browserName}`.toLowerCase().replace(/\s+/g, '-');
const run = (script, args = []) => wd('POST', `/session/${id}/execute/sync`, {script, args});
/** Waits until a script of the page gives a value that is not empty. */
async function until(script, ms, step = 1000) {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(step)) { const v = await run(script); if (v) return v; }
    throw new Error(`no result after ${Math.round(ms / 1000)} s: ${script}`);
}

const result = {name, os: `${got.platformName ?? ''} ${got['safari:platformVersion'] ?? got.platformVersion ?? ''}`.trim() || `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, browser: got.browserName ?? caps.browserName,
    version: got.browserVersion ?? '', device: got['safari:deviceName'] ?? got.deviceName ?? '', driver: caps, date: new Date().toISOString(), commit: process.env.GITHUB_SHA ?? '', checks: [], bench: [], errors: []};

// What the browser can do, asked on the page and in a worker. (Safari does not say which GPU it has, and some of its
// versions have no OffscreenCanvas, or only its 2D context, in a worker. The library chooses its renderer by this.)
const PROBE = `const done = arguments[arguments.length - 1], page = {
        offscreenCanvas: typeof OffscreenCanvas !== 'undefined', transfer: 'transferControlToOffscreen' in HTMLCanvasElement.prototype,
        webgl2: !!document.createElement('canvas').getContext('webgl2'), pixelRatio: devicePixelRatio, screen: screen.width + 'x' + screen.height, userAgent: navigator.userAgent};
    const code = 'const has = typeof OffscreenCanvas !== "undefined", get = kind => { try { return !!new OffscreenCanvas(1, 1).getContext(kind); } catch (e) { return String(e.message); } };' +
        'postMessage({offscreenCanvas: has, webgl2: has && get("webgl2"), context2d: has && get("2d"), createImageBitmap: typeof createImageBitmap !== "undefined"})';
    try {
        const w = new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'})));
        w.onmessage = e => done({page, worker: e.data});
        w.onerror = e => done({page, worker: {error: String(e.message)}});
        setTimeout(() => done({page, worker: {error: 'no answer from the worker'}}), 8000);
    } catch (e) { done({page, worker: {error: String(e.message)}}); }`;

try {
    await wd('POST', `/session/${id}/timeouts`, {script: 30000, pageLoad: 120000});
    // (Some drivers start with a small window. A phone ignores this.)
    await wd('POST', `/session/${id}/window/rect`, {width: 1100, height: 850}).catch(() => {});

    // 1. A short check in each renderer, on the demo server: the map loads, and with the renderer that was asked for or
    //    with the main thread where the browser cannot draw in a worker.
    if (!process.env.BENCH_URL) for (const mode of ['worker', 'main']) {
        const check = {mode, loaded: false, errors: []};
        try {
            await wd('POST', `/session/${id}/url`, {url: `${base}/?renderer=${mode}&nomarkers`});
            await until('return !!(window.map && window.map.loaded && window.map.loaded())', 90000);
            Object.assign(check, await run('const m = window.map, c = m.getCanvas(); return {loaded: true, renderer: m.renderer, zoom: +m.getZoom().toFixed(2), canvas: c.width + "x" + c.height}'));
        } catch (e) { check.error = e.message; }
        result.checks.push(check);
    }

    // 2. The benchmark page, and what the browser can do.
    await wd('POST', `/session/${id}/url`, {url: benchURL});
    result.probe = await wd('POST', `/session/${id}/execute/async`, {script: PROBE, args: []}).catch(e => ({error: e.message}));
    // (The page sets `benchResults` when it has finished. Each question to the browser also keeps a device farm from
    // closing a session that looks idle.)
    await until('return !!window.benchResults', 20 * 60000, 2000);
    result.env = await run('return document.getElementById("env").textContent');
    result.bench = await run('return window.benchResults');
    result.table = await run('return [...document.querySelectorAll("#results tr")].map(tr => [...tr.cells].map(c => c.textContent))');
} catch (e) { result.errors.push(e.message); }
await wd('DELETE', `/session/${id}`).catch(() => {});

writeFileSync(path.join(out, `${name}.json`), JSON.stringify(result, null, 1));
const rows = (result.table ?? []).filter(r => r.length > 1), p = result.probe ?? {}, yes = v => v === true ? 'yes' : v === false ? 'no' : String(v ?? 'unknown');
const md = [`### ${name} (${result.browser} ${result.version}${result.device ? ', ' + result.device : ''})`, '', `${result.os}, through WebDriver`, '', result.env ?? '', '',
    ...(p.page ? [`- On the page: OffscreenCanvas ${yes(p.page.offscreenCanvas)}, transferControlToOffscreen ${yes(p.page.transfer)}, WebGL2 ${yes(p.page.webgl2)}, pixel ratio ${p.page.pixelRatio}, screen ${p.page.screen}`,
        `- In a worker: ${p.worker?.error ? 'FAILED: ' + p.worker.error : `OffscreenCanvas ${yes(p.worker?.offscreenCanvas)}, WebGL2 context ${yes(p.worker?.webgl2)}, 2D context ${yes(p.worker?.context2d)}`}`] : p.error ? [`- The check of what the browser can do failed: ${p.error}`] : []),
    ...result.checks.map(c => `- ${c.mode}: ${c.error ? 'FAILED: ' + c.error : `loaded, renderer ${c.renderer}, canvas ${c.canvas}`}`), '',
    ...(rows.length ? [`| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map(r => `| ${r.join(' | ')} |`)] : ['(no benchmark results)']),
    ...(result.errors.length ? ['', 'Errors: ' + result.errors.join(' | ')] : []), ''].join('\n');
writeFileSync(path.join(out, `${name}.md`), md);
console.log(md);
// (A run with no benchmark results is a failure for the caller, which records it.)
process.exit(rows.length ? 0 : 1);
