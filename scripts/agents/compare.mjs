// Shows the build of main, the build of a branch and MapLibre GL JS side by side, on one page with three maps (#1927).
//
//   node scripts/agents/compare.mjs <worktree of the branch> [--shots <dir> --views "vector,4;raster,2.5"]
//
// The checkout that this script runs in is `main`. Both checkouts must be built (`pnpm build`). The script serves
//   /main/<file>    from dist/ of this checkout,
//   /branch/<file>  from dist/ of the worktree of the branch,
//   /ml/<file>      from node_modules/maplibre-gl/dist/ of this checkout,
// and the page `/` with three maps: the compat entry (`map-jr-gl-maplibre-compat.js`) of each build and
// `maplibre-gl.mjs`. Moving one map moves the other two. The query string of the page sets the view:
//   style       `vector` (https://styles.map-jr.org/1/elevation-zero.json; MapLibre GL JS gets the variant of the same
//               style under /1/maplibre/), `raster` (Sentinel-2 cloudless 2020 by EOX), or the URL of a style;
//   zoom, lat, lng, pitch, bearing   numbers (defaults 4, 47, 8, 0, 0);
//   projection  `globe` for the globe.
// It takes a free port, prints the URL, and stops when its standard input closes (as scripts/agents/suite.mjs does),
// so it runs until you end it with Ctrl-D or Ctrl-C.
//
// With `--shots <dir>`, it opens the page in headless Chromium (test/launch.mjs) for each view of `--views`
// ("style,zoom[,lat,lng[,pitch,bearing]]", separated by ";"), waits until all three maps are idle (at most 30 s, and
// the file is written in any case), writes <dir>/<n>-<style>-<zoom>.png, prints the tile requests of each map by zoom
// level, and then stops the server.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
if (!args.length || args.includes('--help')) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
    process.exit(args.length ? 0 : 2);
}
const shots = option('--shots'), views = option('--views') ?? 'vector,4';
const branch = path.resolve(args[0]);
const folders = {main: path.join(root, 'dist'), branch: path.join(branch, 'dist'), ml: path.join(root, 'node_modules/maplibre-gl/dist')};
for (const [name, dir] of Object.entries(folders)) {
    const file = path.join(dir, name === 'ml' ? 'maplibre-gl.mjs' : 'map-jr-gl-maplibre-compat.js');
    if (!existsSync(file)) { console.error(`compare.mjs: ${file} is missing. Run \`pnpm build\` (or \`pnpm install\`) in ${path.dirname(dir)}.`); process.exit(2); }
}

const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.json': 'application/json', '.html': 'text/html; charset=utf-8'};
const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>main, branch, MapLibre GL JS</title>
<link rel="stylesheet" href="/ml/maplibre-gl.css">
<style>
body { margin: 0; font: 14px system-ui, sans-serif; background: #fff; color: #111; }
nav { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 6px 8px; }
main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; height: calc(100vh - 70px); }
section { display: flex; flex-direction: column; min-width: 0; }
h2 { font-size: 14px; margin: 2px 4px; }
.map { flex: 1; position: relative; }
@media (max-width: 700px) { main { grid-template-columns: 1fr; height: auto; } .map { height: 300px; flex: none; } }
</style>
<nav>
  <a href="?style=vector">vector</a> <a href="?style=raster">raster</a> <a href="?style=vector&projection=globe&zoom=1.5">globe</a>
  <button id="out">zoom −</button><button id="in">zoom +</button><button id="tilt">pitch 0/60</button>
  <span id="view"></span>
</nav>
<main>
  <section><h2>main <span id="s-main"></span></h2><div id="main" class="map"></div></section>
  <section><h2>branch <span id="s-branch"></span></h2><div id="branch" class="map"></div></section>
  <section><h2>MapLibre GL JS <span id="s-ml"></span></h2><div id="ml" class="map"></div></section>
</main>
<script type="module">
const q = new URLSearchParams(location.search), num = (k, d) => q.has(k) ? Number(q.get(k)) : d;
const kind = q.get('style') ?? 'vector';
const raster = {version: 8, sources: {s2: {type: 'raster', tileSize: 256, maxzoom: 15,
  tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'],
  attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless - https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)'}},
  layers: [{id: 's2', type: 'raster', source: 's2'}]};
const style = which => kind === 'raster' ? structuredClone(raster) : kind === 'vector'
  ? (which === 'ml' ? 'https://styles.map-jr.org/1/maplibre/elevation-zero.json' : 'https://styles.map-jr.org/1/elevation-zero.json') : kind;
const camera = {center: [num('lng', 8), num('lat', 47)], zoom: num('zoom', 4), pitch: num('pitch', 0), bearing: num('bearing', 0)};
const [mainLib, branchLib, mlLib] = await Promise.all([import('/main/map-jr-gl-maplibre-compat.js'), import('/branch/map-jr-gl-maplibre-compat.js'), import('/ml/maplibre-gl.mjs')]);
const libs = {main: mainLib.default ?? mainLib, branch: branchLib.default ?? branchLib, ml: mlLib.default ?? mlLib};
window.compare = {idle: {}, tiles: {}, errors: []};
const maps = {};
let syncing = false;
for (const [which, lib] of Object.entries(libs)) {
  const tiles = window.compare.tiles[which] = {};
  const map = maps[which] = new lib.Map({container: which, style: style(which), ...camera, hash: false,
    transformRequest(url, type) { if (type === 'Tile') { const z = /\\/(\\d{1,2})\\/\\d+\\/\\d+(?:\\.\\w+)?(?:[?#]|$)/.exec(url)?.[1] ?? '?'; tiles[z] = (tiles[z] ?? 0) + 1; } return {url}; }});
  map.addControl(new lib.NavigationControl());
  if (q.get('projection') === 'globe') map.on('style.load', () => map.setProjection({type: 'globe'}));
  map.on('error', e => window.compare.errors.push(which + ': ' + (e.error?.message ?? e.error ?? e)));
  map.on('idle', () => { window.compare.idle[which] = true; document.getElementById('s-' + which).textContent = '(idle)'; });
  map.on('movestart', () => { window.compare.idle[which] = false; document.getElementById('s-' + which).textContent = ''; });
  map.on('move', () => {
    if (syncing) return;
    syncing = true;
    const c = map.getCenter(), view = {center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing()};
    for (const other of Object.values(maps)) if (other !== map) other.jumpTo(view);
    document.getElementById('view').textContent = 'zoom ' + view.zoom.toFixed(2) + ', ' + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
    syncing = false;
  });
}
const first = () => maps.main;
document.getElementById('in').onclick = () => first().zoomIn();
document.getElementById('out').onclick = () => first().zoomOut();
document.getElementById('tilt').onclick = () => first().easeTo({pitch: first().getPitch() > 30 ? 0 : 60});
</script>
`;

const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.writeHead(200, {'content-type': types['.html'], 'cache-control': 'no-store'}); res.end(page); return; }
    const [, name, ...rest] = url.pathname.split('/');
    const dir = folders[name], file = dir && path.join(dir, decodeURIComponent(rest.join('/')));
    if (!file || !file.startsWith(dir + path.sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store'});
    res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://localhost:${server.address().port}/`;
console.log(`compare.mjs: main ${root}, branch ${branch}`);
console.log(`compare.mjs: ${base}?style=vector&zoom=4`);

if (!shots) {
    // Stops when the standard input closes (Ctrl-D, or the end of the process that started it).
    process.stdin.on('data', () => {}).on('end', () => { server.close(); process.exit(0); });
} else {
    const {launch} = await import('../../test/launch.mjs');
    mkdirSync(shots, {recursive: true});
    const browser = await launch();
    try {
        const page = await browser.newPage({viewport: {width: 1500, height: 600}});
        let n = 0;
        for (const view of views.split(';').map(v => v.trim()).filter(Boolean)) {
            const [style, zoom = '4', lat, lng, pitch, bearing] = view.split(',').map(s => s.trim());
            const q = new URLSearchParams({style, zoom});
            for (const [k, v] of Object.entries({lat, lng, pitch, bearing})) if (v) q.set(k, v);
            const started = Date.now();
            await page.goto(base + '?' + q, {waitUntil: 'load'});
            const allIdle = await page.waitForFunction(() => window.compare && ['main', 'branch', 'ml'].every(w => window.compare.idle[w]), null, {timeout: 30000}).then(() => true, () => false);
            const file = path.join(shots, `${++n}-${style.replace(/\W+/g, '_').slice(0, 40)}-${zoom}.png`);
            await page.screenshot({path: file});
            const state = await page.evaluate(() => window.compare ?? {});
            console.log(`${file}: ${allIdle ? `all three idle after ${((Date.now() - started) / 1000).toFixed(1)} s` : `not all idle after 30 s (idle: ${Object.keys(state.idle ?? {}).filter(w => state.idle[w]).join(', ') || 'none'})`}`);
            for (const which of ['main', 'branch', 'ml']) {
                const tiles = state.tiles?.[which] ?? {};
                const total = Object.values(tiles).reduce((a, b) => a + b, 0);
                console.log(`  ${which.padEnd(6)} ${total} tile requests: ${Object.entries(tiles).sort((a, b) => Number(a[0]) - Number(b[0])).map(([z, c]) => `z${z} ${c}`).join(', ') || 'none'}`);
            }
            for (const e of state.errors ?? []) console.log(`  error ${e}`);
        }
    } finally {
        await browser.close();
        server.close();
    }
}
