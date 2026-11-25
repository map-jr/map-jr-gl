// The compat entry exports `Hash` and `config`, which svelte-maplibre-gl and svelte-maplibre use (#1261).
import {test} from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
g.__DEV__ = false; g.__VERSION__ = 'test';
g.location = {hash: '#4/10/20', href: 'http://x/'};
g.addEventListener = g.removeEventListener = () => {};
g.history = {state: null, replaceState: (_s: unknown, _t: string, url: string) => { g.location.hash = new URL(url).hash; }};
const {Hash, config, EXTENT, Evented, addProtocol, removeProtocol} = await import('../../src/maplibre-compat.ts') as any;

const stub = () => {
    const calls: any[] = [], listeners: Record<string, Function[]> = {};
    return {calls, listeners, jumpTo: (c: any) => calls.push(c), on: (t: string, f: Function) => (listeners[t] ??= []).push(f), off: (t: string, f: Function) => { listeners[t] = (listeners[t] ?? []).filter(x => x !== f); },
        getCenter: () => ({lat: 1, lng: 2}), getZoom: () => 5, getBearing: () => 0, getPitch: () => 0};
};
const later = () => new Promise(r => setTimeout(r, 20));

test('Hash takes the camera of the fragment and removes its listeners', async () => {
    const map = stub(), hash = new Hash();
    assert.equal(hash.addTo(map), hash);
    assert.equal(hash._onHashChange(), true);
    await later();
    assert.deepEqual(map.calls, [{zoom: 4, center: [20, 10], bearing: 0, pitch: 0}]);
    assert.equal(map.listeners.moveend.length, 1);
    hash.remove();
    assert.equal(map.listeners.moveend.length, 0);
});

test('Hash writes the camera into a fragment that has none, and a name keeps other values', async () => {
    g.location.hash = '#a=1';
    const map = stub(), hash = new Hash('map');
    hash.addTo(map);
    assert.equal(hash._onHashChange(), false);
    await later();
    assert.equal(g.location.hash, '#a=1&map=5/1/2');
    assert.equal(map.calls.length, 0);
    hash.remove();
});

test('Hash.remove before the code has loaded stops it', async () => {
    const map = stub();
    new Hash().addTo(map).remove();
    await later();
    assert.equal(map.listeners.moveend, undefined);
});

test('config lists the protocols and holds the two settings', () => {
    addProtocol('x', async () => ({data: 1}));
    assert.ok(Object.hasOwn(config.REGISTERED_PROTOCOLS, 'x') && !Object.hasOwn(config.REGISTERED_PROTOCOLS, 'pmtiles'));
    removeProtocol('x');
    assert.ok(!Object.hasOwn(config.REGISTERED_PROTOCOLS, 'x'));
    config.MAX_PARALLEL_IMAGE_REQUESTS = 5;
    assert.equal(config.MAX_PARALLEL_IMAGE_REQUESTS, 5);
    assert.equal(EXTENT, 8192);
    assert.equal(new Evented().on('a', () => {}) instanceof Evented, true);
});

test('the source names answer instanceof by the type of the source, and Event takes its data (#1717)', async () => {
    const m = await import('../../src/maplibre-compat.ts') as any;
    const names: Record<string, string> = {GeoJSONSource: 'geojson', VectorTileSource: 'vector', RasterTileSource: 'raster', RasterDEMTileSource: 'raster-dem', ImageSource: 'image', VideoSource: 'video', CanvasSource: 'canvas'};
    for (const [name, type] of Object.entries(names)) {
        assert.equal({id: 's', type} instanceof m[name], true, name);
        for (const other of Object.values(names)) if (other !== type) assert.equal({type: other} instanceof m[name], false, `${name} ${other}`);
        assert.equal(undefined instanceof m[name], false);
        assert.equal(m.default[name], m[name], `default.${name}`);
    }
    assert.equal(m.default.Event, m.Event);
    const e = new m.Event('custom', {a: 1, type: 'other'});
    assert.equal(e.type, 'custom');
    assert.equal(e.a, 1);
    assert.equal(e instanceof m.Event, true);
    assert.equal(new m.Event('x').type, 'x');
});

test('the compat entry has the names that @maptiler/sdk re-exports: AJAXError, EdgeInsets, GeolocateEvent, prewarm (#1784)', async () => {
    const m = await import('../../src/maplibre-compat.ts') as any;
    for (const name of ['AJAXError', 'EdgeInsets', 'GeolocateEvent', 'prewarm', 'clearPrewarmedResources']) assert.equal(m.default[name], m[name], `default.${name}`);
    const err = new m.AJAXError(404, 'Not Found', 'https://x/y.json', undefined);
    assert.equal(err instanceof m.AJAXError, true);
    assert.equal(err instanceof Error, true);
    assert.deepEqual([err.status, err.statusText, err.url, err.message], [404, 'Not Found', 'https://x/y.json', 'AJAXError: Not Found (404): https://x/y.json']);
    const g = new m.GeolocateEvent('trackuserlocationend');
    assert.equal(g.type, 'trackuserlocationend');
    assert.equal({type: 'userlocationlostfocus'} instanceof m.GeolocateEvent, true);
    assert.equal({type: 'geolocate'} instanceof m.GeolocateEvent, false);
    const e = new m.EdgeInsets(10, 20, 30, 40);
    assert.deepEqual({...e}, {top: 10, bottom: 20, left: 30, right: 40});
    assert.deepEqual({...new m.EdgeInsets()}, {top: 0, bottom: 0, left: 0, right: 0});
    assert.equal(m.prewarm(), undefined);
    assert.equal(m.clearPrewarmedResources(), undefined);
});
