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
const page = withStaticImports('map-jr-gl.js'), compat = withStaticImports('map-jr-gl-maplibre-compat.js'), engines = readdirSync('dist').filter(f => f.startsWith('map-jr-gl-engine-entry') && f.endsWith('.js')).map(f => withStaticImports(f));
// (The development build can have an engine file of its own, which imports the files of that build. The budget is for
// the engine of the production build: the one that imports a file of the production page.)
const engine = engines.find(files => [...files].some(f => compat.has(f))) ?? engines[0];
for (const f of compat) engine.delete(f); // the page has these already when it loads the engine

// A budget is a ceiling that catches an accident (a dependency in the bundle, a table that is not on demand). It is
// not a target to fill and not a limit to fight for bytes against: each has about 2 KB of room since 2026-11-12, by
// the owner, after a day in which several fixes each cost an hour to fit into the last 100 bytes. What keeps the
// library small is the rule in CLAUDE.md ("Size"): every pull request says what it adds, and a pass before each
// release looks for savings in one go.
const sizes = [
    // What a page downloads before the map can start. The worker file is downloaded at the same time.
    ['page script, up front (' + [...page].length + ' files)', gz(page), 31],
    // The same for the entry that is a replacement for MapLibre GL JS (`map-jr-gl/maplibre-compat`).
    ['page script of maplibre-compat, up front (' + [...compat].length + ' files)', gz(compat), 34],
    ['map-jr-gl-worker.js', gz(['map-jr-gl-worker.js']), 64],
    // Only when the engine runs on the main thread (no worker is possible).
    ['engine on the main thread, on demand', gz(engine), 61],
];
let ok = true;
for (const [name, kb, budget] of sizes) {
    if (kb > budget) ok = false;
    console.log(`${kb > budget ? 'OVER ' : 'ok   '} ${name}: ${Math.round(kb * 1024)} bytes gzip, ${kb.toFixed(1)} KB (budget ${budget} KB)`);
}
// The budgets are for the production build. The development build (`dist/*.dev.js`) has no budget: it is the same code
// with the loader of the checks for common mistakes, and that file of checks is downloaded after the map has started.
const dev = withStaticImports('map-jr-gl.dev.js'), mistakes = readdirSync('dist').filter(f => /^map-jr-gl-mistakes-.*\.js$/.test(f));
console.log(`info  page script of the development build, up front: ${gz(dev).toFixed(1)} KB gzip (${Math.round((gz(dev) - gz(page)) * 1024)} bytes more), and ${gz(mistakes).toFixed(1)} KB gzip of checks on demand`);
if (!ok) { console.error('The built library is larger than a budget. Make it smaller, or change the budget in scripts/size-check.mjs on purpose.'); process.exit(1); }
