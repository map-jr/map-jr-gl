// The far plane of the tiles reaches at least as far as MapLibre GL JS's far plane (#2211). MapLibre GL JS works it out
// for a plane 100 m below the camera, so at pitch 85 near the ground the tiles of this library stopped about 3 pixels
// below the line where MapLibre's ground ends.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';

test('depthRange() reaches as far as farZ() at a high pitch', () => {
    for (const [w, h] of [[800, 600], [512, 512], [400, 800]]) for (const pitch of [0, 60, 80, 85]) for (const elevation of [0, 2000]) {
        const tr = new Transform();
        tr.width = w; tr.height = h; tr.zoom = 16; tr.pitch = pitch; tr.lat = 40; tr.lng = 5; tr.elevation = elevation;
        const far = tr.depthRange()[1], ml = tr.farZ();
        assert.ok(far >= ml, `${w}x${h}, pitch ${pitch}, elevation ${elevation}: far plane ${far.toFixed(0)} is short of MapLibre's ${ml.toFixed(0)}`);
    }
});
