// The `buffer` of a GeoJSON source sets how far past its edges a tile keeps the features, as in MapLibre GL JS (#1066).
// With `buffer: 0` a polygon is cut at the edge of the tile, so the walls of an extrusion start where MapLibre's do.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource, sliceGeoJSON} from '../../src/geojson.ts';
import {resolveStyle} from '../../src/resolve.ts';

const square = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon',
    coordinates: [[[-60, -60], [60, -60], [60, 60], [-60, 60], [-60, -60]]]}}]};
const range = (buffer?: number) => {
    const coords: number[] = [], ends: number[] = [];
    Object.values(sliceGeoJSON(prepareSource(square, buffer === undefined ? {} : {buffer}), 1, 0, 0))[0].features[0].geometry(4096, coords, ends);
    return [Math.min(...coords), Math.max(...coords)];
};

test('GeoJSON buffer: a tile keeps the features as far past its edges as the buffer says', () => {
    assert.equal(range(0)[1], 4096, 'buffer 0 cuts at the edge');
    assert.equal(range(64)[1], 4096 + 512, 'buffer 64 keeps 64 of 512 pixels');
    assert.equal(range()[1], 4096 + 128, 'the default is unchanged');
});

test('GeoJSON buffer: the style option reaches the source', async () => {
    const style = await resolveStyle({version: 8, sources: {g: {type: 'geojson', data: square, buffer: 0}}, layers: []} as any);
    assert.equal((style.sources.g as any).options?.buffer, 0);
});

test('GeoJSON buffer: the default of the entry applies only to a source without buffer (#1085)', async () => {
    const buffer = async (raw: object, entry?: number) => ((await resolveStyle({version: 8, sources: {g: {type: 'geojson', data: square, ...raw}}, layers: []} as any, undefined, undefined, undefined, undefined, entry)).sources.g as any).options?.buffer;
    assert.equal(await buffer({}), undefined, 'the main entry keeps the default of the tiles (16)');
    assert.equal(await buffer({}, 128), 128, 'the compat entry passes 128');
    assert.equal(await buffer({buffer: 0}, 128), 0, 'a buffer that is given is kept');
});
