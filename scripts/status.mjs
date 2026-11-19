// Writes the current test and MapLibre coverage figures into the README, between the status markers, and the same
// figures to docs/status.json, which the docs site can read. The package does not publish that file ("files" of
// package.json lists docs/*.md only).
// Run with: pnpm status   (run `pnpm build` first; `pnpm test:render` writes the totals of the render tests)
import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {sizesBlock, speedBlock, statusBlock} from './status-tables.mjs';

const root = new URL('..', import.meta.url).pathname;
const run = cmd => { try { return execSync(cmd, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); } catch (e) { return String(e.stdout ?? '') + String(e.stderr ?? ''); } };
const num = (text, re) => +(re.exec(text)?.[1] ?? NaN);

const unit = run('node --experimental-transform-types --no-warnings --test test/unit/*.test.ts');
const expr = run('node test/conformance/expressions.mjs');
const api = run('node test/conformance/api.mjs --write');
const spec = run('node test/conformance/spec.mjs');
const render = existsSync(root + 'test/conformance/render-result.json') ? JSON.parse(readFileSync(root + 'test/conformance/render-result.json', 'utf8')) : null;
// The sizes are the bytes that `pnpm test:size` prints (scripts/size-check.mjs), which has the hard line.
const bytes = (dir, files) => [...files].reduce((n, f) => n + gzipSync(readFileSync(root + dir + f)).length, 0);
// A page script is the file of the entry and the files that it imports when it loads (not the ones that it imports on demand).
const upFront = (file, seen = new Set()) => {
    if (seen.has(file)) return seen;
    seen.add(file);
    for (const m of readFileSync(root + 'dist/' + file, 'utf8').matchAll(/(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+)["']/g)) upFront(m[1], seen);
    return seen;
};
const page = bytes('dist/', upFront('map-jr-gl.js')), compat = bytes('dist/', upFront('map-jr-gl-maplibre-compat.js')), worker = bytes('dist/', ['map-jr-gl-worker.js']);
const ml = JSON.parse(readFileSync(root + 'node_modules/maplibre-gl/package.json', 'utf8')).version;
const mlPage = bytes('node_modules/maplibre-gl/dist/', ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl.css']), mlWorker = bytes('node_modules/maplibre-gl/dist/', ['maplibre-gl-worker.mjs']);

const exprPass = num(expr, /(\d+) pass/), exprAll = num(expr, /of (\d+)/);
// The results of the plugin tests are in docs/ecosystem.md (see test/conformance/plugins.mjs and ecosystem.mjs).
const eco = existsSync(root + 'docs/ecosystem.md') ? readFileSync(root + 'docs/ecosystem.md', 'utf8') : '';
const ran = /\*\*(\d+) of (\d+) scenarios pass/.exec(eco), audited = /\*\*(\d+) of (\d+) packages\*\*/.exec(eco), pages = /\*\*(\d+) of (\d+) pages work/.exec(eco);
const tests = {text: 'Tests against MapLibre GL JS', href: 'docs/development.md#tests-against-maplibre-gl-js'}, renderTests = {text: 'Render tests', href: 'docs/development.md#render-tests'};
// The speed section of the README: from the results of the workflow "Browsers" (the branch bench-results), which
// measures each push in three browsers on three systems, next to MapLibre GL JS.
const speed = (() => {
    const show = file => { try { return execSync(`git show origin/bench-results:${file}`, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1e8}); } catch { return null; } };
    try { execSync('git fetch -q origin +bench-results:refs/remotes/origin/bench-results', {cwd: root, stdio: 'ignore', timeout: 60000}); } catch { /* without a network, the results that are there are used */ }
    const systems = {darwin: 'macOS', linux: 'Linux', win32: 'Windows'}, browsers = {chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit'}, rows = [];
    let commit = '', date = '';
    for (const os in systems) for (const b in browsers) {
        const text = show(`${os}-${b}.json`), r = text && JSON.parse(text);
        // (The page of #29 has one entry for each scenario and library, with the median of each measure as a field.)
        const at = (scenario, lib) => r?.bench?.find(x => x.scenario === scenario && x.lib === lib);
        const renderer = r && (at('load', 'worker')?.load ? 'worker' : 'main');
        const pair = (scenario, field) => { const a = at(scenario, 'maplibre')?.[field], c = renderer && at(scenario, renderer)?.[field]; return a && c ? {maplibre: a, mapJr: c} : null; };
        const load = pair('load', 'load');
        if (!load) continue;
        if (r.date > date) { date = r.date; commit = r.commit; }
        rows.push({system: systems[os], browser: browsers[b], renderer, load, moving: pair('camera', 'panFps'), markers: pair('markers10000', 'panFps')});
    }
    return rows.length ? {date, commit, rows} : null;
})();
const jsonFile = root + 'docs/status.json', before = existsSync(jsonFile) ? JSON.parse(readFileSync(jsonFile, 'utf8')) : {};
const figures = {
    maplibre: ml,
    unitTests: {pass: num(unit, /# pass (\d+)/), fail: num(unit, /# fail (\d+)/)},
    // In bytes (gzip).
    sizes: [
        {file: 'Page script of `@map-jr/map-jr-gl`', bytes: page, maplibreBytes: mlPage},
        {file: 'Page script of `@map-jr/map-jr-gl/maplibre-compat`', bytes: compat, maplibreBytes: mlPage},
        {file: 'Worker file', bytes: worker, maplibreBytes: mlWorker},
        {file: 'Page script and worker file of `@map-jr/map-jr-gl`', bytes: page + worker, maplibreBytes: mlPage + mlWorker},
        {file: 'Page script and worker file of `@map-jr/map-jr-gl/maplibre-compat`', bytes: compat + worker, maplibreBytes: mlPage + mlWorker},
        {file: 'Hard line for the page script and the worker file', bytes: Math.floor((mlPage + mlWorker) / 3), maplibreBytes: mlPage + mlWorker},
        {file: 'Server renderer', bytes: bytes('dist/', upFront('server.js')), maplibreBytes: null},
    ],
    compatibility: [
        {area: 'MapLibre expression tests', passing: exprPass, total: exprAll, details: tests},
        {area: 'Methods of the MapLibre `Map` class', passing: num(api, /coverage: (\d+)/), total: num(api, /of (\d+) methods/), details: {text: 'Map methods', href: 'docs/maplibre-compatibility.md#map-methods'}},
        {area: 'Properties of the MapLibre style specification', passing: num(spec, /: (\d+) of/), total: num(spec, /of (\d+) properties/), details: tests},
        ...(ran ? [{area: 'MapLibre plugins, run in a browser', passing: +ran[1], total: +ran[2], details: {text: 'Plugins that were run', href: 'docs/ecosystem.md#plugins-that-were-run'}}] : []),
        ...(audited ? [{area: 'Plugins and frameworks, read from npm', passing: +audited[1], total: +audited[2], details: {text: 'Each package', href: 'docs/ecosystem.md#each-package'}}] : []),
        ...(pages ? [{area: 'Example pages of the MapLibre documentation', passing: +pages[1], total: +pages[2], details: {text: 'Example pages', href: 'docs/ecosystem.md#the-example-pages-of-maplibre-gl-js'}}] : []),
        // "near" includes the tests that are the same (see test/conformance/render-summary.mjs).
        ...(render ? [{area: 'MapLibre render tests, the same', passing: render.match, total: render.run, details: renderTests},
            {area: 'MapLibre render tests, the same or near', passing: render.near, total: render.run, details: renderTests}] : []),
    ],
    // The parts of the totals above that the tables of the README do not show.
    expressions: {wontfix: num(expr, /wontfix (\d+)/), later: num(expr, /later (\d+)/), fail: num(expr, /no label: (\d+)/)},
    mapMethods: {noEffect: num(api, /no effect: (\d+)/), internal: num(api, /not counted: (\d+)/)},
    styleProperties: {notRead: num(spec, /not read: (\d+)/), fewerExpressionInputs: num(spec, /fewer expression inputs: (\d+)/)},
    ...(render ? {renderTests: {differ: render.differ, differWontfix: render.differWontfix, differLater: render.differLater, skipped: render.skipped}} : {}),
    // Without a network, the speed of the run before stays.
    ...(speed ?? before.speed ? {speed: speed ?? before.speed} : {}),
};
writeFileSync(jsonFile, JSON.stringify(figures, null, 2) + '\n');
const file = root + 'README.md', block = statusBlock(figures);
let doc = readFileSync(file, 'utf8');
if (speed && /<!-- speed:start -->[\s\S]*<!-- speed:end -->/.test(doc)) doc = doc.replace(/<!-- speed:start -->[\s\S]*<!-- speed:end -->/, () => speedBlock(speed, ml));
if (!/<!-- status:start -->[\s\S]*<!-- status:end -->/.test(doc)) { console.error('README.md has no status markers'); process.exit(1); }
writeFileSync(file, doc.replace(/<!-- status:start -->[\s\S]*<!-- status:end -->/, () => block));
// The page of the user docs that is the home of the sizes and the speeds has the same figures.
const page = root + 'docs/guide/size-and-speed.md';
if (existsSync(page)) {
    let text = readFileSync(page, 'utf8').replace(/<!-- sizes:start -->[\s\S]*<!-- sizes:end -->/, () => sizesBlock(figures));
    if (figures.speed) text = text.replace(/<!-- speed:start -->[\s\S]*<!-- speed:end -->/, () => speedBlock(figures.speed, ml, {page: true}));
    writeFileSync(page, text);
}
console.log(block.split('\n').slice(3, -1).join('\n'));
