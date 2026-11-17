// `encoding: 'custom'` of a `raster-dem` source (#590): the factors of red, green and blue and the shift.
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';
import {decodeElevation, demUnpack, sampleElevation} from '../../src/query.ts';

const resolved = async (source: object) => (await resolveStyle({version: 8, sources: {dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png'], ...source}}, layers: []} as any)).sources.dem.encoding;
test('custom encoding: the source gives its factors and its shift, with the defaults 1, 1, 1 and 0', async () => {
    assert.deepEqual(await resolved({encoding: 'custom', redFactor: 2, greenFactor: 0.5, blueFactor: 0, baseShift: 100}), [2, 0.5, 0, 100]);
    assert.deepEqual(await resolved({encoding: 'custom', baseShift: -7}), [1, 1, 1, -7]);
    assert.equal(await resolved({encoding: 'terrarium', redFactor: 2}), 'terrarium');
    assert.equal(await resolved({}), 'mapbox');
});

test('custom encoding: the page passes the values on as they are (the engine checks them, see test/interact.mjs)', async () => {
    assert.deepEqual(await resolved({encoding: 'custom', redFactor: '2', baseShift: 5}), ['2', 1, 1, 5]);
});

test('custom encoding: an elevation is red * redFactor + green * greenFactor + blue * blueFactor - baseShift', () => {
    assert.equal(decodeElevation([10, 20, 30, 255], 0, [2, 0.5, 0.1, 100]), 20 + 10 + 3 - 100);
    assert.equal(decodeElevation([10, 20, 30, 255], 0, [0, 0, 0, -500]), 500);
    // Between two pixels of 100 m and 300 m.
    assert.equal(sampleElevation([100, 0, 0, 255, 300 - 256, 1, 0, 255], 2, 1, 0.5, 0.5, [1, 256, 0, 0]), 200);
    assert.deepEqual(demUnpack([2, 0.5, 0.1, 100]), [2, 0.5, 0.1, 100]);
    assert.deepEqual(demUnpack('terrarium'), [256, 1, 1 / 256, 32768]);
    assert.deepEqual(demUnpack('mapbox'), [6553.6, 25.6, 0.1, 10000]);
});
