// The tables that `pnpm status` and the conformance tools write (#1113): a cell has a name, one number, one word of
// result or a link, and a sentence about a row is outside the table.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error (a plain module of the scripts, without types)
import {statusBlock, speedBlock} from '../../scripts/status-tables.mjs';
// @ts-expect-error (a plain module of the conformance tools, without types)
import {apiBlock, pluginsBlock, maputnikBlock, examplesBlock} from '../../test/conformance/report.mjs';

const root = new URL('../../', import.meta.url);
/** The rows of the tables of a text, each as its cells, without the two lines of each heading. */
function cellsOf(text: string): string[][] {
    const rows: string[][] = [];
    let line = 0;
    for (const l of text.split('\n')) {
        line = l.startsWith('|') ? line + 1 : 0;
        if (line > 2) rows.push(l.slice(2, -2).split(/(?<!\\) \| /));
    }
    return rows;
}
const between = (text: string, name: string) => new RegExp(`<!-- ${name}:start -->[\\s\\S]*<!-- ${name}:end -->`).exec(text)?.[0] ?? '';
const isNumber = (s: string) => /^\d+(\.\d+)?$/.test(s);
/** No cell is a sentence: it has at most `max` characters, and no full stop, colon or semicolon before a space. */
const noSentences = (text: string, max: number) => { for (const row of cellsOf(text)) for (const c of row) assert.ok(c.length <= max && !/[.;:] /.test(c), `the cell "${c}" is a sentence`); };

const figures = {
    maplibre: '6.17.0', unitTests: {pass: 241, fail: 0},
    sizes: [{file: 'Worker file', bytes: 86341, maplibreBytes: 148480}, {file: 'Server renderer', bytes: 48830, maplibreBytes: null}],
    compatibility: [{area: 'MapLibre expression tests', passing: 357, total: 583, details: {text: 'Tests', href: 'docs/development.md#tests'}}],
};

test('the status block has a table of sizes and a table of compatibility with one number in each cell', () => {
    const block = statusBlock(figures);
    assert.deepEqual(cellsOf(block), [
        ['Worker file', '84.3', '145.0', '58.1%'],
        ['Server renderer', '47.7', '', ''],
        ['MapLibre expression tests', '357', '583', '61.2%', '[Tests](docs/development.md#tests)'],
    ]);
    assert.match(block, /^<!-- status:start -->\n[\s\S]*\nUnit tests: 241 pass and 0 fail\.\n[\s\S]*\n<!-- status:end -->$/);
});

test('the speed block has one table for each measure, with one number in each cell and the ratio', () => {
    const block = speedBlock({date: '2026-11-19T10:00:00Z', commit: 'dea6a7f0123', rows: [
        {system: 'macOS', browser: 'Chromium', load: {maplibre: 904.4, mapJr: 431.2}, moving: {maplibre: 22, mapJr: 26.4}, markers: {maplibre: 5, mapJr: 23}},
        {system: 'Linux', browser: 'WebKit', load: {maplibre: 1277, mapJr: 511}, moving: null, markers: null},
    ]}, '6.17.0');
    assert.deepEqual(cellsOf(block), [
        ['macOS, Chromium', '904', '431', '0.48'], ['Linux, WebKit', '1277', '511', '0.40'],
        ['macOS, Chromium', '22', '26', '1.20'],
        ['macOS, Chromium', '5', '23', '4.60'],
    ]);
    assert.match(block, /on 2026-11-19 \(commit dea6a7f\)/);
});

test('the blocks of the conformance tools keep what a scenario found out of the cells', () => {
    const plugins = pluginsBlock([{version: 'pmtiles 4.5.0', ok: true, detail: 'addProtocol and removeProtocol accepted the protocol', errors: []},
        {version: 'a 1.0.0, b 2.0.0', ok: false, detail: 'the control is in the page: false', errors: ['x is not a function']}]);
    assert.deepEqual(cellsOf(plugins), [['1', 'pmtiles 4.5.0', 'Pass'], ['2', 'a 1.0.0, b 2.0.0', 'Fail']]);
    assert.match(plugins, /\*\*1 of 2 scenarios pass\.\*\*/);
    assert.match(plugins, /\n2\. the control is in the page: false Errors: x is not a function\n/);

    const maputnik = maputnikBlock({repo: 'https://github.com/map-jr/maputnik', maputnikVersion: '3.1.0', head: '2ca0ccc', maplibreVersion: '6.18.0',
        suite: {ours: {passed: 193, total: 194}, ml: {passed: 194, total: 194}}, onlyOurs: [{title: 'a › b', error: 'timeout'}],
        scenarios: [{title: 'Opens', ours: {ok: true, detail: 'errors: 0'}, ml: {ok: true, detail: 'errors: 0'}}, {title: 'Icons', ours: {ok: false, detail: 'icons: 2 of 3'}, ml: {ok: true, detail: 'icons: 3 of 3'}, issue: '#758'}]});
    assert.deepEqual(cellsOf(maputnik), [
        ['Maputnik\'s own tests, with this library', '193', '194', '99.5%'], ['Maputnik\'s own tests, with MapLibre GL JS', '194', '194', '100.0%'],
        ['Opens', 'Pass', 'Pass'], ['Icons', 'Fail (#758)', 'Pass'],
    ]);
    assert.match(maputnik, /- Opens\. Both libraries: errors: 0\.\n- Icons\. This library: icons: 2 of 3\. MapLibre GL JS: icons: 3 of 3\./);

    const examples = examplesBlock([{name: 'a', state: 'works', diff: 1, newErrors: []}, {name: 'b', state: 'error', diff: 41.7, newErrors: ['Error: no | http://localhost:8080/x.js']},
        {name: 'c', state: 'differs', diff: 28.1, newErrors: []}, {name: 'd', state: 'works', diff: 0, newErrors: []}], 12);
    assert.deepEqual(cellsOf(examples), [
        ['Works', '2', '50.0%'], ['Gives an error', '1', '25.0%'], ['Draws a different image', '1', '25.0%'], ['Not compared', '0', '0.0%'],
        ['b', 'error', '41.7'], ['c', 'differs', '28.1'],
    ]);
    assert.match(examples, /\*\*2 of 4 pages work\.\*\*/);
    assert.match(examples, /\n- b: Error: no \\\| \n/);

    const api = apiBlock({have: ['a', 'b', 'c'], accepted: ['setRoll'], extra: ['querySource'], missing: [], notCounted: ['x', 'y']});
    assert.deepEqual(cellsOf(api), [['Available', '3', '75.0%'], ['Accepted, with no effect', '1', '25.0%'], ['Not available', '0', '0.0%'], ['Only in this library', '1', ''], ['Internal to MapLibre GL JS, not counted', '2', '']]);
    assert.match(api, /\*\*Not available:\*\* \n/);
});

test('the blocks in the README and in the documents have no sentence in a cell', () => {
    const readme = readFileSync(new URL('README.md', root), 'utf8'), status = between(readme, 'status'), speed = between(readme, 'speed');
    assert.ok(status && speed);
    noSentences(status, 110);
    assert.ok(cellsOf(speed).length > 0);
    for (const row of cellsOf(speed)) assert.ok(row.length === 4 && row.slice(1).every(isNumber), `a cell of "${row.join(' | ')}" is not one number`);
    const eco = readFileSync(new URL('docs/ecosystem.md', root), 'utf8');
    for (const name of ['plugins', 'maputnik', 'examples']) { assert.ok(between(eco, name)); noSentences(between(eco, name), 110); }
    assert.ok(eco.includes('\n## What is missing most often\n'));
});

test('docs/status.json has the figures of the blocks of the README', () => {
    const f = JSON.parse(readFileSync(new URL('docs/status.json', root), 'utf8')), readme = readFileSync(new URL('README.md', root), 'utf8');
    assert.equal(between(readme, 'status'), statusBlock(f));
    assert.equal(between(readme, 'speed'), speedBlock(f.speed, f.maplibre));
});
