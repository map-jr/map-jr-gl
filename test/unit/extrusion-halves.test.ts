// The vertices of a fill-extrusion of a GeoJSON source keep halves of a tile unit, as MapLibre GL JS keeps whole units of
// its GeoJSON tiles, which are 8192 units wide (#1803). Rounded to whole units, the top edge of the polygon of the render
// test `combinations/fill-opaque--fill-extrusion-translucent` moved from 15.45 to 15.51 pixels and left the row 15 out.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, toGL, ROOF} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('fill-extrusion: a GeoJSON polygon keeps halves of a tile unit', () => {
    const z = 11, tx = 379, ty = 804, n = 2 ** z;
    const mercX = (lng: number) => (lng + 180) / 360, mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
    const [w, e, s, north] = [-113.27384948730469, -113.26421051269531, 35.962, 35.97];
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Polygon', coordinates: [[[w, s], [e, s], [e, north], [w, north], [w, s]]]} as any), z, tx, ty);
    const b = toGL(buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint: {'fill-extrusion-height': 10}})!], false)).tile.layers.b as any;
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < b.v.length; i += 4) if (b.v[i + 3] === ROOF) { xs.push(b.v[i]); ys.push(b.v[i + 1]); }
    // (The edges in units of a tile 8192 wide, rounded as geojson-vt rounds them, and then in units of this tile.)
    const unit = (t: number) => Math.round(t * 8192) / 2;
    assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
        [unit(mercX(w) * n - tx), unit(mercX(e) * n - tx), unit(mercY(north) * n - ty), unit(mercY(s) * n - ty)]);
    assert.equal(Math.min(...ys), 1766.5, 'the top edge is 3533 units of a tile 8192 wide, as in MapLibre GL JS');
});
