// Runs MapLibre's own expression test fixtures against our expression compiler and reports how many agree.
//   node test/conformance/expressions.mjs [--list] [--min=<pass count>]
// The list `deliberate` below labels the fixtures that do not pass by a decision, and the output counts each label.
// The fixtures are cloned from maplibre/maplibre-style-spec into .cache/ on first use (they are not vendored).
import {build} from 'esbuild';
import {execSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..'), repo = path.join(root, '.cache/maplibre-style-spec');
// The tests of one commit, so that the counts change only with this library. To take newer tests, change the commit
// here, delete the folder in .cache, and set the floor (--min) in package.json again.
const commit = 'f94442fd4c768a40f1896630ccb64dd50067d94b';
if (!existsSync(repo)) execSync(`git init -q "${repo}" && git -C "${repo}" fetch -q --depth 1 https://github.com/maplibre/maplibre-style-spec.git ${commit} && git -C "${repo}" checkout -q FETCH_HEAD`, {stdio: 'inherit'});
// (Node has no canvas to ask for the value of a color name: each bundle takes the table, src/color-names.ts.)
await build({stdin: {contents: "export * from './src/expr.ts'; import {useColorNames} from './src/expr.ts'; import {NAMED} from './src/color-names.ts'; useColorNames(NAMED);", resolveDir: root, loader: 'ts'}, bundle: true, format: 'esm', outfile: path.join(root, '.cache/expr.mjs'), logLevel: 'error'});
const {compileExpr, compileProp, parseColor, compileFor, pickImage, geo} = await import(path.join(root, '.cache/expr.mjs'));
// The code of "within" and "distance", which the tile builder loads on demand (src/within.ts, #1707).
await build({entryPoints: [path.join(root, 'src/within.ts')], bundle: true, format: 'esm', outfile: path.join(root, '.cache/within.mjs'), logLevel: 'error'});
geo.code = await import(path.join(root, '.cache/within.mjs'));
// The type check of the development build (#1748): the fixtures that expect a compile error run against it.
await build({stdin: {contents: "export {expressionErrors} from './src/expr-check.ts'; export {zoomCurveError} from './src/mistakes.ts'; import {useColorNames} from './src/expr.ts'; import {NAMED} from './src/color-names.ts'; useColorNames(NAMED);", resolveDir: root, loader: 'ts'},
    bundle: true, format: 'esm', outfile: path.join(root, '.cache/expr-check.mjs'), logLevel: 'error', define: {__DEV__: 'true'}});
const {expressionErrors, zoomCurveError} = await import(path.join(root, '.cache/expr-check.mjs'));
const {expressionCode} = await import('../../scripts/style-spec-values.mjs');
/** The errors of the development build for a fixture, in the form of the fixture. The property is completed as
 * MapLibre's test does (`getCompletePropertySpec`): data-driven, with zoom and interpolation, when the fixture does not say. */
const devErrors = t => {
    const spec = {'property-type': 'data-driven', expression: {interpolated: true, parameters: ['zoom', 'feature']}, ...t.propertySpec};
    const errors = expressionErrors(t.expression, (expressionCode(spec) || '- ' + expressionCode({...spec, type: 'number'}).split(' ')[1]));
    const zoom = !errors.length && zoomCurveError(t.expression);
    return zoom ? [{key: '', error: zoom}] : errors;
};
let devSame = 0;
const devDiffer = [];
const warn = console.warn; console.warn = () => {};

const TYPES = {Point: 1, MultiPoint: 1, LineString: 2, MultiLineString: 2, Polygon: 3, MultiPolygon: 3};
// The geometry of a fixture in coordinates of its tile, as MapLibre's runner makes it (test/lib/geometry.ts there):
// each position rounded at an extent of 8192, and a ring for each point of a MultiPoint. It is given at the extent
// that `geometry()` of a tile feature is asked for.
const tileGeometry = (g, {z, x, y}) => {
    const pos = p => [Math.round((180 + p[0]) / 360 * 2 ** z * 8192) - x * 8192, Math.round((180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + p[1] * Math.PI / 360))) / 360 * 2 ** z * 8192) - y * 8192];
    const c = g.coordinates, rings = g.type === 'Point' ? [[c]] : g.type === 'MultiPoint' ? c.map(p => [p]) : g.type === 'LineString' ? [c] : g.type === 'MultiPolygon' ? c.flat() : c;
    return (extent, coords, ends) => { for (const r of rings) { for (const p of r) coords.push(...pos(p).map(v => v * extent / 8192)); ends.push(coords.length / 2); } return rings.length; };
};
const same = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b)); // fixtures keep six significant digits
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => typeof v === 'number' && typeof b[i] === 'number' ? Math.abs(v - b[i]) <= 1e-5 * Math.max(1, Math.abs(b[i])) : same(v, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return a === b || (a == null && b == null);
};
// The library keeps the result of "format" and of "image" as one text, and the fixtures write it as an object. This
// gives the text that the library has for the object of a fixture (see STYLE_OPEN and IMAGE_OPEN in src/expr.ts), so
// that the two are compared in one form. "vertical-align" is a fourth field of the style marker, and an image with it
// is inside a style marker that has only that field. One thing has no place in the text, and it differs as follows.
// - The expression gives the name of an image and does not know whether the image is available, so `available` is
//   not compared. `coalesce` gives the names of all its images, and the engine takes the first one that the map has
//   (`pickImage`): the runner does the same with `availableImages` of the fixture.
const internal = want => {
    if (!want || typeof want !== 'object' || Array.isArray(want)) return want;
    if (typeof want.name === 'string' && 'available' in want) return want.name;
    if (!Array.isArray(want.sections)) return want;
    return want.sections.map(s => {
        const va = s.verticalAlign == null ? '' : '|' + s.verticalAlign;
        if (s.image) return va ? `||${va}${s.image.name}` : `${s.image.name}`;
        if (s.scale == null && s.fontStack == null && s.textColor == null && !va || s.text === '') return s.text;
        const c = s.textColor;
        return `${s.scale ?? ''}|${s.fontStack ?? ''}|${c ? [c.r, c.g, c.b, c.a].join(',') : ''}${va}${s.text}`;
    }).join('');
};
// Fixtures that do not pass by a decision. A fixture takes the first entry that matches it. `match` gets the id of
// the fixture (its folder, for example "within/point-within-polygon"), its operator (the first part of the id) and
// whether the fixture expects a compile error. The decision is 'later' (the work is planned) or 'wontfix' (the
// library will not do it). Only the owner adds an entry with 'wontfix'.
const deliberate = [
    {label: 'compile-error', decision: 'wontfix', match: f => f.compileError,
        reason: 'The fixture expects a compile error. By a decision of the owner of 2026-11-16, the production build does not check the types of an expression or validate a style. The development build checks them (src/expr-check.ts, #1748), and the line "Development build" counts them.'},
    {label: 'projection-transition', decision: 'later', match: f => f.id.startsWith('interpolate/projection'),
        reason: 'An "interpolate" between two projections gives the first projection, and not the transition between the two ({from, to, transition}).'},
    {label: 'upstream-fixture', decision: 'later', match: f => f.id === 'legacy/identity/enum',
        reason: 'The fixture wants "c", which is not a value of the enum, from an identity function with no default; "legacy/identity/enum-default" and the identity function of MapLibre GL JS replace such a value. The fixture is to be corrected upstream (#656).'},
];
const labelled = Object.fromEntries(deliberate.map(d => [d.label, 0]));
const results = {}, failures = [];
let pass = 0, fail = 0, skipped = 0;
const walk = dir => {
    for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (name !== 'test.json') continue;
        const t = JSON.parse(readFileSync(p, 'utf8')), id = path.relative(path.join(repo, 'test/integration/expression/tests'), dir), op = id.split(path.sep)[0];
        const r = results[op] ??= {pass: 0, fail: 0, skipped: 0};
        // Fixtures that expect a compile-time type error test validation, which the library does not have. They do not run.
        const compileError = t.expected?.compiled?.result !== 'success' || !t.inputs, label = deliberate.find(d => d.match({id, op, compileError}))?.label;
        if (compileError) {
            const want = t.expected.compiled.result === 'success' ? [] : t.expected.compiled.errors, got = devErrors(t);
            if (JSON.stringify(got) === JSON.stringify(want)) devSame++; else devDiffer.push(`${id}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`.slice(0, 300));
        }
        // (An expression that compiles in MapLibre GL JS gets no error in the development build. A legacy function is
        // not an expression, and the development build does not check its types.)
        else if (Array.isArray(t.expression) && devErrors(t).length) devDiffer.push(`${id}: got ${JSON.stringify(devErrors(t))}, want no error`.slice(0, 300));
        if (compileError) { skipped++; r.skipped++; if (label) labelled[label]++; continue; }
        let ok = true, why = '';
        try {
            compileFor({g: t.globalState ?? {}, f: {}});
            const isColor = t.propertySpec?.type === 'color' || t.expected.compiled.type === 'color';
            // Legacy "function" objects ({stops: ...}) go through the property compiler, as they do in a real style.
            const legacy = !Array.isArray(t.expression) && typeof t.expression === 'object' && t.expression !== null;
            // The kind is the one that the table of properties in src/style.ts gives to such a property: 'discrete' is a
            // property that the specification does not interpolate, whose function steps between its zoom levels.
            const prop = legacy ? compileProp(t.expression, isColor ? 'color' : ['padding', 'colorArray', 'numberArray'].includes(t.propertySpec?.type) ? t.propertySpec.type : t.propertySpec?.expression?.interpolated === false ? 'discrete' : t.propertySpec?.type === 'number' ? 'number' : 'string', t.propertySpec?.default ?? null, t.propertySpec?.values && Object.keys(t.propertySpec.values)) : null;
            const fn = prop ? c => prop.eval(c.zoom, c.f) : compileExpr(t.expression, {dd: false, zoom: false});
            t.inputs.forEach(([globals, feature], i) => {
                // Fixtures write arrays of numbers or colours as {values: [...]}, and a colour in an array as {r, g, b, a}.
                const plain = v => v && typeof v === 'object' && !Array.isArray(v) && 'r' in v && 'a' in v ? [v.r, v.g, v.b, v.a] : v;
                let want = t.expected.outputs[i];
                if (want && typeof want === 'object' && Array.isArray(want.values)) want = want.values.map(plain);
                if (want && typeof want === 'object' && !Array.isArray(want) && 'error' in want) return; // runtime-error cases
                const tile = globals?.canonicalID, g = feature?.geometry;
                geo.tile = tile ? [tile.z, tile.x, tile.y] : undefined;
                let got = fn({zoom: globals?.zoom ?? 0, density: globals?.heatmapDensity ?? globals?.elevation, f: {type: TYPES[g?.type] ?? 0, id: feature?.id, properties: feature?.properties ?? {}, state: feature?.featureState, geometry: tile && g?.coordinates ? tileGeometry(g, tile) : undefined}});
                // A property that is a text ("string" or "formatted"): the tile builder makes the text of the value with
                // String(value ?? ''), where MapLibre adds "to-string" to the expression.
                const type = t.propertySpec?.type;
                if (!legacy && (type === 'string' || type === 'formatted')) got = String(got ?? '');
                // A property with tokens ("text-field", "icon-image"): the tile builder puts the properties of the feature
                // in place of the tokens of a constant and of a zoom function (src/tile.ts). It also trims the text, which is
                // left out here.
                if (prop?.tokens && t.propertySpec?.tokens && typeof got === 'string') got = got.replace(/\{([^}]+)\}/g, (_, k) => feature?.properties?.[k] ?? '');
                if (typeof got === 'string') got = pickImage(got, name => globals?.availableImages?.includes(name));
                want = internal(want);
                if (isColor && typeof got === 'string') got = parseColor(got);
                if (Array.isArray(got) && Array.isArray(want) && want.some(Array.isArray)) got = got.map(v => typeof v === 'string' ? parseColor(v) ?? v : v);
                // Fixtures record colours with alpha premultiplied.
                if (isColor && Array.isArray(got) && got.length === 4) got = [got[0] * got[3], got[1] * got[3], got[2] * got[3], got[3]];
                if (!same(got, want)) { ok = false; why ||= `input ${i}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`; }
            });
        } catch (e) { ok = false; why = 'threw ' + e.message; }
        if (ok) { pass++; r.pass++; } else { fail++; r.fail++; if (label) labelled[label]++; failures.push(`${label ? `[${label}] ` : ''}${id}: ${why}`.slice(0, 200)); }
    }
};
walk(path.join(repo, 'test/integration/expression/tests'));
console.warn = warn;
const pct = (n, of) => Math.round(100 * n / of);
const failing = Object.entries(results).filter(([, r]) => r.fail).sort((a, b) => b[1].fail - a[1].fail);
console.log(`Expression conformance: ${pass} pass, ${fail} fail, ${skipped} skipped (compile-error fixtures) of ${pass + fail + skipped} (${pct(pass, pass + fail + skipped)}%)`);
console.log('Operators with failures: ' + failing.map(([op, r]) => `${op} ${r.fail}/${r.pass + r.fail}`).join(', '));
// A fixture with a label that passes counts as a pass, so the counts below have only fixtures that do not pass.
const total = decision => deliberate.reduce((n, d) => n + (d.decision === decision ? labelled[d.label] : 0), 0);
const parts = decision => deliberate.filter(d => d.decision === decision).map(d => `${d.label} ${labelled[d.label]}`).join(', ');
console.log(`Do not pass by a decision: later ${total('later')}${parts('later') && ` (${parts('later')})`}, wontfix ${total('wontfix')}${parts('wontfix') && ` (${parts('wontfix')})`}`);
console.log(`Without the fixtures left out on purpose (wontfix): ${pass} of ${pass + fail + skipped - total('wontfix')} (${pct(pass, pass + fail + skipped - total('wontfix'))}%)`);
console.log(`Fail with no label: ${fail + skipped - total('later') - total('wontfix')}`);
console.log(`Development build: ${devSame} of ${skipped} compile-error fixtures give MapLibre's errors; ${devDiffer.length} fixtures in all differ from MapLibre in their errors`);
if (process.argv.includes('--list')) console.log([...failures, ...devDiffer.map(d => '[development build] ' + d)].join('\n'));
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (pass < min) { console.error(`FAIL: expected at least ${min} passing`); process.exit(1); }
const minDev = +(process.argv.find(a => a.startsWith('--min-dev='))?.slice(10) ?? 0);
if (devSame < minDev || devDiffer.length) { console.error(`FAIL: expected at least ${minDev} compile-error fixtures with MapLibre's errors in the development build, and no other difference in the errors (see --list)`); process.exit(1); }
