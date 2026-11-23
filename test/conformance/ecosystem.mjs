// Reads popular MapLibre plugins and wrappers from npm and reports which parts of the MapLibre API they use that
// the entry `@map-jr/map-jr-gl/maplibre-compat` does not have. The packages are only read as text; none of their code runs.
//   node test/conformance/ecosystem.mjs [--write]      (--write puts the report in docs/ecosystem.md)
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {compatSurface, methodsOf} from './compat-surface.mjs';
import {table} from './report.mjs';

const root = path.resolve(import.meta.dirname, '../..'), cache = path.join(root, '.cache/ecosystem');
const PACKAGES = {
    'Drawing and editing': ['@mapbox/mapbox-gl-draw', 'terra-draw-maplibre-gl-adapter', '@watergis/maplibre-gl-terradraw', 'maplibre-gl-measures'],
    'Search and directions': ['@maplibre/maplibre-gl-geocoder', '@maplibre/maplibre-gl-directions'],
    'Controls and tools': ['@maplibre/maplibre-gl-compare', '@maplibre/maplibre-gl-inspect', '@watergis/maplibre-gl-export', 'maplibre-gl-opacity', '@mapbox/mapbox-gl-sync-move', 'maplibre-gl-basemaps', '@maplibre/maplibre-gl-style-flipper'],
    'Data and layers': ['pmtiles', 'maplibre-contour', '@deck.gl/mapbox', '@maplibre/maplibre-gl-leaflet', 'maplibre-gl-vector-text-protocol', '@americana/maplibre-shield-generator'],
    'Frameworks': ['react-map-gl', '@vis.gl/react-maplibre', 'vue-maplibre-gl', '@indoorequal/vue-maplibre-gl', 'svelte-maplibre-gl', 'svelte-maplibre', '@maplibre/ngx-maplibre-gl', '@maptiler/sdk'],
};

// What MapLibre has: the methods of Map (as in api.mjs), and the names that the package exports.
const dts = readFileSync(createRequire(import.meta.url).resolve('maplibre-gl/dist/maplibre-gl.d.ts'), 'utf8');
const theirMethods = new Set([...methodsOf(dts, ['Map', 'Map$1']), ...methodsOf(dts, ['Camera']), ...methodsOf(dts, ['Evented'])]);
// What this library has. Plugins and wrappers for MapLibre GL JS use the entry maplibre-compat, so the scan reads that entry.
const {methods: ourMethods, inert, values: ourExports, types: ourTypes, events: ourEvents} = compatSurface(root);
// Only values (classes, functions and constants) matter at run time: a type is not in a built file. The declaration
// file exports most of them where it declares them, and renames some in a list at its end.
const exportBlock = dts.slice(dts.lastIndexOf('export {'));
const valueExports = new Set([
    ...[...dts.matchAll(/^export declare (?:abstract )?(?:class|function|const|let|var) (\w+)/gm)].map(m => m[1]),
    ...[...exportBlock.matchAll(/[{,]\s*(?!type )(?:[\w$]+ as )?(\w+)(?=\s*[,}])/g)].map(m => m[1]),
]);
const theirEvents = new Set([...dts.matchAll(/^\s+(\w+): (?:MapLibre\w*Event|Map\w*Event|ErrorEvent|MapDataEvent|MapStyle\w*Event|MapSource\w*Event|MapContextEvent|MapTerrainEvent|MapProjectionEvent)/gm)].map(m => m[1]));

mkdirSync(cache, {recursive: true});
/** Downloads a package from npm and returns the folder with its files, or null if npm does not have it. */
function fetchPackage(name) {
    const dir = path.join(cache, name.replace('/', '__'));
    if (!existsSync(path.join(dir, 'package'))) {
        try {
            mkdirSync(dir, {recursive: true});
            const tgz = execFileSync('npm', ['pack', name, '--silent', '--pack-destination', dir], {cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim().split('\n').pop();
            execFileSync('tar', ['-xzf', path.join(dir, tgz), '-C', dir]);
        } catch { return null; }
    }
    return path.join(dir, 'package');
}
/** The text of a package's code: the built files it publishes, without source maps, tests and minified copies. */
function codeOf(dir) {
    let text = '';
    const walk = d => {
        for (const f of readdirSync(d)) {
            const p = path.join(d, f), st = statSync(p);
            if (st.isDirectory()) { if (!/^(node_modules|test|tests|__tests__|docs|examples?|demo|cypress|coverage)$/.test(f)) walk(p); continue; }
            if (!/\.(m?js|cjs|ts|tsx|vue|svelte)$/.test(f) || /\.(min|d)\.\w+$|\.test\.|\.spec\./.test(f) || st.size > 3e6) continue;
            text += readFileSync(p, 'utf8') + '\n';
        }
    };
    walk(dir);
    return text;
}

const rows = [], demand = {methods: {}, exports: {}, events: {}, inert: {}};
for (const [group, names] of Object.entries(PACKAGES)) for (const name of names) {
    const dir = fetchPackage(name);
    if (!dir) { rows.push({group, name, missing: true}); continue; }
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')), text = codeOf(dir);
    const used = [...theirMethods].filter(m => new RegExp(`\\.${m}\\(`).test(text));
    const noMethod = used.filter(m => !ourMethods.has(m)).sort();
    // A method that is accepted with no effect does not stop the package: it warns once for a value that is not the default.
    const noEffect = used.filter(m => inert.has(m)).sort();
    // (A name that is imported only as a type does not count: `import type {...}` and `type X` in a list.)
    const usedExports = [...valueExports].filter(e => e !== 'Map' && new RegExp(`(?:maplibregl|mapboxgl|maplibre|mapLib|maplibreGl)\\.${e}\\b|import\\s*\\{(?:[^}]*,)?\\s*${e}\\b[^}]*\\}\\s*from\\s*['"](?:maplibre-gl|mapbox-gl)['"]`).test(text));
    // A name that this library exports as a type is enough when the package does not use the name as a value
    // (`new X`, `instanceof X`, `extends X`, `X.something`): TypeScript then removes the import from the built code.
    const asValue = e => new RegExp(`new ${e}\\b|instanceof ${e}\\b|extends ${e}\\b|[^.\\w]${e}\\.\\w`).test(text);
    const noExport = usedExports.filter(e => !ourExports.has(e) && !(ourTypes.has(e) && !asValue(e))).sort();
    const usedEvents = [...theirEvents].filter(e => new RegExp(`\\.(?:on|once|off)\\(\\s*['"]${e}['"]`).test(text));
    const noEvent = usedEvents.filter(e => !ourEvents.has(e)).sort();
    for (const [kind, list] of [['methods', noMethod], ['exports', noExport], ['events', noEvent], ['inert', noEffect]]) for (const n of list) (demand[kind][n] ??= []).push(name);
    rows.push({group, name, version: pkg.version, methods: used.length, exports: usedExports.length, events: usedEvents.length, noMethod, noEffect, noExport, noEvent});
}

const code = list => list.length ? list.map(n => '`' + n + '`').join(', ') : 'none';
const ready = rows.filter(r => !r.missing && !r.noMethod.length && !r.noExport.length && !r.noEvent.length).length, read = rows.filter(r => !r.missing).length;
const top = kind => Object.entries(demand[kind]).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
const lines = ['# Plugins and frameworks', '',
    'This report is written by `node test/conformance/ecosystem.mjs --write`. The script reads popular MapLibre plugins and',
    'framework wrappers from npm. It finds the methods of `Map`, the exports of `maplibre-gl` and the map events that each',
    'package uses, and compares them with the entry `@map-jr/map-jr-gl/maplibre-compat` of this library.', '',
    'The script reads the code as text. It does not run the packages. So a package with "none" in each column can still',
    'have a problem, and a method in the list is possibly used only in a part of the package that you do not use.', '',
    `**${ready} of ${read} packages** use only parts of the API that this library has.`, '',
    'A missing method throws a `TypeError` when the package calls it. A method that is "accepted, with no effect" exists and',
    'does nothing, so the package goes on, and it does not count as missing. Most of these methods warn once when they get a',
    'value that the library cannot do (see "Accepted, with no effect" in `docs/reference/maplibre-differences.md`).', '',
    'react-map-gl 7 does not work with this library, and the tables below read version 8 only. Version 7 reads the private',
    '`map.transform` of MapLibre GL JS and throws a `TypeError`. Version 8 works (the field test of #187).', '',
    '## What is missing most often', '',
    ...table(['Missing', 'Kind', 'Packages', 'Names of the packages'], ['exports', 'methods', 'events'].flatMap(kind => top(kind).map(([n, who]) => ['`' + n + '`', kind === 'exports' ? 'export' : kind === 'methods' ? 'method of `Map`' : 'event', who.length, who.join(', ')])), [2]), '',
    '## What is accepted with no effect', '',
    ...table(['Method of `Map`', 'Packages', 'Names of the packages'], top('inert').map(([n, who]) => ['`' + n + '`', who.length, who.join(', ')]), [1]), '',
    '## Each package', ''];
for (const group of Object.keys(PACKAGES)) {
    lines.push(`### ${group}`, '', ...table(['Package', 'Version', 'Methods in use', 'Exports in use', 'Events in use', 'Missing methods', 'Accepted, with no effect', 'Missing exports', 'Missing events'],
        rows.filter(r => r.group === group).map(r => r.missing ? [r.name, 'not found on npm', '', '', '', '', '', '', ''] : [r.name, r.version, r.methods, r.exports, r.events, code(r.noMethod), code(r.noEffect), code(r.noExport), code(r.noEvent)]), [2, 3, 4]));
    lines.push('');
}
console.log(`${ready} of ${read} packages use only API that this library has.`);
for (const kind of ['exports', 'methods', 'events']) console.log(`Missing ${kind}: ${top(kind).map(([n, who]) => `${n} (${who.length})`).join(', ')}`);
console.log(`Accepted with no effect: ${top('inert').map(([n, who]) => `${n} (${who.length})`).join(', ')}`);
if (process.argv.includes('--write')) {
    // What the other tools wrote (plugins.mjs, styles.mjs, examples.mjs) and the text after their tables stay in the document.
    const file = path.join(root, 'docs/ecosystem.md'), ran = existsSync(file) ? /<!-- plugins:start -->[\s\S]*?(?=\n+## What is missing most often)/.exec(readFileSync(file, 'utf8'))?.[0] : undefined;
    const at = lines.indexOf('## What is missing most often');
    if (ran) lines.splice(at, 0, ran, '');
    writeFileSync(file, lines.join('\n'));
}
