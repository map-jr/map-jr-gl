// Unit tests for the timeout of requests (glyphs, sprites, fonts, images, tiles, TileJSON, GeoJSON; #135, #141, #394): a request that never answers fails like any other.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {withTimeout} from '../../src/requests.ts';
import {LocalBackend, TileBuilder} from '../../src/tiles.ts';

// The engine and the map start in Node: src/gl.ts is replaced by a renderer that does nothing, and the glyph atlas
// draws on a canvas that does nothing. Each request then goes to a `fetch` that never answers.
const fakeGL = new URL('./fixtures/fake-gl.mjs', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(
    `export async function resolve(s, c, next) { return s === './gl.ts' ? {url: ${JSON.stringify(fakeGL)}, shortCircuit: true} : next(s, c); }`));
const nothing: any = new Proxy(function () {}, {get: (_, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : nothing, apply: () => nothing, construct: () => nothing});
(globalThis as any).OffscreenCanvas ??= class { constructor(public width: number, public height: number) {} getContext() { return nothing; } };
const {Engine} = await import('../../src/engine.ts');
const {Map: JrMap} = await import('../../src/map.ts');
const {resolveStyle} = await import('../../src/resolve.ts');
/** A `fetch` that never answers, except for the URLs of `answers`, with the URLs that it was asked for. */
const neverFetch = (asked: string[], answers: Record<string, () => Response> = {}) => ((input: unknown) => {
    asked.push(String(input));
    return answers[String(input)] ? Promise.resolve(answers[String(input)]()) : new Promise<Response>(() => {});
}) as typeof fetch;
/** Lets the promises that are ready run (a request starts after a few of them). */
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
const timedOut = (url: string) => new RegExp(`\\[map-jr-gl\\] the request to ${url.replace(/[.?/]/g, '\\$&')} did not finish within 30000 ms`);

test('request timeout: a request that never answers rejects and is aborted', async () => {
    let signal: AbortSignal | undefined;
    const never = ((_: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); }) as typeof fetch;
    await assert.rejects(withTimeout(never, 50)('https://glyphs.test/0-255.pbf'), /\[map-jr-gl\] the request to https:\/\/glyphs\.test\/0-255\.pbf did not finish within 50 ms/);
    assert.equal(signal?.aborted, true);
});

test('request timeout: a body that never ends is aborted', async () => {
    const endless = (async (_: unknown, init?: RequestInit) => new Response(new ReadableStream({start(c) {
        c.enqueue(new Uint8Array(10)); init!.signal!.addEventListener('abort', () => c.error(new Error('aborted')));
    }}))) as typeof fetch;
    const res = await withTimeout(endless, 50)('https://sprites.test/s.png');
    await assert.rejects(res.arrayBuffer());
});

test('request timeout: a request that answers in time is unchanged', async () => {
    const res = await withTimeout((async () => new Response('ok')) as typeof fetch, 1000)('https://glyphs.test/a');
    assert.equal(await res.text(), 'ok');
});

test('request timeout: each request of the engine that never answers fails after 30 s (glyphs, sprite, font, image, tile, elevation)', async t => {
    const fetched = globalThis.fetch, asked: string[] = [], errors: string[] = [];
    // (The two files of a sheet of the sprite are asked for together, and the first failure ends the sheet: one sheet
    // answers only its image, the other only its JSON.)
    globalThis.fetch = neverFetch(asked, {'https://sprites.test/a.png': () => new Response(null, {status: 404}), 'https://sprites.test/b.json': () => Response.json({})});
    t.mock.timers.enable({apis: ['setTimeout']});
    try {
        const style = await resolveStyle({version: 8, sprite: [{id: 'a', url: 'https://sprites.test/a'}, {id: 'b', url: 'https://sprites.test/b'}], glyphs: 'https://glyphs.test/{fontstack}/{range}.pbf',
            sources: {
                picture: {type: 'image', url: 'https://images.test/a.png', coordinates: [[-1, 1], [1, 1], [1, -1], [-1, -1]]},
                raster: {type: 'raster', tiles: ['https://tiles.test/{z}/{x}/{y}.png']},
                dem: {type: 'raster-dem', tiles: ['https://dem.test/{z}/{x}/{y}.png'], maxzoom: 1},
            },
            layers: [{id: 'picture', type: 'raster', source: 'picture'}, {id: 'raster', type: 'raster', source: 'raster'}]});
        const engine: any = new Engine(new EventTarget() as never, {style, width: 100, height: 100, dpr: 1, fontFamily: 'sans-serif', center: [0, 0], zoom: 1,
            fonts: [{family: 'F', src: 'https://fonts.test/f.woff2'}]} as never, [new LocalBackend()], (e: any) => { if (e.type === 'error') errors.push(e.message); });
        const failures: string[] = [];
        engine.atlas.fetchGlyphs('https://glyphs.test/F/0-255.pbf').catch((e: Error) => failures.push(e.message));
        engine.pictureItems('picture', engine.tr);
        engine.queryElevation({type: 'elevation', lng: 0, lat: 0, source: 'dem', zoom: 1}).catch((e: Error) => failures.push(e.message));
        // (The engine asks for the tiles in its first frames, which a timer starts. A raster tile is fetched by the tile builder, #2068.)
        await settle();
        t.mock.timers.tick(100);
        await settle();
        const urls = ['https://glyphs.test/F/0-255.pbf', 'https://sprites.test/a.json', 'https://sprites.test/b.png', 'https://fonts.test/f.woff2', 'https://images.test/a.png', 'https://tiles.test/1/0/0.png', 'https://dem.test/1/1/1.png'];
        for (const url of urls) assert.ok(asked.includes(url), `no request to ${url}: ${asked.join(', ')}`);
        t.mock.timers.tick(29899);
        await settle();
        assert.deepEqual([...errors, ...failures], [], 'a request failed before 30 s');
        t.mock.timers.tick(200);
        await settle();
        const all = [...errors, ...failures].join('\n');
        for (const url of urls) assert.match(all, timedOut(url), `the request to ${url} has no timeout:\n${all}`);
    } finally { globalThis.fetch = fetched; }
});

test('request timeout: an abort by the caller still ends the request', async () => {
    let signal: AbortSignal | undefined;
    const never = ((_: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); }) as typeof fetch;
    const ac = new AbortController(), p = withTimeout(never, 10000)('https://tiles.test/1/0/0.pbf', {signal: ac.signal});
    ac.abort(new Error('cancelled'));
    await assert.rejects(p, /cancelled/);
    assert.equal(signal?.aborted, true);
});

test('request timeout: a tile request that never answers fails after 30 s like any failed tile (#394)', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const builder = new TileBuilder((() => new Promise<Response>(() => {})) as typeof fetch);
    const p = builder.loadIR({id: 1, source: 's', url: 'https://tiles.test/1/0/0.pbf', z: 1} as never);
    let failed: unknown;
    p.catch(e => { failed = e; });
    await new Promise(r => setImmediate(r));
    t.mock.timers.tick(29999);
    await new Promise(r => setImmediate(r));
    assert.equal(failed, undefined);
    t.mock.timers.tick(1);
    await new Promise(r => setImmediate(r));
    assert.match(String(failed), /\[map-jr-gl\] the request to https:\/\/tiles\.test\/1\/0\/0\.pbf did not finish within 30000 ms/);
});

test('request timeout: each request of the map that never answers fails after 30 s (style, TileJSON, GeoJSON, setData)', async t => {
    const fetched = globalThis.fetch, asked: string[] = [];
    globalThis.fetch = neverFetch(asked);
    t.mock.timers.enable({apis: ['setTimeout']});
    try {
        // The map is taken from its constructor once its members are set, before it measures the page (Node has none).
        let map: any;
        class Probe extends JrMap { measure() { map = this; throw new Error('stop'); } }
        const element = () => ({style: {}, classList: {add() {}}, querySelector: () => null, setAttribute() {}, insertBefore() {}, firstChild: null});
        (globalThis as any).document = {createElement: element};
        try { new Probe({container: element()} as never); } catch (e) { assert.equal((e as Error).message, 'stop'); } finally { delete (globalThis as any).document; }
        const failures: string[] = [], fail = (e: Error) => failures.push(e.message);
        map.loadStyle('https://style.test/s.json').catch(fail);
        map.rawStyle = {version: 8, sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: []};
        map.styleBase = 'https://style.test/s.json';
        map.setGeoJSON('g', 'https://data.test/set.json').catch(fail);
        resolveStyle({version: 8, sources: {v: {type: 'vector', url: 'https://tilejson.test/v.json'}, d: {type: 'geojson', data: 'https://data.test/d.json'}}, layers: []},
            map.fetchAs('Source'), 'https://style.test/s.json', undefined, fail).catch(fail);
        await settle();
        const urls = ['https://style.test/s.json', 'https://data.test/set.json', 'https://tilejson.test/v.json', 'https://data.test/d.json'];
        assert.deepEqual([...asked].sort(), [...urls].sort());
        t.mock.timers.tick(29999);
        await settle();
        assert.deepEqual(failures, [], 'a request failed before 30 s');
        t.mock.timers.tick(1);
        await settle();
        const all = failures.join('\n');
        for (const url of urls) assert.match(all, timedOut(url), `the request to ${url} has no timeout:\n${all}`);
    } finally { globalThis.fetch = fetched; }
});

test('request timeout: the timer is cleared when the request settles (#415)', async () => {
    const active = new Set<unknown>(), set = globalThis.setTimeout, clear = globalThis.clearTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number) => { const id = set(() => { active.delete(id); fn(); }, ms); active.add(id); return id; }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => { active.delete(id); clear(id); }) as typeof clearTimeout;
    try {
        const res = await withTimeout((async () => Object.defineProperty(new Response('ok'), 'url', {value: 'https://glyphs.test/a'})) as typeof fetch)('https://glyphs.test/a');
        assert.equal(res.url, 'https://glyphs.test/a');
        assert.equal(await res.text(), 'ok');
        assert.equal(await (await withTimeout((async () => new Response('{"a":1}')) as typeof fetch)('https://glyphs.test/j')).json().then(j => j.a), 1);
        assert.equal((await withTimeout((async () => new Response(null, {status: 204})) as typeof fetch)('https://glyphs.test/b')).status, 204);
        await assert.rejects(withTimeout((async () => { throw new Error('offline'); }) as typeof fetch)('https://glyphs.test/c'), /offline/);
        const ac = new AbortController(), p = withTimeout((() => new Promise<Response>(() => {})) as typeof fetch)('https://glyphs.test/d', {signal: ac.signal});
        ac.abort(new Error('cancelled'));
        await assert.rejects(p, /cancelled/);
        assert.equal(active.size, 0, `${active.size} timers of settled requests are still pending`);
    } finally {
        for (const id of active) clear(id as ReturnType<typeof setTimeout>);
        globalThis.setTimeout = set; globalThis.clearTimeout = clear;
    }
});
