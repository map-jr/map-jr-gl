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
await build({entryPoints: [path.join(root, 'src/expr.ts')], bundle: true, format: 'esm', outfile: path.join(root, '.cache/expr.mjs'), logLevel: 'error'});
const {compileExpr, compileProp, parseColor, compileFor} = await import(path.join(root, '.cache/expr.mjs'));
const warn = console.warn; console.warn = () => {};

const TYPES = {Point: 1, MultiPoint: 1, LineString: 2, MultiLineString: 2, Polygon: 3, MultiPolygon: 3};
const same = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b)); // fixtures keep six significant digits
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => typeof v === 'number' && typeof b[i] === 'number' ? Math.abs(v - b[i]) <= 1e-5 * Math.max(1, Math.abs(b[i])) : same(v, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return a === b || (a == null && b == null);
};
// The library keeps the result of "format" and of "image" as one text, and the fixtures write it as an object. This
// gives the text that the library has for the object of a fixture (see STYLE_OPEN and IMAGE_OPEN in src/expr.ts), so
// that the two are compared in one form. Three things have no place in the text, and they differ as follows.
// - "vertical-align" is not supported. A fixture that sets it gets a text that no result is equal to, so it fails.
// - Of a font stack, the library keeps the first font. A fixture with a second font fails.
// - The expression gives the name of an image and does not know whether the image is available, so `available` is
//   not compared.
const internal = want => {
    if (!want || typeof want !== 'object' || Array.isArray(want)) return want;
    if (typeof want.name === 'string' && 'available' in want) return want.name;
    if (!Array.isArray(want.sections)) return want;
    return want.sections.map(s => {
        if (s.verticalAlign != null) return `vertical-align: ${s.verticalAlign}`;
        if (s.image) return `${s.image.name}`;
        if (s.scale == null && s.fontStack == null && s.textColor == null || s.text === '') return s.text;
        const c = s.textColor;
        return `${s.scale ?? ''}|${s.fontStack ?? ''}|${c ? [c.r, c.g, c.b, c.a].join(',') : ''}${s.text}`;
    }).join('');
};
// Fixtures that do not pass by a decision. A fixture takes the first entry that matches it. `match` gets the id of
// the fixture (its folder, for example "within/point-within-polygon"), its operator (the first part of the id) and
// whether the fixture expects a compile error. The decision is 'later' (the work is planned) or 'wontfix' (the
// library will not do it). Only the owner adds an entry with 'wontfix'.
const deliberate = [
    {label: 'compile-error', decision: 'wontfix', match: f => f.compileError,
        reason: 'The fixture expects a compile error. By a decision of the owner of 2026-11-16, the production build does not check the types of an expression or validate a style. Checks in the development build are possible later.'},
    {label: 'within-distance', decision: 'later', match: f => f.op === 'within' || f.op === 'distance',
        reason: 'The operators "within" and "distance" are not implemented.'},
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
        if (compileError) { skipped++; r.skipped++; if (label) labelled[label]++; continue; }
        let ok = true, why = '';
        try {
            compileFor({g: t.globalState ?? {}, f: {}});
            const isColor = t.propertySpec?.type === 'color' || t.expected.compiled.type === 'color';
            // Legacy "function" objects ({stops: ...}) go through the property compiler, as they do in a real style.
            const legacy = !Array.isArray(t.expression) && typeof t.expression === 'object' && t.expression !== null;
            const prop = legacy ? compileProp(t.expression, isColor ? 'color' : t.propertySpec?.type === 'number' ? 'number' : 'string', t.propertySpec?.default ?? null) : null;
            const fn = prop ? c => prop.eval(c.zoom, c.f) : compileExpr(t.expression, {dd: false, zoom: false});
            t.inputs.forEach(([globals, feature], i) => {
                // Fixtures write arrays of numbers or colours as {values: [...]}, and a colour in an array as {r, g, b, a}.
                const plain = v => v && typeof v === 'object' && !Array.isArray(v) && 'r' in v && 'a' in v ? [v.r, v.g, v.b, v.a] : v;
                let want = t.expected.outputs[i];
                if (want && typeof want === 'object' && Array.isArray(want.values)) want = want.values.map(plain);
                if (want && typeof want === 'object' && !Array.isArray(want) && 'error' in want) return; // runtime-error cases
                let got = fn({zoom: globals?.zoom ?? 0, density: globals?.heatmapDensity ?? globals?.elevation, f: {type: TYPES[feature?.geometry?.type] ?? 0, id: feature?.id, properties: feature?.properties ?? {}, state: feature?.featureState}});
                // A property that is a text ("string" or "formatted"): the tile builder makes the text of the value with
                // String(value ?? ''), where MapLibre adds "to-string" to the expression.
                const type = t.propertySpec?.type;
                if (!legacy && (type === 'string' || type === 'formatted')) got = String(got ?? '');
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
if (process.argv.includes('--list')) console.log(failures.join('\n'));
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (pass < min) { console.error(`FAIL: expected at least ${min} passing`); process.exit(1); }
