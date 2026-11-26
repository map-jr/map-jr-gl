// The work of one contour tile is bounded (#2047). Terrarium elevation tiles read as mapbox gave a tile tens of millions
// of crossings of levels and cells, and renderToSVG ran out of the 4 GB heap of Node. Such a tile now has no lines and
// warns one time for its source; a usual tile is drawn as before.
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contourTile} from '../../src/contour.ts';
import {decodeElevation, type DemEncoding} from '../../src/query.ts';

// Terrarium pixels of mountains from 500 to 3500 m.
const P = 512, pixels = new Uint8Array(P * P * 4);
for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    const v = 2000 + 1500 * Math.sin(x / 40) * Math.cos(y / 55) + 32768;
    pixels.set([Math.floor(v / 256), Math.floor(v) % 256, Math.floor((v % 1) * 256), 255], (y * P + x) * 4);
}
const dem = (encoding: DemEncoding) => {
    const data = new Float32Array(P * P);
    for (let i = 0; i < data.length; i++) data[i] = decodeElevation(pixels, i * 4, encoding);
    return {width: P, height: P, data};
};
const config = (encoding: DemEncoding, interval: number) => ({tiles: ['https://example.com/{z}/{x}/{y}.png'], encoding, demMaxzoom: 12, demMinzoom: 0,
    thresholds: {0: [interval, interval * 5]}, multiplier: 1, overzoom: 1, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level'});

/** Collects the warnings of the rest of the test. */
const warnings = (t: {after(fn: () => void): void}): string[] => {
    const list: string[] = [], warn = console.warn;
    console.warn = (m: unknown) => { list.push(String(m)); };
    t.after(() => { console.warn = warn; });
    return list;
};

test('contours: a terrarium tile read as mapbox gives no lines, one warning, and little memory', async t => {
    const warned = warnings(t), wrong = dem('mapbox'), cfg = config('mapbox', 10);
    const before = process.memoryUsage().heapUsed;
    const a = await contourTile(cfg, 12, 100, 100, async () => wrong, 'hills');
    const b = await contourTile(cfg, 12, 101, 100, async () => wrong, 'hills');
    const grown = process.memoryUsage().heapUsed - before;
    assert.deepEqual([a, b], [{}, {}]);
    assert.equal(warned.length, 1, warned.join('\n'));
    assert.match(warned[0]!, /^\[map-jr-gl\] E12047 The contour source "hills" has a tile whose lines cross .* more than 1000000 times.*"encoding"/);
    // (Without the bound, the lines of the two tiles took several hundred MB.)
    assert.ok(grown < 100e6, `the heap grew by ${Math.round(grown / 1e6)} MB`);
});

test('contours: the same tile read as terrarium has its lines', async () => {
    const right = dem('terrarium');
    const tile = await contourTile(config('terrarium', 20), 12, 100, 100, async () => right, 'hills');
    assert.ok(tile.contours!.features.length > 100);
});

test('contours: an interval that is not greater than 0 draws no lines and warns', async t => {
    const warned = warnings(t), right = dem('terrarium');
    assert.deepEqual(await contourTile(config('terrarium', -10), 12, 100, 100, async () => right, 'steps'), {});
    assert.match(warned.join('\n'), /^\[map-jr-gl\] E2047 The contour source "steps" has the interval -10 in "thresholds".*greater than 0/);
});
