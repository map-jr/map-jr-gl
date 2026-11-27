// Unit test for #2315: the extra frame that runs no `render()` of images (#2279) is only extra while nothing else asks
// for a frame. A repaint that does not come from a command (a tile that arrives, an upload, a timer) after the extra frame
// was planned makes that frame a usual one, which calls `render()` of images, as MapLibre GL JS does in every frame.
// The test stubs `frame()` and records whether the frame would skip `render()`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

const engine = () => {
    const skips: boolean[] = [];
    const e = Object.assign(Object.create(Engine.prototype), {scheduled: false, skipPreFrame: false, frame(this: {skipPreFrame: boolean}) { skips.push(this.skipPreFrame); }});
    return {e, skips};
};
// (Without `requestAnimationFrame`, the engine plans a frame with a timer of 16 ms.)
const nextFrame = () => new Promise(r => setTimeout(r, 40));

test('extra frame: a frame that only the extra frame asked for skips render() of images', async () => {
    const {e, skips} = engine();
    e.extraFrame();
    await nextFrame();
    assert.deepEqual(skips, [true]);
});

test('extra frame: a repaint after the extra frame was planned makes the frame call render() of images', async () => {
    const {e, skips} = engine();
    e.extraFrame();
    e.repaint(); // (as when a tile arrives)
    await nextFrame();
    assert.deepEqual(skips, [false]);
});

test('extra frame: a frame that is already planned stays a usual frame', async () => {
    const {e, skips} = engine();
    e.repaint();
    e.extraFrame();
    await nextFrame();
    assert.deepEqual(skips, [false]);
});
