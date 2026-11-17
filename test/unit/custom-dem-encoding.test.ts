// `encoding: 'custom'` of a `raster-dem` source (#590): the factors of red, green and blue and the shift.
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';
import {decodeElevation, demUnpack, sampleElevation} from '../../src/query.ts';

const resolved = async (source: object) => (await resolveStyle({version: 8, sources: {dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png'], ...source}}, layers: []} as any)).sources.dem.encoding;
const warnings = async (run: () => Promise<unknown>) => {
    const seen: string[] = [], warn = console.warn;
    console.warn = (text: string) => { seen.push(text); };
    try { await run(); } finally { console.warn = warn; }
    return seen;
};

test('custom encoding: the source gives its factors and its shift, with the defaults 1, 1, 1 and 0', async () => {
    assert.deepEqual(await resolved({encoding: 'custom', redFactor: 2, greenFactor: 0.5, blueFactor: 0, baseShift: 100}), [2, 0.5, 0, 100]);
    assert.deepEqual(await resolved({encoding: 'custom', baseShift: -7}), [1, 1, 1, -7]);
    assert.equal(await resolved({encoding: 'terrarium', redFactor: 2}), 'terrarium');
    assert.equal(await resolved({}), 'mapbox');
});

test('custom encoding: a factor that is not a finite number gives one message and the mapbox encoding', async () => {
    for (const bad of [{redFactor: '2'}, {greenFactor: NaN}, {blueFactor: Infinity}, {baseShift: {}}]) {
        const source = {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png'], encoding: 'custom', ...bad};
        const style = {version: 8, sources: {dem: source}, layers: []} as any;
        let encoding: unknown;
        // (The style is resolved two times: the message comes one time for the source.)
        const seen = await warnings(async () => { encoding = (await resolveStyle(style)).sources.dem.encoding; await resolveStyle(style); });
        assert.equal(encoding, 'mapbox');
        assert.equal(seen.length, 1, JSON.stringify(seen));
        assert.match(seen[0], /^\[map-jr-gl\] The source "dem": .*"redFactor".*finite numbers.*"mapbox"/);
    }
    assert.deepEqual(await warnings(() => resolved({encoding: 'custom', redFactor: 3})), []);
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
