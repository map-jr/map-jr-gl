// Compares the reference of the MapLibre style specification (`v8.json` of the copy of
// @maplibre/maplibre-gl-style-spec that the installed maplibre-gl uses) with what the library reads (#1001).
//   node test/conformance/spec.mjs [--gaps] [--markdown] [--min=<count>]
// For each layout and paint property of each layer type, each root property, the properties of `light`, `sky`,
// `terrain`, `projection` and `transition`, and each source property, the check says whether the library reads it,
// and compares the expression inputs that it evaluates with `expression.parameters` of the reference. It also
// compares the default of each property in the list `SPEC` of src/style.ts with the default of the reference.
// `--min` fails the run when fewer properties than that are supported in full, so a new gap fails `pnpm test`.
//
// How a property counts as read:
// - A layer property in `SPEC` (src/style.ts) is compiled by `compileProp`. Unless its kind is `raw`, it takes any
//   expression, so it evaluates zoom, feature, feature-state and global-state. A `raw` one takes literal values only.
// - The table `OTHER` below lists the properties that the code reads in another way, with the inputs that it
//   evaluates and a pattern that must still match its file (else the entry is stale and the check fails).
// - A layer property that is in neither, but whose name appears quoted in src/, is "read, not classified": it fails
//   the check until it has an entry in `OTHER`.
// - A root or source property counts as read when its name appears in src/ (quoted, or as a member). This is a
//   search for the name, so a common name (`zoom`, `type`) can count as read when it is not; a name that is not
//   found is certainly not read.
import {readFileSync, readdirSync, realpathSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const specDir = path.join(realpathSync(path.join(root, 'node_modules/maplibre-gl')), '../@maplibre/maplibre-gl-style-spec');
const specVersion = JSON.parse(readFileSync(path.join(specDir, 'package.json'), 'utf8')).version;
const ref = JSON.parse(readFileSync(path.join(specDir, 'src/reference/v8.json'), 'utf8'));
const src = Object.fromEntries(readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.ts')).map(f => [f, readFileSync(path.join(root, 'src', f), 'utf8')]));

const ALL = ['zoom', 'feature', 'feature-state', 'global-state'];
// The supported properties of each layer type, as src/style.ts lists them: name -> [kind, default as written].
const SPEC = {};
{
    let type;
    for (const m of src['style.ts'].split('const SPEC')[1].split('\n};')[0].matchAll(/^\s*'?([a-z-]+)'?: \{|\['([a-z-]+)', '(\w+)', ((?:\[[^\]]*\])|(?:'[^']*')|[^\]]+?)\]/gm)) {
        if (m[1]) SPEC[type = m[1]] = {};
        else SPEC[type][m[2]] = [m[3], m[4]];
    }
}
if (Object.keys(SPEC).length < 10) { console.error('FAIL: could not read the list SPEC of src/style.ts'); process.exit(1); }

// Properties that the code reads outside `SPEC`: [layer type or group ('*' for each layer type), name, inputs, file, pattern].
const OTHER = [
    ['*', 'visibility', [], 'style.ts', /l\.layout\?\.visibility !== 'none'/],
    ['line', 'line-gradient', ['line-progress'], 'style.ts', /l\.paint\['line-gradient'\]/],
    ['heatmap', 'heatmap-color', ['heatmap-density'], 'style.ts', /l\.paint\?\.\['heatmap-color'\]/],
    // (Only an `interpolate` expression gives stops; see `relief` in src/style.ts.)
    ['color-relief', 'color-relief-color', ['elevation'], 'style.ts', /l\.paint\?\.\['color-relief-color'\]/],
    ...['sky-color', 'horizon-color', 'fog-color', 'sky-horizon-blend', 'horizon-fog-blend', 'fog-ground-blend', 'atmosphere-blend'].map(n => ['sky', n, ['zoom', 'global-state'], 'gl.ts', new RegExp(`at\\('${n}'`)]),
    ['light', 'anchor', [], 'gl.ts', /light\.anchor === 'map'/],
    ['light', 'position', ['zoom', 'global-state'], 'gl.ts', /at\(light\.position/],
    ['light', 'color', ['zoom', 'global-state'], 'gl.ts', /at\(light\.color/],
    ['light', 'intensity', ['zoom', 'global-state'], 'gl.ts', /at\(light\.intensity/],
    ['terrain', 'source', [], 'engine.ts', /terrain/],
    ['terrain', 'exaggeration', [], 'engine.ts', /exaggeration/],
    // (`globeStops` takes a name or an `interpolate` on zoom.)
    ['projection', 'type', ['zoom'], 'geo.ts', /type\[0\] === 'interpolate' && type\[2\]\?\.\[0\] === 'zoom'/],
    ['transition', 'duration', [], 'style.ts', /duration: 300/],
    ['transition', 'delay', [], 'style.ts', /delay: 0/],
];
const stale = OTHER.filter(([, , , f, re]) => !re.test(src[f]));
const other = (group, name) => OTHER.find(([g, n]) => (g === group || (g === '*' && !['sky', 'light', 'terrain', 'projection', 'transition'].includes(group))) && n === name);
const named = name => Object.values(src).some(t => t.includes(`'${name}'`) || t.includes(`"${name}"`) || (/^\w+$/.test(name) && new RegExp(`[.{,]\\s*${name}\\b`).test(t)));

// The defaults of `SPEC` as JSON, and those of the reference, in one form for colours.
const norm = v => {
    if (Array.isArray(v) && v.length === 1) v = v[0];
    if (typeof v !== 'string') return JSON.stringify(v);
    let s = v.replace(/\s+/g, '').toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + [...s.slice(1)].map(c => c + c).join('');
    return {'#000000': 'rgba(0,0,0,1)', '#ffffff': 'rgba(255,255,255,1)', black: 'rgba(0,0,0,1)', white: 'rgba(255,255,255,1)', transparent: 'rgba(0,0,0,0)'}[s] ?? JSON.stringify(s);
};
const written = text => { try { return JSON.parse(text.replace(/'/g, '"')); } catch { return undefined; } };

const rows = [];
const check = (group, name, def, layerType) => {
    const want = def.expression?.parameters ?? [];
    let status, inputs = [], note = '';
    const entry = layerType && Object.entries(SPEC[layerType] ?? {}).find(([n]) => n === name);
    const o = other(layerType ?? group, name);
    if (entry) {
        const [kind, d] = entry[1];
        inputs = kind === 'raw' ? [] : ALL;
        if (def.default !== undefined && written(d) !== undefined && written(d) !== null && norm(written(d)) !== norm(def.default)) note = `default ${d.replace(/'/g, '"')}, the specification has ${JSON.stringify(def.default)}`;
        status = 'read';
    } else if (o) { inputs = o[2]; status = 'read'; }
    else if (layerType && named(name)) status = 'not classified';
    else if (!layerType && named(name)) status = 'read';
    else status = 'not read';
    const fewer = status === 'read' ? want.filter(i => !inputs.includes(i)) : [];
    const gap = status !== 'read' ? status : fewer.length ? `no ${fewer.join(', ')}` : '';
    rows.push({group, name, want, gap, note, type: def['property-type'] ?? ''});
};
for (const [layerType, l] of Object.entries(ref.layer.type.values)) {
    for (const kind of ['layout', 'paint']) for (const [name, def] of Object.entries(ref[`${kind}_${layerType}`] ?? {})) check(`${kind} ${layerType}`, name, def, layerType);
    if (!SPEC[layerType]) rows.push({group: 'layer', name: `type "${layerType}"`, want: [], gap: 'not read', note: '', type: ''});
}
for (const [name, def] of Object.entries(ref.$root)) check('root', name, def);
for (const group of ['light', 'sky', 'terrain', 'projection', 'transition']) for (const [name, def] of Object.entries(ref[group])) {
    const o = other(group, name), want = def.expression?.parameters ?? [];
    const fewer = o ? want.filter(i => !o[2].includes(i)) : [];
    rows.push({group, name, want, gap: !o ? 'not read' : fewer.length ? `no ${fewer.join(', ')}` : '', note: '', type: def['property-type'] ?? ''});
}
const sourceTypes = src['resolve.ts'].match(/type: ('[a-z-]+'(?: \| '[a-z-]+')*);/)[1].match(/[a-z-]+/g);
for (const s of ref.source) {
    const type = s.slice('source_'.length).replace('_', '-');
    if (!sourceTypes.includes(type)) { rows.push({group: 'source', name: `type "${type}"`, want: [], gap: 'not read', note: '', type: ''}); continue; }
    for (const [name, def] of Object.entries(ref[s])) if (name !== '*') check(`source ${type}`, name, def);
}

const gaps = rows.filter(r => r.gap), notes = rows.filter(r => r.note), full = rows.length - gaps.length;
const count = re => gaps.filter(r => re.test(r.gap)).length;
console.log(`Style specification ${specVersion} coverage: ${full} of ${rows.length} properties are read with every expression input that the specification allows`);
console.log(`Gaps: ${gaps.length} (not read: ${count(/^not read/)}; fewer expression inputs: ${count(/^no /)}; not classified: ${count(/^not classified/)})`);
console.log(`Defaults that differ: ${notes.length}`);
const table = list => ['| Where | Property | Gap | Inputs in the specification |', '|---|---|---|---|',
    ...list.map(r => `| ${r.group} | \`${r.name}\` | ${r.gap || r.note}${r.gap && r.note ? `; ${r.note}` : ''} | ${r.want.join(', ') || '(none)'} |`)].join('\n');
if (process.argv.includes('--markdown')) console.log('\n' + table([...gaps, ...notes.filter(r => !r.gap)]));
else if (process.argv.includes('--gaps')) for (const r of [...gaps, ...notes.filter(r => !r.gap)]) console.log(`  ${r.group}: ${r.name}: ${r.gap || r.note}${r.gap && r.note ? `; ${r.note}` : ''}`);
let fail = false;
for (const [g, n, , f] of stale) { console.error(`FAIL: the entry ${g} ${n} of OTHER in test/conformance/spec.mjs no longer matches src/${f}. Update the entry.`); fail = true; }
for (const r of gaps.filter(r => r.gap === 'not classified')) { console.error(`FAIL: src/ names ${r.group} ${r.name}, which is not in SPEC of src/style.ts or in OTHER of test/conformance/spec.mjs. Add it to OTHER with the inputs that it evaluates.`); fail = true; }
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (full < min) { console.error(`FAIL: expected at least ${min} properties supported in full (run with --gaps to see the gaps)`); fail = true; }
if (fail) process.exit(1);
