// Compares our Map class with MapLibre's public Map API and reports which methods exist.
//   node test/conformance/api.mjs [--missing] [--min=<count>]
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
/** Public method names of a class, read from source text (declaration files and our own source share this layout). */
const publicMethods = (file, classNames) => {
    const text = readFileSync(file, 'utf8'), names = new Set();
    for (const cls of classNames) {
        const start = text.search(new RegExp(`^(export )?(declare )?class ${cls.replace('$', '\\$')}\\b`, 'm'));
        if (start < 0) continue;
        const body = text.slice(start, text.indexOf('\n}', start));
        for (const m of body.matchAll(/^(?:\t|    |  )(?:(private|protected|static|readonly) )?(?:async )?([A-Za-z]\w*)(?:<[^>(]*>)?\(/gm)) {
            if (!m[1] && !['constructor', 'if', 'for', 'while', 'switch', 'return', 'function', 'catch'].includes(m[2])) names.add(m[2]);
        }
    }
    return names;
};
const dts = createRequire(import.meta.url).resolve('maplibre-gl/dist/maplibre-gl.d.ts');
// MapLibre's Map inherits camera and event methods; count the whole public surface.
const theirs = new Set([...publicMethods(dts, ['Map', 'Map$1']), ...publicMethods(dts, ['Camera']), ...publicMethods(dts, ['Evented'])]);
// (The map of the entry maplibre-compat: the core class and the class that extends it.)
const ours = new Set([...publicMethods(path.join(root, 'src/map.ts'), ['Map']), ...publicMethods(path.join(root, 'src/compat-map.ts'), ['Map'])]);
const have = [...theirs].filter(n => ours.has(n)).sort(), missing = [...theirs].filter(n => !ours.has(n)).sort();
const extra = [...ours].filter(n => !theirs.has(n)).sort();
console.log(`MapLibre Map API coverage: ${have.length} of ${theirs.size} methods (${(100 * have.length / theirs.size).toFixed(0)}%)`);
console.log(`Ours only: ${extra.join(', ')}`);
if (process.argv.includes('--missing')) console.log(`Missing: ${missing.join(', ')}`);
if (process.argv.includes('--write')) {
    // Keep the compatibility document's method lists in step with the code.
    const file = path.join(root, 'docs/maplibre-compatibility.md'), doc = readFileSync(file, 'utf8');
    const list = names => names.map(n => '`' + n + '`').join(', ');
    const block = `<!-- api:start -->\n${have.length} of the ${theirs.size} public methods of the MapLibre \`Map\` class are available (${(100 * have.length / theirs.size).toFixed(0)}%).\n\n` +
        `**Available:** ${list(have)}\n\n**Only in this library:** ${list(extra)}\n\n**Not available:** ${list(missing)}\n<!-- api:end -->`;
    writeFileSync(file, doc.replace(/<!-- api:start -->[\s\S]*<!-- api:end -->/, block));
}
const min = +(process.argv.find(a => a.startsWith('--min='))?.slice(6) ?? 0);
if (have.length < min) { console.error(`FAIL: expected at least ${min}`); process.exit(1); }
