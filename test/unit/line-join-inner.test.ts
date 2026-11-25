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
