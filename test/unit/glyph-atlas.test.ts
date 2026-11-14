// The glyph atlas starts small and grows as glyphs arrive, instead of taking 4 MB when the map starts (#27).
import {test} from 'node:test';
import assert from 'node:assert/strict';

(globalThis as any).OffscreenCanvas ??= class { getContext() { return {}; } };
const {GlyphAtlas} = await import('../../src/text.ts');

test('the glyph atlas starts small and grows, keeping the pixels it has', () => {
    const atlas = new GlyphAtlas('sans-serif') as any;
    assert.ok(atlas.data.length <= 2048 * 256, `starts with ${atlas.data.length} bytes`);
    const cell = new Uint8Array(40 * 40).fill(7), first = {} as any;
    atlas.pack(first, cell, 40, 40);
    atlas.dirty = [atlas.height, 0];
    for (let i = 0; i < 1000; i++) atlas.pack({}, cell, 40, 40);
    assert.equal(atlas.resets, 0);
    assert.ok(atlas.height > 128 && atlas.height <= 2048);
    assert.equal(atlas.data.length, atlas.width * atlas.height);
    assert.equal(atlas.dirty, null, 'a grown atlas is sent again as a whole');
    assert.equal(atlas.data[first.y * atlas.width + first.x], 7);
});
