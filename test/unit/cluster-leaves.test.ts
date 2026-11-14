import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource} from '../../src/geojson.ts';

// Supercluster stops only when the result length equals `limit`, so -1, 0 and Infinity return every leaf.
test('getClusterLeaves follows the limit and offset rules of supercluster (#251)', () => {
    const features = Array.from({length: 12}, (_, i) => ({type: 'Feature', properties: {i}, geometry: {type: 'Point', coordinates: [i * 1e-4, 0]}}));
    const {clusters} = prepareSource({type: 'FeatureCollection', features}, {cluster: true});
    const top = clusters!.at(0)!;
    assert.equal(top.length, 1);
    const id = top[0].properties.cluster_id as number;
    const n = (limit?: number, offset?: number) => clusters!.leaves(id, limit, offset).length;
    assert.equal(n(), 10);
    assert.equal(n(-1), 12);
    assert.equal(n(0), 12);
    assert.equal(n(Infinity), 12);
    assert.equal(n(5, 10), 2);
    assert.equal(n(Infinity, 12), 0);
    assert.equal(n(-1, 20), 0);
});
