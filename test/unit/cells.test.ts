// The cells of a batch (`cellsOf` in src/tile.ts): the renderer draws only the cells that are in the view, so a tile has
// the same triangles as before in each batch, each cell has the box of its triangles, and a batch whose order shows in
// the picture keeps its order.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLayer} from '../../src/style.ts';
import {CELL, CELL_HEAD, LINE_NORMAL, LINE_VERTEX, buildTile, cellsOf, tessellate, toGL, type GLBatch} from '../../src/tile.ts';
import {EXTENT} from '../../src/geo.ts';
import {cutFill, cutLine} from '../../src/subdivide.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const compile = (layers: unknown[]) => layers.map(l => compileLayer(l as any)!);
const layers = compile([
    {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#00f'}},
    {id: 'land', type: 'fill', source: 's', 'source-layer': 'landuse', paint: {'fill-color': ['match', ['get', 'class'], 'residential', '#eee', '#ddd']}},
    {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-width': 2}},
    {id: 'wide', type: 'line', source: 's', 'source-layer': 'transportation', layout: {'line-join': 'round', 'line-cap': 'round'}, paint: {'line-width': ['match', ['get', 'class'], 'motorway', 12, 3]}},
    {id: 'gaps', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-width': 2, 'line-gap-width': ['match', ['get', 'class'], 'motorway', 6, 1]}},
    {id: 'sorted', type: 'line', source: 's', 'source-layer': 'transportation', layout: {'line-sort-key': ['get', 'layer']}, paint: {'line-width': 2}},
    {id: 'pattern', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-pattern': 'stripes'}},
    {id: 'buildings', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height']}},
    {id: 'flat', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': 30}},
    {id: 'dots', type: 'circle', source: 's', 'source-layer': 'poi'},
]);
const ir = () => buildTile(bytes, 14, layers, false);
const built = toGL(ir()).tile.layers, plain = Object.fromEntries(Object.entries(ir().layers).map(([id, b]) => [id, tessellate(b)!]));
/** x, y and height of vertex `i` of a batch, in tile units. */
const vertex = (g: GLBatch, i: number): number[] => {
    if (g.type === 'line') { const v = new DataView(g.v.buffer, g.v.byteOffset); return [v.getInt16(i * LINE_VERTEX, true) / 2, v.getInt16(i * LINE_VERTEX + 2, true) / 2, 0]; }
    if (g.type === 'extrusion') return [g.v[i * 4], g.v[i * 4 + 1], g.v[i * 4 + 2]];
    return [g.pos[i * 2], g.pos[i * 2 + 1], 0];
};
const triangles = (idx: Uint32Array) => Array.from({length: idx.length / 3}, (_, t) => `${idx[t * 3]},${idx[t * 3 + 1]},${idx[t * 3 + 2]}`);
const cellsOfBatch = (g: GLBatch) => Array.from({length: (g.cells!.length - CELL_HEAD) / CELL}, (_, i) => Array.from(g.cells!.subarray(CELL_HEAD + i * CELL, CELL_HEAD + (i + 1) * CELL)));

test('cells: a tile has the same vertices and the same triangles in each batch, with the corners of each triangle in their order', () => {
    assert.deepEqual(Object.keys(built).sort(), Object.keys(plain).sort());
    for (const id in plain) {
        const a = plain[id] as any, b = built[id] as any;
        for (const k in a) {
            if (k === 'idx') continue;
            if (ArrayBuffer.isView(a[k])) assert.deepEqual(Buffer.from(b[k].buffer, b[k].byteOffset, b[k].byteLength), Buffer.from((a[k] as Uint8Array).buffer, a[k].byteOffset, a[k].byteLength), `${id}.${k}`);
            else assert.deepEqual(b[k], a[k], `${id}.${k}`);
        }
        assert.deepEqual(triangles(b.idx).sort(), triangles(a.idx).sort(), id);
    }
});

test('cells: the cells of a batch are all of its indices in ranges that follow each other, and each has its triangles in its box and under its height', () => {
    let sorted = 0;
    for (const id in built) {
        const g = built[id];
        if (g.type === 'circle' || id === 'gaps') { assert.equal(g.cells, undefined, id); continue; }
        const cells = cellsOfBatch(g);
        assert.ok(cells.length >= 1 && cells.length <= 256, id);
        let next = 0;
        for (const [start, count, x0, y0, x1, y1, top] of cells) {
            assert.equal(start, next, id);
            assert.ok(count > 0 && count % 3 === 0, id);
            next = start + count;
            for (let i = start; i < next; i++) {
                const [x, y, z] = vertex(g, g.idx[i]);
                assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1 && z <= top, `${id}: vertex ${x}, ${y}, ${z} in the box ${[x0, y0, x1, y1, top]}`);
            }
            // (The box is that of the points of the polygons and lines of the cell, which lie in the tile and its buffer.)
            assert.ok(x0 >= -4096 && y0 >= -4096 && x1 <= 8192 && y1 <= 8192 && x0 <= x1 && y0 <= y1, id);
        }
        assert.equal(next, g.idx.length, id);
        if (cells.length > 1 && triangles(g.idx).join() !== triangles(plain[id].idx).join()) sorted++;
    }
    // (The fixture has batches that are large enough for a grid and whose order does not show: water, roads and wide.)
    assert.ok(sorted >= 3, `${sorted} batches are sorted by cell`);
});

test('cells: a cell has the triangles of the polygons around that cell of the grid, in their order, and its box is small', () => {
    const g = built.roads, was = triangles(plain.roads.idx), order = new Map(was.map((t, i) => [t, i]));
    const cells = cellsOfBatch(g);
    assert.ok(cells.length > 16, `${cells.length} cells`);
    let small = 0;
    for (const [start, count, x0, y0, x1, y1] of cells) {
        const at = triangles(g.idx.subarray(start, start + count)).map(t => order.get(t)!);
        // (Two triangles with the same corners are next to each other in both orders, so the place of the first is enough.)
        for (let i = 1; i < at.length; i++) assert.ok(at[i] >= at[i - 1], 'the order within a cell');
        // (A cell of the grid is a sixteenth of the tile or less a side, and a group of a line is seldom larger than that.)
        if (x1 - x0 < EXTENT / 2 && y1 - y0 < EXTENT / 2) small++;
    }
    assert.ok(small >= cells.length * 0.9, `${small} of ${cells.length} cells are smaller than half the tile`);
});

test('cells: a batch whose order shows in the picture is not sorted', () => {
    // A color for each feature, a sort key, an image along the line, and buildings: each pixel takes the wall that is
    // drawn first, and the shade of a wall depends on the height of its building, so where a building and its part have
    // a wall in one plane, the order shows.
    for (const id of ['land', 'sorted', 'pattern', 'buildings', 'flat']) {
        assert.deepEqual(triangles(built[id].idx), triangles(plain[id].idx), id);
        assert.ok(built[id].cells!.length >= CELL_HEAD + CELL, id);
    }
    const walls = toGL(buildTile(bytes, 14, compile([{id: 'b', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-pattern': 'bricks'}}]), false)).tile.layers.b;
    const same = tessellate(buildTile(bytes, 14, compile([{id: 'b', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-pattern': 'bricks'}}]), false).layers.b)!;
    assert.deepEqual(triangles(walls.idx), triangles(same.idx));
    assert.ok(cellsOfBatch(walls).length > 1);
});

test('cells: a line has a direction that no vertex is longer than, and the largest width of a feature', () => {
    const g = built.wide as Extract<GLBatch, {type: 'line'}>, v = new DataView(g.v.buffer, g.v.byteOffset);
    let reach = 1;
    for (let o = 0; o < g.v.byteLength; o += LINE_VERTEX) reach = Math.max(reach, Math.hypot(v.getInt16(o + 4, true), v.getInt16(o + 6, true)) / LINE_NORMAL);
    assert.ok(g.cells![0] >= reach, `${g.cells![0]} against ${reach}`);
    assert.equal(g.cells![0], Math.fround(Math.SQRT2 * 4)); // (the largest that the 16 bits of a direction can hold)
    assert.equal(g.cells![1], 12);
    assert.equal(built.roads.cells![1], 0); // (the width of the layer is not in the tile)
});

test('cells: a small batch is one cell, and a batch for the globe has none', () => {
    const one: GLBatch = {type: 'fill', pos: Int16Array.from([0, 0, 100, 0, 100, 50, 0, 50]), idx: Uint32Array.from([0, 1, 2, 0, 2, 3])};
    cellsOf(one, [0, 0, 0, 100, 50, 0]);
    assert.deepEqual(Array.from(one.cells!), [Math.fround(Math.SQRT2 * 4), 0, 0, 6, 0, 0, 100, 50, 0]);
    assert.deepEqual(Array.from(one.idx), [0, 1, 2, 0, 2, 3]);
    const globe = toGL(ir(), {grid: 4, cutFill, cutLine}).tile.layers;
    for (const id in globe) assert.equal(globe[id].cells, undefined, id);
});

test('cells: the box of a polygon has its holes, also a hole that lies outside the outer ring', () => {
    // (Such a polygon is not valid, but a tile can have one: its triangles reach the hole, and its walls stand there.)
    const geom = () => ({coords: Int16Array.from([0, 0, 100, 0, 100, 100, 0, 100, 4000, 4000, 4000, 4100, 4100, 4100, 4100, 4000]), ringEnds: Uint32Array.from([4, 8]), featEnds: Uint32Array.from([2])});
    for (const batch of [{type: 'fill', antialias: false, geom: geom()}, {type: 'fill', geom: geom(), height: Float32Array.from([25]), base: Float32Array.from([0])}] as any[]) {
        const groups: number[] = [], g = tessellate(batch, undefined, groups)!;
        cellsOf(g, groups);
        const [, , x0, y0, x1, y1, top] = cellsOfBatch(g)[0];
        assert.equal(cellsOfBatch(g).length, 1);
        let far = 0;
        for (const i of g.idx) {
            const [x, y, z] = vertex(g, i);
            assert.ok(x >= x0 && x <= x1 && y >= y0 && y <= y1 && z <= top, `${g.type}: vertex ${x}, ${y}, ${z} in the box ${[x0, y0, x1, y1, top]}`);
            if (x >= 4000) far++;
        }
        // (The walls of the hole are far from the outer ring. The triangles of this fill do not reach its hole.)
        if (g.type === 'extrusion') assert.ok(far > 0, 'a wall stands on the hole');
    }
});

test('cells: the tile that goes to the renderer, with its sorted indices and its cells, is byte for byte what it was', () => {
    // (test/unit/subdivide.test.ts has the hash of the batches before `cellsOf`. This one is of what `toGL` gives for
    // the layers of this file: a change of the grid, of the groups of a line or of the order within a cell changes it.)
    const h = createHash('sha256');
    for (const id of Object.keys(built).sort()) for (const [k, v] of Object.entries(built[id]).sort()) {
        if (v === undefined) continue;
        h.update(id + k);
        h.update(ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : String(JSON.stringify(v)));
    }
    assert.equal(h.digest('hex'), '588f6e16f40137fa740a16bf4a288f9ef64b016d79d48bc313c0f3f0d362139b');
});
