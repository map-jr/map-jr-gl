// Compares our Map class with MapLibre's public Map API and reports which methods exist.
//   node test/conformance/api.mjs [--missing] [--write] [--min=<count>]
// The count leaves out what is internal to MapLibre GL JS: a method that its declaration tags `@internal`, and a
// method that only the class `Camera` has. `Map` does not extend `Camera` in MapLibre GL JS 6 (it keeps one in the
// private member `_camera`), and the package does not export `Camera`, so a page cannot call these methods.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {apiBlock} from './report.mjs';
import {compatSurface} from './compat-surface.mjs';

const root = path.resolve(import.meta.dirname, '../..');
/**
 * Public method names of a class, read from source text (declaration files and our own source share this layout).
 * With `tagged`, the result has only the methods whose comment has the tag `@internal`.
 */
const publicMethods = (file, classNames, tagged = false) => {
    const text = readFileSync(file, 'utf8'), names = new Set();
    for (const cls of classNames) {
        const start = text.search(new RegExp(`^(export )?(declare )?(abstract )?class ${cls.replace('$', '\\$')}\\b`, 'm'));
        if (start < 0) continue;
        const body = text.slice(start, text.indexOf('\n}', start));
        for (const m of body.matchAll(/((?:^[ \t]*(?:\/\*\*|\*).*\n)*)^(?:\t|    |  )(?:(private|protected|static|readonly) )?(?:async )?([A-Za-z]\w*)(?:<[^>(]*>)?\(/gm)) {
            if (!m[2] && !['constructor', 'if', 'for', 'while', 'switch', 'return', 'function', 'catch'].includes(m[3]) && (!tagged || /@internal\b/.test(m[1]))) names.add(m[3]);
        }
    }
    return names;
};
const dts = createRequire(import.meta.url).resolve('maplibre-gl/dist/maplibre-gl.d.ts');
// MapLibre's Map inherits the event methods of Evented; count the whole public surface.
const declared = new Set(publicMethods(dts, ['Map', 'Map$1', 'Evented']));
const internal = new Set([...publicMethods(dts, ['Map', 'Map$1', 'Evented'], true), ...[...publicMethods(dts, ['Camera'])].filter(n => !declared.has(n))]);
const theirs = new Set([...declared].filter(n => !internal.has(n)));
// (The map of the entry maplibre-compat: the core class and the class that extends it.)
const ours = new Set([...publicMethods(path.join(root, 'src/map.ts'), ['Map']), ...publicMethods(path.join(root, 'src/compat-map.ts'), ['Map'])]);
// Methods that are accepted and have no effect (see "Accepted, with no effect" in src/compat-map.ts) are counted apart.
const inert = new Set(readFileSync(path.join(root, 'src/compat-map.ts'), 'utf8').split('// ---- Accepted, with no effect ----')[1].split('\n\n')[0].match(/^    [a-z]\w*(?=\()/gm).map(n => n.trim()).filter(n => /^set/.test(n)));
const have = [...theirs].filter(n => ours.has(n) && !inert.has(n)).sort(), accepted = [...theirs].filter(n => ours.has(n) && inert.has(n)).sort(), missing = [...theirs].filter(n => !ours.has(n)).sort();
const extra = [...ours].filter(n => !theirs.has(n)).sort(), notCounted = [...internal].sort();
console.log(`MapLibre Map API coverage: ${have.length} of ${theirs.size} methods (${(100 * have.length / theirs.size).toFixed(0)}%)`);
console.log(`Accepted with no effect: ${accepted.length} (${accepted.join(', ')})`);
console.log(`Ours only: ${extra.join(', ')}`);
console.log(`Internal to MapLibre GL JS, not counted: ${notCounted.length} (${notCounted.join(', ')})`);
if (process.argv.includes('--missing')) console.log(`Missing: ${missing.join(', ')}`);
if (process.argv.includes('--write')) {
    // Keep the compatibility document's method lists in step with the code.
    const file = path.join(root, 'docs/maplibre-compatibility.md'), doc = readFileSync(file, 'utf8');
    const block = apiBlock({have, accepted, extra, missing, notCounted});
    writeFileSync(file, doc.replace(/<!-- api:start -->[\s\S]*<!-- api:end -->/, block));
}
// The values (classes, functions and constants) that `maplibre-gl` exports and the entry does not. A name that the
// entry exports as a type only is listed apart: it compiles in a type position, and fails as a value.
const dtsText = readFileSync(dts, 'utf8'), exportList = dtsText.slice(dtsText.lastIndexOf('export {'));
const theirValues = new Set([
    ...[...dtsText.matchAll(/^export declare (?:abstract )?(?:class|function|const|let|var) (\w+)/gm)].map(m => m[1]),
    ...[...exportList.matchAll(/[{,]\s*(?!type )(?:[\w$]+ as )?(\w+)(?=\s*[,}])/g)].map(m => m[1]),
]);
const surface = compatSurface(root), absent = [...theirValues].filter(n => !surface.values.has(n)).sort();
const typeOnly = absent.filter(n => surface.types.has(n)), none = absent.filter(n => !surface.types.has(n));
console.log(`Exports of maplibre-gl that the entry lacks: ${absent.length} (${typeOnly.length} of them are types here)`);
if (process.argv.includes('--write')) {
    const file = path.join(root, 'docs/reference/maplibre-compat.md'), doc = readFileSync(file, 'utf8');
    const list = names => names.map(n => '`' + n + '`').join(', ');
    const block = ['<!-- exports:start -->',
        `**A type here, not a value** (${typeOnly.length}): ${list(typeOnly)}.`, '',
        `**Not exported** (${none.length}): ${list(none)}.`, '',
        '<!-- exports:end -->'].join('\n');
    writeFileSync(file, doc.replace(/<!-- exports:start -->[\s\S]*<!-- exports:end -->/, block));
}
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (have.length < min) { console.error(`FAIL: expected at least ${min}`); process.exit(1); }
