// The development build of the entry maplibre-compat warns once when code reads a member of MapLibre GL JS that a
// class of this library does not have (#206).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchMembers} from '../../src/mistakes.ts';

class Base { on() { return this; } }
class Map extends Base { getZoom() { return 3; } }
class ScaleControl { onAdd() { return null; } }

test('a missing member of MapLibre warns once, and other reads do not warn', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        watchMembers({Map, ScaleControl}, {Map: ['getZoom', 'on', 'transform', 'coveringTiles'], ScaleControl: ['onAdd', 'setUnit']});
        const map = new Map() as any, scale = new ScaleControl() as any;
        assert.equal(map.getZoom(), 3);
        assert.equal(map.on(), map);
        assert.equal(map.coveringTiles, undefined);
        map.coveringTiles;
        assert.equal(scale.setUnit, undefined);
        assert.equal(map.transform, undefined);
        // Names that frameworks probe, and names that MapLibre does not have, do not warn.
        for (const k of ['then', 'toJSON', '$$typeof', '__v_skip', '__v_isRef', '_render', 'somethingElse']) assert.equal(map[k], undefined);
        assert.equal(map[Symbol.iterator], undefined);
        assert.equal(typeof map.toString, 'function');
        assert.ok(map instanceof Map && map instanceof Base);
        assert.deepEqual(warnings, [
            '[map-jr-gl] map.coveringTiles is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/maplibre-compatibility.md for what replaces it.',
            '[map-jr-gl] ScaleControl.setUnit is not available in @map-jr/map-jr-gl/maplibre-compat. Remove the use, or see docs/maplibre-compatibility.md for what replaces it.',
            '[map-jr-gl] map.transform is private state of MapLibre GL JS and does not exist in @map-jr/map-jr-gl/maplibre-compat. Use getCenter(), getZoom(), getBearing(), getPitch() and project(). react-map-gl 8 does not read it.',
        ]);
    } finally { console.warn = warn; }
});
