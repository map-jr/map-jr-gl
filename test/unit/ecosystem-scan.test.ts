// The scan of plugins and wrappers (test/conformance/ecosystem.mjs) compares them with the entry maplibre-compat, and
// not with the main entry, so it does not list members of that entry as missing (#472, #224).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
// @ts-ignore: a script without types
import {compatSurface, exportsOf} from '../conformance/compat-surface.mjs';

const surface = compatSurface(path.resolve(import.meta.dirname, '../..'));

test('the scan knows the exports of the entry maplibre-compat', () => {
    for (const name of ['Map', 'Marker', 'Popup', 'LngLat', 'LngLatBounds', 'Point', 'NavigationControl', 'GeolocateControl', 'FullscreenControl', 'GlobeControl', 'GPUInitializationError', 'setWorkerUrl', 'getVersion']) {
        assert.ok(surface.values.has(name), `${name} is an export of the entry`);
    }
    // A type is not a value: a package that uses it with `new` or `instanceof` does not find it.
    assert.ok(surface.types.has('MapOptions') && !surface.values.has('MapOptions'));
    assert.ok(surface.types.has('ControlPosition') && !surface.values.has('ControlPosition'));
});

test('the scan knows the methods of the compat map, and which of them have no effect', () => {
    for (const name of ['queryRenderedFeatures', 'moveLayer', 'loadImage', 'setProjection', 'setPitch', 'on', 'setSky', 'setRenderWorldCopies']) {
        assert.ok(surface.methods.has(name), `${name} is a method of the map`);
    }
    for (const name of ['setRoll', 'setRenderWorldCopies', 'setZoomSnap']) assert.ok(surface.inert.has(name), `${name} has no effect`);
    for (const name of ['setProjection', 'setPitch', 'unsupported', 'incomplete']) assert.ok(!surface.inert.has(name), `${name} is not in the list`);
    assert.ok(!surface.methods.has('unsupported'), 'a private method is not in the list');
    assert.ok(surface.events.has('projectiontransition') && surface.events.has('touchstart'));
});

test('exportsOf separates values from types', () => {
    const {values, types} = exportsOf([
        "export {Map, Map as MapLibreMap} from './a.ts';",
        "export {Handler, type Feature} from './b.ts';",
        "export type {Anchor} from './c.ts';",
        'export class Marker extends Core {}',
        'export const getVersion = () => 1;',
        'export interface Options {}',
        'export type Unit = string;',
    ].join('\n'));
    assert.deepEqual([...values].sort(), ['Handler', 'Map', 'MapLibreMap', 'Marker', 'getVersion']);
    assert.deepEqual([...types].sort(), ['Anchor', 'Feature', 'Options', 'Unit']);
});
