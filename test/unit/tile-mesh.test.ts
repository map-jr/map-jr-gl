// createTileMesh of the compat entry (#1465, exported by src/maplibre-compat.ts) gives the same bytes as createTileMesh of MapLibre GL JS 6.17.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as compat from '../../src/tile-mesh.ts';
import {createTileMesh as theirs} from 'maplibre-gl';

const bytes = (m: {vertices: ArrayBuffer; indices: ArrayBuffer; uses32bitIndices: boolean}) =>
    [Buffer.from(m.vertices).toString('hex'), Buffer.from(m.indices).toString('hex'), m.uses32bitIndices];

test('createTileMesh matches MapLibre GL JS for every option', () => {
    assert.equal(typeof compat.createTileMesh, 'function');
    for (const granularity of [undefined, 0, 1, 3, 32, 128]) for (const size of [undefined, '16bit', '32bit'] as const)
        for (let f = 0; f < 8; f++) {
            const o = {granularity, generateBorders: !!(f & 1), extendToNorthPole: !!(f & 2), extendToSouthPole: !!(f & 4)};
            assert.deepEqual(bytes(compat.createTileMesh(o, size)), bytes(theirs(o, size)), JSON.stringify([o, size]));
        }
});

test('createTileMesh takes 32-bit indices when the mesh needs them, and throws for "16bit"', () => {
    assert.deepEqual(bytes(compat.createTileMesh({granularity: 300})), bytes(theirs({granularity: 300})));
    assert.equal(compat.createTileMesh({granularity: 300}).uses32bitIndices, true);
    assert.throws(() => compat.createTileMesh({granularity: 300}, '16bit'), /\[map-jr-gl\] createTileMesh\(\)/);
});
