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
        vs.push({x: view.getInt16(o, true) / 2, y: view.getInt16(o + 2, true) / 2, nx: view.getInt16(o + 4, true) / LINE_NORMAL,
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
        const x = view.getInt16(o, true) / 2, y = view.getInt16(o + 2, true) / 2, ex = view.getInt16(o + 4, true) / LINE_NORMAL, ey = view.getInt16(o + 6, true) / LINE_NORMAL;
        const raw = view.getInt16(o + 8, true), side = Math.sign(raw), c = Math.abs(raw) > 1.5 ? (Math.abs(raw) - 2) / 4096 - 2 : 0;
        return [x + ex * (hw + side * off) + c * off * ey, y + ey * (hw + side * off) - c * off * ex];
    };
    const byCorner = new Map<string, number[]>();
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        const key = view.getInt16(o, true) / 2 + ',' + view.getInt16(o + 2, true) / 2;
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
        const x = view.getInt16(o, true) / 2, y = view.getInt16(o + 2, true) / 2, nx = view.getInt16(o + 4, true) / LINE_NORMAL, ny = view.getInt16(o + 6, true) / LINE_NORMAL;
        const raw = view.getInt16(o + 8, true), sa = Math.abs(raw), side = Math.sign(raw), c = sa > 1.5 && sa < 16383.5 ? (sa - 2) / 4096 - 2 : 0, t = (sa - 24575) / 8191 * Math.PI;
        const [ex, ey] = sa > 16383.5 ? [Math.cos(t), Math.sin(t)] : [nx * Math.abs(side), ny * Math.abs(side)], s = side || 1;
        return [x + ex * hw + (nx * s + c * ny) * off, y + ey * hw + (ny * s - c * nx) * off];
    };
    const byPoint = new Map<string, number[]>();
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        const key = view.getInt16(o, true) / 2 + ',' + view.getInt16(o + 2, true) / 2;
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

test('line joins: past a turn of 120 degrees, line-offset moves the pairs of a round join with its fan, as MapLibre GL JS does', () => {
    // A turn of 135 degrees moves the whole corner twice the offset along the bisector. A turn of 165 degrees eases that
    // vector back to the normal of each segment (offsetFallback of MapLibre), so that each segment keeps its own round
    // end. Before, the pairs moved along the normals of the segments and the fan along the bisector, apart from them.
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI, d = 0.02;
    for (const turn of [135, 165]) {
        const a = turn * Math.PI / 180, coords = [[lng - d, lat], [lng, lat], [lng + d * Math.cos(a), lat + d * Math.sin(a)]];
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: coords}} as any), z, tx, ty);
        const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'round'}})!], false).layers.l)!;
        const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength);
        // The position that the vertex shader of src/gl.ts gives a vertex for a half width hw and an offset off.
        const at = (o: number, hw: number, off: number) => {
            const x = view.getInt16(o, true) / 2, y = view.getInt16(o + 2, true) / 2, nx = view.getInt16(o + 4, true) / LINE_NORMAL, ny = view.getInt16(o + 6, true) / LINE_NORMAL;
            const raw = view.getInt16(o + 8, true), sa = Math.abs(raw), side = Math.sign(raw), c = sa > 1.5 && sa < 16383.5 ? (sa - 2) / 4096 - 2 : 0, t = (sa - 24575) / 8191 * Math.PI;
            const [ex, ey] = sa > 16383.5 ? [Math.cos(t), Math.sin(t)] : [nx * Math.abs(side), ny * Math.abs(side)], s = side || 1;
            return [x + ex * hw + (nx * s + c * ny) * off, y + ey * hw + (ny * s - c * nx) * off];
        };
        const pts = new Map<number, number[]>();
        for (let o = 0; o < view.byteLength; o += LINE_VERTEX) pts.set(view.getFloat32(o + 12, true), [view.getInt16(o, true) / 2, view.getInt16(o + 2, true) / 2]);
        const [p0, p1, p2] = [...pts.keys()].sort((a, b) => a - b).map(k => pts.get(k)!);
        const unit = (x: number, y: number) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
        const [pdx, pdy] = unit(p1[0] - p0[0], p1[1] - p0[1]), [dx, dy] = unit(p2[0] - p1[0], p2[1] - p1[1]);
        const pn = [-pdy, pdx], nn = [-dy, dx], miter = 2 / Math.hypot(pn[0] + nn[0], pn[1] + nn[1]);
        const [bx, by] = unit(pn[0] + nn[0], pn[1] + nn[1]).map(v => v * Math.min(miter, 2)), ease = Math.min(1, Math.max(0, (miter - 3) / 5));
        const want = [pn, nn].map(([x, y]) => [(bx + (x - bx) * ease) * 12, (by + (y - by) * ease) * 12]);
        const seen = new Set<number>();
        for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
            if (view.getInt16(o, true) / 2 !== p1[0] || view.getInt16(o + 2, true) / 2 !== p1[1]) continue;
            const [x0, y0] = at(o, 10, 0), [x1, y1] = at(o, 10, 12), k = want.findIndex(([wx, wy]) => Math.hypot(x1 - x0 - wx, y1 - y0 - wy) < 0.1);
            assert.ok(k >= 0, `turn ${turn}: a vertex at the corner moves by ${[x1 - x0, y1 - y0]}, not by one of ${JSON.stringify(want)}`);
            seen.add(k);
        }
        assert.equal(seen.size, ease ? 2 : 1, `turn ${turn}: the vectors that the offset moves the corner along`);
    }
});

test('line joins: a miter join that turns more than 120 degrees is a flipbevel, as in MapLibre GL JS (#1981)', () => {
    // A turn of about 150 degrees: the line goes east, then back to the west and north.
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const a = 150 * Math.PI / 180, d = 0.05;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString',
        coordinates: [[lng - d, lat], [lng, lat], [lng + d * Math.cos(a), lat + d * Math.sin(a) * 0.6]]}} as any), z, tx, ty);
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'miter'}})!], false).layers.l)!;
    const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength), vs = [];
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
        vs.push({x: view.getInt16(o, true) / 2, y: view.getInt16(o + 2, true) / 2, nx: view.getInt16(o + 4, true) / LINE_NORMAL,
            ny: view.getInt16(o + 6, true) / LINE_NORMAL, side: view.getInt16(o + 8, true)});
    }
    const atCorner = vs.filter(v => v.x === 2048 && v.y === 2048);
    // Two pairs across the bisector of the two normals, 1 / sin of half the turn long (about 1.035 here).
    assert.equal(atCorner.length, 4, 'two pairs at the corner');
    for (const v of atCorner) assert.ok(Math.abs(v.side) > 15360 && Math.abs(v.side) < 16384, 'a pair of a flipbevel (#2114)');
    const len = Math.hypot(atCorner[0].nx, atCorner[0].ny);
    for (const v of atCorner) assert.ok(Math.abs(Math.hypot(v.nx, v.ny) - len) < 0.01, 'all the same length');
    assert.ok(len > 1 && len < 1.2, `the length is about 1 / sin of half the turn (${len})`);
});

test('line joins: a GeoJSON line keeps halves of a tile unit, and a turn of 175 degrees has the pairs of a sharp corner', () => {
    // MapLibre GL JS rounds the vertices of a GeoJSON line in a tile 8192 units wide, twice as fine as the tiles here,
    // and adds a pair of vertices 15 pixels from every corner sharper than 75 degrees (#2118; the render test
    // `regressions/mapbox-gl-native#15139`). Before, vertices were whole units, and a miter corner past 120 degrees had
    // no such pairs.
    const z = 10, tx = 300, ty = 380, n = 2 ** z, unit = 360 / n / 4096;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    // The corner is half a unit east of the middle of the tile, and the line turns back by 175 degrees there.
    const turn = 175 * Math.PI / 180, far = 0.05, cx = lng + 0.5 * unit;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString',
        coordinates: [[cx - far, lat], [cx, lat], [cx + far * Math.cos(turn), lat + far * Math.sin(turn)]]}} as any), z, tx, ty);
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g'})!], false).layers.l)!;
    const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength), vs = [];
    for (let o = 0; o < view.byteLength; o += LINE_VERTEX) vs.push({x: view.getInt16(o, true) / 2, y: view.getInt16(o + 2, true) / 2});
    assert.ok(vs.some(v => v.x === 2048.5 && v.y === 2048), 'a vertex at the corner, half a unit east of the middle');
    const sharp = vs.filter(v => Math.abs(Math.hypot(v.x - 2048.5, v.y - 2048) - 120) < 1);
    assert.equal(sharp.length, 4, 'a pair of vertices on each segment 15 pixels from the corner');
});

test('line joins: line-offset moves a flipbevel corner along the bisector and eases it to the normal of the pair, as MapLibre GL JS does (#2114)', () => {
    // A miter join past a turn of 120 degrees. MapLibre moves both pairs of the corner by twice the offset along the
    // bisector, and as the miter grows from 3 to 8 eases that vector to the normal of each pair (offsetFallback). Before,
    // each pair moved along its own normal, across the bisector.
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI, d = 0.02;
    for (const turn of [130, 150, 165, -150]) {
        const a = turn * Math.PI / 180, coords = [[lng - d, lat], [lng, lat], [lng + d * Math.cos(a), lat + d * Math.sin(a)]];
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: coords}} as any), z, tx, ty);
        const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout: {'line-join': 'miter'}})!], false).layers.l)!;
        const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength);
        // The position that the vertex shader of src/gl.ts gives a vertex for a half width hw and an offset off.
        const at = (o: number, hw: number, off: number) => {
            const x = view.getInt16(o, true) / 2, y = view.getInt16(o + 2, true) / 2, nx = view.getInt16(o + 4, true) / LINE_NORMAL, ny = view.getInt16(o + 6, true) / LINE_NORMAL;
            const raw = view.getInt16(o + 8, true), sa = Math.abs(raw), side = Math.sign(raw), u = sa - 15872, flip = sa > 15360.5 && sa < 16383.5;
            const k = flip ? (Math.abs(u) - 1) / 510 : 1;
            const c = sa > 1.5 && sa < 15360.5 ? (sa - 2) / 4096 - 2 : flip ? Math.sign(u) * (1 - k) * 2 / Math.hypot(nx, ny) : 0;
            return [x + nx * hw + (nx * side * k + c * ny) * off, y + ny * hw + (ny * side * k - c * nx) * off];
        };
        const pts = new Map<number, number[]>();
        for (let o = 0; o < view.byteLength; o += LINE_VERTEX) pts.set(view.getFloat32(o + 12, true), [view.getInt16(o, true) / 2, view.getInt16(o + 2, true) / 2]);
        const [p0, p1, p2] = [...pts.keys()].sort((a, b) => a - b).map(k => pts.get(k)!);
        const unit = (x: number, y: number) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
        const [pdx, pdy] = unit(p1[0] - p0[0], p1[1] - p0[1]), [dx, dy] = unit(p2[0] - p1[0], p2[1] - p1[1]);
        const pn = [-pdy, pdx], nn = [-dy, dx], miter = 2 / Math.hypot(pn[0] + nn[0], pn[1] + nn[1]);
        const [bx, by] = unit(pn[0] + nn[0], pn[1] + nn[1]).map(v => v * 2), ease = Math.min(1, Math.max(0, (miter - 3) / 5));
        let checked = 0;
        for (let o = 0; o < view.byteLength; o += LINE_VERTEX) {
            if (view.getInt16(o, true) / 2 !== p1[0] || view.getInt16(o + 2, true) / 2 !== p1[1]) continue;
            // The normal of the pair of this vertex, as MapLibre stores it on the vertex of the left side.
            const side = Math.sign(view.getInt16(o + 8, true)), jx = side * view.getInt16(o + 4, true) / LINE_NORMAL, jy = side * view.getInt16(o + 6, true) / LINE_NORMAL;
            const want = [(bx + (jx - bx) * ease) * 12, (by + (jy - by) * ease) * 12];
            const [x0, y0] = at(o, 10, 0), [x1, y1] = at(o, 10, 12);
            assert.ok(Math.hypot(x1 - x0 - want[0], y1 - y0 - want[1]) < 0.1, `turn ${turn} (miter ${miter.toFixed(2)}): a vertex at the corner moves by ${[x1 - x0, y1 - y0]}, not by ${want}`);
            assert.ok(Math.hypot(x0 - p1[0] - jx * side * 10, y0 - p1[1] - jy * side * 10) < 0.05, `turn ${turn}: without an offset the vertex stays where it was`);
            checked++;
        }
        assert.equal(checked, 4, `turn ${turn}: two pairs at the corner`);
    }
});
