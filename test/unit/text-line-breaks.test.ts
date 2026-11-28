import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EstimateShaper} from '../../src/text.ts';

const lines = (text: string, maxWidthEm: number, images = false) => {
    const s = new EstimateShaper();
    if (images) s.images = () => ({width: 24, height: 24, pixelRatio: 1});
    return s.shape(text, '400|Open Sans', maxWidthEm, 0, 1.2, 24).lines.map(l => l.text);
};

test('a label breaks after a hyphen and after a slash, as in MapLibre (#2593, #1794)', () => {
    assert.deepEqual(lines('Aaaaaa-Bbbbbb-Cccccc-Dddddd', 5), ['Aaaaaa-', 'Bbbbbb-', 'Cccccc-', 'Dddddd']);
    assert.deepEqual(lines('Aaaaaa/Bbbbbb/Cccccc/Dddddd', 5), ['Aaaaaa/', 'Bbbbbb/', 'Cccccc/', 'Dddddd']);
});

test('a label breaks before an opening bracket that does not end it (#2593)', () => {
    assert.deepEqual(lines('Aaaaaaaaaaaa(Bbbbbbbbbbbb)', 5), ['Aaaaaaaaaaaa', '(Bbbbbbbbbbbb)']);
});

test('a label breaks after an image in the text (#2593, #1777)', () => {
    const img = 'pin';
    assert.ok(lines(img.repeat(8), 3, true).length > 1);
});

test('Thai text breaks between words, which it writes without spaces (#2593, #1796)', () => {
    const thai = 'ถนนสุขุมวิทกรุงเทพมหานครประเทศไทย';
    const out = lines(thai, 5);
    assert.ok(out.length > 1, JSON.stringify(out));
    assert.equal(out.join(''), thai);
});

test('a styled ")" in rich text keeps the penalty of a break before it (#2593)', () => {
    const plain = lines('Aaaaaaa Bbbbbbb ) Ccc', 4);
    const rich = lines('Aaaaaaa Bbbbbbb 1||||) Ccc', 4).map(l => l.replace(/[-]/g, ''));
    assert.deepEqual(plain, ['Aaaaaaa', 'Bbbbbbb )', 'Ccc']);
    assert.deepEqual(rich, plain);
});

test('an empty line of the text stays as a line, as in MapLibre (#2594, #1792)', () => {
    assert.deepEqual(lines('one\n\nthree', 50), ['one', '', 'three']);
});

test('control characters are not shaped (#2594, #1793)', () => {
    assert.deepEqual(lines('ab\x1Ccd', 50), ['abcd']);
    assert.deepEqual(lines('a\x00b\x7Fc\nd', 50), ['abc', 'd']);
});
