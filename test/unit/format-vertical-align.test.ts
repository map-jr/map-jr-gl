// The section option "vertical-align" of `format` places a section within the height of the largest text of its
// line, as in MapLibre GL JS (#1029).
import {test} from 'node:test';
import assert from 'node:assert/strict';

(globalThis as any).OffscreenCanvas ??= class { getContext() { return {}; } };
const {GlyphAtlas, EM} = await import('../../src/text.ts');
const {compileExpr} = await import('../../src/expr.ts');

// A shaper whose glyphs are boxes one EM wide, so that the test needs no font.
const shaper = () => {
    const atlas = new GlyphAtlas('sans-serif') as any;
    atlas.glyph = () => ({x: 0, y: 0, w: 10, h: 10, left: 0, top: 0, advance: EM});
    atlas.images = (name: string) => name === 'pin' ? {width: 12, height: 12, pixelRatio: 1} : undefined;
    return atlas;
};
const shape = (expr: unknown[]) => shaper().shape(String(compileExpr(expr, 0 as any)({} as any)), '400\u0000Noto Sans', 100, 0, 1.2, 24).lines[0].glyphs;

test('format: vertical-align moves a smaller section within the line of a larger one', () => {
    const g = shape(['format', 'A', {'font-scale': 2}, 'b', {}, 'c', {'vertical-align': 'center'}, 'd', {'vertical-align': 'top'}, 'e', {'vertical-align': 'bottom'}]);
    assert.equal(g[1].dy, undefined, 'without the option, a section sits on the baseline');
    assert.equal(g[2].dy, -EM / 2, 'center');
    assert.equal(g[3].dy, -EM, 'top');
    assert.equal(g[4].dy, 0, 'bottom');
});

test('format: vertical-align places an image in the line', () => {
    const g = shape(['format', 'A', {'font-scale': 2}, ['image', 'pin'], {'vertical-align': 'top'}, ['image', 'pin'], {'vertical-align': 'bottom'}]);
    const h = g[1].imageHeight;
    assert.equal(g[1].dy, -(2 * EM - h) / 2, 'top');
    assert.equal(g[2].dy, (2 * EM - h) / 2, 'bottom');
});

test('format: an image without vertical-align sits at the bottom of the line, as in MapLibre GL JS', () => {
    const g = shape(['format', 'A', {'font-scale': 2}, ['image', 'pin'], {}]);
    assert.equal(g[1].dy, (2 * EM - g[1].imageHeight) / 2, 'beside a larger text');
    const plain = shape(['format', 'A', {}, ['image', 'pin'], {}]);
    assert.equal(plain[1].dy, (EM - plain[1].imageHeight) / 2, 'in text with no other option');
});
