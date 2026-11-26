// With 3D terrain, screenToGround finds where the view ray first meets the surface, also on a crest that is one grid
// cell of the elevation data wide (#1488). The walk went down in 96 steps of height and stepped over such a crest.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, mercY} from '../../src/geo.ts';

test('screenToGround finds a crest one grid cell wide that the view ray crosses', () => {
    const tr = new Transform();
    tr.width = tr.height = 512; tr.maxPitch = 85;
    tr.set([7.6586, 45.9763], 13, 0, 75);
    // A ridge across the view, 2,000 m high and one cell of a 512-pixel tile at zoom 12 wide, on flat ground.
    const cell = 1 / 2 ** 12 / 512, ridgeY = mercY(45.9763) - 40 * cell;
    tr.heightAt = (_mx, my) => Math.abs(my - ridgeY) <= cell / 2 ? 2000 : 0;
    tr.elevation = 0; tr.groundRange = [0, 2000];
    // The pixels whose rays pass over the ridge at heights from 100 to 1,100 m (the rays of higher crossings start above the horizon): the ridge hides the ground behind it.
    const misses: string[] = [];
    for (let h = 100; h <= 1100; h += 100) {
        let top = 0, bottom = tr.height;
        for (let i = 0; i < 40; i++) {
            const mid = (top + bottom) / 2, my = tr.screenToMerc(256, mid, h * tr.pixelsPerMetre, true)[1];
            if (my < ridgeY) top = mid; else bottom = mid;
        }
        const off = (tr.screenToGround(256, top)[1] - ridgeY) / cell;
        if (Math.abs(off) > 1) misses.push(`${h} m: ${off.toFixed(1)} cells`);
    }
    assert.deepEqual(misses, [], 'the ground under each pixel is the ridge');
});
