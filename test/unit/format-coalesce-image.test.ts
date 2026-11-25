// A `coalesce` of images inside a `format` section is an image, and the first image that the map has is drawn (#658).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileExpr, IMAGE_OPEN} from '../../src/expr.ts';
import {EstimateShaper} from '../../src/text.ts';

test('format: a coalesce of images is drawn as the first image that the map has', () => {
    const text = String(compileExpr(['format', 'Exit ', {}, ['coalesce', ['image', 'missing'], ['image', 'star']], {}], 0 as any)({} as any));
    assert.ok(text.includes(IMAGE_OPEN), 'the section is an image marker: ' + JSON.stringify(text));
    const shaper = new EstimateShaper();
    shaper.images = name => name === 'star' ? {width: 20, height: 10, pixelRatio: 1} : undefined;
    const shaped = shaper.shape(text, '400\u0000Noto Sans', 10, 0, 1.2, 16);
    assert.deepEqual(shaped.images, ['star']);
});
