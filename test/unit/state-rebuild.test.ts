// After a change of feature state, a tile worker builds only the layers that read it (`TileRequest.state`), and
// nothing for a tile that has none of the changed features. The buffers are those of a build of the whole tile.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TileBuilder, type TileRequest} from '../../src/tiles.ts';
import {decodeVectorTile} from '../../src/mvt.ts';
import {toGL} from '../../src/tile.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const hover = ['boolean', ['feature-state', 'hover'], false];
const layers: any[] = [
    {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#00f'}},
    {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-width': 2}},
    {id: 'lit', type: 'fill', source: 's', 'source-layer': 'building', paint: {'fill-color': ['case', hover, '#f00', '#888']}},
    {id: 'wide', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-width': ['case', hover, 8, 2], 'line-color': '#333'}},
    {id: 'tall', type: 'fill-extrusion', source: 's', 'source-layer': 'building', paint: {'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-color': ['case', hover, '#f00', '#ccc']}},
    {id: 'names', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: {'text-field': ['get', 'name']}},
];
const vt = decodeVectorTile(bytes), building = vt.building.features.find(f => f.id !== undefined)!.id!, road = vt.transportation.features.find(f => f.id !== undefined)!.id!;
const req: TileRequest = {id: 1, source: 's', url: 'https://example.com/t.pbf', z: 14, overscaled: false};
const builder = () => { const b = new TileBuilder((async () => new Response(bytes)) as unknown as typeof fetch); b.setStyle(layers); return b; };
const same = (a: any, b: any, what: string) => {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), what);
    for (const k in a) {
        if (ArrayBuffer.isView(a[k])) assert.ok(Buffer.from(a[k].buffer, a[k].byteOffset, a[k].byteLength).equals(Buffer.from(b[k].buffer, b[k].byteOffset, b[k].byteLength)), `${what}.${k}`);
        else assert.deepEqual(a[k], b[k], `${what}.${k}`);
    }
};

test('state rebuild: a build of the layers that read feature state has their buffers of a build of the whole tile, and no other layer', async () => {
    const b = builder(), before = toGL(await b.loadIR(req)).tile;
    b.setFeatureState('s', {[`building|${building}`]: {hover: true}, [`transportation|${road}`]: {hover: true}});
    const part = toGL(await b.loadIR({...req, id: 2, again: true, state: {layers: ['lit', 'wide', 'tall'], changed: [`building|${building}`, `transportation|${road}`]}})).tile;
    const whole = toGL(await b.loadIR({...req, id: 3, again: true})).tile;
    assert.deepEqual(Object.keys(part.layers).sort(), ['lit', 'tall', 'wide']);
    assert.deepEqual(part.labels, {});
    assert.equal(part.same, undefined);
    for (const id of ['lit', 'wide', 'tall']) same(part.layers[id], whole.layers[id], id);
    // (The state shows in the buffers: the color of a building, the width of a road.)
    assert.ok(!Buffer.from(before.layers.lit.color!.buffer).equals(Buffer.from(whole.layers.lit.color!.buffer)));
    assert.ok(Object.keys(whole.layers).includes('water') && Object.keys(whole.labels).includes('names'));
});

test('state rebuild: a tile with none of the changed features is not built, and one whose changes are not known is', async () => {
    const b = builder();
    await b.loadIR(req);
    b.setFeatureState('s', {'building|1': {hover: true}});
    const none = await b.loadIR({...req, id: 2, again: true, state: {layers: ['lit', 'tall'], changed: ['building|1', 'transportation|2']}});
    assert.deepEqual(none, {layers: {}, labels: {}, same: true, expires: undefined, etag: undefined});
    // (The key of a feature of another source layer than those of the layers does not count.)
    assert.equal((await b.loadIR({...req, id: 3, again: true, state: {layers: ['lit'], changed: [`transportation|${road}`]}})).same, true);
    assert.equal((await b.loadIR({...req, id: 4, again: true, state: {layers: ['wide'], changed: [`transportation|${road}`]}})).same, undefined);
    const all = await b.loadIR({...req, id: 5, again: true, state: {layers: ['lit', 'tall']}});
    assert.deepEqual(Object.keys(all.layers).sort(), ['lit', 'tall']);
});

test('state rebuild: the builds read the tile that the worker keeps decoded, and answer one fetch', async () => {
    let fetches = 0;
    const b = new TileBuilder((async () => (fetches++, new Response(bytes))) as unknown as typeof fetch);
    b.setStyle(layers);
    await b.loadIR(req);
    for (let i = 0; i < 5; i++) await b.loadIR({...req, id: 10 + i, again: true, state: {layers: ['lit'], changed: [`building|${building}`]}});
    assert.equal(fetches, 1);
    assert.equal((b as any).asked.size, 1);
});
