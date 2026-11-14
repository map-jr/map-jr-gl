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

// The first use of a font family can take half a second, so the fonts of the style are looked up before the first
// label placement needs them, one font in each task (#326).
test('warm() looks up each font of the style once, in later tasks, and not when the style has glyph files', async () => {
    const atlas = new GlyphAtlas('sans-serif') as any, measured: string[] = [];
    atlas.ctx = {font: '', measureText() { measured.push(this.font); return {width: 0}; }};
    atlas.warm(['Noto Sans Bold', ['Open Sans Italic', 'Arial Unicode MS Regular'], 'Noto Sans Bold']);
    assert.deepEqual(measured, [], 'nothing is looked up in the task that asks');
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(measured, ['700 24px "Noto Sans", sans-serif', 'italic 400 24px "Open Sans", sans-serif']);
    atlas.setGlyphs('https://example.com/{fontstack}/{range}.pbf');
    atlas.warm(['Roboto Regular']);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(measured.length, 2, 'glyph files of the style make the lookup unnecessary');
});
