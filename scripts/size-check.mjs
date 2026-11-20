// Fails when a map downloads more than a third of what MapLibre GL JS downloads, or when another built file is larger
// than its ceiling. Run after `pnpm build`. The size of the library is one of its main advantages.
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

// The hard line (the owner, 2026-11-17): what a page with a map downloads, the page script up front and the worker
// file together, is at most a third of what MapLibre GL JS downloads (its page script, its worker and its CSS). The
// limit is computed from the MapLibre GL JS that is installed, so no number here needs to be raised. It replaces the
// budgets of the page scripts and of the worker file, which were raised seven times from 2026-11-14 to 2026-11-16.
// The line is not a target: every pull request still says what it adds and keeps that small (CLAUDE.md, "Size").
// A fast time to idle comes before the size of the files that load up front, so do not move code that a usual map
// needs to a file that loads on demand only to save bytes.
const ml = 'node_modules/maplibre-gl/dist/';
let maplibre;
try { maplibre = ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css'].reduce((sum, f) => sum + gzipSync(readFileSync(ml + f)).length, 0) / 1024; }
catch { console.error(`The size check needs the files of MapLibre GL JS in ${ml}. Run \`pnpm install\`.`); process.exit(1); }
const worker = gz(['map-jr-gl-worker.js']), line = maplibre / 3;
const row = (name, kb) => console.log(`info  ${name}: ${Math.round(kb * 1024)} bytes gzip, ${kb.toFixed(1)} KB`);
row('page script, up front (' + [...page].length + ' files)', gz(page));
row('page script of maplibre-compat, up front (' + [...compat].length + ' files)', gz(compat));
row('map-jr-gl-worker.js', worker);
const sizes = [
    // What a page downloads before the map can draw, for each entry.
    ['download of a map: page script and worker', gz(page) + worker, line],
    ['download of a map with maplibre-compat: page script and worker', gz(compat) + worker, line],
    // The files below are not part of that download. Their ceilings are wide and only catch an accident (a dependency
    // in the bundle, a table that is not on demand).
    // Only when the engine runs on the main thread (no worker is possible).
    ['engine on the main thread, on demand', gz(engine), 90],
    // The control functions (`@map-jr/map-jr-gl/controls`). They load the control classes, and with them the map,
    // only when the map adds a control, so a page can import them before it makes the map (#160).
    ['controls.js, up front (' + [...withStaticImports('controls.js')].length + ' files)', gz(withStaticImports('controls.js')), 4],
    // The adapter for Vue (`@map-jr/map-jr-gl/vue`). `MapJr` loads the map when it is mounted, so a component that
    // imports only `MapOverlay`, `MapImage` or `useMapInstance` does not load the map (#159).
    ['vue.js, up front (' + [...withStaticImports('vue.js')].length + ' files)', gz(withStaticImports('vue.js')), 8],
    // The adapter for React (`@map-jr/map-jr-gl/react`), with the files that it imports when it loads (#1266).
    ['react.js, up front (' + [...withStaticImports('react.js')].length + ' files)', gz(withStaticImports('react.js')), 8],
    // The web component (`@map-jr/map-jr-gl/element`), without the page script that it imports, which is counted above (#826).
    ['element.js, without the page script', gz(['element.js']), 4],
    // The server renderer (`@map-jr/map-jr-gl/server`), with the files that it imports when it loads.
    ['server.js (' + [...withStaticImports('server.js')].length + ' files)', gz(withStaticImports('server.js')), 56],
];
let ok = true;
for (const [name, kb, budget] of sizes) {
    if (kb > budget) ok = false;
    console.log(`${kb > budget ? 'OVER ' : 'ok   '} ${name}: ${Math.round(kb * 1024)} bytes gzip, ${kb.toFixed(1)} KB (limit ${budget.toFixed(1)} KB)`);
}
console.log(`info  MapLibre GL JS downloads ${maplibre.toFixed(1)} KB gzip (page script, worker and CSS). A map of this library downloads ${(maplibre / (gz(page) + worker)).toFixed(2)} times less, and ${(maplibre / (gz(compat) + worker)).toFixed(2)} times less with maplibre-compat.`);
// The limits are for the production build. The development build (`dist/*.dev.js`) has no limit: it is the same code
// with the loader of the checks for common mistakes, and that file of checks is downloaded after the map has started.
const dev = withStaticImports('map-jr-gl.dev.js'), mistakes = readdirSync('dist').filter(f => /^map-jr-gl-mistakes-.*\.js$/.test(f));
console.log(`info  page script of the development build, up front: ${gz(dev).toFixed(1)} KB gzip (${Math.round((gz(dev) - gz(page)) * 1024)} bytes more), and ${gz(mistakes).toFixed(1)} KB gzip of checks on demand`);
if (!ok) { console.error('The built library is larger than a limit. Make it smaller. The limit of the download is a third of MapLibre GL JS and does not rise; a change of it or of a ceiling needs the owner.'); process.exit(1); }
