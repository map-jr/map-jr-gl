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

test('50,000 replacements of images of mixed sizes do not report full while most of the texture is free (repack)', () => {
    let space = new AtlasSpace(2048);
    const live: [number, number, number, number][] = [];
    let seed = 1, repacks = 0;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 50000; i++) {
        if (live.length > 400) { const r = live.splice(Math.floor(rnd() * live.length), 1)[0]; space.give(r[0], r[1], r[2], r[3]); }
        const w = 8 + Math.floor(rnd() * 120), h = 8 + Math.floor(rnd() * 120);
        let at = space.take(w, h);
        if (!at) {
            repacks++; // (What the map does: place the live images again in an empty texture.)
            const fresh = new AtlasSpace(2048), all = fresh.repack([...live.map(r => [r[2], r[3]] as [number, number]), [w, h]]);
            assert.ok(all, `replacement ${i}: full with ${live.reduce((a, r) => a + (r[2] + 1) * (r[3] + 1), 0)} of ${2048 * 2048} pixels used`);
            live.forEach((r, j) => { r[0] = all[j][0]; r[1] = all[j][1]; });
            space = fresh; at = all[live.length];
        }
        live.push([at[0], at[1], w, h]);
    }
    // (Without a repack, the free list alone first reports full here while 55% of the texture is free.)
    assert.ok(repacks > 0, 'the churn never needed a repack');
});

test('a repack places images without overlap', () => {
    const sizes: [number, number][] = Array.from({length: 300}, (_, i) => [5 + (i * 7) % 60, 5 + (i * 11) % 50]);
    const at = new AtlasSpace(1024).repack(sizes)!;
    assert.ok(at);
    for (let i = 0; i < at.length; i++) for (let j = 0; j < i; j++) {
        const [a, b] = [at[i], at[j]], [aw, ah] = sizes[i], [bw, bh] = sizes[j];
        assert.ok(a[0] + aw + 1 <= b[0] || b[0] + bw + 1 <= a[0] || a[1] + ah + 1 <= b[1] || b[1] + bh + 1 <= a[1], 'overlap');
    }
});
