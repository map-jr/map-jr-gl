// The place of an image that the map no longer has goes to later images of any size that fits (#27).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AtlasSpace} from '../../src/atlas-space.ts';

test('500 updates of an image of changing size do not fill the texture', () => {
    const space = new AtlasSpace(2048);
    let last: [number, number] | null = null, size = 0;
    for (let i = 0; i < 500; i++) {
        if (last) space.give(last[0], last[1], size, size);
        size = 64 + (i % 5) * 16;
        last = space.take(size, size);
        assert.ok(last, `update ${i} found no place`);
    }
});

test('freed places that touch become one place for a larger image', () => {
    const space = new AtlasSpace(2048);
    const a = space.take(10, 10)!, b = space.take(10, 10)!;
    space.give(a[0], a[1], 10, 10);
    space.give(b[0], b[1], 10, 10);
    assert.deepEqual(space.take(21, 10), a);
});

test('places do not overlap', () => {
    const space = new AtlasSpace(256), got: number[][] = [];
    for (let i = 0; i < 200; i++) {
        const w = 5 + (i * 7) % 23, h = 5 + (i * 11) % 19, at = space.take(w, h);
        if (!at) continue;
        for (const o of got) assert.ok(at[0] + w + 1 <= o[0] || o[0] + o[2] + 1 <= at[0] || at[1] + h + 1 <= o[1] || o[1] + o[3] + 1 <= at[1], 'overlap');
        got.push([at[0], at[1], w, h]);
        if (i % 3 === 0) { const r = got.splice((i * 13) % got.length, 1)[0]; space.give(r[0], r[1], r[2], r[3]); }
    }
});
