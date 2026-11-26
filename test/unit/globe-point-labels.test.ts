// Point text with `text-pitch-alignment: map` on the globe (#2012): the text lies on the sphere, as in MapLibre GL JS,
// also on a map without pitch. It is foreshortened towards the edge of the sphere and keeps the size of `text-size` on
// the sphere at its anchor (MapLibre's `getPitchedTextCorrection`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import * as globe from '../../src/globe.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const id = {z: 0, x: 0, y: 0, w: 0, key: '0/0/0'};

/** The placed label of a point at `lat` on a view of 512 pixels at zoom 1 that looks at 0°, 0°. */
function place(lat: number, pitchAlignment = 'map'): any {
    const layer = compileLayer({id: 't', type: 'symbol', source: 'g', layout: {
        'text-field': 'TEST', 'text-size': 16, 'text-rotation-alignment': 'map', 'text-pitch-alignment': pitchAlignment}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, lat]}} as any), 0, 0, 0);
    const labels = buildTile(data, 0, [layer], false).labels;
    const tr = new Transform();
    tr.width = 512; tr.height = 512;
    tr.globe = globe; tr.globeStops = [0, 1];
    tr.set([0, 0], 1, 0, 0);
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid())[0];
}

test('point text that is aligned with the map lies on the sphere of the globe without pitch', () => {
    const mid = place(0), high = place(60);
    assert.ok(mid?.frame && high?.frame, 'the text has a frame on the ground');
    // [a, b, c, d]: one pixel of text along x, then along y, on the screen.
    const [a, , , d] = mid.frame, [ha, , , hd] = high.frame;
    assert.ok(Math.abs(a - 1) < 0.05 && Math.abs(d - 1) < 0.05, `at the center the text has its size: ${mid.frame}`);
    // At 60° N the sphere is seen at a slant: y is foreshortened, and x keeps the size of the text on the sphere (less
    // the perspective of a point that is farther from the camera). A step in the tile there is half as long on the sphere.
    assert.ok(ha > 0.85 && ha < 1, `x keeps its size at 60° N: ${high.frame}`);
    assert.ok(hd < 0.75, `y is foreshortened at 60° N: ${high.frame}`);
    assert.ok(!place(60, 'viewport')?.frame, 'text aligned with the viewport stays flat on the screen');
});
