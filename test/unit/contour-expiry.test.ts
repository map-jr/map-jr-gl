// A contour tile expires with its elevation tiles, and an expired elevation tile is fetched again (#2053).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TileBuilder} from '../../src/tiles.ts';

// A slope in the mapbox encoding (height = -10000 + v / 10), so that the tile has contour lines.
const P = 64, pixels = new Uint8Array(P * P * 4);
for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    const v = (100 + x * 10 + y * 5) * 10 + 100000;
    pixels.set([(v >> 16) & 255, (v >> 8) & 255, v & 255, 255], (y * P + x) * 4);
}
const cfg = {tiles: ['https://example.com/{z}/{x}/{y}.png'], encoding: 'mapbox' as const, demMaxzoom: 12, demMinzoom: 0,
    thresholds: {0: [50, 250]}, multiplier: 1, overzoom: 0, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level'};

test('a contour tile carries the expiry of its elevation tiles, and an expired elevation tile is fetched again', async () => {
    let calls = 0;
    const b = new TileBuilder((async () => (calls++, new Response(new Uint8Array([1]), {headers: {'cache-control': 'max-age=2'}}))) as unknown as typeof fetch);
    b.decodeImage = () => ({width: P, height: P, data: pixels});
    b.setContours({hills: cfg});
    const req = {id: 1, source: 'hills', url: 'contour://hills/12/100/100', z: 12, overscaled: false as const};
    const before = Date.now(), a = await b.loadIR(req);
    assert.ok(a.expires && a.expires >= before + 2000 && a.expires <= Date.now() + 2000, `expires: ${a.expires}`);
    const first = calls;
    assert.ok(first > 0);
    await b.loadIR(req);
    assert.equal(calls, first, 'a fresh elevation tile is taken from the cache');
    const now = Date.now;
    Date.now = () => now() + 3000;
    try {
        const c = await b.loadIR(req);
        assert.equal(calls, 2 * first, 'the expired elevation tiles are fetched again');
        assert.ok(c.expires! > a.expires!);
    } finally { Date.now = now; }
});
