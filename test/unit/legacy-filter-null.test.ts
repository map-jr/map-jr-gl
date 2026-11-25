// The legacy comparison filters give the results of MapLibre's `featureFilter` for null, missing and set properties (#1914).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {compileFilter} from '../../src/expr.ts';

const require = createRequire(import.meta.url);
const spec = createRequire(require.resolve('maplibre-gl/package.json'))('@maplibre/maplibre-gl-style-spec');

const properties: Record<string, any> = {null: {a: null}, missing: {}, number: {a: 1}, zero: {a: 0}, string: {a: '1'}};
const filters: any[] = [];
for (const op of ['==', '!=', '<', '<=', '>', '>=']) for (const v of [null, 1, '1']) filters.push([op, 'a', v]);
filters.push(['in', 'a', null], ['!in', 'a', null], ['in', 'a', null, 1], ['!in', 'a', null, 1]);

test('legacy comparison filters agree with MapLibre featureFilter on null, missing and set properties', () => {
    for (const f of filters) {
        const ours = compileFilter(f)!, theirs = spec.featureFilter(f, 'filter').filter;
        for (const [name, p] of Object.entries(properties)) {
            const feature = {type: 1, properties: p};
            assert.equal(ours({zoom: 0, f: feature} as any), theirs({zoom: 0}, feature), `${JSON.stringify(f)} on ${name}`);
        }
    }
});
