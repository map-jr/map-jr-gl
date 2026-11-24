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
    atlas.dirty = [];
    for (let i = 0; i < 1000; i++) atlas.pack({}, cell, 40, 40);
    assert.equal(atlas.resets, 0);
    assert.ok(atlas.height > 128 && atlas.height <= 2048);
    assert.equal(atlas.data.length, atlas.width * atlas.height);
    assert.equal(atlas.data[first.y * atlas.width + first.x], 7);
    // (The renderer copies its texture when the atlas grows, so only the new glyphs are sent: one part for each shelf.)
    assert.equal(new Set(atlas.dirty.map((r: number[]) => r[1])).size, atlas.dirty.length, 'one part for each shelf');
    assert.equal(atlas.dirty.reduce((n: number, [, , w]: number[]) => n + (w + 1) / 41, 0), 1000);
    assert.ok(atlas.dirty.every(([x, , w, h]: number[]) => x >= 1 && x + w <= atlas.width && h === 40));
});

// In Firefox, getImageData in a worker waits until the page thread is free (#1841): glyphs that the canvas draws wait
// on the canvas for the renderer, which computes their distance fields on the GPU, and nothing reads the canvas.
test('glyphs drawn with the canvas wait for the renderer, which takes them when the canvas is full', () => {
    const atlas = new GlyphAtlas('sans-serif') as any, drawn: number[][] = [], taken: number[] = [];
    const fake = (height: number) => ({canvas: {width: 2048, height}, font: '', textBaseline: '', fillStyle: '',
        measureText: () => ({width: 20, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 4}),
        fillText: (_t: string, x: number, y: number) => drawn.push([x, y]), clearRect() {},
        getImageData() { throw new Error('getImageData'); }});
    atlas.ctx = fake(128);
    atlas.newContext = fake;
    atlas.flush = () => { taken.push(atlas.drawn.length); atlas.drawnSent(); };
    const first = atlas.glyph('a', '400|x');
    assert.deepEqual(atlas.drawn, [[0, 0, first.x, first.y, 28, 32]], 'a place on the canvas and one in the atlas');
    assert.deepEqual(drawn[0], [4, 24], 'drawn with the border of SDF_BUFFER');
    for (let i = 0; i < 400; i++) atlas.glyph(String.fromCharCode(0x100 + i), '400|x');
    // 73 cells of 28 pixels fit in a row of 2048, and 4 rows of 32 in 128.
    assert.deepEqual(taken, [292]);
    assert.equal(atlas.drawn.length, 401 - 292);
    assert.deepEqual(atlas.dirty, [], 'no glyph of a file');
});

// The first use of a font family can take half a second, so the fonts of the style are looked up before the first
// label placement needs them, one font in each task (#326).
test('warm() looks up each font of the style once, in later tasks, and not when the style has glyph files', async () => {
    // The test waits for the lookups themselves, with a bound, and not for a fixed time: on a busy runner the timers
    // of warm() can fire late (#712).
    const atlas = new GlyphAtlas('sans-serif') as any, measured: string[] = [];
    let inTask = false, sameTask = 0;
    atlas.ctx = {font: '', measureText() {
        if (inTask) sameTask++;
        inTask = true; queueMicrotask(() => { inTask = false; });
        measured.push(this.font); return {width: 0};
    }};
    const turn = () => new Promise(r => setTimeout(r, 1));
    const until = async (done: () => boolean) => { for (const end = Date.now() + 5000; !done() && Date.now() < end;) await turn(); };
    atlas.warm(['Noto Sans Bold', ['Open Sans Italic', 'Arial Unicode MS Regular'], 'Noto Sans Bold']);
    assert.deepEqual(measured, [], 'nothing is looked up in the task that asks');
    await until(() => measured.length >= 2);
    for (let i = 0; i < 5; i++) await turn();
    assert.deepEqual(measured, ['700 24px "Noto Sans", sans-serif', 'italic 400 24px "Open Sans", "Arial Unicode MS", sans-serif']);
    assert.equal(sameTask, 0, 'each font is looked up in a task of its own');
    atlas.setGlyphs('https://example.com/{fontstack}/{range}.pbf');
    atlas.fetchGlyphs = () => new Promise(() => {});
    atlas.warm(['Roboto Regular']);
    for (let i = 0; i < 5; i++) await turn();
    assert.equal(measured.length, 2, 'glyph files of the style make the lookup unnecessary');
});

// With glyph files, the file of the first 256 characters of each font stack is requested when the map starts, at the
// same time as the tiles, instead of after the first label placement, which waits for the tiles (#371).
test('warm() requests the first glyph file of each font stack once, when the style has glyph files', async () => {
    const atlas = new GlyphAtlas('sans-serif') as any, urls: string[] = [];
    atlas.setGlyphs('https://example.com/{fontstack}/{range}.pbf');
    atlas.fetchGlyphs = (url: string) => { urls.push(url); return Promise.resolve(new Response(null, {status: 404})); };
    atlas.warm([['Noto Sans Bold', 'Arial Unicode MS Bold'], 'Noto Sans Regular', 'Noto Sans Regular']);
    assert.deepEqual(urls, ['https://example.com/Noto%20Sans%20Bold%2CArial%20Unicode%20MS%20Bold/0-255.pbf', 'https://example.com/Noto%20Sans%20Regular/0-255.pbf']);
    assert.equal(atlas.loading, 2, 'the map is not idle while they are on their way');
    await new Promise(r => setTimeout(r, 0));
    assert.equal(atlas.loading, 0, 'a file that fails counts as arrived');
    atlas.warm(['Noto Sans Regular']);
    assert.equal(urls.length, 2, 'a file is requested once');
});
