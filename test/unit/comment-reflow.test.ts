// The re-flow of comments by the docs formatter (website/build/format.mjs, #1281): a comment that spans several lines
// is re-flowed as one paragraph of words, with one comment marker on each output line.
import {test} from 'node:test';
import assert from 'node:assert/strict';

// The formatter needs the packages of website/ (prettier). Without them the tests are skipped, as docs-lint does (#1296).
// @ts-ignore: a JavaScript module of the site without types.
const format = await import('../../website/build/format.mjs').catch(() => undefined);
if (!format) console.log('comment-reflow: skipped, because website/ has no packages. Run pnpm install --dir website.');
const skip = format ? false : 'website/ has no packages: run pnpm install --dir website';
const {reflowComments, formatCode, isVerbatim, desktopWidth, phoneWidth} = format ?? {};

const words = (text: string) => text.replace(/\/\/|\/\*\*?|\*\/|<!--|-->|^\s*\*/gm, ' ').split(/\s+/).filter(Boolean);

test('a "//" comment of three lines is one paragraph at both widths', {skip}, () => {
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

test('a "/* */" block keeps one " * " per line and its paragraphs and lists apart', {skip}, () => {
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

test('an HTML comment of several lines is one paragraph between "<!--" and "-->"', {skip}, () => {
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

test('a comment of several lines that fits keeps its lines', {skip}, () => {
    const code = '// One line.\n// Another line.\nx();';
    assert.equal(reflowComments(code, 'js', phoneWidth), code);
});

test('the comments of a <script> in an html fence re-flow as JavaScript comments (#1271)', {skip}, () => {
    const code = [
        '<script src="https://unpkg.com/@map-jr/map-jr-gl/dist/map-jr-gl.js"></script>',
        '<script type="module">',
        '  // The map shows the terrain with a hillshade and contour lines at every zoom level of the map.',
        '  // It fades to the horizon.',
        '  /* A block comment that is longer than the phone width. */',
        '  createMap();',
        '</script>',
    ].join('\n');
    assert.equal(reflowComments(code, 'html', phoneWidth), [
        '<script src="https://unpkg.com/@map-jr/map-jr-gl/dist/map-jr-gl.js"></script>',
        '<script type="module">',
        '  // The map shows the terrain with a',
        '  // hillshade and contour lines at',
        '  // every zoom level of the map. It',
        '  // fades to the horizon.',
        '  /*',
        '   * A block comment that is longer',
        '   * than the phone width.',
        '   */',
        '  createMap();',
        '</script>',
    ].join('\n'));
    const desktop = reflowComments(code, 'html', desktopWidth).split('\n');
    assert.ok(desktop.slice(1).every(line => line.length <= desktopWidth), desktop.join('\n'));
});

test('an html fence re-flows "<!-- -->" with paragraphs kept apart (#1271)', {skip}, () => {
    const code = [
        '<!-- The map shows the terrain with a hillshade and contour lines at every zoom.',
        '',
        '     - a list item that is long enough to wrap at the phone width',
        '-->',
        '<div id="map"></div>',
    ].join('\n');
    assert.equal(reflowComments(code, 'html', phoneWidth), [
        '<!--',
        '  The map shows the terrain with a',
        '  hillshade and contour lines at every',
        '  zoom.',
        '',
        '  - a list item that is long enough to',
        '    wrap at the phone width',
        '-->',
        '<div id="map"></div>',
    ].join('\n'));
});

test('a text fence keeps its lines at both widths (#1271)', {skip}, async () => {
    const code = '[map-jr-gl] <map-jr>: the attribute hover-state="false" switches the option on all\nthe same.';
    for (const language of ['text', 'txt', 'console', 'output']) {
        assert.ok(isVerbatim(language), language);
        for (const width of [desktopWidth, phoneWidth]) {
            assert.equal(reflowComments(code, language, width), code);
            assert.equal(await formatCode(code, language, width) ?? code, code);
        }
    }
});
