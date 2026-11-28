// The view test of the renderer for the cells of a batch (`sidesOf` and `hidden` in src/gl.ts): a box with a point in
// the view is never left out, at any pitch and bearing, and a box that is far outside the view is.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {hidden, sidesOf} from '../../src/gl.ts';

function rng(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
}
const camera = (zoom: number, bearing: number, pitch: number) => { const t = new Transform(); t.width = 1000; t.height = 700; t.set([-74.0065, 40.7085], zoom, bearing, pitch); return t; };
/** Whether the point (x, y, z) of a tile is in the view: `m` takes it to clip space. */
const seen = (m: ArrayLike<number>, x: number, y: number, z: number) => {
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return cw > 0 && Math.abs(cx) <= cw && Math.abs(cy) <= cw;
};

test('cells: a box with a point in the view is drawn, at each zoom, bearing and pitch', () => {
    const r = rng(7), sides = new Float64Array(20);
    let boxes = 0, inView = 0, left = 0;
    for (const zoom of [14, 14.3, 15.2, 16.7, 18]) for (const bearing of [0, 40, 135, -100]) for (const pitch of [0, 30, 60, 80]) {
        const tr = camera(zoom, bearing, pitch);
        for (const id of tr.tileCover(14, 14)) {
            const m = tr.tileMatrix4(id);
            sidesOf(m, 1 + 8 / 1000, 1 + 8 / 700, sides);
            for (let i = 0; i < 60; i++) {
                const w = r() < 0.5 ? r() * 200 : r() * 3000, h = r() < 0.5 ? r() * 200 : r() * 3000, x0 = r() * (EXTENT + 512) - 256 - w / 2, y0 = r() * (EXTENT + 512) - 256 - h / 2;
                const top = r() < 0.5 ? 0 : r() * 400;
                let visible = false;
                for (let a = 0; a <= 8 && !visible; a++) for (let b = 0; b <= 8 && !visible; b++) for (const z of top ? [0, top / 2, top] : [0]) if (seen(m, x0 + w * a / 8, y0 + h * b / 8, z)) { visible = true; break; }
                boxes++;
                if (visible) inView++;
                const out = hidden(sides, x0, y0, x0 + w, y0 + h, top);
                if (out) left++;
                assert.ok(!(visible && out), `zoom ${zoom}, bearing ${bearing}, pitch ${pitch}, tile ${id.key}: the box ${[x0, y0, w, h, top].map(Math.round)} has a point in the view`);
            }
        }
    }
    // (The test is exact for a box against one side of the view, so few boxes outside the view are drawn.)
    assert.ok(inView > boxes * 0.05 && left > boxes * 0.3, `${boxes} boxes: ${inView} in the view, ${left} left out`);
    assert.ok(left + inView > boxes * 0.8, `${boxes - left - inView} boxes outside the view are drawn`);
});

test('cells: a box beside the view, or behind the camera, is left out, and a box that holds the view is drawn', () => {
    const tr = camera(15, 0, 0), sides = new Float64Array(20), id = tr.tileCover(14, 14)[0], m = tr.tileMatrix4(id);
    sidesOf(m, 1.008, 1.011, sides);
    assert.equal(hidden(sides, -1e6, -1e6, 1e6, 1e6, 0), false);
    assert.equal(hidden(sides, 1e5, 0, 1e5 + 10, 10, 0), true);
    assert.equal(hidden(sides, -1e5 - 10, 0, -1e5, 10, 0), true);
    assert.equal(hidden(sides, 0, 1e5, 10, 1e5 + 10, 0), true);
    assert.equal(hidden(sides, 0, -1e5 - 10, 10, -1e5, 0), true);
    // (A matrix whose last row gives a negative w for every point: all of the tile is behind the camera.)
    const behind = Float32Array.from(m); behind[3] = behind[7] = behind[11] = 0; behind[15] = -1;
    sidesOf(behind, 1.008, 1.011, sides);
    assert.equal(hidden(sides, 0, 0, 100, 100, 50), true);
});

// ---- The ranges that the renderer draws, for a real tile ----
import {readFileSync} from 'node:fs';
import {compileLayer} from '../../src/style.ts';
import {CELL, CELL_HEAD, LINE_NORMAL, LINE_VERTEX, buildTile, toGL, type GLBatch} from '../../src/tile.ts';
import {cellRanges, lineReach} from '../../src/gl.ts';

const WIDTH = 24, HEIGHT = 30;
const tile = toGL(buildTile(new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url))), 14, [
    {id: 'water', type: 'fill', source: 's', 'source-layer': 'water'},
    {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', layout: {'line-join': 'round', 'line-cap': 'round'}, paint: {'line-width': WIDTH}},
    {id: 'buildings', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height']}},
    {id: 'slabs', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': HEIGHT}},
].map(l => compileLayer(l as any)!), false)).tile.layers;
/** The place of each vertex of a batch as its program draws it, in tile units: x, y and height. `scale` is pixels per tile unit. */
function drawn(g: GLBatch, scale: number): Float64Array {
    if (g.type === 'line') {
        // (As the vertex shader of the line program without an offset: the vertex moves half the width, with the soft
        // edge, along its direction, and an outer vertex of a fan along the angle in its side.)
        const v = new DataView(g.v.buffer, g.v.byteOffset), n = g.v.byteLength / LINE_VERTEX, out = new Float64Array(n * 3), hw = WIDTH / 2 + 0.5;
        for (let i = 0, o = 0; i < n; i++, o += LINE_VERTEX) {
            const side = v.getInt16(o + 8, true), sa = Math.abs(side), t = (sa - 24575) / 8191 * Math.PI;
            const ex = sa > 16383.5 ? Math.cos(t) : side ? v.getInt16(o + 4, true) / LINE_NORMAL : 0, ey = sa > 16383.5 ? Math.sin(t) : side ? v.getInt16(o + 6, true) / LINE_NORMAL : 0;
            out[i * 3] = v.getInt16(o, true) / 2 + ex * hw / scale; out[i * 3 + 1] = v.getInt16(o + 2, true) / 2 + ey * hw / scale;
        }
        return out;
    }
    if (g.type === 'extrusion') { const out = new Float64Array(g.v.length / 4 * 3); for (let i = 0; i < out.length / 3; i++) { out[i * 3] = g.v[i * 4]; out[i * 3 + 1] = g.v[i * 4 + 1]; out[i * 3 + 2] = g.lift ? (g.v[i * 4 + 2] ? HEIGHT : 0) : g.v[i * 4 + 2]; } return out; }
    const pos = (g as Extract<GLBatch, {type: 'fill'}>).pos, out = new Float64Array(pos.length / 2 * 3);
    for (let i = 0; i < pos.length / 2; i++) { out[i * 3] = pos[i * 2]; out[i * 3 + 1] = pos[i * 2 + 1]; }
    return out;
}

test('cells: every triangle of a real tile with a corner in the view is in a range that is drawn, and a view of a part of the tile draws a part of it', () => {
    const sides = new Float64Array(20), share: Record<string, number[]> = {};
    for (const [zoom, bearing, pitch] of [[14.3, 0, 0], [15.2, 40, 0], [15.6, 120, 60], [16.7, -30, 45], [17.5, 10, 0], [16, 200, 75]]) {
        const tr = new Transform(); tr.width = 1000; tr.height = 700;
        // (The middle of the tile 14/4823/6160.)
        tr.set([(4823.5 / 16384) * 360 - 180, 40.7067], zoom, bearing, pitch);
        const id = tr.tileCover(14, 14).find(t => t.key === '14/4823/6160')!, m = tr.tileMatrix4(id), scale = 512 * 2 ** (zoom - 14) / EXTENT;
        assert.ok(id, `zoom ${zoom}: the tile is in the cover`);
        sidesOf(m, 1 + 8 / 1000, 1 + 8 / 700, sides);
        for (const name of ['water', 'roads', 'buildings', 'slabs']) {
            const g = tile[name], cells = g.cells!, at = drawn(g, scale);
            assert.ok(cells.length > CELL_HEAD + CELL, name);
            const reach = g.type === 'line' ? lineReach(cells, WIDTH, 0, 0) / scale : 0;
            const ranges = cellRanges(cells, sides, reach, g.type === 'extrusion' && g.lift ? HEIGHT : undefined);
            const inRange = new Uint8Array(g.idx.length);
            let kept = 0;
            for (let i = 0; i < ranges.length; i += 2) { assert.ok(ranges[i] < ranges[i + 1] && ranges[i + 1] <= g.idx.length && (!i || ranges[i] > ranges[i - 1]), name); inRange.fill(1, ranges[i], ranges[i + 1]); kept += ranges[i + 1] - ranges[i]; }
            let visible = 0;
            for (let t = 0; t < g.idx.length; t += 3) {
                let any = false;
                for (let j = 0; j < 3 && !any; j++) { const v = g.idx[t + j] * 3; any = seen(m, at[v], at[v + 1], at[v + 2]); }
                if (!any) continue;
                visible++;
                assert.ok(inRange[t] && inRange[t + 2], `${name} at zoom ${zoom}, bearing ${bearing}, pitch ${pitch}: the triangle at index ${t} has a corner in the view`);
            }
            (share[name] ??= []).push(kept / g.idx.length);
            if (zoom === 14.3) assert.ok(visible > 0, `${name}: the view has triangles`);
        }
    }
    // (At zoom 17.5 the view is a ninth of the tile a side: most of each batch is left out. The water of this tile is a
    // few large polygons, which are one group each, so it is drawn whole.)
    for (const name of ['roads', 'buildings', 'slabs']) assert.ok(share[name][4] < 0.35, `${name}: ${(share[name][4] * 100).toFixed(0)} % of the indices are drawn at zoom 17.5`);
});

test('cells: the reach of a line grows with its width, its gap and its offset', () => {
    const cells = Float32Array.from([Math.SQRT2 * 4, 0]);
    assert.ok(lineReach(cells, 10, 0, 0) >= Math.SQRT2 * 4 * 5.5);
    assert.ok(lineReach(cells, 10, 6, 0) > lineReach(cells, 10, 0, 0));
    assert.ok(lineReach(cells, 10, 0, -4) > lineReach(cells, 10, 0, 0));
    assert.equal(lineReach(cells, 10, 0, -4), lineReach(cells, 10, 0, 4));
});
