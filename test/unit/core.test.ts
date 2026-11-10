// Unit tests for the DOM-free core. Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Transform, bezier, mercX, mercY} from '../../src/geo.ts';
import {compileExpr, compileFilter, compileProp, parseColor} from '../../src/expr.ts';
import {applySSROverrides, compileLayer} from '../../src/style.ts';
import {LINE_VERTEX, buildTile, tessellate, type Batch} from '../../src/tile.ts';
import {queryTile, sampleElevation} from '../../src/query.ts';
import {CollisionGrid, renderItems} from '../../src/placement.ts';
import {fillTemplate, sizedSVG} from '../../src/markers.ts';
import {renderToSVG} from '../../src/server.ts';
import {decodePNG, decodeWebPLossless} from '../../src/webp.ts';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

// A real OpenMapTiles tile of lower Manhattan (© OpenStreetMap contributors, via OpenFreeMap).
const TILE = {z: 14, x: 4823, y: 6160}, bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const camera = (pitch = 0, bearing = 0) => { const t = new Transform(); t.width = 800; t.height = 600; t.set([-74.006, 40.7128], 14.3, bearing, pitch); return t; };

test('transform: project and unproject are inverses, flat, rotated and tilted', () => {
    for (const [pitch, bearing] of [[0, 0], [0, 37], [45, 0], [60, -120]]) {
        const t = camera(pitch, bearing);
        for (const [x, y] of [[400, 300], [10, 590], [790, 20], [123, 456]]) {
            const [lng, lat] = t.unproject(x, y), [px, py] = t.project(lng, lat);
            close(px, x, 1e-5); close(py, y, 1e-5);
        }
        const [cx, cy] = t.project(-74.006, 40.7128);
        close(cx, 400, 1e-6); close(cy, 300, 1e-6);
    }
});

test('transform: the GPU matrix agrees with projectTile, including height', () => {
    const t = camera(50, 25), id = {z: 14, x: 4823, y: 6160, w: 0, key: '14/4823/6160'}, m = t.tileMatrix4(id);
    for (const [x, y, h] of [[0, 0, 0], [4096, 4096, 0], [2000, 1000, 120]]) {
        const w = m[3] * x + m[7] * y + m[11] * h + m[15];
        const sx = ((m[0] * x + m[4] * y + m[8] * h + m[12]) / w + 1) / 2 * t.width, sy = (1 - (m[1] * x + m[5] * y + m[9] * h + m[13]) / w) / 2 * t.height;
        const [px, py] = t.projectTile(id, x, y, h);
        close(sx, px, 1e-2); close(sy, py, 1e-2);
    }
});

test('transform: zooming around a point keeps that point fixed', () => {
    const t = camera(40, 15), [lng, lat] = t.unproject(650, 120);
    t.set(undefined, 16.1);
    t.setLocationAt(lng, lat, 650, 120);
    const [x, y] = t.project(lng, lat);
    close(x, 650, 1e-5); close(y, 120, 1e-5);
});

test('transform: tile cover is uniform when flat and coarser with distance when tilted', () => {
    const flat = camera().coveringTiles(0, 14);
    assert.ok(flat.length >= 2 && flat.every(t => t.z === 14));
    assert.equal(flat[0].key, `14/${Math.floor(mercX(-74.006) * 2 ** 14)}/${Math.floor(mercY(40.7128) * 2 ** 14)}`); // the centre's tile comes first
    const tilted = camera(60).coveringTiles(0, 14), zooms = new Set(tilted.map(t => t.z));
    assert.ok(zooms.has(14) && Math.min(...zooms) < 14, [...zooms].join());
    assert.ok(tilted.length < 60, `too many tiles: ${tilted.length}`);
    assert.equal(camera().coveringTiles(0, 22, 256)[0].z, 15); // 256px tiles load one level deeper
});

test('easing: bezier hits its endpoints and is monotonic', () => {
    const ease = bezier(0.25, 0.1, 0.25, 1);
    assert.equal(ease(0), 0); assert.equal(ease(1), 1);
    for (let i = 1; i <= 20; i++) assert.ok(ease(i / 20) >= ease((i - 1) / 20));
});

test('colours: common CSS forms parse', () => {
    assert.deepEqual(parseColor('#f00'), [1, 0, 0, 1]);
    assert.deepEqual(parseColor('rgba(0, 0, 255, 0.5)'), [0, 0, 1, 0.5]);
    assert.deepEqual(parseColor('hsl(120, 100%, 50%)')!.map(v => +v.toFixed(3)), [0, 1, 0, 1]);
    assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
    assert.equal(parseColor('not-a-colour'), null);
});

test('expressions: data, zoom and legacy forms evaluate', () => {
    const f = {type: 2, properties: {class: 'primary', lanes: 3}};
    assert.equal(compileExpr(['match', ['get', 'class'], ['primary', 'trunk'], 'big', 'small'], {dd: false, zoom: false})({zoom: 0, f}), 'big');
    assert.equal(compileProp(['interpolate', ['linear'], ['zoom'], 10, 1, 20, 11], 'number', 0).eval(15), 6);
    assert.equal(compileProp({stops: [[10, 1], [20, 11]]}, 'number', 0).eval(15), 6);
    assert.equal(compileProp({property: 'lanes', type: 'identity'}, 'number', 0).eval(0, f), 3); // regression: identity functions
    assert.deepEqual(compileProp({stops: [[5, [1, 2]], [10, [3, 4]]]}, 'discrete', null).eval(7), [1, 2]); // dash arrays step, not blend
    assert.equal(compileFilter(['all', ['==', 'class', 'primary'], ['!in', 'class', 'path']])!({zoom: 0, f}), true);
    assert.equal(compileFilter(['==', ['geometry-type'], 'Polygon'])!({zoom: 0, f}), false);
    assert.equal(compileExpr(['number-format', 1234.5, {'max-fraction-digits': 0, locale: 'en-US'}], {dd: false, zoom: false})({zoom: 0, f: null}), '1,235');
});

test('tessellation: triangles cover exactly the polygon area, holes excluded', () => {
    // 100x100 square with a 20x20 hole (opposite winding).
    const batch: Batch = {type: 'fill', geom: {coords: Int16Array.from([0, 0, 100, 0, 100, 100, 0, 100, 40, 40, 40, 60, 60, 60, 60, 40]), ringEnds: Uint32Array.from([4, 8]), featEnds: Uint32Array.from([2])}};
    const gl = tessellate(batch) as any, c = batch.geom.coords;
    let area = 0;
    for (let i = 0; i < gl.idx.length; i += 3) {
        const [a, b, d] = [gl.idx[i], gl.idx[i + 1], gl.idx[i + 2]];
        area += Math.abs((c[b * 2] - c[a * 2]) * (c[d * 2 + 1] - c[a * 2 + 1]) - (c[d * 2] - c[a * 2]) * (c[b * 2 + 1] - c[a * 2 + 1])) / 2;
    }
    assert.equal(area, 100 * 100 - 20 * 20);
});

test('tessellation: lines and buildings produce well-formed meshes', () => {
    const geom = {coords: Int16Array.from([0, 0, 100, 0, 100, 100]), ringEnds: Uint32Array.from([3]), featEnds: Uint32Array.from([1])};
    for (const [cap, join] of [['butt', 'miter'], ['round', 'round'], ['square', 'bevel']]) {
        const line = tessellate({type: 'line', geom, cap, join}) as any;
        // Vertices are packed, LINE_VERTEX bytes each: position, sideways direction, side, distance along the line.
        assert.equal(line.v.length % LINE_VERTEX, 0);
        assert.ok(line.idx.length % 3 === 0 && Math.max(...line.idx) < line.v.length / LINE_VERTEX, `${cap}/${join}`);
        const view = new DataView(line.v.buffer, line.v.byteOffset), last = line.v.length - LINE_VERTEX;
        assert.deepEqual([view.getInt16(0, true), view.getInt16(2, true)], [0, 0], 'first vertex is at the line start');
        assert.ok(Math.abs(view.getFloat32(last + 12, true) - 200) < 1e-3, 'the last vertex is 200 units along the line');
    }
    const box = {coords: Int16Array.from([0, 0, 10, 0, 10, 10, 0, 10]), ringEnds: Uint32Array.from([4]), featEnds: Uint32Array.from([1])};
    const building = tessellate({type: 'fill', geom: box, height: Float32Array.from([30]), base: Float32Array.from([0])}) as any;
    assert.equal(building.type, 'extrusion');
    assert.equal(building.idx.length, (2 + 4 * 2) * 3); // two roof triangles and two per wall
    assert.equal(Math.max(...Array.from(building.v as Float32Array).filter((_, i) => i % 4 === 2)), 30);
});

test('tiles: a real tile builds layers and labels from a style', () => {
    const layers = [
        {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#00f'}},
        {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', filter: ['==', 'class', 'primary'], paint: {'line-width': ['get', 'lanes']}},
        {id: 'names', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: {'text-field': '{name}', 'symbol-placement': 'line', 'text-font': ['Open Sans Semibold Italic']}},
        {id: 'buildings', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height']}},
    ].map(l => compileLayer(l)!);
    const ir = buildTile(bytes, TILE.z, layers, true);
    assert.deepEqual(Object.keys(ir.layers).sort(), ['buildings', 'roads', 'water']);
    assert.ok(ir.layers.roads.width, 'data-driven width is carried per feature');
    assert.ok(ir.layers.buildings.height!.some(h => h > 50), 'building heights come from the data');
    const label = ir.labels.names[0];
    assert.ok(label.text.length > 0 && label.angle !== null);
    assert.equal(label.font, 'italic 600|Open Sans');
});

test('queries: features are found from raw tile data, with filters and geometry', () => {
    const q = {source: 's', ...TILE, px: 2048, py: 2048, radius: 400};
    const all = queryTile(bytes, q);
    assert.ok(all.length > 0);
    const buildings = queryTile(bytes, {...q, sourceLayers: ['building'], geometry: true});
    assert.ok(buildings.length > 0 && buildings.every(f => f.sourceLayer === 'building' && f.type === 'Polygon'));
    const [lng, lat] = (buildings[0].geometry!.coordinates as number[][][])[0][0];
    assert.ok(lng > -74.03 && lng < -73.99 && lat > 40.69 && lat < 40.72, `${lng}, ${lat}`);
    assert.equal(queryTile(bytes, {...q, filter: ['==', ['get', 'class'], 'no-such-class']}).length, 0);
});

test('elevation: Terrarium and Mapbox encodings decode, with interpolation between pixels', () => {
    // 2x1 image: 100 m and 200 m, Terrarium encoded (R * 256 + G + B / 256 - 32768).
    const px = (m: number) => { const v = m + 32768; return [Math.floor(v / 256), Math.floor(v % 256), 0, 255]; };
    const data = [...px(100), ...px(200)];
    close(sampleElevation(data, 2, 1, 0.25, 0.5, 'terrarium'), 100);
    close(sampleElevation(data, 2, 1, 0.5, 0.5, 'terrarium'), 150);
    close(sampleElevation([1, 134, 160, 255], 1, 1, 0.5, 0.5, 'mapbox'), 0, 1e-9); // -10000 + 100000 * 0.1
});

test('placement: collision grid and tile fallback', () => {
    const grid = new CollisionGrid();
    grid.insert(10, 10, 60, 30);
    assert.equal(grid.hits(50, 20, 90, 40), true);
    assert.equal(grid.hits(61, 10, 90, 30), false);
    const t = camera(), ideal = t.coveringTiles(0, 14), loaded = new Map([['13/2412/3079', 'parent']]);
    const items = renderItems(t, ideal, k => loaded.get(k));
    const fromParent = items.filter(i => i.id.z === 13);
    assert.ok(fromParent.length > 0 && fromParent.every(i => i.clip[2] - i.clip[0] === 2048), 'a parent stands in, clipped to the missing child');
});

test('style: server overrides hide layers, add filters and adjust detail', () => {
    const out = applySSROverrides([
        {id: 'a', type: 'line', metadata: {'map-jr:ssr': {hidden: true}}},
        {id: 'b', type: 'line', filter: ['==', 'class', 'x'], paint: {'line-width': 1}, metadata: {'map-jr:ssr': {filter: ['>', ['get', 'rank'], 2], paint: {'line-width': 3}, minSize: 5}}},
        {id: 'c', type: 'fill'},
    ]);
    assert.deepEqual(out.map(l => l.id), ['b', 'c']);
    const b = compileLayer({...out[0], source: 's'})!;
    assert.equal(b.p.width.eval(0), 3);
    assert.equal(b.ssr!.minSize, 5);
    assert.equal(b.filter!({zoom: 0, f: {type: 2, properties: {class: 'x', rank: 3}}}), true);
    assert.equal(b.filter!({zoom: 0, f: {type: 2, properties: {class: 'x', rank: 1}}}), false);
});

test('markers: templates escape values and get explicit sizes', () => {
    assert.equal(fillTemplate('<text>{{label}}</text>', {label: '<b>&'}), '<text>&#60;b&#62;&#38;</text>');
    assert.match(sizedSVG('<svg viewBox="0 0 10 20"><rect/></svg>', 30, 60), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]* width="30" height="60" viewBox="0 0 10 20"><rect\/><\/svg>$/);
});

test('server: renders a tile to SVG offline, with generated icons and overrides', async () => {
    const style = {
        version: 8, sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14}},
        layers: [
            {id: 'bg', type: 'background', paint: {'background-color': '#eee'}},
            {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#0af'}},
            {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2, 1]}},
            {id: 'hidden', type: 'fill', source: 's', 'source-layer': 'building', paint: {'fill-color': '#123456'}, metadata: {'map-jr:ssr': {hidden: true}}},
            {id: 'shields', type: 'symbol', source: 's', 'source-layer': 'transportation_name', filter: ['has', 'ref'], layout: {'icon-image': ['concat', 'ref-', ['get', 'ref']], 'symbol-placement': 'line'}},
            {id: 'names', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: {'text-field': '{name}', 'symbol-placement': 'line'}, paint: {'text-halo-color': '#fff', 'text-halo-width': 1}},
        ],
    };
    const requested: string[] = [];
    const fetch = async (url: any) => { requested.push(String(url)); return String(url).includes('/14/4823/6160.pbf') ? new Response(bytes) : new Response(null, {status: 404}); };
    const n = 2 ** 14, center: [number, number] = [(TILE.x + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (TILE.y + 0.5) / n))) * 180 / Math.PI];
    close(mercX(center[0]) * n, TILE.x + 0.5, 1e-6); close(mercY(center[1]) * n, TILE.y + 0.5, 1e-6);
    const opts = {style, center, zoom: 14.5, width: 400, height: 300, fetch: fetch as any, resolveImage: (name: string) => ({svg: `<svg viewBox="0 0 20 12"><rect width="20" height="12" data-name="${name}"/></svg>`, width: 20, height: 12})};
    const {svg, tiles} = await renderToSVG(opts);
    assert.ok(tiles.includes('https://tiles.test/14/4823/6160.pbf'));
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="400" height="300"/);
    assert.match(svg, /fill="#00aaff"/); assert.match(svg, /stroke-dasharray="4 2"/); assert.match(svg, /<text /);
    assert.match(svg, /<symbol id="i0"[^>]*><rect width="20" height="12" data-name="ref-/, 'generated icons are embedded as vector symbols');
    assert.ok(!svg.includes('#123456'), 'a layer hidden for server output is left out');
    const full = await renderToSVG({...opts, ssrOverrides: false});
    assert.ok(full.svg.includes('#123456') && full.svg.length > svg.length);
});

test('style: font-faces become web fonts keyed by family, weight and style', async () => {
    const {resolveStyle, parseFontName} = await import('../../src/style.ts');
    assert.deepEqual(parseFontName('Open Sans Semibold Italic'), {family: 'Open Sans', weight: 600, style: 'italic'});
    assert.deepEqual(parseFontName('Noto Sans Regular'), {family: 'Noto Sans', weight: 400, style: 'normal'});
    const style = await resolveStyle({version: 8, sources: {}, layers: [], 'font-faces': {
        'Open Sans Bold': 'fonts/open-sans-bold.woff2',
        'Noto Sans Regular': [{url: 'https://fonts.test/khmer.ttf', 'unicode-range': ['U+1780-17FF', 'U+19E0-19FF']}],
    }}, undefined, 'https://example.test/styles/style.json');
    assert.deepEqual(style.fonts, [
        {family: 'Open Sans', weight: 700, style: 'normal', src: 'https://example.test/styles/fonts/open-sans-bold.woff2', unicodeRange: undefined},
        {family: 'Noto Sans', weight: 400, style: 'normal', src: 'https://fonts.test/khmer.ttf', unicodeRange: 'U+1780-17FF, U+19E0-19FF'},
    ]);
});

test('pmtiles: tiles are read from an archive by range request, through directories', async () => {
    const {PMTiles, tileId, fetchTile} = await import('../../src/pmtiles.ts');
    assert.deepEqual([tileId(0, 0, 0), tileId(1, 0, 0), tileId(1, 0, 1), tileId(1, 1, 1), tileId(1, 1, 0), tileId(2, 0, 0)], [0, 1, 2, 3, 4, 5]);
    // Build a minimal archive: header, an uncompressed root directory with two tiles, then the tile data.
    const varint = (n: number) => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 0x80; o.push(b); } while (n); return o; };
    const tiles = [{id: tileId(14, 4823, 6160), data: bytes.subarray(0, 5000)}, {id: tileId(14, 4824, 6160), data: bytes.subarray(5000, 5300)}].sort((a, b) => a.id - b.id);
    const dir = [...varint(2), ...varint(tiles[0].id), ...varint(tiles[1].id - tiles[0].id), ...varint(1), ...varint(1),
        ...varint(tiles[0].data.length), ...varint(tiles[1].data.length), ...varint(1), ...varint(0)];
    const file = new Uint8Array(127 + dir.length + tiles[0].data.length + tiles[1].data.length), v = new DataView(file.buffer);
    file.set(new TextEncoder().encode('PMTiles')); file[7] = 3;
    const u64 = (o: number, n: number) => v.setUint32(o, n, true);
    u64(8, 127); u64(16, dir.length); u64(56, 127 + dir.length);
    file[97] = 1; file[98] = 1; file[99] = 1; file[100] = 14; file[101] = 14;
    file.set(dir, 127); file.set(tiles[0].data, 127 + dir.length); file.set(tiles[1].data, 127 + dir.length + tiles[0].data.length);
    const ranges: string[] = [];
    const fetch = (async (_url: any, init: any) => {
        const [, a, b] = /bytes=(\d+)-(\d+)/.exec(init.headers.Range)!;
        ranges.push(init.headers.Range);
        return new Response(file.subarray(+a, Math.min(file.length, +b + 1)), {status: 206});
    }) as any;
    const pm = new PMTiles('https://tiles.test/a.pmtiles', fetch);
    assert.deepEqual(await pm.info().then(i => [i.type, i.minzoom, i.maxzoom]), ['mvt', 14, 14]);
    const want = (id: number) => tiles.find(t => t.id === id)!.data;
    assert.deepEqual(await pm.tile(14, 4823, 6160), want(tileId(14, 4823, 6160)));
    assert.deepEqual(await pm.tile(14, 4824, 6160), want(tileId(14, 4824, 6160)));
    assert.equal(await pm.tile(14, 1, 1), null);
    assert.equal(ranges.filter(r => r === 'bytes=0-16383').length, 1, 'the header and root directory are fetched once');
    assert.equal(await fetchTile('pmtiles://https://tiles.test/a.pmtiles/3/1/1', fetch), null);
});

test('geojson: sources are cut into tiles, clipped, and render and query like vector tiles', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const n = 2 ** 14, lng = (x: number) => x / n * 360 - 180, lat = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    // A square covering the middle half of tile 14/4823/6160, a line crossing the whole tile and beyond, and a point.
    const square = [[TILE.x + 0.25, TILE.y + 0.25], [TILE.x + 0.75, TILE.y + 0.25], [TILE.x + 0.75, TILE.y + 0.75], [TILE.x + 0.25, TILE.y + 0.75], [TILE.x + 0.25, TILE.y + 0.25]].map(([x, y]) => [lng(x), lat(y)]);
    const data = {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 7, properties: {kind: 'area'}, geometry: {type: 'Polygon', coordinates: [square]}},
        {type: 'Feature', properties: {kind: 'route'}, geometry: {type: 'LineString', coordinates: [[lng(TILE.x - 2), lat(TILE.y + 0.5)], [lng(TILE.x + 3), lat(TILE.y + 0.5)]]}},
        {type: 'Feature', properties: {kind: 'stop', name: 'Here'}, geometry: {type: 'Point', coordinates: [lng(TILE.x + 0.5), lat(TILE.y + 0.5)]}},
    ]};
    const prepared = prepareGeoJSON(data), tile = sliceGeoJSON(prepared, TILE.z, TILE.x, TILE.y)._geojson.features;
    assert.equal(tile.length, 3);
    const geom = (f: any) => { const c: number[] = [], e: number[] = []; f.geometry(4096, c, e); return c; };
    assert.deepEqual(geom(tile[0]), [1024, 1024, 3072, 1024, 3072, 3072, 1024, 3072]);
    assert.deepEqual(geom(tile[1]), [-128, 2048, 4224, 2048], 'lines are clipped to the tile plus its buffer');
    assert.deepEqual(geom(tile[2]), [2048, 2048]);
    assert.equal(sliceGeoJSON(prepared, TILE.z, TILE.x + 1, TILE.y)._geojson.features.length, 1, 'the neighbouring tile only gets the line');
    assert.deepEqual(sliceGeoJSON(prepared, TILE.z, TILE.x + 9, TILE.y), {});

    const hits = queryTile(sliceGeoJSON(prepared, TILE.z, TILE.x, TILE.y), {source: 'g', ...TILE, px: 1500, py: 1500, radius: 10});
    assert.deepEqual(hits.map(h => [h.properties.kind, h.id]), [['area', 7]]);

    const style = {version: 8, sources: {g: {type: 'geojson', data}}, layers: [
        {id: 'fill', type: 'fill', source: 'g', filter: ['==', ['get', 'kind'], 'area'], paint: {'fill-color': '#ff0000'}},
        {id: 'line', type: 'line', source: 'g', filter: ['==', ['get', 'kind'], 'route'], paint: {'line-color': '#00ff00', 'line-width': 4}},
        {id: 'label', type: 'symbol', source: 'g', filter: ['has', 'name'], layout: {'text-field': ['get', 'name']}},
    ]};
    const {svg, tiles} = await renderToSVG({style, center: [lng(TILE.x + 0.5), lat(TILE.y + 0.5)], zoom: 14, width: 300, height: 300, fetch: (async () => { throw new Error('no network expected'); }) as any});
    assert.match(svg, /fill="#ff0000"/); assert.match(svg, /stroke="#00ff00" stroke-width="4"/); assert.match(svg, />Here<\/text>/);
    assert.deepEqual(tiles, []);
});

test('contours: isolines join into rings and open lines, with levels and seamless tile edges', async () => {
    const {isolines, contourTile, thresholdsAt} = await import('../../src/contour.ts');
    // A cone: height falls off with distance from the centre, so each level is one closed ring.
    const n = 41, cone = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cone[y * n + x] = 100 - Math.hypot(x - 20, y - 20) * 5;
    const rings = isolines(cone, n, 25);
    assert.ok([25, 50, 75].every(l => rings.has(l)));
    for (const level of [25, 50, 75]) {
        const lines = rings.get(level)!;
        assert.equal(lines.length, 1, `level ${level} is a single line`);
        const l = lines[0];
        close(l[0], l[l.length - 2], 1e-9); close(l[1], l[l.length - 1], 1e-9); // closed
        for (let i = 0; i < l.length; i += 2) close(Math.hypot(l[i] - 20, l[i + 1] - 20), (100 - level) / 5, 0.25); // on the right circle
    }
    // A plain slope gives straight open lines from edge to edge.
    const slope = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) slope[y * n + x] = x * 10;
    const open = isolines(slope, n, 100).get(200)!;
    assert.equal(open.length, 1);
    assert.deepEqual([open[0][0], open[0][open[0].length - 2]].sort(), [20, 20]);
    assert.deepEqual([open[0][1], open[0][open[0].length - 1]].sort((a, b) => a - b), [0, 40]);

    assert.deepEqual(thresholdsAt({9: [500, 1000], 12: [100, 500]}, 11), [500, 1000]);
    assert.equal(thresholdsAt({9: [500, 1000]}, 8), null);

    // Elevation as a smooth function of global position, served as 64px tiles at any zoom.
    const P = 64, height = (gx: number, gy: number) => 1000 + 400 * Math.sin(gx * 7) + 300 * Math.cos(gy * 9);
    const loadDEM = async (url: string) => {
        const [z, x, y] = url.split('/').map(Number), data = new Float32Array(P * P), s = 2 ** z;
        for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) data[j * P + i] = height((x + (i + 0.5) / P) / s, (y + (j + 0.5) / P) / s);
        return {width: P, height: P, data};
    };
    const cfg = {tiles: ['{z}/{x}/{y}'], encoding: 'terrarium', demMaxzoom: 12, demMinzoom: 0, thresholds: {0: [100, 500]}, multiplier: 1, overzoom: 0, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level'};
    const tile = async (x: number, y: number) => (await contourTile(cfg, 3, x, y, loadDEM)).contours.features.map(f => { const c: number[] = [], e: number[] = []; f.geometry(4096, c, e); return {ele: f.properties.ele, level: f.properties.level, c}; });
    const a = await tile(2, 3), b = await tile(3, 3);
    assert.ok(a.length > 3 && b.length > 3);
    assert.ok(a.every(f => f.ele % 100 === 0 && f.level === (f.ele % 500 === 0 ? 1 : 0)));
    // Every line leaving the left tile through its right edge arrives in the right tile at the same height.
    const ends = (fs: typeof a, edgeX: number) => fs.flatMap(f => [[f.c[0], f.c[1]], [f.c[f.c.length - 2], f.c[f.c.length - 1]]].filter(p => p[0] === edgeX).map(p => `${f.ele}@${p[1]}`)).sort();
    const leaving = ends(a, 4096), arriving = ends(b, 0);
    assert.ok(leaving.length > 0, 'some contours cross the shared edge');
    assert.deepEqual(leaving, arriving);
});

/** A minimal RGB PNG (filter 0 or `filter` on every row; checksums are not verified by the decoder). */
function makePNG(width: number, height: number, rgb: (x: number, y: number) => number[], filter = 0): Uint8Array {
    const stride = width * 3, raw = new Uint8Array(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = filter;
        for (let x = 0; x < width; x++) {
            const c = rgb(x, y), left = x && filter === 1 ? rgb(x - 1, y) : [0, 0, 0];
            for (let k = 0; k < 3; k++) raw[y * (stride + 1) + 1 + x * 3 + k] = c[k] - left[k];
        }
    }
    const chunk = (type: string, data: Uint8Array) => {
        const out = new Uint8Array(data.length + 12);
        new DataView(out.buffer).setUint32(0, data.length);
        out.set([...type].map(c => c.charCodeAt(0)), 4); out.set(data, 8);
        return out;
    };
    const head = new Uint8Array(13);
    new DataView(head.buffer).setUint32(0, width); new DataView(head.buffer).setUint32(4, height);
    head[8] = 8; head[9] = 2;
    return Buffer.concat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]);
}

test('server: PNG elevation tiles are decoded without a browser and contours are drawn', async () => {
    const colour = (x: number, y: number) => [x * 7 % 256, y * 3 % 256, (x + y) % 256];
    for (const filter of [0, 1]) {
        const px = await decodePNG(makePNG(5, 4, colour, filter));
        assert.deepEqual([px.width, px.height], [5, 4]);
        assert.deepEqual([...px.data.subarray((2 * 5 + 3) * 4, (2 * 5 + 3) * 4 + 4)], [...colour(3, 2), 255]);
    }
    // A cone 0-1000 m high in terrarium encoding, the same for every tile.
    const dem = makePNG(64, 64, (x, y) => { const e = Math.max(0, 1000 - Math.hypot(x - 32, y - 32) * 40) + 32768; return [Math.floor(e / 256), Math.floor(e) % 256, 0]; });
    const style = {version: 8, sources: {
        dem: {type: 'raster-dem', tiles: ['https://example.test/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
        contours: {type: 'contour', source: 'dem', overzoom: 0, thresholds: {0: [100, 500]}}},
        layers: [{id: 'c', type: 'line', source: 'contours', 'source-layer': 'contours', paint: {'line-color': '#963'}}]};
    const {svg} = await renderToSVG({style, width: 256, height: 256, center: [0, 0], zoom: 3, fetch: (async () => new Response(dem as BodyInit)) as typeof fetch});
    assert.match(svg, /<path[^>]*stroke="#996633"/);
});

test('server: lossless WebP elevation tiles decode to the same pixels as a reference decoder', () => {
    // A Mapterhorn elevation tile (https://mapterhorn.com/attribution); the checksum is of the pixels libwebp produces.
    const px = decodeWebPLossless(readFileSync(new URL('../fixtures/dem-12-1205-1539.webp', import.meta.url)));
    assert.deepEqual([px.width, px.height], [512, 512]);
    assert.equal(createHash('sha256').update(px.data).digest('hex'), '99c838ff762322359f7cd2e06a8eb4bec1bd0b6ef02ede07ae09facfe22e956f');
});

test('tiles: nothing is requested below a source\'s minimum zoom', () => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([7.66, 45.98], 8.9, 0);
    assert.equal(tr.coveringTiles(9, 15).length, 0);
    tr.set([7.66, 45.98], 9.1, 0);
    assert.ok(tr.coveringTiles(9, 15).every(t => t.z === 9) && tr.coveringTiles(9, 15).length > 0);
    tr.set([7.66, 45.98], 3, 0);
    assert.equal(tr.coveringTiles(9, 15).length, 0);
});

test('terrain: projections follow the ground height, and tile selection reaches low ground', () => {
    const t = new Transform();
    t.width = 800; t.height = 600;
    t.set([7.66, 45.98], 13, 30, 55);
    const flat = t.coveringTiles(0, 22).length;
    // The map centre sits on a 3,000 m summit; a point on the ground at that height projects where it did before.
    const before = t.projectTile({z: 13, x: 4270, y: 2915, w: 0, key: ''}, 2048, 2048);
    t.elevation = 3000;
    t.heightAt = () => 3000;
    const same = t.projectTile({z: 13, x: 4270, y: 2915, w: 0, key: ''}, 2048, 2048);
    assert.ok(Math.hypot(same[0] - before[0], same[1] - before[1]) < 1e-6);
    // Sea level is now far below the centre: it appears lower on screen, and the view reaches more tiles down there.
    const low = t.projectTile({z: 13, x: 4270, y: 2915, w: 0, key: ''}, 2048, 2048, 0);
    assert.ok(low[1] > same[1] + 20);
    t.groundRange = [0, 3000];
    assert.ok(t.coveringTiles(0, 22).length > flat);
    // Unprojecting onto a lower plane and projecting a point at that height are inverses.
    const ppm = t.pixelsPerMetre, [mx, my] = t.screenToMerc(650, 200, -3000 * ppm), n = 2 ** 13;
    const back = t.projectTile({z: 13, x: Math.floor(mx * n), y: Math.floor(my * n), w: 0, key: ''}, (mx * n % 1) * 4096, (my * n % 1) * 4096, 0);
    assert.ok(Math.hypot(back[0] - 650, back[1] - 200) < 1e-3, String(back));
    // A ridge between the camera and a point hides it.
    const v = new Transform();
    v.width = 800; v.height = 600;
    v.set([7.66, 45.98], 13, 0, 55);
    const cy = mercY(v.lat), target: [number, number] = [mercX(v.lng), cy - 0.0005];
    v.heightAt = () => 0;
    assert.equal(v.occluded(...target), false);
    v.heightAt = (_x, y) => Math.abs(y - (cy - 0.00025)) < 0.00008 ? 9000 : 0;
    assert.equal(v.occluded(...target), true);
});

test('state: feature-state and global-state are read when tiles are built', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const {setFeatureStates, setGlobalState} = await import('../../src/expr.ts');
    const n = 2 ** 14, lng = (x: number) => x / n * 360 - 180, lat = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const box = (x: number) => [[x, 0.2], [x + 0.2, 0.2], [x + 0.2, 0.4], [x, 0.4], [x, 0.2]].map(([dx, dy]) => [lng(TILE.x + dx), lat(TILE.y + dy)]);
    const data = {type: 'FeatureCollection', features: [1, 2].map(id => ({type: 'Feature', id, properties: {}, geometry: {type: 'Polygon', coordinates: [box(id * 0.3)]}}))};
    const layer = compileLayer({id: 'fill', type: 'fill', source: 'g', paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#ff0000', ['coalesce', ['global-state', 'base'], '#0000ff']]}})!;
    // The colours baked into the tile for each of the two squares, as [r, g, b] bytes.
    const colours = () => {
        const tile = buildTile(sliceGeoJSON(prepareGeoJSON(data), TILE.z, TILE.x, TILE.y), TILE.z, [layer], false);
        const c = tile.layers.fill.color!;
        return [[c[0], c[1], c[2]], [c[4], c[5], c[6]]];
    };
    setGlobalState({});
    assert.deepEqual(colours(), [[0, 0, 255], [0, 0, 255]]);
    setFeatureStates('g', {'|2': {hover: true}});
    assert.deepEqual(colours(), [[0, 0, 255], [255, 0, 0]]);
    setGlobalState({base: '#00ff00'});
    assert.deepEqual(colours(), [[0, 255, 0], [255, 0, 0]]);
    setFeatureStates('g', {});
    setGlobalState(undefined);
});

test('padding: the centre moves to the middle of the unpadded area, consistently for the CPU and the GPU', () => {
    const t = new Transform();
    t.width = 800; t.height = 600;
    t.set([-74, 40.7], 12, 30, 50);
    t.padding = [40, 0, 0, 300]; // a header and a left-hand panel
    const [cx, cy] = t.project(-74, 40.7);
    assert.ok(Math.abs(cx - 550) < 1e-6 && Math.abs(cy - 320) < 1e-6, `${cx},${cy}`);
    const [lng, lat] = t.unproject(123, 456), [bx, by] = t.project(lng, lat);
    assert.ok(Math.hypot(bx - 123, by - 456) < 1e-6);
    // The matrix sent to the GPU puts a tile point where the CPU projection does.
    const id = {z: 12, x: 1206, y: 1540, w: 0, key: ''}, m = t.tileMatrix4(id), [sx, sy] = t.projectTile(id, 1000, 3000);
    const clip = [0, 1, 3].map(r => m[r] * 1000 + m[4 + r] * 3000 + m[12 + r]);
    assert.ok(Math.abs((clip[0] / clip[2] + 1) / 2 * 800 - sx) < 1e-3 && Math.abs((1 - clip[1] / clip[2]) / 2 * 600 - sy) < 1e-3, `${clip} vs ${sx},${sy}`);
});
