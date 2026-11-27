// On 3D terrain, each polygon of a fill-extrusion stands on the ground at its centroid, as in MapLibre GL JS, so its
// roof stays flat (#2154; the render tests `terrain/fill-extrusion*`). Every vertex carries its polygon's centroid.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, toGL, ROOF} from '../../src/tile.ts';
import {prepareGeoJSON, prepareSource, sliceGeoJSON} from '../../src/geojson.ts';
import {EXTENT} from '../../src/geo.ts';

test('fill-extrusion: every vertex carries the centroid of its own polygon', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.2) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const sq = (x: number, d: number) => [[[x, lat], [x + d, lat], [x + d, lat + d], [x, lat + d], [x, lat]]];
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon',
        coordinates: [sq(lng, 0.02), sq(lng + 0.1, 0.04)]}} as any), z, tx, ty);
    const ir = buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint: {'fill-extrusion-height': 10}})!], false);
    const b = toGL(ir).tile.layers.b as any;
    assert.ok(b.c, 'the batch has centroids');
    assert.equal(b.c.length, b.v.length / 2);
    const seen = new Map<string, number[]>();
    for (let i = 0; i < b.c.length / 2; i++) {
        const k = `${b.c[i * 2]},${b.c[i * 2 + 1]}`;
        seen.set(k, [...(seen.get(k) ?? []), b.v[i * 4], b.v[i * 4 + 1]]);
    }
    assert.equal(seen.size, 2);
    for (const [k, xy] of seen) {
        const [cx, cy] = k.split(',').map(Number), xs = xy.filter((_, i) => i % 2 === 0), ys = xy.filter((_, i) => i % 2);
        assert.ok(Math.abs(cx - (Math.min(...xs) + Math.max(...xs)) / 2) <= 1 && Math.abs(cy - (Math.min(...ys) + Math.max(...ys)) / 2) <= 1, k);
    }
});

// A rectangle from 0.6 to 1.9 tiles of x and from 0.3 to 0.7 tiles of y of the tile 15/17090/11656: it crosses the edge
// to the next tile and reaches past the buffer of each tile (a quarter of a tile, the 128 of the compat entry).
const z = 15, tx = 17090, ty = 11656;
const lng = (x: number) => x / 2 ** z * 360 - 180, lat = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;
const wide = (x1 = 1.9) => prepareSource({type: 'Polygon', coordinates: [[[lng(tx + 0.6), lat(ty + 0.7)], [lng(tx + x1), lat(ty + 0.7)],
    [lng(tx + x1), lat(ty + 0.3)], [lng(tx + 0.6), lat(ty + 0.3)], [lng(tx + 0.6), lat(ty + 0.7)]]]}, {buffer: 128});
const building = (x: number, x1?: number) => toGL(buildTile(sliceGeoJSON(wide(x1), z, x, ty), z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint: {'fill-extrusion-height': 10}})!], false)).tile.layers.b as any;

// MapLibre GL JS lifts each piece of a polygon by the ground at the centroid of the piece in its tile, so the centroid
// lies in the elevation tile under that tile (#2287). A GeoJSON source does the same.
test('fill-extrusion: each piece of a GeoJSON polygon in two tiles carries the centroid of the piece', () => {
    const centroids = (x: number) => {
        const b = building(x), set = new Set<string>();
        for (let i = 0; i < b.c.length / 2; i++) set.add(`${b.c[i * 2]},${b.c[i * 2 + 1]}`);
        return [...set].map(k => k.split(',').map(Number));
    };
    // The piece of the left tile runs from 0.6 tiles to the edge of the buffer (1.25 tiles); the piece of the right tile
    // from the edge of the buffer (-0.25 tiles) to 0.9 tiles.
    for (const [x, x0, x1] of [[tx, 0.6, 1.25], [tx + 1, -0.25, 0.9]]) {
        const c = centroids(x);
        assert.equal(c.length, 1);
        assert.ok(Math.abs(c[0][0] - (x0 + x1) / 2 * EXTENT) <= 1 && Math.abs(c[0][1] - 0.5 * EXTENT) <= 1, `${x}: ${c[0]}`);
    }
});

// A polygon whose outer ring lies wholly in the buffer of a tile is drawn by the next tile. As in MapLibre GL JS
// (`isEntirelyOutside`), this tile draws no roof and no walls for it: its centroid would lie past the elevation tile
// under this tile, so on 3D terrain it would float (#2287, where a z10 tile at the horizon drew it).
test('fill-extrusion: a polygon wholly in the buffer of the tile is not drawn', () => {
    // A rectangle from 0.6 to 0.9 tiles of x lies from -0.4 to -0.1 tiles in the next tile: its piece there, cut at the
    // edge of the buffer (-0.25), lies wholly left of the tile. The tile of the rectangle draws it.
    assert.equal(building(tx + 1, 0.9), undefined);
    assert.ok(building(tx, 0.9));
});

// The clip of the source cuts a polygon along the edge of the buffer. Buildings are not cut at the edge of the tile, as in
// MapLibre GL JS, so a wall there would stand inside the building, in the part that the next tile draws: such an edge has
// no wall (`isBoundaryEdge` of MapLibre GL JS).
test('fill-extrusion: an edge along the buffer of the tile has no wall', () => {
    const b = building(tx);
    let walls = 0, past = 0;
    for (let i = 0; i < b.v.length / 4; i++) if (b.v[i * 4 + 3] !== ROOF) { walls++; if (b.v[i * 4] > EXTENT) past++; }
    // (A wall has 4 vertices. The walls along x end at the edge of the buffer, one corner pair each.)
    assert.equal(walls, 3 * 4);
    assert.equal(past, 4);
});
