// The line shader takes the tile of a pixel from its place on the screen (#2443): `screenToTile` takes a pixel of the
// target back to the ground in the units of one tile, and `clipIn` gives the rectangle of each tile in those units, so
// that two neighbor tiles share the numbers of their edge exactly.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT, type TileID} from '../../src/geo.ts';
import {screenToTile, clipIn} from '../../src/gl.ts';

const tile = (z: number, x: number, y: number, w = 0): TileID => ({z, x, y, w, key: `${z}/${x}/${y}`});

test('screenToTile takes the pixel of a tile point on a pitched, turned map back to that point', () => {
    const tr = new Transform();
    tr.width = 600; tr.height = 400; tr.set([3, 2], 4, 30, 60);
    const id = tile(4, 8, 7), m = tr.tileMatrix4(id), target = [1200, 800], h = screenToTile(m, target);
    for (const [u, v] of [[0, 0], [EXTENT, 0], [4000, 6000], [-500, 9000]]) {
        // Tile point to clip space to the pixel of gl_FragCoord (y from the bottom).
        const c = [0, 1, 3].map(r => m[r] * u + m[4 + r] * v + m[12 + r]);
        const px = (c[0] / c[2] + 1) / 2 * target[0], py = (c[1] / c[2] + 1) / 2 * target[1];
        const g = [0, 1, 2].map(r => h[r] * px + h[3 + r] * py + h[6 + r]);
        assert.ok(Math.abs(g[0] / g[2] - u) < 0.5 && Math.abs(g[1] / g[2] - v) < 0.5, `${u},${v} came back as ${g[0] / g[2]},${g[1] / g[2]}`);
    }
});

test('clipIn gives neighbor tiles, a part of a parent tile and a copy of the world the same edges', () => {
    const ref = tile(4, 8, 7), full = [0, 0, EXTENT, EXTENT];
    assert.deepEqual(clipIn(ref, ref, full), full);
    assert.equal(clipIn(ref, tile(4, 9, 7), full)[0], clipIn(ref, ref, full)[2]);
    assert.equal(clipIn(ref, tile(4, 8, 8), full)[1], clipIn(ref, ref, full)[3]);
    // The right half of the tile 3/4/3 is where the tiles 4/9/6 and 4/9/7 are.
    assert.deepEqual(clipIn(ref, tile(3, 4, 3), [EXTENT / 2, EXTENT / 2, EXTENT, EXTENT]), clipIn(ref, tile(4, 9, 7), full));
    assert.deepEqual(clipIn(ref, tile(4, 0, 7, 1), full), clipIn(ref, tile(4, 16, 7), full));
});
