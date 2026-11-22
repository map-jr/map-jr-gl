// `promoteId` on a vector source gives each feature the id from one of its properties, for feature state and queries (#1437).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeVectorTile} from '../../src/mvt.ts';
import {TileBuilder} from '../../src/tiles.ts';

const varint = (n: number) => { const b: number[] = []; while (n > 127) { b.push((n & 127) | 128); n >>>= 7; } b.push(n); return b; };
const field = (n: number, bytes: number[]) => [...varint(n << 3 | 2), ...varint(bytes.length), ...bytes];
const text = (s: string) => [...new TextEncoder().encode(s)];
/** A tile with one layer "a" of four points: id 5 with `code: "x1"`, id 6 with `flag: true`, id 7 with no properties, id 8 with `code: "12"`. */
function tile(): Uint8Array {
    const point = field(4, [9, 50, 50]); // MoveTo(1) of (25, 25)
    const feature = (id: number, tags: number[]) => field(2, [8, ...varint(id), ...(tags.length ? field(2, tags) : []), 24, 1, ...point]);
    const layer = [...field(1, text('a')), ...feature(5, [0, 0]), ...feature(6, [1, 1]), ...feature(7, []), ...feature(8, [0, 2]),
        ...field(3, text('code')), ...field(3, text('flag')), ...field(4, field(1, text('x1'))), ...field(4, [56, 1]), ...field(4, field(1, text('12'))), 40, ...varint(4096), 120, 2];
    return new Uint8Array(field(3, layer));
}
const ids = (promoteId?: string | Record<string, string>) => decodeVectorTile(tile(), promoteId).a.features.map(f => f.id);

// (As `FeatureIndex.getId` of MapLibre GL JS 6.17.0: the value of the property as it is, a boolean as a number.)
test('promoteId: the id comes from the property, as in MapLibre GL JS', () => {
    assert.deepEqual(ids(), [5, 6, 7, 8]);
    // A string stays the string, a string of digits too; a feature without the property has no id; a boolean becomes 0 or 1.
    assert.deepEqual(ids('code'), ['x1', undefined, undefined, '12']);
    assert.deepEqual(ids('flag'), [undefined, 1, undefined, undefined]);
    // The object form names a property for each source layer; a layer that it does not name has no ids.
    assert.deepEqual(ids({a: 'code'}), ['x1', undefined, undefined, '12']);
    assert.deepEqual(ids({b: 'code'}), [undefined, undefined, undefined, undefined]);
});

test('promoteId: feature state with a promoted string id changes the tile, and a query gives that id', async () => {
    const bytes = tile(), url = 'https://example.com/0/0/0.pbf';
    const draw = async (promote: boolean, hot: boolean) => {
        const b = new TileBuilder((async () => new Response(bytes)) as typeof fetch);
        b.setStyle([{id: 'dots', type: 'circle', source: 's', 'source-layer': 'a', paint: {'circle-color': ['case', ['boolean', ['feature-state', 'hot'], false], '#f00', '#00f']}}]);
        b.setContours({}, promote ? {s: 'code'} : {});
        if (hot) b.setFeatureState('s', {'a|x1': {hot: true}});
        const ir = await b.loadIR({id: 1, source: 's', url, z: 0, overscaled: false});
        return {ir: JSON.stringify(ir), found: await b.query(url, {source: 's', z: 0, x: 0, y: 0, px: 25, py: 25, radius: 2})};
    };
    const cold = await draw(true, false), hot = await draw(true, true), plain = await draw(false, true);
    assert.notEqual(hot.ir, cold.ir, 'the state "hot" of the feature "x1" changes the colour');
    assert.equal(plain.ir, cold.ir, 'without promoteId the feature has the id 5, so the state of "x1" is not its state');
    assert.deepEqual(hot.found.map(f => f.id), ['x1', undefined, undefined, '12']);
    assert.deepEqual(plain.found.map(f => f.id), [5, 6, 7, 8]);
});
