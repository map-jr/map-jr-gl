import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cssFamilies, fontKey} from '../../src/resolve.ts';

test('a text-font stack becomes a CSS family list with generic keywords unquoted (#927)', () => {
    assert.equal(cssFamilies('system-ui Bold'), 'system-ui');
    assert.equal(fontKey(['system-ui Bold']), '700|system-ui|system-ui Bold');
    assert.equal(cssFamilies('Segoe UI Semibold,Roboto Medium,Helvetica Neue Medium'), '"Segoe UI", "Roboto", "Helvetica Neue"');
    assert.equal(cssFamilies('Open Sans Regular,Open Sans Bold,SANS-SERIF'), '"Open Sans", sans-serif');
    assert.equal(cssFamilies('Bold'), '');
    assert.equal(fontKey(['Noto Sans Italic', 'Arial Unicode MS Regular']), 'italic 400|Noto Sans|Noto Sans Italic,Arial Unicode MS Regular');
});

test('a text-font name with "|" keeps its family and the whole stack in the font key (#937)', async () => {
    const {splitFontKey} = await import('../../src/resolve.ts');
    const key = fontKey(['a|b Bold', 'Noto Sans']);
    assert.deepEqual(splitFontKey(key), ['700', 'ab', 'a|b Bold,Noto Sans']);
    assert.equal(cssFamilies(splitFontKey(key)[2]!), '"ab", "Noto Sans"');
    assert.deepEqual(splitFontKey('400|Noto Sans'), ['400', 'Noto Sans', undefined]);
});

test('a format section with the font "a|b Bold" keeps its font and its color (#937)', async () => {
    (globalThis as any).OffscreenCanvas ??= class { getContext() { return {}; } };
    const {compileExpr} = await import('../../src/expr.ts');
    const {GlyphAtlas} = await import('../../src/text.ts');
    const text = compileExpr(['format', 'x', {'text-font': ['literal', ['a|b Bold']], 'text-color': '#ff0000'}], {dd: false, zoom: false})({zoom: 0, f: null});
    const atlas = new GlyphAtlas('sans-serif') as any;
    atlas.markStyles(text);
    assert.equal(atlas.styles[0].font, '700|ab|ab Bold');
    assert.deepEqual(atlas.styles[0].color, [1, 0, 0, 1]);
});
