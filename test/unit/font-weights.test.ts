// A font name gives the CSS weight of each of its weight names (#1192).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFontName} from '../../src/resolve.ts';

test('parseFontName: the CSS weights from 100 to 900', () => {
    const cases: [string, number][] = [
        ['Roboto Thin', 100], ['Roboto Hairline', 100], ['Roboto Extra Light', 200], ['Roboto ExtraLight', 200], ['Roboto Ultra Light', 200],
        ['Roboto Light', 300], ['Roboto Regular', 400], ['Roboto Medium', 500], ['Roboto Semibold', 600], ['Roboto Demi Bold', 600],
        ['Roboto Bold', 700], ['Roboto Extra Bold', 800], ['Roboto Ultra Bold', 800], ['Roboto Black', 900], ['Roboto Heavy', 900],
    ];
    for (const [name, weight] of cases) assert.deepEqual(parseFontName(name), {family: 'Roboto', weight, style: 'normal'}, name);
    assert.deepEqual(parseFontName('Roboto Thin Italic'), {family: 'Roboto', weight: 100, style: 'italic'});
});
