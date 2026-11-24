// The counts and the labels of a run of the render tests (render.mjs). This file has no browser in it, so that
// test/unit/render-summary.test.ts can test it.

/** The statuses of a test, in the order in which they are printed. */
export const statuses = ['match', 'near', 'differ', 'error', 'skipped'];
/** The decisions that an entry of render-expectations.json can have. */
export const decisions = ['wontfix', 'later'];

/**
 * The operations of a test (`metadata.test.operations` of its style) that the run cannot do. A custom layer and the
 * canvas of a canvas source are code of MapLibre's harness, and `pauseTiles` uses a private member of MapLibre's map.
 */
export const operationsNotDone = ['addCustomLayer', 'pauseTiles'];

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

/**
 * Checks the entries of render-expectations.json and returns them. It throws an error that names the entry when
 * one is wrong, because a label that is misspelled would otherwise count nothing.
 */
export function readExpectations(json) {
    const list = json?.expectations;
    if (!Array.isArray(list)) throw new Error('[map-jr-gl] render-expectations.json has no "expectations" array.');
    return list.map((e, i) => {
        const where = `[map-jr-gl] render-expectations.json, entry ${i + 1}${typeof e?.label === 'string' ? ` ("${e.label}")` : ''}:`;
        const text = key => typeof e?.[key] === 'string' && e[key] !== '';
        if (text('test') === text('pattern')) throw new Error(`${where} give either "test" (the id of one test) or "pattern" (a regular expression for test ids).`);
        if (!decisions.includes(e.decision)) throw new Error(`${where} "decision" is ${JSON.stringify(e.decision)}. Write "wontfix" or "later".`);
        if (!text('label') || !text('reason')) throw new Error(`${where} "label" and "reason" are required.`);
        let pattern = null;
        if (text('pattern')) try { pattern = new RegExp(e.pattern); } catch (err) { throw new Error(`${where} "pattern" is not a regular expression (${err.message}).`); }
        return {...e, matches: id => pattern ? pattern.test(id) : id === e.test};
    });
}

/**
 * Makes the totals of a run.
 * @param results one `{id, status}` for each test of the run. An id has `/` between its parts.
 * @param expectations the result of `readExpectations`. The first entry that fits a test gives the test its label.
 * @param allIds the ids of all the tests, also of those that a filter left out. An entry that fits none of them
 *   is in `unused`.
 */
export function summarize(results, expectations = [], allIds = results.map(r => r.id)) {
    const zero = () => Object.fromEntries(statuses.map(s => [s, 0]));
    const by = zero(), labels = {}, stale = [], tests = {};
    const differ = Object.fromEntries(decisions.map(d => [d, 0]));
    for (const r of [...results].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
        by[r.status]++;
        tests[r.id] = r.status;
        const e = expectations.find(e => e.matches(r.id));
        if (!e) continue;
        (labels[e.label] ??= {decision: e.decision, tests: 0, ...zero()})[r.status]++;
        labels[e.label].tests++;
        if (r.status === 'differ') differ[e.decision]++;
        if (e.decision === 'wontfix' && r.status === 'match') stale.push({id: r.id, label: e.label});
    }
    const run = results.length - by.skipped;
    return {
        // "near" includes the tests that match: it is the count of tests where 5% of the pixels or less are different.
        totals: {match: by.match, near: by.match + by.near, differ: by.differ, differWontfix: differ.wontfix, differLater: differ.later, errored: by.error, skipped: by.skipped, run},
        tests, labels, stale,
        unused: expectations.filter(e => !allIds.some(id => e.matches(id))).map(e => e.label),
    };
}

/**
 * The part of the tests that ran, as a percent with one decimal place ("61.2%"). One percent of the tests that run is about 17
 * tests, so a whole number hides a change of a few tests.
 */
export const percent = (n, run) => run ? (n / run * 100).toFixed(1) + '%' : '0.0%';

/** The lines that the run prints. The first line has the totals, and the workflow `CI` copies it into its summary. */
export function report({totals: t, labels, stale, unused}) {
    const lines = [`MapLibre render tests: ${t.match} of ${t.run} match (${percent(t.match, t.run)}; 1% of pixels or less are different), ${t.near} match or are near (${percent(t.near, t.run)}; 5% or less), ${t.differ} differ (${t.differWontfix} of them wontfix, ${t.differLater} later), ${t.errored} errored; ${t.skipped} skipped (tests that the run cannot do)`];
    for (const d of decisions) {
        const of = Object.entries(labels).filter(([, l]) => l.decision === d);
        if (of.length) lines.push(`Labels with the decision ${d} (differ/tests): ` + of.map(([name, l]) => `${name} ${l.differ}/${l.tests}`).join(', '));
    }
    for (const s of stale) lines.push(`STALE: ${s.id} matches, but it has the wontfix label "${s.label}". Remove it from test/conformance/render-expectations.json.`);
    for (const u of unused) lines.push(`UNUSED: the label "${u}" in test/conformance/render-expectations.json fits no test.`);
    return lines;
}

/** The lines for the tests whose status is not the status in the tracked file (render-tests.json). */
export function changes(before, tests) {
    return Object.keys(tests).filter(id => before[id] !== undefined && before[id] !== tests[id]).map(id => `CHANGED: ${id} was ${before[id]} and is ${tests[id]}`)
        .concat(Object.keys(tests).filter(id => before[id] === undefined).map(id => `NEW: ${id} is ${tests[id]}`));
}
