// The pages of /styles on the docs site (website/build/styles.ts), which the site writes from the text of
// map-jr/map-jr-styles, map-jr/maputnik and map-jr/maplibre-style-spec. The fixtures have the shape of those files.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {absoluteLinks, editingPage, headingOf, indexPage, sectionOf, specAdditions, specPage, stylePage, styleRows} from '../../website/build/styles.ts';

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

test('/styles links each style to its page and leaves out the release', () => {
    const page = indexPage(readme, styleRows(readme));
    assert.match(page, /\| \[Elevation\]\(\/styles\/elevation\) \| A terrain map\. \|/);
    assert.ok(page.indexOf('### From OpenFreeMap') > page.indexOf('[Elevation]'), 'the styles of OpenFreeMap come after the own styles');
    assert.match(page, /The styles of OpenFreeMap\. Their pages: \[Bright\]\(\/styles\/openfreemap-bright\), \[Dark\]\(\/styles\/openfreemap-dark\)\./);
    assert.doesNotMatch(page, /\| OpenFreeMap Bright \|/);
    assert.match(page, /blob\/main\/CHANGELOG\.md/);
    assert.doesNotMatch(page, /maintainers/);
    assert.match(page, /^editUrl: /m);
});

const stateRows = [['`color-scheme`', '`light`, `dark`', 'The branch.'], ['`relief`', '`true`, `false`', 'The hillshade.']];

test('a style page has its URLs, its global state, its sources and a map in light and dark', () => {
    const style = {state: {'color-scheme': {default: 'light'}}, sources: {
        openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
        terrarium: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], attribution: '© Mapterhorn'},
    }};
    const page = stylePage(styleRows(readme)[0]!, style, readme, stateRows);
    assert.match(page, /::style-preview\{style-url="https:\/\/styles\.map-jr\.org\/1\/elevation\.json"\}/);
    assert.match(page, /`https:\/\/styles\.map-jr\.org\/1\/maplibre\/elevation\.json` \(5\.16\.0 or later\)/);
    assert.match(page, /`color-scheme`/);
    assert.doesNotMatch(page, /`relief`/);
    assert.match(page, /\| `openmaptiles` \| vector \| `https:\/\/tiles\.openfreemap\.org\/planet` \| From its TileJSON \|/);
    assert.match(page, /© Mapterhorn/);
    assert.match(page, /The licence is MIT\./);
});

test('a style without color-scheme shows one map and says why', () => {
    const page = stylePage(styleRows(readme)[1]!, {sources: {}}, readme, stateRows);
    assert.match(page, /:single="true"/);
    assert.match(page, /The style reads no global state\./);
    assert.match(page, /The style of OpenFreeMap: `https:\/\/tiles\.openfreemap\.org\/styles\/bright`/);
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
