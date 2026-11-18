// Runs Maputnik, the style editor, with this library and with MapLibre GL JS, and compares the two.
//   node test/conformance/maputnik.mjs [--write] [--no-suite]   (--write puts the results in docs/ecosystem.md)
// It uses the fork map-jr/maputnik (branch map-jr-main), whose preview renders with the compat entry of this library;
// MAPUTNIK_RENDERER=maplibre builds the same editor with MapLibre GL JS. The fork is cloned into .cache/maputnik and
// gets the local build of this library (run `pnpm build` first). Each build runs Maputnik's own end-to-end tests
// (about 4 minutes; --no-suite skips them) and the scenarios below, which test what those tests do not.
// Maputnik's tests open http://localhost:8888, so that port must be free.
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {launch} from '../launch.mjs';

const root = path.resolve(import.meta.dirname, '../..'), dir = path.join(root, '.cache/maputnik');
const REPO = 'https://github.com/map-jr/maputnik', BRANCH = 'map-jr-main', PORT = 8888, BASE = `http://localhost:${PORT}/maputnik/`;
const STYLES = 'https://raw.githubusercontent.com/map-jr/map-jr-styles/main/dist/styles/';
const suite = !process.argv.includes('--no-suite');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, {cwd: dir, stdio: 'inherit', ...opts});

if (!existsSync(path.join(root, 'dist/map-jr-gl-maplibre-compat.js'))) throw new Error('dist/ has no build: run `pnpm build` first.');
if (await fetch(`http://localhost:${PORT}/`).then(() => true, () => false)) throw new Error(`Port ${PORT} is in use. Maputnik's tests need it: stop the server on it.`);

// The fork, at the head of its branch, with its dependencies. npm ci runs again only when the lockfile changes.
if (!existsSync(dir)) execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', BRANCH, REPO, dir], {stdio: 'inherit'});
else { run('git', ['fetch', '--quiet', '--depth', '1', 'origin', BRANCH]); run('git', ['reset', '--quiet', '--hard', 'FETCH_HEAD']); }
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {cwd: dir, encoding: 'utf8'}).trim();
const lockHash = createHash('sha256').update(readFileSync(path.join(dir, 'package-lock.json'))).digest('hex'), stamp = path.join(dir, 'node_modules/.lock-hash');
if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== lockHash) { run('npm', ['ci', '--no-audit', '--no-fund']); writeFileSync(stamp, lockHash); }
const version = name => JSON.parse(readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8')).version;
const maputnikVersion = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version, maplibreVersion = version('maplibre-gl');
// The local build of this library in place of the version of npm.
const lib = path.join(dir, 'node_modules/@map-jr/map-jr-gl');
rmSync(path.join(lib, 'dist'), {recursive: true, force: true});
cpSync(path.join(root, 'dist'), path.join(lib, 'dist'), {recursive: true});
cpSync(path.join(root, 'package.json'), path.join(lib, 'package.json'));

// ---- Scenarios. Each one gets a new page and returns a short text and whether it passed. ----
const open = async (browser, query = '') => {
    const p = await browser.newPage({viewport: {width: 1400, height: 900}});
    const errors = [];
    p.on('dialog', d => d.accept());
    // Maputnik writes each `error` event of the map with console.log("ERROR", e).
    p.on('console', async m => {
        if (m.type() === 'error' && !/fonts\.json|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160));
        if (m.text().startsWith('ERROR')) errors.push('map error: ' + await m.args()[1]?.evaluate(e => e?.error?.message ?? String(e)).catch(() => '?'));
    });
    p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    await p.goto(BASE + query);
    await p.waitForSelector('.maputnik-layer-list-item', {timeout: 30000}).catch(() => {});
    await p.waitForTimeout(8000);
    return {p, errors};
};
const SCENARIOS = {
    'Loads the style elevation-color of map-jr-styles': async browser => {
        const {p, errors} = await open(browser, `?style=${STYLES}elevation-color.json`);
        const layers = await p.locator('.maputnik-layer-list-item').count(), messages = await p.locator('.maputnik-message-panel').count();
        await p.close();
        return {ok: layers > 100 && !messages && !errors.length, detail: `layers: ${layers}; messages of the editor: ${messages}; errors: ${errors.length ? errors.slice(0, 2).join('; ') : 0}`};
    },
    'Loads the style liberty of OpenFreeMap': async browser => {
        const {p, errors} = await open(browser, `?style=https://tiles.openfreemap.org/styles/liberty`);
        const layers = await p.locator('.maputnik-layer-list-item').count();
        await p.close();
        return {ok: layers > 100 && !errors.length, detail: `layers: ${layers}; errors: ${errors.length ? errors.slice(0, 2).join('; ') : 0}`};
    },
    // The empty style that a new session of Maputnik opens has "sprite": "" (#760).
    'Opens with the empty default style': async browser => {
        const {p, errors} = await open(browser);
        await p.close();
        return {ok: !errors.length, detail: `errors: ${errors.length ? errors.slice(0, 2).join('; ') : 0}`};
    },
    // The filter editor suggests the properties that the map found in the tiles (Maputnik's layer watcher, #765, #766).
    'Suggests the properties of a source layer in the filter editor': async browser => {
        const {p} = await open(browser, `?style=${STYLES}openfreemap-liberty.json#16/40.7085/-74.0065`);
        await p.getByText('Expand', {exact: true}).first().click();
        await p.locator('[data-wd-key="layer-list-item:building"]').click();
        await p.locator('[data-wd-key="layer-filter-button"]').first().click();
        const field = p.locator('.maputnik-filter-editor-wrapper input[role="combobox"]').first();
        await field.click(); await field.fill(''); await p.waitForTimeout(500);
        const names = await p.locator('.maputnik-filter-editor-wrapper [role="option"]').allTextContents();
        await p.close();
        return {ok: names.length > 0, detail: `properties of the layer "building": ${names.length ? names.join(', ') : 'none'}`};
    },
    // Maputnik colours the icons of the navigation control by `.maplibregl-ctrl-icon` (#758).
    'Shows the icons of the navigation control in the colours of the editor': async browser => {
        const {p} = await open(browser);
        const icons = await p.evaluate(() => [...document.querySelectorAll('.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon, .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon, .maplibregl-ctrl-compass .maplibregl-ctrl-icon')]
            .filter(e => getComputedStyle(e).backgroundImage.includes('a4a4a4')).length);
        await p.close();
        return {ok: icons === 3, detail: `icons with the colour of the editor: ${icons} of 3`};
    },
};

// The issue of each scenario that this library does not pass yet. The report names it next to a failure.
const ISSUES = {'Suggests the properties of a source layer in the filter editor': '#765, #766', 'Shows the icons of the navigation control in the colours of the editor': '#758'};

// ---- One build of the editor for each renderer: its server, the end-to-end tests, the scenarios. ----
const builds = [{name: `MapLibre GL JS ${maplibreVersion}`, env: {MAPUTNIK_RENDERER: 'maplibre'}}, {name: 'this library', env: {}}];
for (const build of builds) {
    console.log(`\n== Maputnik ${maputnikVersion} (${head}) with ${build.name}`);
    rmSync(path.join(dir, 'node_modules/.vite'), {recursive: true, force: true});
    const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {cwd: dir, env: {...process.env, ...build.env}, stdio: 'ignore', detached: true});
    try {
        for (let i = 0; i < 60 && !await fetch(BASE).then(r => r.ok, () => false); i++) await new Promise(r => setTimeout(r, 1000));
        const browser = await launch();
        // Vite prepares the dependencies at the first request and reloads the page once: do that before the tests.
        { const p = await browser.newPage(); await p.goto(BASE); await p.waitForTimeout(15000); await p.close(); }
        build.scenarios = {};
        for (const [title, scenario] of Object.entries(SCENARIOS)) {
            build.scenarios[title] = await scenario(browser).catch(e => ({ok: false, detail: 'the scenario did not finish: ' + String(e.message).split('\n')[0]}));
            console.log(`${build.scenarios[title].ok ? 'PASS' : 'FAIL'}  ${title}: ${build.scenarios[title].detail}`);
        }
        await browser.close();
        if (suite) {
            // The tests get MAPUTNIK_RENDERER too: a test of what only this library draws runs only on its build.
            const out = path.join(dir, 'e2e-result.json');
            try { run('npx', ['playwright', 'test', '--reporter=json', '--trace', 'off'], {env: {...process.env, ...build.env, E2E_NO_WEBSERVER: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: out}, stdio: ['ignore', 'ignore', 'inherit']}); }
            catch { /* A failed test makes the exit code 1; the results are in the file. */ }
            const tests = [], walk = s => { for (const spec of s.specs ?? []) for (const t of spec.tests) tests.push({title: `${spec.file} › ${spec.title}`, status: t.results.at(-1)?.status, error: t.results.at(-1)?.error?.message?.split('\n')[0]?.replace(/\x1b\[[0-9;]*m/g, '')}); (s.suites ?? []).forEach(walk); };
            JSON.parse(readFileSync(out, 'utf8')).suites.forEach(walk);
            build.tests = tests;
            console.log(`Maputnik's end-to-end tests: ${tests.filter(t => t.status === 'passed').length} of ${tests.length} pass`);
        }
    } finally { process.kill(-server.pid); }
}

// ---- The report ----
const [ml, ours] = builds, cell = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
const passed = b => b.tests.filter(t => t.status === 'passed').length;
const onlyOurs = suite ? ours.tests.filter(t => t.status !== 'passed' && ml.tests.find(m => m.title === t.title)?.status === 'passed') : [];
for (const t of onlyOurs) console.log(`fails only with this library: ${t.title}: ${t.error}`);
if (process.argv.includes('--write')) {
    const file = path.join(root, 'docs/ecosystem.md'), doc = readFileSync(file, 'utf8');
    const block = ['<!-- maputnik:start -->', '## Maputnik, the style editor', '',
        '`node test/conformance/maputnik.mjs --write` runs Maputnik in a browser two times: with MapLibre GL JS, and with the',
        'entry `@map-jr/map-jr-gl/maplibre-compat` of this library in its place. It uses the fork',
        `[map-jr/maputnik](${REPO}), whose preview renders with this library; the fork also accepts \`params\` of the`,
        '`image` expression. Each build runs the end-to-end tests of Maputnik and the scenarios below, which test what those',
        'tests do not.', '',
        `Maputnik ${maputnikVersion} (${head}).` + (suite ? ` **Maputnik's own tests: ${passed(ours)} of ${ours.tests.length} pass with this library, and ${passed(ml)} of ${ml.tests.length} with MapLibre GL JS ${maplibreVersion}.**` : ''), '',
        ...(onlyOurs.length ? ['The tests that fail only with this library:', '', ...onlyOurs.map(t => `- ${cell(t.title)}: ${cell(t.error ?? t.status)}`), ''] : []),
        `| Scenario | This library | MapLibre GL JS ${maplibreVersion} |`, '|---|---|---|',
        ...Object.keys(SCENARIOS).map(title => `| ${title} | ${ours.scenarios[title].ok ? 'Pass' : 'Fail'}: ${cell(ours.scenarios[title].detail)}${!ours.scenarios[title].ok && ISSUES[title] ? ` (${ISSUES[title]})` : ''} | ${ml.scenarios[title].ok ? 'Pass' : 'Fail'}: ${cell(ml.scenarios[title].detail)} |`),
        '<!-- maputnik:end -->'].join('\n');
    writeFileSync(file, doc.includes('<!-- maputnik:start -->') ? doc.replace(/<!-- maputnik:start -->[\s\S]*<!-- maputnik:end -->/, block) : doc.replace('<!-- styles:start -->', block + '\n\n<!-- styles:start -->'));
}
