// Fails when the built library is larger than its budgets. Run after `pnpm build`. Raise a budget only on purpose:
// the size of the library is one of its main advantages.
import {gzipSync} from 'node:zlib';
import {readFileSync, readdirSync} from 'node:fs';

/** A file and all the files that it imports when it loads (not the ones that it imports on demand). */
function withStaticImports(file, seen = new Set()) {
    if (seen.has(file)) return seen;
    seen.add(file);
    const code = readFileSync('dist/' + file, 'utf8');
    for (const m of code.matchAll(/(?:import|export)\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+)["']/g)) withStaticImports(m[1], seen);
    return seen;
}
const gz = files => [...files].reduce((sum, f) => sum + gzipSync(readFileSync('dist/' + f)).length, 0) / 1024;
const page = withStaticImports('map-jr-gl.js'), compat = withStaticImports('map-jr-gl-maplibre-compat.js'), engine = withStaticImports(readdirSync('dist').find(f => f.startsWith('map-jr-gl-engine-entry')));
for (const f of compat) engine.delete(f); // the page has these already when it loads the engine

const sizes = [
    // What a page downloads before the map can start. The worker file is downloaded at the same time.
    ['page script, up front (' + [...page].length + ' files)', gz(page), 27],
    // The same for the entry that is a replacement for MapLibre GL JS (`map-jr-gl/maplibre-compat`).
    ['page script of maplibre-compat, up front (' + [...compat].length + ' files)', gz(compat), 29.5],
    ['map-jr-gl-worker.js', gz(['map-jr-gl-worker.js']), 58.5],
    // Only when the engine runs on the main thread (no worker is possible).
    ['engine on the main thread, on demand', gz(engine), 55.5],
];
let ok = true;
for (const [name, kb, budget] of sizes) {
    if (kb > budget) ok = false;
    console.log(`${kb > budget ? 'OVER ' : 'ok   '} ${name}: ${kb.toFixed(1)} KB gzip (budget ${budget} KB)`);
}
if (!ok) { console.error('The built library is larger than a budget. Make it smaller, or change the budget in scripts/size-check.mjs on purpose.'); process.exit(1); }
