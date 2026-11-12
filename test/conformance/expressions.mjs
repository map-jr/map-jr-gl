// Runs MapLibre's own expression test fixtures against our expression compiler and reports how many agree.
//   node test/conformance/expressions.mjs [--list] [--min=<pass count>]
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
const {compileExpr, compileProp, parseColor, setGlobalState} = await import(path.join(root, '.cache/expr.mjs'));
const warn = console.warn; console.warn = () => {};

const TYPES = {Point: 1, MultiPoint: 1, LineString: 2, MultiLineString: 2, Polygon: 3, MultiPolygon: 3};
const same = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b)); // fixtures keep six significant digits
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => typeof v === 'number' && typeof b[i] === 'number' ? Math.abs(v - b[i]) <= 1e-5 * Math.max(1, Math.abs(b[i])) : same(v, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
    return a === b || (a == null && b == null);
};
const results = {}, failures = [];
let pass = 0, fail = 0, skipped = 0;
const walk = dir => {
    for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (name !== 'test.json') continue;
        const t = JSON.parse(readFileSync(p, 'utf8')), id = path.relative(path.join(repo, 'test/integration/expression/tests'), dir), op = id.split(path.sep)[0];
        const r = results[op] ??= {pass: 0, fail: 0, skipped: 0};
        // Fixtures that expect a compile-time type error test validation, which this library leaves to authoring tools.
        if (t.expected?.compiled?.result !== 'success' || !t.inputs) { skipped++; r.skipped++; continue; }
        let ok = true, why = '';
        try {
            setGlobalState(t.globalState);
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
                let got = fn({zoom: globals?.zoom ?? 0, density: globals?.heatmapDensity, f: {type: TYPES[feature?.geometry?.type] ?? 0, id: feature?.id, properties: feature?.properties ?? {}, state: feature?.featureState}});
                if (isColor && typeof got === 'string') got = parseColor(got);
                if (Array.isArray(got) && Array.isArray(want) && want.some(Array.isArray)) got = got.map(v => typeof v === 'string' ? parseColor(v) ?? v : v);
                // Fixtures record colours with alpha premultiplied.
                if (isColor && Array.isArray(got) && got.length === 4) got = [got[0] * got[3], got[1] * got[3], got[2] * got[3], got[3]];
                if (!same(got, want)) { ok = false; why ||= `input ${i}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`; }
            });
        } catch (e) { ok = false; why = 'threw ' + e.message; }
        if (ok) { pass++; r.pass++; } else { fail++; r.fail++; failures.push(`${id}: ${why}`.slice(0, 200)); }
    }
};
walk(path.join(repo, 'test/integration/expression/tests'));
console.warn = warn;
const failing = Object.entries(results).filter(([, r]) => r.fail).sort((a, b) => b[1].fail - a[1].fail);
console.log(`Expression conformance: ${pass} pass, ${fail} fail, ${skipped} skipped (compile-error fixtures) of ${pass + fail + skipped}`);
console.log('Operators with failures: ' + failing.map(([op, r]) => `${op} ${r.fail}/${r.pass + r.fail}`).join(', '));
if (process.argv.includes('--list')) console.log(failures.join('\n'));
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (pass < min) { console.error(`FAIL: expected at least ${min} passing`); process.exit(1); }
