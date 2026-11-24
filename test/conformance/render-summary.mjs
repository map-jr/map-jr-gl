// The counts and the labels of a run of the render tests (render.mjs). This file has no browser in it, so that
// test/unit/render-summary.test.ts can test it.
import {readFileSync, readdirSync} from 'node:fs';

/** The statuses of a test, in the order in which they are printed. */
export const statuses = ['match', 'near', 'differ', 'error', 'skipped'];
/** The decisions that a file of render-expectations/ can have. */
export const decisions = ['wontfix', 'later'];

/**
 * The operations of a test (`metadata.test.operations` of its style) that the run cannot do. `pauseTiles` uses a
 * private member of MapLibre's map.
 */
export const operationsNotDone = ['pauseTiles'];

/**
 * Why the run skips a test, or null when the run draws it. The reason is the name of the first operation that the run
 * cannot do, `reportWidth` for a test that compares a part of the canvas only, or `@mapbox/mvt-fixtures` for a test
 * whose `setStyle` loads a style with tiles of that package, which MapLibre's harness serves on port 2901, when the run
 * could not download the package (#665).
 * @param meta `metadata.test` of the style of the test.
 * @param readAsset gives the text of a file of the assets of the tests (`styles/nepal.json`), or '' when there is none.
 * @param fixtures whether the run serves the tiles of @mapbox/mvt-fixtures.
 */
export function skipReason(meta = {}, readAsset = () => '', fixtures = false) {
    const ops = meta.operations ?? [], op = ops.find(o => operationsNotDone.includes(o[0]));
    if (op) return op[0];
    if (meta.reportWidth !== undefined || meta.reportHeight !== undefined) return 'reportWidth';
    // (The run gives the URL of an asset its own server in place of "local://", so the name is the path of the URL.)
    const asset = url => { try { return new URL(url.replace('local://', 'http://localhost/')).pathname.slice(1); } catch { return ''; } };
    return !fixtures && ops.some(o => o[0] === 'setStyle' && typeof o[1] === 'string' && readAsset(asset(o[1])).includes('localhost:2901')) ? '@mapbox/mvt-fixtures' : null;
}

/** The folder of the expectations: one file for each label (#1862). */
export const expectationsFolder = 'render-expectations/';

/**
 * Checks the files of the folder render-expectations/ and returns one entry for each, in the order in which they give
 * a label: by file name, and the files with `"fallback": true` after the others. It throws an error that names the
 * file when one is wrong, because a label that is misspelled would otherwise count nothing.
 * @param files one `{file, data}` for each file: its name and its parsed JSON.
 */
export function readExpectations(files) {
    if (!Array.isArray(files)) throw new Error(`[map-jr-gl] readExpectations() takes an array of {file, data}, one for each file of ${expectationsFolder}.`);
    const entries = [...files].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0).map(({file, data: e}) => {
        const where = `[map-jr-gl] test/conformance/${expectationsFolder}${file}${typeof e?.label === 'string' ? ` ("${e.label}")` : ''}:`;
        const text = key => typeof e?.[key] === 'string' && e[key] !== '';
        const tests = Array.isArray(e?.tests) && e.tests.length > 0 && e.tests.every(t => typeof t === 'string' && t !== '');
        if (tests === text('pattern')) throw new Error(`${where} give either "tests" (an array of test ids) or "pattern" (a regular expression for test ids).`);
        if (!decisions.includes(e.decision)) throw new Error(`${where} "decision" is ${JSON.stringify(e.decision)}. Write "wontfix" or "later".`);
        if (!text('label') || !text('reason')) throw new Error(`${where} "label" and "reason" are required.`);
        if (e.fallback !== undefined && typeof e.fallback !== 'boolean') throw new Error(`${where} "fallback" is true or left out.`);
        let pattern = null;
        if (text('pattern')) try { pattern = new RegExp(e.pattern); } catch (err) { throw new Error(`${where} "pattern" is not a regular expression (${err.message}).`); }
        return {...e, file, fallback: e.fallback === true, matches: id => pattern ? pattern.test(id) : e.tests.includes(id)};
    });
    const labels = new Map();
    for (const e of entries) {
        if (labels.has(e.label)) throw new Error(`[map-jr-gl] test/conformance/${expectationsFolder}${e.file}: the label "${e.label}" is also in ${labels.get(e.label)}. Give each label one file.`);
        labels.set(e.label, e.file);
    }
    return [...entries.filter(e => !e.fallback), ...entries.filter(e => e.fallback)];
}

/** Reads the folder of the expectations in `dir` (test/conformance/, a URL that ends with "/") and checks it. */
export function loadExpectations(dir) {
    const folder = new URL(expectationsFolder, dir);
    return readExpectations(readdirSync(folder).filter(f => f.endsWith('.json')).map(file => ({file, data: JSON.parse(readFileSync(new URL(file, folder), 'utf8'))})));
}

/**
 * Makes the totals of a run.
 * @param results one `{id, status}` for each test of the run. An id has `/` between its parts.
 * @param expectations the result of `readExpectations`. The first entry that fits a test gives the test its label. A test
 *   that two entries of the same kind (fallback or not) fit is in `overlaps`, because the order of the files would decide.
 * @param allIds the ids of all the tests, also of those that a filter left out. An entry that fits none of them
 *   is in `unused`.
 */
export function summarize(results, expectations = [], allIds = results.map(r => r.id)) {
    const zero = () => Object.fromEntries(statuses.map(s => [s, 0]));
    const by = zero(), labels = {}, stale = [], tests = {}, overlaps = [];
    const differ = Object.fromEntries(decisions.map(d => [d, 0]));
    for (const r of [...results].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
        by[r.status]++;
        tests[r.id] = r.status;
        const fit = expectations.filter(e => e.matches(r.id)), e = fit[0];
        if (!e) continue;
        if (fit.filter(f => f.fallback === e.fallback).length > 1) overlaps.push({id: r.id, labels: fit.filter(f => f.fallback === e.fallback).map(f => f.label)});
        (labels[e.label] ??= {decision: e.decision, tests: 0, ...zero()})[r.status]++;
        labels[e.label].tests++;
        if (r.status === 'differ') differ[e.decision]++;
        if (e.decision === 'wontfix' && r.status === 'match') stale.push({id: r.id, label: e.label});
    }
    const run = results.length - by.skipped;
    return {
        // "near" includes the tests that match: it is the count of tests where 5% of the pixels or less are different.
        totals: {match: by.match, near: by.match + by.near, differ: by.differ, differWontfix: differ.wontfix, differLater: differ.later, errored: by.error, skipped: by.skipped, run},
        tests, labels, stale, overlaps,
        unused: expectations.filter(e => !allIds.some(id => e.matches(id))).map(e => e.label),
    };
}

/** The totals that do not depend on the labels, which render.mjs writes to render-result.json (#1861). */
export const committedTotals = ({differWontfix, differLater, ...rest}) => rest;

/**
 * The summary of the tracked files: the status of each test (render-tests.json) with the labels of the expectations.
 * `pnpm status` and the unit tests compute the totals per decision this way, so that they are not committed and a
 * pull request that only adds a label changes no total (#1861).
 * @param dir the folder test/conformance/, as a URL that ends with "/".
 */
export function trackedSummary(dir) {
    const tests = JSON.parse(readFileSync(new URL('render-tests.json', dir), 'utf8'));
    const expectations = loadExpectations(dir);
    return summarize(Object.keys(tests).map(id => ({id, status: tests[id]})), expectations);
}

/**
 * The part of the tests that ran, as a percent with one decimal place ("61.2%"). One percent of the tests that run is about 17
 * tests, so a whole number hides a change of a few tests.
 */
export const percent = (n, run) => run ? (n / run * 100).toFixed(1) + '%' : '0.0%';

/** The lines that the run prints. The first line has the totals, and the workflow `CI` copies it into its summary. */
export function report({totals: t, labels, stale, overlaps = [], unused}) {
    const lines = [`MapLibre render tests: ${t.match} of ${t.run} match (${percent(t.match, t.run)}; 1% of pixels or less are different), ${t.near} match or are near (${percent(t.near, t.run)}; 5% or less), ${t.differ} differ (${t.differWontfix} of them wontfix, ${t.differLater} later), ${t.errored} errored; ${t.skipped} skipped (tests that the run cannot do)`];
    for (const d of decisions) {
        const of = Object.entries(labels).filter(([, l]) => l.decision === d);
        if (of.length) lines.push(`Labels with the decision ${d} (differ/tests): ` + of.map(([name, l]) => `${name} ${l.differ}/${l.tests}`).join(', '));
    }
    for (const s of stale) lines.push(`STALE: ${s.id} matches, but it has the wontfix label "${s.label}". Remove it from its file in test/conformance/${expectationsFolder}.`);
    for (const o of overlaps) lines.push(`OVERLAP: ${o.id} fits the labels ${o.labels.map(l => `"${l}"`).join(' and ')}. Narrow one, or give the wider one "fallback": true.`);
    for (const u of unused) lines.push(`UNUSED: the label "${u}" in test/conformance/${expectationsFolder} fits no test.`);
    return lines;
}

/** The lines for the tests whose status is not the status in the tracked file (render-tests.json). */
export function changes(before, tests) {
    return Object.keys(tests).filter(id => before[id] !== undefined && before[id] !== tests[id]).map(id => `CHANGED: ${id} was ${before[id]} and is ${tests[id]}`)
        .concat(Object.keys(tests).filter(id => before[id] === undefined).map(id => `NEW: ${id} is ${tests[id]}`));
}
