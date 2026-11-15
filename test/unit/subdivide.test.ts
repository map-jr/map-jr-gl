// The cut of tile geometry for the globe (#463, src/subdivide.ts): a tile of a map without the globe is built as
// before, and a tile with `globe` has short edges, no cracks, the same area, and triangles to the pole at the edge of
// the world.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLayer} from '../../src/style.ts';
import {LINE_VERTEX, buildTile, tessellate, toGL, type Batch} from '../../src/tile.ts';
import {NORTH_POLE, SOUTH_POLE, cutLine, globeBuild, globeGrid, type GlobeBuild} from '../../src/subdivide.ts';
import {sphere} from '../../src/globe.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const layers = [
    {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#00f'}},
    {id: 'land', type: 'fill', source: 's', 'source-layer': 'landuse', paint: {'fill-color': ['match', ['get', 'class'], 'residential', '#eee', '#ddd']}},
    {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-width': 2}},
    {id: 'buildings', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height']}},
].map(l => compileLayer(l)!);
const tile = (globe?: GlobeBuild) => toGL(buildTile(bytes, 14, layers, true), globe).tile as any;
const square = (x0: number, y0: number, x1: number, y1: number, hole?: number[]): Batch => ({type: 'fill', antialias: false,
    geom: {coords: Int16Array.from([x0, y0, x1, y0, x1, y1, x0, y1, ...hole ?? []]), ringEnds: Uint32Array.from(hole ? [4, 8] : [4]), featEnds: Uint32Array.from([hole ? 2 : 1])}});
const area = (pos: ArrayLike<number>, idx: ArrayLike<number>, skip = (_: number) => false) => {
    let sum = 0;
    for (let i = 0; i < idx.length; i += 3) {
        const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
        if (skip(a) || skip(b) || skip(c)) continue;
        sum += Math.abs((pos[b * 2] - pos[a * 2]) * (pos[c * 2 + 1] - pos[a * 2 + 1]) - (pos[c * 2] - pos[a * 2]) * (pos[b * 2 + 1] - pos[a * 2 + 1])) / 2;
    }
    return sum;
};

test('globe: the grid has 40, 20, 10, 5, 3 and 1 cells at zoom 0 to 10, more for an overzoomed tile, and none from zoom 12', () => {
    assert.deepEqual([0, 2, 4, 6, 8, 10, 11, 12, 15].map(z => globeGrid(z)), [40, 20, 10, 5, 3, 1, 1, 0, 0]);
    assert.equal(globeGrid(5, 9), 28); // a tile of zoom 5 shown at zoom 9: the cells are those of zoom 9
    assert.equal(globeGrid(0, 11.9), 128); // (at most 128 cells a side)
    assert.deepEqual(globeBuild({z: 2, y: 0}), {grid: 20, north: true, south: false});
    assert.deepEqual(globeBuild({z: 10, y: 1023}), {grid: 1, north: false, south: true});
    assert.deepEqual(globeBuild({z: 10, y: 5}), {grid: 1, north: false, south: false}); // one cell: the border is still cut
    assert.equal(globeBuild({z: 12, y: 0}), undefined);
});

test('globe: a tile without globe is byte for byte what it was before the cut existed', () => {
    // The hash of the tile of the fixture as main built it before #463 PR 2 (fills, data-driven colours, lines, buildings).
    const h = createHash('sha256'), flat = tile();
    for (const id of Object.keys(flat.layers).sort()) for (const [k, v] of Object.entries(flat.layers[id]).sort()) {
        h.update(id + k);
        h.update(ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : String(JSON.stringify(v)));
    }
    assert.equal(h.digest('hex'), '99a3356f038343851a838c44e12838728a70c12ac21711f09577c1a9cf1e1d66');
});

test('globe: the fills and lines of a real tile get the vertices that were measured, and buildings stay as they are', () => {
    const counts = (t: any) => Object.fromEntries(Object.entries(t.layers).map(([id, l]: [string, any]) => [id, [l.pos ? l.pos.length / 2 : l.v.length / LINE_VERTEX, l.idx.length / 3]]));
    const flat = counts(tile()), g20 = counts(tile({grid: 20})), g40 = counts(tile({grid: 40}));
    // [vertices, triangles] (the vertices of a fill include those of its smoothing edges).
    assert.deepEqual(flat.water, [647, 565]);
    assert.deepEqual(g20.water, [3739, 4058]);
    assert.deepEqual(g40.water, [6290, 8390]);
    assert.deepEqual(g40.land, [1720, 1316]);
    assert.deepEqual([flat.roads[1], g20.roads[1], g40.roads[1]], [34942, 42546, 49744]);
    assert.deepEqual(g40.buildings, flat.buildings); // fill-extrusion comes in a later pull request
});

test('globe: a cut fill keeps its area, has no edge longer than a cell, and no cracks', () => {
    // A square with a hole, and a triangle with slanted edges: the cut must not change the area.
    for (const grid of [1, 3, 20, 40]) {
        const sq = tessellate(square(100, 100, 3000, 2900, [1000, 1000, 1000, 2000, 2000, 2000, 2000, 1000]), {grid}) as any;
        assert.equal(area(sq.pos, sq.idx), 2900 * 2800 - 1000 * 1000, `square, grid ${grid}`);
        const tri: Batch = {type: 'fill', antialias: false, geom: {coords: Int16Array.from([10, 10, 4000, 700, 1500, 3900]), ringEnds: Uint32Array.from([3]), featEnds: Uint32Array.from([1])}};
        const flat = tessellate(tri) as any, cut = tessellate(tri, {grid}) as any;
        assert.ok(Math.abs(area(cut.pos, cut.idx) - area(flat.pos, flat.idx)) / area(flat.pos, flat.idx) < 1e-3, `triangle, grid ${grid}`);
        const cell = Math.ceil(4096 / grid);
        for (let i = 0; i < cut.idx.length; i++) {
            const a = cut.idx[i], b = cut.idx[i % 3 === 2 ? i - 2 : i + 1];
            assert.ok(Math.abs(cut.pos[a * 2] - cut.pos[b * 2]) <= cell && Math.abs(cut.pos[a * 2 + 1] - cut.pos[b * 2 + 1]) <= cell, `edge within a cell, grid ${grid}`);
        }
        // Each inner edge belongs to two triangles; the edges of one triangle only are the outline of the square and of
        // its hole. An edge that ends in the middle of another (a crack) would make that outline longer.
        const edges = new Map<string, number>();
        for (let i = 0; i < sq.idx.length; i++) {
            const a = sq.idx[i], b = sq.idx[i % 3 === 2 ? i - 2 : i + 1], key = a < b ? a + ',' + b : b + ',' + a;
            edges.set(key, (edges.get(key) ?? 0) + 1);
        }
        let outline = 0;
        for (const [key, n] of edges) if (n === 1) { const [a, b] = key.split(',').map(Number); outline += Math.hypot(sq.pos[a * 2] - sq.pos[b * 2], sq.pos[a * 2 + 1] - sq.pos[b * 2 + 1]); }
        assert.equal(outline, 2 * (2900 + 2800) + 4 * 1000, `outline, grid ${grid}`);
    }
});

test('globe: a fill is cut at the border of the tile, and a tile at the edge of the world reaches the pole', () => {
    // A fill that goes into the buffer of the tile: on a globe the buffer would lie over the next tile.
    const wide = tessellate(square(-200, -100, 4300, 300), {grid: 4, north: true}) as any, pole = (i: number) => wide.pos[i * 2 + 1] === NORTH_POLE;
    assert.equal(area(wide.pos, wide.idx, pole), 4096 * 300);
    assert.ok(Array.from(wide.pos as Int16Array).every((v, i) => i % 2 ? v === NORTH_POLE || (v >= 0 && v <= 4096) : v >= 0 && v <= 4096));
    // The triangles to the pole span the whole top border, once.
    let span = 0;
    for (let i = 0; i < wide.idx.length; i += 3) {
        const t = [wide.idx[i], wide.idx[i + 1], wide.idx[i + 2]];
        if (t.filter(pole).length === 2) span += Math.max(...t.map(k => wide.pos[k * 2])) - Math.min(...t.map(k => wide.pos[k * 2]));
    }
    assert.equal(span, 4096);
    const south = tessellate(square(0, 3000, 4096, 4096), {grid: 2, south: true}) as any;
    assert.ok(Array.from(south.pos as Int16Array).some((v, i) => i % 2 === 1 && v === SOUTH_POLE));
    // A fill that does not touch the border, and a tile that is not at the edge of the world, get no pole.
    const inner = tessellate(square(100, 100, 300, 300), {grid: 4, north: true}) as any, middle = tessellate(square(0, 0, 4096, 4096), {grid: 4}) as any;
    assert.ok(![...inner.pos, ...middle.pos].some(v => v === NORTH_POLE || v === SOUTH_POLE));
});

test('globe: lines get a point where they cross the grid, and fill outlines follow the rings and not the cut', () => {
    // A diagonal crosses three corners of the cells: three more points, not six. A ring gets its first point again at the end.
    const points: number[] = [], ring: number[] = [];
    cutLine([0, 0, 4096, 4096], 0, 2, 4, points);
    assert.deepEqual(points, [0, 0, 1024, 1024, 2048, 2048, 3072, 3072, 4096, 4096]);
    cutLine([100, 100, 3000, 100, 3000, 3000], 0, 3, 2, ring, true);
    assert.deepEqual(ring, [100, 100, 2048, 100, 3000, 100, 3000, 2048, 3000, 3000, 2048, 2048, 100, 100]);
    const geom = {coords: Int16Array.from([0, 0, 4096, 4096]), ringEnds: Uint32Array.from([2]), featEnds: Uint32Array.from([1])};
    const flat = tessellate({type: 'line', geom, cap: 'butt', join: 'miter'}) as any, cut = tessellate({type: 'line', geom, cap: 'butt', join: 'miter'}, {grid: 4}) as any;
    assert.ok(cut.v.length > flat.v.length);
    // An outline: the edges are those of the square (with the points of the grid), and none runs along a line of the cut inside it.
    const outlined = tessellate({...square(100, 100, 3000, 3000), antialias: true}, {grid: 4}) as any;
    let length = 0;
    for (let i = 0; i < outlined.edges.length; i += 2) {
        const a = outlined.edges[i], b = outlined.edges[i + 1];
        length += Math.hypot(outlined.pos[a * 2] - outlined.pos[b * 2], outlined.pos[a * 2 + 1] - outlined.pos[b * 2 + 1]);
    }
    assert.equal(length, 4 * 2900);
    // Colours from data reach every vertex of a cut fill.
    const coloured = tessellate({...square(0, 0, 4096, 4096), color: Uint8Array.from([255, 0, 0, 255])}, {grid: 8}) as any;
    assert.equal(coloured.color.length, coloured.pos.length * 2);
    assert.ok(Array.from(coloured.color as Uint8Array).every((v, i) => v === [255, 0, 0, 255][i % 4]));
});

test('globe: two tiles of different zooms meet without a gap on the sphere (no T-junctions along their border)', () => {
    // A tile of zoom z above two tiles of zoom z + 1 (other grids): the vertices on the shared border, put on the
    // sphere, and the gap between each vertex of one side and the edge of the other side, in pixels at zoom z + 1.
    // (Zoom 5 at the equator: 7 cells against 5. Zoom 10 at 80° north: one cell each, the case of the reviewer's cracks.)
    const full = square(0, 0, 4096, 4096);
    const border = (z: number, x: number, y: number, edgeY: number) => {
        const t = tessellate(full, globeBuild({z, y}, z)!) as any, n = 2 ** z, out: number[][] = [];
        for (let i = 0; i < t.pos.length; i += 2) if (t.pos[i + 1] === edgeY) out.push([(x + t.pos[i] / 4096) / n, (y + edgeY / 4096) / n]);
        return out.sort((a, b) => a[0] - b[0]);
    };
    const gap = (side: number[][], other: number[][], R: number) => Math.max(...side.map(([mx, my]) => {
        const k = other.findIndex((p, i) => i + 1 < other.length && p[0] <= mx && other[i + 1][0] >= mx);
        const [a, b] = [other[k], other[k + 1]], t = (mx - a[0]) / (b[0] - a[0] || 1);
        const pa = sphere(a[0], a[1]), pb = sphere(b[0], b[1]), p = sphere(mx, my);
        return Math.hypot(...p.map((v, i) => v - (pa[i] + (pb[i] - pa[i]) * t))) * R;
    }));
    for (const [z, x, y] of [[5, 3, 15], [10, 10, 162]]) {
        // (The radius of the globe in pixels at zoom z + 1 at the latitude of the tile.)
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / 2 ** z))), R = 512 * 2 ** (z + 1) / (2 * Math.PI * Math.cos(lat));
        const coarse = border(z, x, y, 4096), fine = [...border(z + 1, 2 * x, 2 * y + 2, 0), ...border(z + 1, 2 * x + 1, 2 * y + 2, 0)];
        const worst = Math.max(gap(fine, coarse, R), gap(coarse, fine, R));
        assert.ok(worst < 0.05, `zoom ${z}: ${worst} px`);
    }
});
