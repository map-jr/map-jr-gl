// A paint value that is the same for the whole layer is drawn at the zoom of the map, so that a change of it needs no new
// tiles and moves over its transition (#972). `layerRules` is what the tiles are built from: such a change keeps it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layerRules} from '../../src/rules.ts';

const same = (a: any, b: any) => JSON.stringify(layerRules(a)) === JSON.stringify(layerRules(b));
const symbol = (paint: object) => ({id: 's', type: 'symbol', source: 'v', layout: {'text-field': 'A', 'icon-image': 'x'}, paint});

test('symbol paint for the whole layer needs no new tiles', () => {
    const was = symbol({'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 1, 'text-opacity': 1, 'icon-opacity': 1, 'icon-color': '#000', 'icon-halo-width': 1, 'icon-halo-color': '#fff', 'icon-halo-blur': 0});
    const now = symbol({'text-color': '#f00', 'text-halo-color': '#00f', 'text-halo-width': 2, 'text-halo-blur': 1, 'text-opacity': 0.5, 'icon-opacity': 0.2, 'icon-color': '#0f0', 'icon-halo-width': 3, 'icon-halo-color': '#f0f', 'icon-halo-blur': 2, 'text-color-transition': {duration: 900}});
    assert.ok(same(was, now));
});

test('symbol paint that the tiles hold still builds them again', () => {
    // A value for each feature, and an icon that gets or loses its halo (a tile holds an icon without a halo apart).
    assert.ok(!same(symbol({'text-color': '#000'}), symbol({'text-color': ['get', 'c']})));
    assert.ok(!same(symbol({}), symbol({'icon-halo-width': 1, 'icon-halo-color': '#fff'})));
});

test('fill-extrusion color and fill-outline-color need no new tiles; heights do', () => {
    const x = (paint: object) => ({id: 'x', type: 'fill-extrusion', source: 'v', paint});
    assert.ok(same(x({'fill-extrusion-color': '#000', 'fill-extrusion-opacity': 1, 'fill-extrusion-height': 10}), x({'fill-extrusion-color': '#f00', 'fill-extrusion-opacity': 0.5, 'fill-extrusion-height': 10})));
    assert.ok(!same(x({'fill-extrusion-height': 10}), x({'fill-extrusion-height': 20})));
    const fill = (paint: object) => ({id: 'f', type: 'fill', source: 'v', paint});
    assert.ok(same(fill({'fill-outline-color': '#000'}), fill({'fill-outline-color': '#f00'})));
});
