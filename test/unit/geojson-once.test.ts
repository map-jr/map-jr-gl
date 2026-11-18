// The engine encodes a GeoJSON update once for all tile workers, and each worker gets a copy of the bytes (#878).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PortBackend, serveTiles} from '../../src/tiles.ts';

const data = {type: 'FeatureCollection', features: [{type: 'Feature', id: 1, properties: {a: 1}, geometry: {type: 'Point', coordinates: [10, 20]}}]};

test('PortBackend sends the encoded bytes of a GeoJSON update, and the worker indexes them', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const packed = () => bytes;
    const sent: any[] = [];
    const backends = [0, 1, 2, 3].map(() => {
        const worker: any = {onmessage: null, postMessage: (m: any) => queueMicrotask(() => page.onmessage({data: m}))};
        const page: any = {onmessage: null, postMessage: (m: any, t?: Transferable[]) => { sent.push({m, t}); queueMicrotask(() => worker.onmessage({data: m})); }};
        serveTiles(worker);
        return new PortBackend(page);
    });
    await Promise.all(backends.map(b => b.setGeoJSON('s', data, {}, 18, packed)));
    const geo = sent.filter(s => s.m.type === 'geojson');
    assert.equal(geo.length, 4);
    for (const {m, t} of geo) {
        assert.equal(m.data, undefined, 'the object is not cloned for each worker');
        assert.ok(m.bytes instanceof Uint8Array && t?.includes(m.bytes.buffer), 'each worker gets its own transferred bytes');
        assert.notEqual(m.bytes, bytes, 'the shared bytes are not detached');
    }
    const found = await backends[0].query('geojson://s/0/0/0', {source: 's', z: 0, x: 0, y: 0, px: 2048 + 10 / 360 * 4096, py: 1820, radius: 4096} as any);
    assert.ok(found.length >= 1, 'the worker indexed the data from the bytes');
});
