// The pages of /styles on the docs site (website/build/styles.ts), which the site writes from the text of
// map-jr/map-jr-styles, map-jr/maputnik and map-jr/maplibre-style-spec. The fixtures have the shape of those files.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {absoluteLinks, safeMarkdown, editingPage, headingOf, indexPage, attributionParts, sectionOf, specAdditions, specPage, styleChoice, styleRows} from '../../website/build/styles.ts';

const readme = `# map-jr-styles

Map styles for map-jr-gl.

## The styles

| Style | map-jr-gl | MapLibre GL JS 5.16+ | What it is |
|---|---|---|---|
| Elevation | [elevation.json](https://styles.map-jr.org/1/elevation.json) | [maplibre/elevation.json](https://styles.map-jr.org/1/maplibre/elevation.json) | A terrain map. |
| OpenFreeMap Bright | [openfreemap-bright.json](https://styles.map-jr.org/1/openfreemap-bright.json) | [OpenFreeMap's](https://tiles.openfreemap.org/styles/bright) | The styles of OpenFreeMap. |
| OpenFreeMap Dark | [openfreemap-dark.json](https://styles.map-jr.org/1/openfreemap-dark.json) | [OpenFreeMap's](https://tiles.openfreemap.org/styles/dark) | 〃 |

## Use

See [the changelog](CHANGELOG.md).

\`\`\`bash
## not a heading
\`\`\`

### From npm

pnpm add @map-jr/styles

## Release

For maintainers.

## Editing a style with Maputnik

Open it in Maputnik.

## Sources and licences

The licence is MIT.
`;

test('a section ends at the next heading of its level, and a fence does not end it', () => {
    const use = sectionOf(readme, '## Use');
    assert.match(use, /## not a heading/);
    assert.match(use, /### From npm/);
    assert.doesNotMatch(use, /maintainers/);
});

test('a relative link leads to the file on GitHub, and other links stay', () => {
    const source = {name: 'map-jr-styles', branch: 'main'};
    assert.equal(absoluteLinks('[a](CHANGELOG.md) [b](#use) [c](/styles) [d](https://x.org)', source),
        '[a](https://github.com/map-jr/map-jr-styles/blob/main/CHANGELOG.md) [b](#use) [c](/styles) [d](https://x.org)');
});

test('the rows of the table of the styles, with 〃 as the text of the row above', () => {
    const rows = styleRows(readme);
    assert.deepEqual(rows.map(row => row.name), ['elevation', 'openfreemap-bright', 'openfreemap-dark']);
    assert.equal(rows[2]!.text, 'The styles of OpenFreeMap.');
});

test('/styles has one map with the switch, links each style to its view on the map, and leaves out the release', () => {
    const page = indexPage(readme, styleRows(readme));
    assert.equal(page.match(/^::style-switch$/gm)?.length, 1);
    assert.match(page, /\| \[Elevation\]\(\/styles\?style=elevation\) \| A terrain map\. \|/);
    assert.ok(page.indexOf('### From OpenFreeMap') > page.indexOf('[Elevation]'), 'the styles of OpenFreeMap come after the own styles');
    assert.match(page, /\[Bright\]\(\/styles\?style=openfreemap-bright\), \[Dark\]\(\/styles\?style=openfreemap-dark\)\./);
    assert.doesNotMatch(page, /\]\(\/styles\/(?!editing|spec)/);
    assert.doesNotMatch(page, /\| OpenFreeMap Bright \|/);
    assert.match(page, /blob\/main\/CHANGELOG\.md/);
    assert.match(page, /The licence is MIT\./);
    assert.doesNotMatch(page, /maintainers/);
    assert.match(page, /^editUrl: /m);
});

const stateRows = [['`color-scheme`', '`light`, `dark`', 'The branch.'], ['`relief`', '`true`, `false`', 'The hillshade.']];

test('a style of the switch has its URLs, its text, its global state and its sources', () => {
    const [own, copy] = styleRows(readme);
    const choice = styleChoice(own!, {state: {'color-scheme': {default: 'light'}}, sources: {
        openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
        terrarium: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], attribution: '<a href="https://mapterhorn.com/attribution">&copy; Mapterhorn</a>'},
    }}, stateRows);
    assert.equal(choice.url, 'https://styles.map-jr.org/1/elevation.json');
    assert.deepEqual(choice.maplibre, {url: 'https://styles.map-jr.org/1/maplibre/elevation.json', own: true});
    assert.equal(choice.text, 'A terrain map.');
    assert.equal(choice.schemes, true);
    assert.deepEqual(choice.state, [{property: 'color-scheme', values: 'light, dark', effect: 'The branch.'}]);
    assert.deepEqual(choice.sources, [
        {id: 'openmaptiles', type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: 'tilejson'},
        {id: 'terrarium', type: 'raster-dem', url: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp', attribution: [{text: '© Mapterhorn', href: 'https://mapterhorn.com/attribution'}]},
    ]);
    const other = styleChoice(copy!, {}, stateRows);
    assert.deepEqual(other.maplibre, {url: 'https://tiles.openfreemap.org/styles/bright', own: false});
    assert.equal(other.schemes, false);
    assert.deepEqual(other.state, []);
});

test('an attribution keeps its https links and drops other HTML', () => {
    const parts = attributionParts('<a href="javascript:alert(1)">x</a> <img src=x onerror=alert(1)> <script>alert(1)</script> <a href="https://osm.org">OSM</a>');
    assert.ok(parts.every(part => !/[<>]/.test(part.text) && (!part.href || part.href.startsWith('https://'))), JSON.stringify(parts));
    assert.deepEqual(parts.at(-1), {text: 'OSM', href: 'https://osm.org'});
});

test('/styles/editing has the note of the fork of Maputnik without the quote marks', () => {
    const maputnik = '# Maputnik\n\n> **This is the Map Jr. GL fork of Maputnik.** It edits styles.\n>\n> - It renders with Map Jr. GL.\n\n[badge](x)\n';
    const page = editingPage(maputnik, readme);
    assert.match(page, /^\*\*This is the Map Jr\. GL fork of Maputnik\.\*\* It edits styles\.$/m);
    assert.match(page, /^- It renders with Map Jr\. GL\.$/m);
    assert.doesNotMatch(page, /badge/);
    assert.match(page, /Open it in Maputnik\./);
});

test('/styles/spec lists the docs of the reference that name Map Jr. GL', () => {
    const reference = {expression_name: {values: {image: {doc: 'Returns an image.', syntax: {parameters: [{name: 'a'}, {type: {params: {doc: 'Map Jr. GL fills the slots.'}}}]}}}}};
    const additions = specAdditions(reference);
    assert.equal(additions.length, 1);
    assert.equal(headingOf(additions[0]!.path), '`image` expression: `params`');
    assert.match(specPage(reference), /Map Jr\. GL fills the slots\./);
    assert.throws(() => specPage({}), /names Map Jr\. GL/);
});

test('an inline component, and HTML after a fence that holds the other marker, show as text (#1551)', () => {
    const inline = safeMarkdown('A :badge[x]{color=red} and :icon{name=x} here, and `:code[x]` stays.\n');
    assert.match(inline, /A \\:badge\[x\]\\\{color=red\} and \\:icon\\\{name=x\} here, and `:code\[x\]` stays\./);
    assert.match(safeMarkdown('See https://example.com.\n'), /https:\/\/example\.com/);
    for (const [open, inner] of [['~~~', '```'], ['```', '~~~'], ['````', '```']]) {
        const out = safeMarkdown(`${open}md\n${inner}\n<b>in code</b>\n${open}\n\nAfter <img src=x onerror=alert(1)> :badge[x]\n`);
        assert.match(out, /^<b>in code<\/b>$/m, open);
        assert.match(out, /^After &lt;img src=x onerror=alert\(1\)&gt; \\:badge\[x\]$/m, open);
    }
});

test('code spans, attributes, indented code, fences in quotes and lists, URLs and images (#1551)', () => {
    // Backtick runs of unequal length are no code span.
    assert.match(safeMarkdown('a `` b :x[y] ` c\n'), /b \\:x\[y\] ` c/);
    assert.match(safeMarkdown('```a :x[y]` <b>\n'), /\\:x\[y\]` &lt;b&gt;/);
    assert.match(safeMarkdown('a `` b ` c `` :x[y]\n'), /^a `` b ` c `` \\:x\[y\]$/m);
    // A code span over two lines of a paragraph, and an escaped backtick that opens none.
    assert.match(safeMarkdown('a `b\nc` :x[y] `d`\n'), /^c` \\:x\[y\] `d`$/m);
    assert.match(safeMarkdown('a \\` :x[y] `\n'), /\\:x\[y\]/);
    // Attributes of MDC after markup.
    assert.match(safeMarkdown('**x**{style="position:fixed;inset:0"}\n'), /^\*\*x\*\*\\\{style=/m);
    // Indented code stays as it is, and a list item continues.
    const indented = safeMarkdown('Text.\n\n    <b>code</b> :x[y]\n    more <i>\n\n- item\n\n    <b>in the item</b>\n');
    assert.match(indented, /^    <b>code<\/b> :x\[y\]$/m);
    assert.match(indented, /^    more <i>$/m);
    assert.match(indented, /^    &lt;b&gt;in the item/m);
    // Fences in a quote and in a list item.
    assert.match(safeMarkdown('> ```\n> <b>quoted code</b>\n> ```\n> after <b>\n'), /^> <b>quoted code<\/b>$[\s\S]*^> after &lt;b&gt;$/m);
    assert.match(safeMarkdown('- ```\n  <b>listed code</b>\n  ```\n- after <b>\n'), /^  <b>listed code<\/b>$[\s\S]*^- after &lt;b&gt;$/m);
    // Bare URLs and autolinks.
    assert.match(safeMarkdown('See https://example.com/a:b here.\n'), /See https:\/\/example\.com\/a:b here\./);
    assert.match(safeMarkdown('See <https://example.com/x>.\n'), /^See https:\/\/example\.com\/x\.$/m);
    // Images from other hosts become links.
    assert.match(safeMarkdown('![x](https://evil.example/x.png)\n'), /^\[x\]\(https:\/\/evil\.example\/x\.png\)$/m);
    assert.match(safeMarkdown('![x](https://raw.githubusercontent.com/map-jr/a/x.png)\n'), /^!\[x\]/m);
    assert.match(safeMarkdown('![x](docs/x.png)\n'), /^!\[x\]\(docs\/x\.png\)$/m);
    assert.match(safeMarkdown('![x][ref]\n\n[ref]: https://evil.example/x.png\n'), /^\\!\[x\]\[ref\]$/m);
});

test('raw HTML and component blocks of another repository show as text, and code stays', () => {
    const hostile = safeMarkdown('# x\n\nA <script>alert(1)</script> & <img src=x onerror=alert(1)>.\n::style-preview{style-url="https://evil.example"}\n::\n> a quote with <b>\n\n`<code>` and\n\n```html\n<div></div>\n```\n');
    assert.doesNotMatch(hostile.replace(/`[^`]*`|```[\s\S]*?```/g, ''), /<|^::/m);
    assert.match(hostile, /A &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &lt;img/);
    assert.match(hostile, /^\\:\\:style-preview/m);
    assert.match(hostile, /^> a quote with &lt;b&gt;$/m);
    assert.match(hostile, /`<code>`/);
    assert.match(hostile, /^<div><\/div>$/m);
    const page = indexPage(safeMarkdown(readme.replace('Map styles for map-jr-gl.', 'Map styles <iframe src="https://evil.example"></iframe>.')), styleRows(readme));
    assert.doesNotMatch(page, /<iframe/);
});
