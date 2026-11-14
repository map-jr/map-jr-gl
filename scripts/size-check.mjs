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
// the engine of the production build: the one that shares the most files with the production page. Both engines can
// share a small chunk with the page (the runtime of the bundler), so "shares a file" alone can pick the wrong one.)
const shared = files => [...files].filter(f => compat.has(f)).length;
const engine = engines.reduce((a, b) => shared(b) > shared(a) ? b : a);
for (const f of compat) engine.delete(f); // the page has these already when it loads the engine

// A budget is a ceiling that catches an accident (a dependency in the bundle, a table that is not on demand). It is
// not a target to fill and not a limit to fight for bytes against. On 2026-11-14 the owner raised the budgets of the
// page scripts, the worker, the engine and the server renderer by about 4 to 8 KB each and set a new priority: a
// fast time to idle (the map drawn and ready) comes before the size of the files that load up front. Do not move
// code that a usual map needs to a file that loads on demand only to save bytes: each such file is one more request
// before the map is ready. Every pull request still says what it adds (CLAUDE.md, "Size").
const sizes = [
    // What a page downloads before the map can start. The worker file is downloaded at the same time.
    ['page script, up front (' + [...page].length + ' files)', gz(page), 36],
    // The same for the entry that is a replacement for MapLibre GL JS (`@map-jr/map-jr-gl/maplibre-compat`).
    ['page script of maplibre-compat, up front (' + [...compat].length + ' files)', gz(compat), 39],
    ['map-jr-gl-worker.js', gz(['map-jr-gl-worker.js']), 72],
    // Only when the engine runs on the main thread (no worker is possible).
    ['engine on the main thread, on demand', gz(engine), 68],
    // The server renderer (`@map-jr/map-jr-gl/server`), with the files that it imports when it loads.
    // The control functions (`@map-jr/map-jr-gl/controls`). They load the control classes, and with them the map,
    // only when the map adds a control, so a page can import them before it makes the map (#160).
    ['controls.js, up front (' + [...withStaticImports('controls.js')].length + ' files)', gz(withStaticImports('controls.js')), 2.5],
    // The adapter for Vue (`@map-jr/map-jr-gl/vue`). `MapJr` loads the map when it is mounted, so a component that
    // imports only `MapOverlay`, `MapImage` or `useMapHost` does not load the map (#159).
    ['vue.js, up front (' + [...withStaticImports('vue.js')].length + ' files)', gz(withStaticImports('vue.js')), 5],
    ['server.js (' + [...withStaticImports('server.js')].length + ' files)', gz(withStaticImports('server.js')), 44],
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
