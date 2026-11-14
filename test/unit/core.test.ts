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
import {fillTemplate, markerFeatures, markerStyle, sizedSVG, svgSize, templateSlots, withMarkers, VARIANT} from '../../src/markers.ts';
import {cleanCredits, renderToSVG} from '../../src/server.ts';
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

test('images: a template has its slots, and the image expression with params gives the name with the values', () => {
    assert.deepEqual(templateSlots('<svg><path fill="{{color}}" stroke="{{ stroke }}"/><text fill="{{color}}">{{label}}</text></svg>'), ['color', 'stroke', 'label']);
    assert.deepEqual(templateSlots('<svg viewBox="0 0 4 4"/>'), []);
    const f = {type: 1, properties: {class: 'primary', lanes: 3}}, flags = {dd: false, zoom: false};
    assert.equal(compileExpr(['image', 'pin'], flags)({zoom: 0, f}), 'pin');
    assert.equal(compileExpr(['image', 'pin', {params: {color: ['match', ['get', 'class'], 'primary', '#d00', '#00d'], label: ['+', ['get', 'lanes'], 1], tint: ['rgb', 255, 0, 0]}}], flags)({zoom: 0, f}),
        ['pin', 'color=#d00', 'label=4', 'tint=rgba(255,0,0,1)'].join(VARIANT));
    assert.equal(flags.dd, true);
});

test('tiles: an icon name from data that is the name of a member of every object is no template', () => {
    const layer = (icon: unknown) => [compileLayer({id: 'poi', type: 'symbol', source: 's', 'source-layer': 'poi', layout: {'icon-image': icon}})!];
    for (const name of ['toString', 'constructor', '__proto__', 'valueOf']) {
        const labels = buildTile(bytes, TILE.z, layer(name), true, undefined, {pin: ['color']}).labels.poi;
        assert.ok(labels.length > 0 && labels.every(l => l.icon!.name === name), name);
    }
});

test('renderer: each WebGL extension that the code asks for is a name of an extension', () => {
    // (A replacement of text in src/gl.ts once changed a name to one that no browser has, and the heatmap lost its fallback.)
    const asked = [...readFileSync(new URL('../../src/gl.ts', import.meta.url), 'utf8').matchAll(/getExtension\('([^']+)'\)/g)].map(m => m[1]);
    const known = ['EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'OES_texture_float_linear', 'EXT_texture_filter_anisotropic', 'WEBGL_lose_context', 'EXT_float_blend', 'OES_texture_half_float_linear'];
    assert.ok(asked.includes('EXT_color_buffer_half_float'));
    assert.deepEqual(asked.filter(name => !known.includes(name)), []);
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
    assert.equal(label.font, 'italic 600|Open Sans|Open Sans Semibold Italic');
});

test('tiles: icons that need no place among the labels are a batch of the tile, and an icon of a template has the name of its variant', () => {
    const poi = (layout: object) => [compileLayer({id: 'poi', type: 'symbol', source: 's', 'source-layer': 'poi', layout})!];
    const free = {'icon-image': ['get', 'class'], 'icon-allow-overlap': true, 'icon-ignore-placement': true};
    const build = (layout: object, direct: boolean, templates?: Record<string, string[]>) => buildTile(bytes, TILE.z, poi(layout), true, undefined, templates, direct);
    // The map draws such icons from a buffer. A renderer that does not ask for that (the server) gets them as labels.
    const batch = build(free, true).icons!.poi, labels = build(free, false).labels.poi;
    assert.ok(batch.name.length > 10 && batch.pos.length === batch.name.length * 2 && batch.names.every(name => typeof name === 'string'));
    assert.equal(build(free, true).labels.poi, undefined);
    assert.equal(build(free, false).icons, undefined);
    assert.equal(labels.length, batch.name.length);
    assert.deepEqual([...batch.pos.subarray(0, 2)], [labels[0].x, labels[0].y]);
    assert.equal(batch.names[batch.name[0]], labels[0].icon!.name);
    // An icon that labels avoid is in the batch too, and the batch says so.
    const avoided = build({...free, 'icon-ignore-placement': false}, true);
    assert.ok(avoided.icons!.poi.avoid === true && !batch.avoid && avoided.icons!.poi.name.length === batch.name.length && !avoided.labels.poi);
    // An icon with text and an icon that can be hidden are placed with the labels.
    for (const layout of [{...free, 'text-field': '{name}'}, {...free, 'icon-allow-overlap': false}, {...free, 'symbol-sort-key': ['get', 'rank']}]) {
        const ir = build(layout, true);
        assert.ok(ir.labels.poi.length > 0);
        assert.ok(!ir.icons?.poi || ir.icons.poi.name.length < batch.name.length, JSON.stringify(layout)); // (a feature with no name has no text)
    }
    // A value for each feature goes with its icon.
    const sized = build({...free, 'icon-size': ['case', ['==', ['get', 'class'], 'park'], 2, 1], 'icon-rotate': ['get', 'rank']}, true).icons!.poi;
    assert.ok(sized.size!.length === sized.name.length * 2 && sized.rotate!.length === sized.name.length && !sized.alpha);
    // A template: the name of the variant has the value of each slot, from the property of the feature or from `params`.
    const names = (icon: unknown) => build({...free, 'icon-image': icon}, true, {pin: ['class', 'tone']}).icons!.poi.names;
    assert.ok(names('pin').every(name => /^pin\u001f[a-z_]+\u001f$/.test(name)), names('pin')[0]);
    assert.ok(names(['image', 'pin', {params: {tone: ['concat', '#', 'd00']}}]).every(name => /^pin\u001f[a-z_]+\u001f#d00$/.test(name)));
    // A template inside `format` text gets the name of its variant in the same way.
    const text = build({'text-field': ['format', ['image', 'pin', {params: {tone: '#d00'}}], {}, ['get', 'name'], {}]}, true, {pin: ['class', 'tone']}).labels.poi.map(l => l.text);
    assert.ok(text.length > 0 && text.every(t => /^pin\u001f[a-z_]+\u001f#d00/.test(t)), JSON.stringify(text[0]));
});

test('images: a template in a pattern property names its variant, with the values of `params` in the order of the slots', async () => {
    const {variantName} = await import('../../src/markers.ts');
    const name = compileProp(['image', 'hatch', {params: {width: 2, color: 'red'}}], 'string', '').eval(0);
    assert.equal(variantName(name, {hatch: ['color', 'width', 'gap']}), ['hatch', 'red', '2', ''].join(VARIANT));
    assert.equal(variantName(name, {}), 'hatch', 'a name that is no template loses its params');
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
    // (#175) Without a viewBox: the width and height attributes in CSS pixels, each 24 when missing or in another unit.
    assert.deepEqual(svgSize('<svg width="9" height="9"><rect/></svg>'), [9, 9]);
    assert.deepEqual(svgSize("<svg height='12px' width=40><rect/></svg>"), [40, 12]);
    assert.deepEqual(svgSize('<svg width="50%" height="2em"><rect/></svg>'), [24, 24]);
    assert.deepEqual(svgSize('<svg width="9"><rect/></svg>'), [9, 24]);
    assert.deepEqual(svgSize('<svg width="9" height="9" viewBox="0 0 10 20"><rect/></svg>'), [10, 20]);
    assert.deepEqual(svgSize('<svg><svg viewBox="0 0 5 5"/></svg>'), [24, 24]);
    assert.match(sizedSVG('<svg width="9" height="9"><rect/></svg>', 18, 18), /width="18" height="18" viewBox="0 0 9 9">/);
    assert.match(sizedSVG('<svg viewBox="0 0 10 20"><rect/></svg>', 30, 60), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]* width="30" height="60" viewBox="0 0 10 20"><rect\/><\/svg>$/);
});

test('markers: a marker layer is a GeoJSON source and a symbol layer, and its markers are points with the index as the id', () => {
    const data = [{lngLat: [1, 2], props: {color: '#d00'}}, {lngLat: [3, 4]}];
    assert.deepEqual(markerStyle({id: 'pins', image: 'pin', data}).layer, {id: 'pins', type: 'symbol', source: 'pins', before: undefined,
        layout: {'icon-image': 'pin', 'icon-anchor': 'center', 'icon-allow-overlap': true, 'icon-ignore-placement': true}});
    // Labels keep away with `collide`. With `overlap: 'hide'` a marker can be hidden, and labels keep away too.
    assert.deepEqual(markerStyle({id: 'a', image: 'pin', anchor: 'bottom', collide: true, minZoom: 3, maxZoom: 9, data}).layer, {id: 'a', type: 'symbol', source: 'a', before: undefined, minzoom: 3, maxzoom: 9,
        layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': false}});
    assert.deepEqual(markerStyle({id: 'a', image: 'pin', overlap: 'hide', data}).layer.layout, {'icon-image': 'pin', 'icon-anchor': 'center', 'icon-allow-overlap': false, 'icon-ignore-placement': false});
    assert.deepEqual(markerFeatures(data), {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 0, properties: {color: '#d00'}, geometry: {type: 'Point', coordinates: [1, 2]}}, {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [3, 4]}}]});
    // In a style: on top, or below the layer of `before`. The style that was given is not changed.
    const style = {version: 8, sources: {s: {type: 'vector'}}, layers: [{id: 'land'}, {id: 'labels'}]};
    const made = withMarkers(style, [{id: 'pins', image: 'pin', data}, {id: 'under', image: 'pin', before: 'labels', data}], true);
    assert.deepEqual(made.layers.map((l: {id: string}) => l.id), ['land', 'under', 'labels', 'pins']);
    assert.ok(!('before' in made.layers[1]) && made.sources.pins.data.features.length === 2 && made.sources.s === style.sources.s && style.layers.length === 2);
    assert.equal(withMarkers(style, [{id: 'pins', image: 'pin', data}]).sources.pins.data.features.length, 0);
    assert.equal(withMarkers(style, undefined), style);
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
    // The SVG is an image with a name for assistive technology. The option `label` gives the name; its text is escaped.
    assert.match(svg, /^<svg [^>]* role="img" aria-label="Map"/);
    assert.match((await renderToSVG({...opts, label: 'Hotels & "bars" <b>'})).svg, /^<svg [^>]* role="img" aria-label="Hotels &#38; &#34;bars&#34; &#60;b&#62;"/);
    assert.match(svg, /fill="#00aaff"/); assert.match(svg, /stroke-dasharray="4 2"/); assert.match(svg, /<text /);
    assert.match(svg, /<symbol id="i0"[^>]*><rect width="20" height="12" data-name="ref-/, 'generated icons are embedded as vector symbols');
    assert.ok(!svg.includes('#123456'), 'a layer hidden for server output is left out');
    // Changes for the server can also be given for a style that is not your own, by the id of a layer; and the result has the credits.
    const credited = {...style, sources: {s: {...style.sources.s, attribution: '<a href="https://example.com">Example</a>'}}};
    const changed = await renderToSVG({...opts, style: credited, overrides: {water: {hidden: true}, roads: {paint: {'line-color': '#abcdef'}}}});
    assert.ok(!changed.svg.includes('#00aaff') && changed.svg.includes('#abcdef'), 'overrides by layer id are used');
    assert.deepEqual(changed.attribution, ['<a href="https://example.com">Example</a>']);
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

test('pmtiles: a server that ignores Range is read once, and a file above 64 MB fails with a message', async () => {
    const {PMTiles} = await import('../../src/pmtiles.ts');
    const file = new Uint8Array(134 + 20000), v = new DataView(file.buffer);
    file.set(new TextEncoder().encode('PMTiles')); file[7] = 3;
    // Root directory at 127 with one entry (tile 0, run 1, length 20000, offset 0); the tile data lies beyond the first 16 KB.
    v.setUint32(8, 127, true); v.setUint32(16, 7, true); v.setUint32(56, 134, true); v.setUint32(64, 20000, true);
    file[97] = 1; file[98] = 1; file[99] = 1; file[100] = 0; file[101] = 0;
    file.set([1, 0, 1, 0xa0, 0x9c, 0x01, 1], 127);
    for (let i = 134; i < file.length; i++) file[i] = i & 255;
    let calls = 0;
    const fetch = (async () => { calls++; return new Response(file, {status: 200}); }) as any;
    const pm = new PMTiles('https://tiles.test/full.pmtiles', fetch);
    assert.deepEqual(await pm.tile(0, 0, 0), file.subarray(134, 134 + 20000));
    await pm.tile(0, 0, 0);
    assert.equal(calls, 1, 'the whole file is downloaded once');
    let read = false;
    const big = (async () => new Response(new ReadableStream({pull(c) { read = true; c.close(); }}, {highWaterMark: 0}), {status: 200, headers: {'content-length': String(100 << 20)}})) as any;
    await assert.rejects(new PMTiles('https://tiles.test/big.pmtiles', big).info(), /^Error: \[map-jr-gl\] PMTiles https:\/\/tiles.test\/big.pmtiles: the server ignores Range requests, .*\(100 MB\)/);
    assert.equal(read, false, 'the body of a file above the limit is not read');
    // Without Content-Length, the stream is read only until it passes the limit. One 1 MB chunk is sent repeatedly.
    const chunk = new Uint8Array(1 << 20);
    let pulls = 0, cancelled = false;
    const chunked = (async () => new Response(new ReadableStream({pull(c) { pulls++; c.enqueue(chunk); }, cancel() { cancelled = true; }}, {highWaterMark: 0}), {status: 200})) as any;
    await assert.rejects(new PMTiles('https://tiles.test/chunked.pmtiles', chunked).info(), /the server ignores Range requests/);
    assert.ok(pulls <= 66 && cancelled, `the stream is cancelled after the limit (${pulls} chunks read)`);
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
    // (With terrain, far tiles have less detail, by the rule of MapLibre: fewer tiles for the same area.)
    const level = t.coveringTiles(0, 22).length;
    assert.ok(level <= flat, `${level} tiles with terrain, ${flat} without`);
    t.groundRange = [0, 3000];
    assert.ok(t.coveringTiles(0, 22).length > level);
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

test('state: feature-state and global-state are read when tiles are built, for each map apart', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const {compileFor} = await import('../../src/expr.ts');
    const n = 2 ** 14, lng = (x: number) => x / n * 360 - 180, lat = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const box = (x: number) => [[x, 0.2], [x + 0.2, 0.2], [x + 0.2, 0.4], [x, 0.4], [x, 0.2]].map(([dx, dy]) => [lng(TILE.x + dx), lat(TILE.y + dy)]);
    const data = {type: 'FeatureCollection', features: [1, 2].map(id => ({type: 'Feature', id, properties: {}, geometry: {type: 'Polygon', coordinates: [box(id * 0.3)]}}))};
    // Two maps with the same style and the same source name. Each has its own states.
    const map = () => {
        const states = {g: {} as Record<string, unknown>, f: {} as Record<string, Record<string, Record<string, unknown>>>};
        compileFor(states);
        const layer = compileLayer({id: 'fill', type: 'fill', source: 'g', paint: {
            'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#ff0000', ['coalesce', ['global-state', 'base'], '#0000ff']]}})!;
        // The colours baked into the tile for each of the two squares, as [r, g, b] bytes.
        const colours = () => {
            const tile = buildTile(sliceGeoJSON(prepareGeoJSON(data), TILE.z, TILE.x, TILE.y), TILE.z, [layer], false, states.f);
            const c = tile.layers.fill.color!;
            return [[c[0], c[1], c[2]], [c[4], c[5], c[6]]];
        };
        return {states, colours};
    };
    const a = map(), b = map();
    assert.deepEqual(a.colours(), [[0, 0, 255], [0, 0, 255]]);
    a.states.f.g = {'|2': {hover: true}};
    assert.deepEqual(a.colours(), [[0, 0, 255], [255, 0, 0]]);
    a.states.g = {base: '#00ff00'};
    assert.deepEqual(a.colours(), [[0, 255, 0], [255, 0, 0]]);
    // The other map was compiled later and has no state: it does not see the state of the first.
    assert.deepEqual(b.colours(), [[0, 0, 255], [0, 0, 255]]);
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

test('text: images in a format expression travel through the text and are measured as single units', async () => {
    const {IMAGE_OPEN, IMAGE_CLOSE} = await import('../../src/expr.ts');
    const {EstimateShaper, EM} = await import('../../src/text.ts');
    const field = compileProp(['format', ['image', ['get', 'a']], {}, 'AB', {}, ['image', ['coalesce', ['get', 'missing'], '']], {}], 'string', '');
    const text = field.eval(10, {type: 1, properties: {a: 'shield one'}});
    assert.equal(text, `${IMAGE_OPEN}shield one${IMAGE_CLOSE}AB`, 'an image with no name leaves nothing behind');
    // A shaper that knows the image is 40 pixels wide at 2x: at 16-pixel text that is 20 pixels, or 30 text units.
    const shaper = new EstimateShaper();
    shaper.images = name => name === 'shield one' ? {width: 40, height: 40, pixelRatio: 2} : undefined;
    const plain = shaper.shape('AB', 'x', 100, 0, 1.2, 16).width;
    assert.ok(Math.abs(shaper.shape(text, 'x', 100, 0, 1.2, 16).width - plain - 40 / 2 * EM / 16) < 1e-6);
    // Without anyone to supply images (the server renderer), the image is simply left out.
    assert.equal(new EstimateShaper().shape(text, 'x', 100, 0, 1.2, 16).width, plain);
});

test('GeoJSON lines for a gradient know which part of the whole line each piece is', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    // A line from the middle of tile 2/1/1 to the middle of tile 2/2/1.
    const prepared = prepareGeoJSON({type: 'LineString', coordinates: [[-45, 10], [45, 10]]});
    const west = sliceGeoJSON(prepared, 2, 1, 1, true)._geojson.features, east = sliceGeoJSON(prepared, 2, 2, 1, true)._geojson.features;
    assert.equal(west.length, 1);
    assert.equal(west[0].properties.mapbox_clip_start, 0);
    // The two pieces overlap by the tile buffer, and together cover the line.
    assert.ok(west[0].properties.mapbox_clip_end > 0.5 && west[0].properties.mapbox_clip_end < 0.55);
    assert.ok(east[0].properties.mapbox_clip_start < 0.5 && east[0].properties.mapbox_clip_start > 0.45);
    assert.equal(east[0].properties.mapbox_clip_end, 1);
    // Without a gradient layer the features keep their own properties.
    assert.equal(sliceGeoJSON(prepared, 2, 1, 1)._geojson.features[0].properties.mapbox_clip_start, undefined);
});

test('GeoJSON clusters: points join at low zoom and divide at the expansion zoom', async () => {
    const {prepareSource, sliceGeoJSON} = await import('../../src/geojson.ts');
    const point = (lng: number, lat: number, n: number) => ({type: 'Feature', properties: {n}, geometry: {type: 'Point', coordinates: [lng, lat]}});
    // Two points that are near to each other, and one that is far away.
    const data = {type: 'FeatureCollection', features: [point(10, 10, 1), point(10.01, 10, 2), point(-120, 40, 4)]};
    const src = prepareSource(data, {cluster: true, clusterProperties: {sum: ['+', ['get', 'n']]}}, 14);
    const world = sliceGeoJSON(src, 0, 0, 0)._geojson.features;
    assert.equal(world.length, 2, 'one cluster and one single point');
    const cluster = world.find(f => f.properties.cluster)!;
    assert.equal(cluster.properties.point_count, 2);
    assert.equal(cluster.properties.sum, 3);
    const zoom = src.clusters!.expansionZoom(cluster.properties.cluster_id);
    assert.ok(zoom > 5 && zoom <= 13, `the cluster divides at zoom ${zoom}`);
    assert.equal(src.clusters!.at(zoom)!.filter(f => f.properties.cluster).length, 0);
    assert.equal(src.clusters!.at(zoom - 1)!.filter(f => f.properties.cluster).length, 1);
    assert.deepEqual(src.clusters!.leaves(cluster.properties.cluster_id).map(f => f.properties.n).sort(), [1, 2]);
    assert.equal(src.clusters!.children(cluster.properties.cluster_id).length, 2);
    // promoteId: a property becomes the id of the feature.
    assert.equal(prepareSource(data, {promoteId: 'n'}).features[2].id, 4);
    // The object form names the one layer of a GeoJSON source, as in MapLibre GL JS (#294).
    assert.equal(prepareSource(data, {promoteId: {_geojsonTileLayer: 'n'}}).features[2].id, 4);
});

test('promoteId on a vector source warns once for the source object (#207)', async () => {
    const {resolveStyle} = await import('../../src/style.ts');
    const warn = console.warn, seen: string[] = [];
    console.warn = (m: string) => { seen.push(m); };
    try {
        const style = {version: 8, sources: {areas: {type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}.pbf'], promoteId: 'id'}}, layers: []};
        await resolveStyle(style);
        await resolveStyle(style);
    } finally { console.warn = warn; }
    assert.equal(seen.length, 1);
    assert.match(seen[0], /^\[map-jr-gl\] The source "areas": "promoteId" has no effect on vector sources/);
});

test('rich text: a section of format with a font scale is wider or narrower, and makes its line taller', async () => {
    const {EstimateShaper, EM} = await import('../../src/text.ts');
    const text = (scale: number) => compileExpr(['format', 'AB', {'font-scale': scale}, '\n', {}, 'AB', {}], {dd: false, zoom: false})({zoom: 0, f: null}) as string;
    const shaper = new EstimateShaper(), plain = shaper.shape('AB\nAB', 'x', 100, 0, 1.2, 16), big = shaper.shape(text(2), 'x', 100, 0, 1.2, 16);
    assert.ok(Math.abs(big.lines[0].width - 2 * plain.lines[0].width) < 1e-6);
    assert.ok(Math.abs(big.lines[1].width - plain.lines[1].width) < 1e-6);
    assert.ok(Math.abs(big.height - (2 + 1) * 1.2 * EM) < 1e-6, 'the first line is two times as tall');
    assert.deepEqual(big.lines[0].chars, ['A', 'B'], 'the style characters are not part of the text');
});

test('style: each layer type that the page accepts has its properties in the compiler', async () => {
    const {LAYER_TYPES} = await import('../../src/resolve.ts');
    for (const type of LAYER_TYPES) assert.ok(compileLayer({id: 'x', type} as any), type);
    assert.equal(compileLayer({id: 'x', type: 'no-such-type'} as any), null);
});

test('terrain: the height lookup uses a deeper grid after it is told that the grids changed', async () => {
    const {groundHeight, heightsChanged, HEIGHT_GRID} = await import('../../src/geo.ts');
    const grids = new Map<string, Float32Array>([['0/0/0', new Float32Array(HEIGHT_GRID * HEIGHT_GRID).fill(100)]]);
    assert.equal(groundHeight(grids, 0.3, 0.3, 4), 100);
    assert.equal(groundHeight(grids, 0.3, 0.3, 4), 100, 'the second lookup takes the remembered grid');
    grids.set('1/0/0', new Float32Array(HEIGHT_GRID * HEIGHT_GRID).fill(250));
    heightsChanged(grids);
    assert.equal(groundHeight(grids, 0.3, 0.3, 4), 250);
    assert.equal(groundHeight(grids, 0.8, 0.8, 4), 100, 'a place outside the deeper tile keeps the first grid');
    grids.clear(); heightsChanged(grids);
    assert.equal(groundHeight(grids, 0.3, 0.3, 4, 0, -1), -1, 'no data: the value for unknown');
});

test('transform: the view stays inside the world from top to bottom', () => {
    const t = new Transform();
    t.width = 800; t.height = 500;
    // At zoom 0 the world is 512 pixels high: with a view of 500 pixels the centre can move only a little from the equator.
    t.set([-117, 32], 0);
    assert.ok(Math.abs(t.lat) < 5, String(t.lat));
    assert.ok(t.unproject(400, 0)[1] <= 85.06 && t.unproject(400, 500)[1] >= -85.06);
    // At a high zoom the limit has no effect.
    t.set([-117, 40.7085], 10);
    assert.equal(t.lat, 40.7085); // exactly as given
});

test('terrain: tiles get less detail with distance, by the rule of MapLibre, and more near the camera', () => {
    const t = new Transform();
    t.width = 1000; t.height = 700;
    t.set([7.70, 45.99], 12, 20, 60);
    t.elevation = 3000; t.heightAt = () => 3000; t.groundRange = [3000, 3000];
    const levels = t.coveringTiles(0, 22).map(id => id.z);
    // The ground at the centre is one level coarser than the zoom at this tilt, far ground is coarser again, and
    // ground that is nearer to the camera than the centre is finer.
    assert.ok(Math.min(...levels) <= 10 && Math.max(...levels) >= 12, levels.join());
    assert.ok(levels.length < 24, `too many tiles: ${levels.length}`);
    // Image tiles (the last argument) change level at the middle of a level, so they are finer than the others.
    const images = t.coveringTiles(0, 22, 512, true).map(id => id.z);
    assert.ok(images.reduce((a, b) => a + b) / images.length > levels.reduce((a, b) => a + b) / levels.length);
});

test('sources: a tile URL for a WMS server gets the edges of the tile in Web Mercator metres', async () => {
    const {tileURL} = await import('../../src/resolve.ts');
    const src = {type: 'raster', tiles: ['https://example.org/wms?bbox={bbox-epsg-3857}&z={z}'], minzoom: 0, maxzoom: 22, tileSize: 256} as any;
    assert.equal(tileURL(src, 0, 0, 0), 'https://example.org/wms?bbox=-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244&z=0');
    const [west, south, east, north] = /bbox=([^&]*)/.exec(tileURL(src, 1, 1, 0))![1].split(',').map(Number);
    close(west, 0, 1e-6); close(south, 0, 1e-6); close(east, 20037508.342789244, 1e-6); close(north, 20037508.342789244, 1e-6);
    // The scheme `tms` counts rows from the south; `{quadkey}` is the tile as digits in base 4.
    assert.equal(tileURL({...src, tiles: ['t/{z}/{x}/{y}'], tms: true}, 3, 2, 1), 't/3/2/6');
    assert.equal(tileURL({...src, tiles: ['q/{quadkey}']}, 3, 3, 5), 'q/213');
});

test('vector tiles: zeros after the end of the tile are not read', async () => {
    const {decodeVectorTile} = await import('../../src/mvt.ts');
    // (A protocol can give a tile in a larger buffer.)
    const padded = new Uint8Array(bytes.length + 4096);
    padded.set(bytes);
    assert.deepEqual(Object.keys(decodeVectorTile(padded)), Object.keys(decodeVectorTile(bytes)));
});

test('server: the credits of the first view keep text and http(s) links only', () => {
    assert.equal(cleanCredits('© <a href="https://osm.org/copyright" onclick="x()" target="_blank">OpenStreetMap</a> contributors'), '© <a href="https://osm.org/copyright">OpenStreetMap</a> contributors');
    assert.equal(cleanCredits('&copy; Tiles & data'), '&copy; Tiles &amp; data');
    // Hostile values: nothing but text and the links that the function writes can come out.
    for (const bad of [
        '© Tiles <img src=x onerror=window.xss=1 ',
        '<img src=x onerror="window.xss=1">',
        '<a href="javascript:alert(1)">x</a>',
        '<a href="https://ok.example/" onmouseover="alert(1)">x</a><script>alert(1)</script>',
        '<a href="https://ok.example/"><img src=x onerror=alert(1)></a',
        '<svg/onload=alert(1)>', '"><script>alert(1)</script>', '<a href=\'https://ok.example/"onclick="x\'>y</a>',
    ]) {
        const out = cleanCredits(bad), tags = out.match(/<[^>]*>?/g) ?? [];
        assert.ok(tags.every(t => t === '</a>' || /^<a href="https?:\/\/[^"<>]*">$/.test(t)), `${bad} -> ${out}`);
        assert.ok(!out.includes('javascript:'), `${bad} -> ${out}`);
    }
});

test('geojson: a line that crosses 180° of longitude is sliced into the tiles on both sides', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const src = prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[121, 31], [200, 40], [241, 34]]}});
    // At zoom 1, tile (0, 0) covers -180..0 and holds the part of the line from 180 to 241, shifted by one world.
    assert.ok(Object.values(sliceGeoJSON(src, 1, 0, 0))[0]?.features.length, 'the part past 180° is in the western tile');
    assert.ok(Object.values(sliceGeoJSON(src, 1, 1, 0))[0]?.features.length);
    // A line west of -180° is in the eastern tiles.
    const neg = prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-200, 10], [-190, 20]]}});
    assert.ok(Object.values(sliceGeoJSON(neg, 1, 1, 0))[0]?.features.length, 'the part west of -180° is in the eastern tile');
});

test('text-font defaults to the style specification default (#256)', () => {
    const l: any = compileLayer({id: 't', type: 'symbol', source: 's', 'source-layer': 'poi', layout: {'text-field': 'x'}})!;
    assert.deepEqual(l.p.font.eval(10, {properties: {}}), ['Open Sans Regular', 'Arial Unicode MS Regular']);
});

test('labels: text along a line that is too short for it is rejected before the points of the line are projected (#49)', async () => {
    const {placeLabels} = await import('../../src/placement.ts');
    const {EstimateShaper} = await import('../../src/text.ts');
    const layer = compileLayer({id: 'names', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: {'text-field': '{name}', 'symbol-placement': 'line'}})!;
    const real = buildTile(bytes, TILE.z, [layer], true).labels.names.find(l => l.path && l.text.length > 8)!;
    const id = {...TILE, w: 0, key: `${TILE.z}/${TILE.x}/${TILE.y}`}, n = 2 ** TILE.z;
    for (const pitch of [0, 50]) {
        const tr = camera(pitch, 20);
        // A straight line of 41 points through the centre of the view, `step` tile units apart.
        const x = (mercX(-74.006) * n - TILE.x) * 4096, y = (mercY(40.7128) * n - TILE.y) * 4096;
        // (A label has most of its fields, the text among them, on its prototype, so it is changed in place rather than copied.)
        const line = (step: number) => Object.assign(real, {x, y, angle: 0, path: Array.from({length: 82}, (_, i) => i % 2 ? y : x + (i / 2 - 20) * step), pathIndex: 20});
        let calls = 0;
        const project = tr.projectTile.bind(tr);
        tr.projectTile = (...a: Parameters<typeof project>) => { calls++; return project(...a); };
        const place = (l: typeof real) => { calls = 0; return placeLabels(tr, renderItems(tr, [id], () => ({labels: {names: [l]}})), [layer], new EstimateShaper(), new CollisionGrid()); };
        assert.equal(place(line(1)).length, 0);
        assert.equal(calls, 2, `pitch ${pitch}: only the anchor and the direction of the line are projected`);
        assert.equal(place(line(40)).length, 1, `pitch ${pitch}: text that fits its line is placed`);
        assert.ok(calls > 41);
    }
});

test('labels: the test for the same text nearby reads only nearby labels when one text repeats thousands of times (#332)', async () => {
    const {placeLabels} = await import('../../src/placement.ts');
    const {EstimateShaper} = await import('../../src/text.ts');
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'text-field': 'Parking', 'text-allow-overlap': true}})!;
    const n = 2 ** TILE.z, lng = (TILE.x + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (TILE.y + 0.5) / n))) * 180 / Math.PI;
    const point = {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, lat]}};
    const base = buildTile(sliceGeoJSON(prepareGeoJSON(point), TILE.z, TILE.x, TILE.y), TILE.z, [layer], true).labels.p[0];
    // Two tiles side by side, each with 3000 labels "Parking" at random places away from the edges. 40 labels of the left tile lie at its
    // right edge, less than a pixel from 40 labels of the right tile, which are duplicates of them.
    let seed = 7;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const at = (x: number, y: number) => Object.assign(Object.create(base), {x, y});
    const inside = () => at(64 + rnd() * 3968, rnd() * 4096);
    const left = Array.from({length: 3000}, (_, i) => i < 40 ? at(4095.9, i * 100 + 50) : inside());
    const right = Array.from({length: 3000}, (_, i) => i < 40 ? at(0.2, i * 100 + 50) : inside());
    const ids = [0, 1].map(dx => ({z: TILE.z, x: TILE.x + dx, y: TILE.y, w: 0, key: `${TILE.z}/${TILE.x + dx}/${TILE.y}`}));
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([(TILE.x + 1) / n * 360 - 180, lat], 13, 0, 0);
    const hypot = Math.hypot;
    let calls = 0;
    Math.hypot = (...a: number[]) => { calls++; return hypot(...a); };
    let out;
    try {
        out = placeLabels(tr, renderItems(tr, ids, key => ({labels: {p: key === ids[0].key ? left : right}})), [layer], new EstimateShaper(), new CollisionGrid());
    } finally { Math.hypot = hypot; }
    // The old test of every pair placed the same labels: all but the 40 duplicates.
    assert.equal(out.length, 6000 - 40);
    assert.ok(out.every(p => p.src.x !== 0.2), 'the labels at the edge of the right tile are the duplicates');
    // The test of every pair took about 9 million distances here.
    assert.ok(calls < 60000, `${calls} distances for 6000 labels`);
});

test('sizes: a size of zoom and feature is found at the zoom that an overzoomed tile is built for (#249)', async () => {
    const {prepareGeoJSON, sliceGeoJSON} = await import('../../src/geojson.ts');
    const n = 2 ** 14, lng = (TILE.x + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (TILE.y + 0.5) / n))) * 180 / Math.PI;
    const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {k: 2}, geometry: {type: 'Point', coordinates: [lng, lat]}}]};
    const stops = (low: number) => ['interpolate', ['linear'], ['zoom'], 14, ['*', low, ['get', 'k']], 20, ['*', 20, ['get', 'k']]];
    const symbol = compileLayer({id: 's', type: 'symbol', source: 'g', layout: {'icon-image': 'pin', 'text-field': 'A', 'icon-size': stops(2), 'text-size': stops(8)}})!;
    const circle = compileLayer({id: 'c', type: 'circle', source: 'g', paint: {'circle-radius': stops(2)}})!;
    // A tile of zoom 14, the deepest level of its source, built for the map at zoom 17. Each size is 2 * (low + (20 - low) * (zoom - 14) / 6).
    const tile = buildTile(sliceGeoJSON(prepareGeoJSON(data), TILE.z, TILE.x, TILE.y), TILE.z, [symbol, circle], 17);
    const l = tile.labels.s[0];
    assert.equal(tile.z, 17);
    assert.deepEqual([l.icon!.size, l.icon!.size1], [22, 28]);
    assert.deepEqual([l.size0, l.size1], [28, 32]);
    assert.equal(tile.layers.c.radius![0], 22);
});

test('geojson: generateId gives each feature its index in the data as its id, replacing any id', async () => {
    const {prepareSource} = await import('../../src/geojson.ts');
    const data = {type: 'FeatureCollection', features: [
        {type: 'Feature', id: 7, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
        {type: 'Feature', properties: {}, geometry: null},
        {type: 'Feature', properties: {}, geometry: {type: 'MultiPoint', coordinates: [[1, 1], [2, 2]]}},
    ]};
    assert.deepEqual(prepareSource(data).features.map(f => f.id), [7, undefined]);
    assert.deepEqual(prepareSource(data, {generateId: true}).features.map(f => f.id), [0, 2], 'a feature without geometry still counts');
});
