// `fill-extrusion-rounded-corner-distance` cuts each corner of a building with an arc, as in MapLibre GL JS 6.17 (#1693;
// the render tests of the group `fill-extrusion-rounded-corner-distance`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

const z = 16, tx = 32768, ty = 32768, n = 2 ** z;
const lng = (tx + 0.25) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.25) / n))) * 180 / Math.PI;
// A square of about 0.5 tile (300 m at this zoom) inside the tile.
const d = 0.5 / n * 360;
const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Polygon',
    coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat - d], [lng, lat - d], [lng, lat]]]}} as any), z, tx, ty);
const build = (layout?: Record<string, unknown>) =>
    buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', layout, paint: {'fill-extrusion-height': 10}})!], false, undefined, undefined, false, [z, ty]).layers.b;

test('fill-extrusion-rounded-corner-distance: each corner becomes an arc, and 0 keeps it sharp', () => {
    const sharp = build(), zero = build({'fill-extrusion-rounded-corner-distance': 0});
    assert.equal(sharp.geom.ringEnds[0], 4);
    assert.deepEqual(Array.from(zero.geom.coords), Array.from(sharp.geom.coords));
    assert.equal(sharp.smooth, undefined);
    // 10 m is about 67 units of the tile at zoom 16 on the equator (a tile is 611 m and 4096 units): each corner of 90 degrees is an arc of 4 points.
    const round = build({'fill-extrusion-rounded-corner-distance': 10}), c = round.geom.coords;
    assert.equal(round.geom.ringEnds[0], 16);
    assert.equal(round.smooth, true);
    // The arc of the first corner starts on one side and ends on the other, about 67 units from the corner.
    const [x0, y0] = [sharp.geom.coords[0], sharp.geom.coords[1]];
    const ends = [[c[0], c[1]], [c[6], c[7]]].map(([x, y]) => Math.hypot(x - x0, y - y0));
    for (const e of ends) assert.ok(Math.abs(e - 67) <= 1.5, `${e}`);
});

test('fill-extrusion-rounded-corner-distance: the radius is at most a fifth of a side', () => {
    const c = build({'fill-extrusion-rounded-corner-distance': 10000}).geom.coords, side = build().geom;
    const len = Math.abs(side.coords[2] - side.coords[0]) || Math.abs(side.coords[3] - side.coords[1]);
    assert.ok(Math.abs(Math.hypot(c[0] - side.coords[0], c[1] - side.coords[1]) - len / 5) <= 1.5);
});
