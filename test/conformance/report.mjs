// The Markdown that the conformance tools write into docs/ecosystem.md and docs/reference/maplibre-differences.md, and the
// tables of scripts/status-tables.mjs. A cell of a table has a name, a number or one word of result. A sentence about
// a row goes into a list after the table (#1113). This file has no browser in it, so that
// test/unit/status-tables.test.ts can test it.

/** The text of a cell: a `|` and a line break would end the cell. */
export const cell = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');

/**
 * The lines of a Markdown table.
 * @param head the names of the columns.
 * @param rows the cells of each row.
 * @param right the indexes of the columns with numbers, which are aligned to the right.
 */
export const table = (head, rows, right = []) => [
    `| ${head.join(' | ')} |`,
    `|${head.map((_, i) => right.includes(i) ? '---:' : '---').join('|')}|`,
    ...rows.map(r => `| ${r.join(' | ')} |`),
];

/** The share of `part` in `whole` as a percentage with one decimal place, or '' when there is no whole. */
export const share = (part, whole) => whole ? (100 * part / whole).toFixed(1) + '%' : '';

const code = names => names.map(n => '`' + n + '`').join(', ');

/** Notes after the name of a method in the list "Available" of the block of api.mjs. */
const apiNotes = {setTransformCameraUpdate: "(with `renderer: 'main'`)"};

/** The block of api.mjs in docs/reference/maplibre-differences.md. Each argument is a sorted list of names of methods. */
export function apiBlock({have, accepted, extra, missing, notCounted}) {
    // A method that is available with one renderer only gets its note after its name.
    const noted = names => names.map(n => '`' + n + '`' + (apiNotes[n] ? ' ' + apiNotes[n] : '')).join(', ');
    const total = have.length + accepted.length + missing.length;
    return ['<!-- api:start -->',
        `The table counts the ${total} public methods of the MapLibre \`Map\` class in the entry \`@map-jr/map-jr-gl/maplibre-compat\`. The lists below it have the names.`, '',
        ...table(['Methods of `Map`', 'Number', 'Share'], [
            ['Available', have.length, share(have.length, total)],
            ['Accepted, with no effect', accepted.length, share(accepted.length, total)],
            ['Not available', missing.length, share(missing.length, total)],
            ['Only in this library', extra.length, ''],
            ['Internal to MapLibre GL JS, not counted', notCounted.length, ''],
        ], [1, 2]), '',
        `- **Available:** ${noted(have)}`,
        `- **Accepted, with no effect** (a value that the library cannot do gives one warning): ${code(accepted)}`,
        `- **Only in this library:** ${code(extra)}`,
        `- **Not available:** ${missing.length ? code(missing) : 'none'}`,
        `- **Internal to MapLibre GL JS, not counted** (the declaration tags the method \`@internal\`, or only the class \`Camera\` has it, which the package does not export): ${code(notCounted)}`,
        '<!-- api:end -->'].join('\n');
}

/**
 * The block of plugins.mjs in docs/ecosystem.md.
 * @param results one entry for each scenario: `version` (the packages with their versions), `ok`, `detail` (what the
 * scenario found) and `errors`.
 */
export function pluginsBlock(results) {
    return ['<!-- plugins:start -->', '## Plugins that were run', '',
        'These plugins were run with this library in a browser by `node test/conformance/plugins.mjs --write`. Each one has a',
        'short scenario in `test/conformance/plugins/`. The plugin imports `maplibre-gl` and gets this library.', '',
        `**${results.filter(r => r.ok).length} of ${results.length} scenarios pass.**`, '',
        ...table(['Scenario', 'Plugin', 'Result'], results.map((r, i) => [i + 1, cell(r.version), r.ok ? 'Pass' : 'Fail']), [0]), '',
        'What each scenario found:', '',
        ...results.map((r, i) => `${i + 1}. ${cell(r.detail)}${r.errors?.length ? ' Errors: ' + cell(r.errors.join('; ')) : ''}`),
        '<!-- plugins:end -->'].join('\n');
}

/**
 * The block of maputnik.mjs in docs/ecosystem.md.
 * @param r `repo` (the URL of the fork), `maputnikVersion`, `head` (its commit), `maplibreVersion`, `suite` (the
 * counts `ours` and `ml` of Maputnik's own tests as `{passed, total}`, or null when they did not run), `onlyOurs`
 * (the tests that fail only with this library, as `{title, error}`) and `scenarios` (`{title, ours, ml, issue}`,
 * where `ours` and `ml` are `{ok, detail}`).
 */
export function maputnikBlock(r) {
    const result = (s, issue) => s.ok ? 'Pass' : 'Fail' + (issue ? ` (${issue})` : '');
    return ['<!-- maputnik:start -->', '## Maputnik, the style editor', '',
        '`node test/conformance/maputnik.mjs --write` runs Maputnik in a browser two times: with MapLibre GL JS, and with the',
        'entry `@map-jr/map-jr-gl/maplibre-compat` of this library in its place. It uses the fork',
        `[map-jr/maputnik](${r.repo}), whose preview renders with this library; the fork also accepts \`params\` of the`,
        '`image` expression. Each build runs the end-to-end tests of Maputnik and the scenarios below, which test what those',
        'tests do not.', '',
        `The run used Maputnik ${r.maputnikVersion} (${r.head}) and MapLibre GL JS ${r.maplibreVersion}.`, '',
        ...(r.suite ? [...table(['Tests', 'Passing', 'Total', 'Share'], [
            ['Maputnik\'s own tests, with this library', r.suite.ours.passed, r.suite.ours.total, share(r.suite.ours.passed, r.suite.ours.total)],
            ['Maputnik\'s own tests, with MapLibre GL JS', r.suite.ml.passed, r.suite.ml.total, share(r.suite.ml.passed, r.suite.ml.total)],
        ], [1, 2, 3]), ''] : []),
        ...(r.onlyOurs.length ? ['The tests that fail only with this library:', '', ...r.onlyOurs.map(t => `- ${cell(t.title)}: ${cell(t.error)}`), ''] : []),
        ...table(['Scenario', 'This library', 'MapLibre GL JS'], r.scenarios.map(s => [s.title, result(s.ours, s.issue), result(s.ml)])), '',
        'What each scenario found:', '',
        ...r.scenarios.map(s => `- ${s.title}. ${s.ours.detail === s.ml.detail ? `Both libraries: ${cell(s.ours.detail)}` : `This library: ${cell(s.ours.detail)}. MapLibre GL JS: ${cell(s.ml.detail)}`}.`),
        '<!-- maputnik:end -->'].join('\n');
}

/**
 * The block of examples.mjs in docs/ecosystem.md.
 * @param rows one entry for each example page: `name`, `state` ('works', 'error', 'differs', 'no image' or
 * 'not run'), `diff` (the percentage of pixels that differ) and `newErrors` (the errors that only this library gives).
 * @param limit the percentage of pixels that can differ on a page that works.
 */
export function examplesBlock(rows, limit) {
    const count = s => rows.filter(r => r.state === s).length, total = rows.length;
    const text = s => cell(s).replace(/https?:\/\/localhost:\d+\/\S*/g, '').slice(0, 160);
    const other = rows.filter(r => r.state !== 'works'), errors = other.filter(r => r.newErrors?.[0]);
    return ['<!-- examples:start -->', '## The example pages of MapLibre GL JS', '',
        'The documentation of MapLibre GL JS has an example page for each common task. `node test/conformance/examples.mjs --write`',
        'runs each page two times: with MapLibre GL JS, and with this library in its place (the page itself is not changed).',
        `A page works when this library gives no error that MapLibre GL JS does not give, and at most ${limit} percent of the`,
        'pixels of the two images differ clearly (labels and controls are drawn in different ways).', '',
        `**${count('works')} of ${total} pages work.**`, '',
        ...table(['Result', 'Pages', 'Share'], [
            ['Works', count('works'), share(count('works'), total)],
            ['Gives an error', count('error'), share(count('error'), total)],
            ['Draws a different image', count('differs'), share(count('differs'), total)],
            ['Not compared', count('no image') + count('not run'), share(count('no image') + count('not run'), total)],
        ], [1, 2]), '',
        'The pages that do not work:', '',
        ...table(['Example page', 'Result', 'Pixels that differ, %'], other.map(r => [r.name, r.state, r.diff ?? '']), [2]),
        ...(errors.length ? ['', 'The first error that this library gives on each of these pages:', '', ...errors.map(r => `- ${r.name}: ${text(r.newErrors[0])}`)] : []),
        '<!-- examples:end -->'].join('\n');
}
