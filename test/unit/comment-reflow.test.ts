// The re-flow of comments by the docs formatter (website/build/format.mjs, #1281): a comment that spans several lines
// is re-flowed as one paragraph of words, with one comment marker on each output line.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore: a JavaScript module of the site without types.
import {reflowComments, desktopWidth, phoneWidth} from '../../website/build/format.mjs';

const words = (text: string) => text.replace(/\/\/|\/\*\*?|\*\/|<!--|-->|^\s*\*/gm, ' ').split(/\s+/).filter(Boolean);

test('a "//" comment of three lines is one paragraph at both widths', () => {
    const code = [
        '// The terrain adds relief and shading: contour lines and a stronger hillshade make the slopes easier to read',
        '// at every zoom, and the sky fades to the',
        '// horizon.',
        'map.update(description);',
    ].join('\n');
    for (const width of [desktopWidth, phoneWidth]) {
        const out = reflowComments(code, 'js', width).split('\n');
        assert.equal(out.pop(), 'map.update(description);');
        assert.ok(out.every(line => line.startsWith('// ') && line.length <= width), out.join('\n'));
        assert.deepEqual(words(out.join('\n')), words(code.split('\n').slice(0, 3).join('\n')));
        // Every line but the last is filled: the next word would not fit on it.
        const next = words(out.join('\n'));
        let n = 0;
        for (const line of out.slice(0, -1)) { n += words(line).length; assert.ok(line.length + 1 + next[n].length > width, line); }
    }
});

test('a "/* */" block keeps one " * " per line and its paragraphs and lists apart', () => {
    const code = [
        '/**',
        ' * The terrain adds relief and shading: contour lines and a stronger hillshade make the slopes easier',
        ' * to read.',
        ' *',
        ' * - a list item that is long enough to wrap onto a second line at the phone width',
        ' * - second',
        ' */',
    ].join('\n');
    assert.equal(reflowComments(code, 'ts', phoneWidth), [
        '/**',
        ' * The terrain adds relief and',
        ' * shading: contour lines and a',
        ' * stronger hillshade make the slopes',
        ' * easier to read.',
        ' *',
        ' * - a list item that is long enough',
        ' *   to wrap onto a second line at the',
        ' *   phone width',
        ' * - second',
        ' */',
    ].join('\n'));
    assert.ok(reflowComments(code, 'ts', desktopWidth).split('\n').every(line => line.length <= desktopWidth));
});

test('an HTML comment of several lines is one paragraph between "<!--" and "-->"', () => {
    const code = [
        '<template>',
        '  <!-- The map shows the terrain with a hillshade',
        '       and contour lines at every zoom level of the map. -->',
        '  <div />',
        '</template>',
    ].join('\n');
    assert.equal(reflowComments(code, 'vue', phoneWidth), [
        '<template>',
        '  <!--',
        '    The map shows the terrain with a',
        '    hillshade and contour lines at',
        '    every zoom level of the map.',
        '  -->',
        '  <div />',
        '</template>',
    ].join('\n'));
});

test('a comment of several lines that fits keeps its lines', () => {
    const code = '// One line.\n// Another line.\nx();';
    assert.equal(reflowComments(code, 'js', phoneWidth), code);
});
