// `firstViewOptions` turns a description into the options of `renderFirstView` (#2358).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstViewOptions, renderFirstView, renderElement, renderToSVG} from '../../src/server.ts';
import {navigation} from '../../src/control-specs.ts';

const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};

test('the options have the fields of the description, and the size defaults to 800 by 500', () => {
    const o = firstViewOptions({style, initialView: {center: [5, 6], zoom: 3, bearing: 20}, colorScheme: 'dark', minZoom: 2, nonce: 'n', locale: {'Map.Title': 'Hotels'}, controls: [navigation()]} as any);
    assert.deepEqual([o.center, o.zoom, o.bearing, o.width, o.height, o.colorScheme, o.minZoom, o.nonce, o.label], [[5, 6], 3, 20, 800, 500, 'dark', 2, 'n', 'Hotels']);
    assert.equal(o.style, style);
    assert.equal(o.controls?.length, 1);
    assert.equal(o.bounds, undefined);
});

test('a view replaces the bounds of the initial view, as in the map, and a description with no view centers at 0, 0', () => {
    const initialView = {bounds: [0, 0, 10, 10] as [number, number, number, number], fitPadding: 5, fitMaxZoom: 8};
    const fit = firstViewOptions({style, initialView} as any);
    assert.deepEqual([fit.bounds, fit.padding, fit.fitMaxZoom], [[0, 0, 10, 10], 5, 8]);
    const view = firstViewOptions({style, initialView, view: {center: [1, 2], zoom: 4}} as any);
    assert.deepEqual([view.bounds, view.center, view.zoom], [undefined, [1, 2], 4]);
    const none = firstViewOptions({style} as any);
    assert.deepEqual([none.center, none.zoom], [[0, 0], 0]);
});

test('options are passed on, null fields count as not set, and attribution false of the description wins', () => {
    const o = firstViewOptions({style, attribution: false, colorScheme: null, nonce: null} as any, {width: 300, height: 200, timeout: 3000, attribution: 'Mine'});
    assert.deepEqual([o.width, o.height, o.timeout, o.attribution, o.colorScheme, o.nonce], [300, 200, 3000, false, 'light', undefined]);
    assert.equal(firstViewOptions({style} as any, {attribution: 'Mine'}).attribution, 'Mine');
    assert.deepEqual(firstViewOptions({style, attribution: {compact: true}} as any).attributionOptions, {compact: true});
});

test('renderFirstView(firstViewOptions(description)) renders what renderElement puts inside the element', async () => {
    const description = {style, initialView: {center: [0, 0] as [number, number], zoom: 2}, controls: [navigation()]} as any;
    const first = (await renderFirstView(firstViewOptions(description, {width: 100, height: 80}))).html;
    assert.match(first, /map-jr-ctrl-zoom-in/);
    const element = await renderElement(description, {width: 100, height: 80});
    assert.ok(element.endsWith(`${first}</map-jr>`), 'the element holds the same first view');
});

test('a missing or non-object description throws a message that says what to pass (#2358)', () => {
    for (const bad of [undefined, null, 'https://example.com/style.json', [], 5]) {
        assert.throws(() => firstViewOptions(bad as any), {message: /^\[map-jr-gl\] E2358 firstViewOptions\(\): the description is .*Pass the description of the map/});
    }
});

test('a description with no style is reported by renderFirstView', async () => {
    await assert.rejects(renderFirstView(firstViewOptions({} as any)), {message: /^\[map-jr-gl\] E/});
});

test('renderFirstView returns the HTML and the URLs of the tiles that renderToSVG returns (#1201)', async () => {
    const tiled = {version: 8, sources: {v: {type: 'vector', tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf']}}, layers: [{id: 'w', type: 'fill', source: 'v', 'source-layer': 'water', paint: {'fill-color': '#0af'}}]};
    const o = {style: tiled, center: [0, 0] as [number, number], zoom: 1, width: 256, height: 256, fetch: async () => new Response(new Uint8Array())} as any;
    const first = await renderFirstView(o);
    assert.deepEqual(Object.keys(first).sort(), ['html', 'tiles']);
    assert.match(first.html, /^<div data-map-jr-ssr=""/);
    assert.ok(first.tiles.length > 0 && first.tiles.every(t => t.startsWith('https://tiles.example.com/1/')), first.tiles.join());
    assert.deepEqual(first.tiles, (await renderToSVG(o)).tiles);
});
