// The blocks that `pnpm status` (scripts/status.mjs) writes into the README, from the figures that it also writes to
// docs/status.json. A cell of these tables has a name, one number or a link, so that a reader can compare the numbers
// of a column (#1113). This file runs nothing, so that test/unit/status-tables.test.ts can test it.
import {share, table} from '../test/conformance/report.mjs';

const kb = bytes => bytes === null || bytes === undefined ? '' : (bytes / 1024).toFixed(1);

/** The measures of the speed tables: the field of a row and the sentence above its table. */
export const speedMeasures = [
    {key: 'load', title: 'Load to idle, in milliseconds. A ratio below 1 means that Map Jr. GL is faster.'},
    {key: 'moving', title: 'Frames per second while the map moves. A ratio above 1 means that Map Jr. GL is faster.'},
    {key: 'markers', title: 'Frames per second while a map with 10,000 markers moves. A ratio above 1 means that Map Jr. GL is faster.'},
];

/**
 * The status block of the README.
 * @param f the figures of docs/status.json: `maplibre` (the version), `unitTests` (`{pass, fail}`), `sizes` (rows of
 * `{file, bytes, maplibreBytes}`, where `maplibreBytes` is null when MapLibre GL JS has no such file) and
 * `compatibility` (rows of `{area, passing, total, details: {text, href}}`).
 */
export function statusBlock(f) {
    return ['<!-- status:start -->',
        `These figures are written by \`pnpm status\`. They compare this library with MapLibre GL JS ${f.maplibre}. The file [docs/status.json](docs/status.json) has the same figures.`, '',
        `Unit tests: ${f.unitTests.pass} pass and ${f.unitTests.fail} fail.`, '',
        'Sizes, in KB (gzip). The page script of MapLibre GL JS includes its CSS. The page script of this library is the file of the entry and the files that it imports when it loads.', '',
        ...table(['File', 'Map Jr. GL', 'MapLibre GL JS', 'Share'], f.sizes.map(s => [s.file, kb(s.bytes), kb(s.maplibreBytes), s.maplibreBytes ? share(s.bytes, s.maplibreBytes) : '']), [1, 2, 3]), '',
        'Compatibility with MapLibre GL JS, tested with the entry `@map-jr/map-jr-gl/maplibre-compat`:', '',
        ...table(['Area', 'Passing', 'Total', 'Share', 'Details'], f.compatibility.map(c => [c.area, c.passing, c.total, share(c.passing, c.total), `[${c.details.text}](${c.details.href})`]), [1, 2, 3]),
        '<!-- status:end -->'].join('\n');
}

/**
 * The size table of docs/guide/size-and-speed.md: the sizes of the status block, with no links, because the links of
 * the README do not lead anywhere from that page.
 * @param f the figures of docs/status.json, as for `statusBlock`.
 */
export function sizesBlock(f) {
    return ['<!-- sizes:start -->',
        `Sizes in KB, compressed with gzip, next to MapLibre GL JS ${f.maplibre}. The page script of MapLibre GL JS includes its CSS. The page script of Map Jr. GL is the file of the entry and the files that it imports when it loads.`, '',
        ...table(['File', 'Map Jr. GL', 'MapLibre GL JS', 'Share'], f.sizes.map(s => [s.file, kb(s.bytes), kb(s.maplibreBytes), s.maplibreBytes ? share(s.bytes, s.maplibreBytes) : '']), [1, 2, 3]),
        '<!-- sizes:end -->'].join('\n');
}

/**
 * The speed block of the README: one table for each measure, with one number in each cell.
 * @param speed `date`, `commit` and `rows`. A row has `system`, `browser` and, for each key of `speedMeasures`, the
 * pair `{maplibre, mapJr}` or null when the run has no result for it.
 * @param maplibre the version of MapLibre GL JS.
 * @param options `page: true` for docs/guide/size-and-speed.md, whose first sentence has no date and no commit.
 */
export function speedBlock(speed, maplibre, {page = false} = {}) {
    const number = (n, digits = 0) => typeof n === 'number' && isFinite(n) ? n.toFixed(digits) : '';
    // The page of the user docs has no date and no commit: they belong to the README and to the branch of results.
    return ['<!-- speed:start -->', page
        ? `The workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) runs the same page with both libraries after each change, next to MapLibre GL JS ${maplibre}. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.`
        : `Measured by the workflow [Browsers](https://github.com/map-jr/map-jr-gl/tree/bench-results) on ${speed.date.slice(0, 10)} (commit ${speed.commit.slice(0, 7)}), next to MapLibre GL JS ${maplibre}. Map Jr. GL uses the worker renderer where the browser has it. The ratio is the number of Map Jr. GL divided by the number of MapLibre GL JS.`,
        ...speedMeasures.flatMap(m => ['', m.title, '',
            ...table(['System, browser', 'MapLibre GL JS', 'Map Jr. GL', 'Ratio'], speed.rows.filter(r => r[m.key]).map(r => [`${r.system}, ${r.browser}`, number(r[m.key].maplibre), number(r[m.key].mapJr), number(r[m.key].mapJr / r[m.key].maplibre, 2)]), [1, 2, 3])]),
        '<!-- speed:end -->'].join('\n');
}
