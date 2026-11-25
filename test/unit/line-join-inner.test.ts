// The corners of a line are built as in MapLibre GL JS, so that dashes and gradients fall where MapLibre draws them
// (#1706; the render tests `line-gradient-dasharray/*`): the two segments of a bevel or round join do not overlap on
// the inner side, and a corner sharper than 75 degrees has one more pair of vertices on each segment.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate, LINE_VERTEX, LINE_NORMAL} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line joins: a right angle meets at the inner miter point and has a pair of vertices 15 pixels from the corner', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString',
        coordinates: [[lng - 0.05, lat], [lng, lat], [lng, lat + 0.05]]}} as any), z, tx, ty);
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'bevel'}})!], false).layers.l)!;
    const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength), vs = [];
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        vs.push({x: view.getInt16(o, true), y: view.getInt16(o + 2, true), nx: view.getInt16(o + 4, true) / LINE_NORMAL,
            ny: view.getInt16(o + 6, true) / LINE_NORMAL, side: view.getInt16(o + 8, true), dist: view.getFloat32(o + 12, true)});
    }
    // The corner is the vertex that the line passes at its middle distance.
    const corner = vs.find(v => v.x === 2048 && v.y === 2048)!;
    assert.ok(corner, 'a vertex at the corner');
    const atCorner = vs.filter(v => v.x === corner.x && v.y === corner.y);
    // The inner vertices of the two segments both lie where the inner edges meet: one normal, sqrt(2) long.
    const long = atCorner.filter(v => Math.abs(Math.hypot(v.nx, v.ny) - Math.SQRT2) < 0.01);
    assert.equal(long.length, 2, 'two inner vertices at the inner miter point');
    assert.ok(Math.abs(long[0].nx - long[1].nx) < 0.01 && Math.abs(long[0].ny - long[1].ny) < 0.01, 'the inner vertices meet');
    // 15 pixels is 120 tile units: one pair on each segment, with the distance along the line of its place.
    const sharp = vs.filter(v => Math.abs(Math.hypot(v.x - corner.x, v.y - corner.y) - 120) < 1);
    assert.equal(sharp.length, 4, 'a pair of vertices on each segment 15 pixels from the corner');
    for (const v of sharp) assert.ok(Math.abs(Math.abs(v.dist - corner.dist) - 120) < 1, 'its distance along the line');
});

test('line joins: line-offset moves the four vertices of a bevel corner along its miter, so short segments do not spike', () => {
    // A zig-zag of 100-degree turns. MapLibre moves the stroke at a corner by the miter times the offset. Before this
    // was fixed, the outer vertex moved along its own normal while its partner sat at the inner miter point, and a line
    // with an offset and segments shorter than the pullback drew spikes across its corners.
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI, d = 0.002;
    const coords = Array.from({length: 6}, (_, i) => [lng + i * d, lat + (i % 2 ? 1.2 * d : 0)]);
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: coords}} as any), z, tx, ty);
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'bevel'}})!], false).layers.l)!;
    const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength);
    // The position that the vertex shader of src/gl.ts gives a vertex for a half width hw and an offset off (tile units).
    const at = (o: number, hw: number, off: number) => {
        const x = view.getInt16(o, true), y = view.getInt16(o + 2, true), ex = view.getInt16(o + 4, true) / LINE_NORMAL, ey = view.getInt16(o + 6, true) / LINE_NORMAL;
        const raw = view.getInt16(o + 8, true), side = Math.sign(raw), c = Math.abs(raw) > 1.5 ? (Math.abs(raw) - 2) / 4096 - 2 : 0;
        return [x + ex * (hw + side * off) + c * off * ey, y + ey * (hw + side * off) - c * off * ex];
    };
    const byCorner = new Map<string, number[]>();
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        const key = view.getInt16(o, true) + ',' + view.getInt16(o + 2, true);
        byCorner.set(key, [...byCorner.get(key) ?? [], o]);
    }
    // The ends and the extra pairs have two vertices, a bevel corner has four.
    const corners = [...byCorner].filter(([, vs]) => vs.length === 4).map(([key, vs]) => ({at: key.split(',').map(Number), vs}));
    assert.equal(corners.length, 4, 'four bevel corners');
    for (const {vs} of corners) {
        const moves = vs.map(o => { const [x0, y0] = at(o, 10, 0), [x1, y1] = at(o, 10, 12); return [x1 - x0, y1 - y0]; });
        for (const [mx, my] of moves) assert.ok(Math.hypot(mx - moves[0][0], my - moves[0][1]) < 0.05, `the offset moves each vertex of a corner the same way: ${JSON.stringify(moves)}`);
        // Along the miter: the inner vertices point to the inner miter point, 1 / cos of half the turn long (1.2 to 2 here).
        const miter = Math.max(...vs.map(o => Math.hypot(view.getInt16(o + 4, true), view.getInt16(o + 6, true)) / LINE_NORMAL));
        assert.ok(miter > 1.2 && miter < 2, `a turn between 75 and 120 degrees: miter ${miter}`);
        assert.ok(Math.abs(Math.hypot(moves[0][0], moves[0][1]) - 12 * miter) < 0.05, `along the miter: ${JSON.stringify(moves[0])}, ${12 * miter}`);
    }
});

test('line joins: line-offset moves a round join and a round cap as a whole, so the fan is centered on the offset corner', () => {
    // A zig-zag of 100-degree turns with round joins and caps (#1986). The middle vertex of a fan did not move with the
    // offset, and its outer vertices moved outward, so a line with an offset drew a blob at the centerline of each corner.
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI, d = 0.002;
    const coords = Array.from({length: 6}, (_, i) => [lng + i * d, lat + (i % 2 ? 1.2 * d : 0)]);
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: coords}} as any), z, tx, ty);
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'round', 'line-cap': 'round'}})!], false).layers.l)!;
    const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength);
    // The position that the vertex shader of src/gl.ts gives a vertex for a half width hw and an offset off (tile units).
    const at = (o: number, hw: number, off: number) => {
        const x = view.getInt16(o, true), y = view.getInt16(o + 2, true), nx = view.getInt16(o + 4, true) / LINE_NORMAL, ny = view.getInt16(o + 6, true) / LINE_NORMAL;
        const raw = view.getInt16(o + 8, true), sa = Math.abs(raw), side = Math.sign(raw), c = sa > 1.5 && sa < 16383.5 ? (sa - 2) / 4096 - 2 : 0, t = (sa - 24575) / 8191 * Math.PI;
        const [ex, ey] = sa > 16383.5 ? [Math.cos(t), Math.sin(t)] : [nx * Math.abs(side), ny * Math.abs(side)], s = side || 1;
        return [x + ex * hw + (nx * s + c * ny) * off, y + ey * hw + (ny * s - c * nx) * off];
    };
    const byPoint = new Map<string, number[]>();
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        const key = view.getInt16(o, true) + ',' + view.getInt16(o + 2, true);
        byPoint.set(key, [...byPoint.get(key) ?? [], o]);
    }
    // Two ends with a cap and four corners with a fan; the extra pairs of a sharp corner have two vertices.
    const fans = [...byPoint.values()].filter(vs => vs.some(o => view.getInt16(o + 8, true) === 0));
    assert.equal(fans.length, 6, 'four round joins and two round caps');
    for (const vs of fans) {
        const moves = vs.map(o => { const [x0, y0] = at(o, 10, 0), [x1, y1] = at(o, 10, 12); return [x1 - x0, y1 - y0]; });
        for (const [mx, my] of moves) assert.ok(Math.hypot(mx - moves[0][0], my - moves[0][1]) < 0.05, `the offset moves each vertex of a fan and its pairs the same way: ${JSON.stringify(moves)}`);
        assert.ok(Math.hypot(moves[0][0], moves[0][1]) >= 12 - 0.05, 'the offset moves the fan');
        // The outer vertices of the fan stay one half width from its middle.
        const middle = vs.find(o => view.getInt16(o + 8, true) === 0)!, [cx, cy] = at(middle, 10, 12);
        for (const o of vs.filter(o => view.getInt16(o + 8, true) > 16383)) {
            const [x, y] = at(o, 10, 12);
            assert.ok(Math.abs(Math.hypot(x - cx, y - cy) - 10) < 0.05, `an outer vertex of the fan is a half width from its middle: ${Math.hypot(x - cx, y - cy)}`);
        }
    }
});
