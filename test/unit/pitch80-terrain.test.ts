// With 3D terrain at pitch 80 (render test terrain/fog-sky-blend-globe, #1480): far ground that wants a level below a
// source's minzoom gets no tile of that source, and the fog starts at the camera's distance to sea level, as in
// MapLibre GL JS.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';

const camera = () => {
    const tr = new Transform();
    tr.width = tr.height = 256; tr.maxPitch = 90;
    tr.set([11.52517, 47.34487], 13, 0, 80);
    tr.heightAt = () => 3000; tr.elevation = 3000; tr.groundRange = [0, 6000];
    return tr;
};

test('a pitched tile cover with 3D terrain has no tile below the minzoom of the source', () => {
    const cover = camera().tileCover(9, 17);
    assert.ok(cover.length > 0);
    assert.deepEqual(cover.filter(t => t.z < 9).map(t => t.key), []);
});

test('the fog of 3D terrain starts at the distance of the camera to sea level', () => {
    const tr = camera(), [near, far] = tr.fogRange();
    assert.ok(Math.abs(near - (tr.cameraDistance + 3000 * tr.pixelsPerMetre / Math.cos(80 * Math.PI / 180))) < 1e-6);
    assert.ok(far > near);
});
