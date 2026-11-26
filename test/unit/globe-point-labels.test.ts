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

/** The placed icon (20 pixels, no text) of a point at `lat`, as in `place` (#2174). */
function placeIcon(lat: number, pitchAlignment = 'map'): any {
    const layer = compileLayer({id: 'i', type: 'symbol', source: 'g', layout: {
        'icon-image': 'a', 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': pitchAlignment}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, lat]}} as any), 0, 0, 0);
    const labels = buildTile(data, 0, [layer], false).labels;
    const tr = new Transform();
    tr.width = 512; tr.height = 512;
    tr.globe = globe; tr.globeStops = [0, 1];
    tr.set([0, 0], 1, 0, 0);
    const icons = () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any);
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), icons)[0];
}

test('an icon that is aligned with the map lies on the sphere of the globe without pitch (#2174)', () => {
    const mid = placeIcon(0)?.icon, high = placeIcon(60)?.icon;
    assert.ok(mid?.frame && high?.frame, 'the icon has a frame on the ground');
    const [a, , , d] = mid.frame, [ha, , , hd] = high.frame;
    assert.ok(Math.abs(a - 1) < 0.05 && Math.abs(d - 1) < 0.05, `at the center the icon has its size: ${mid.frame}`);
    assert.ok(ha > 0.85 && ha < 1 && hd < 0.75, `y is foreshortened at 60° N: ${high.frame}`);
    assert.ok(!placeIcon(60, 'viewport')?.icon?.frame, 'an icon aligned with the viewport stays flat on the screen');
});

test('on the globe without pitch, an icon without text on the ground has the collision box of Mercator', () => {
    // As in MapLibre GL JS, `text-pitch-alignment` decides whether the box lies on the ground. Two icons 32 pixels apart
    // on a map turned by 30°: their boxes (24 pixels with the padding) turned by the bearing would overlap.
    const layer = compileLayer({id: 'i', type: 'symbol', source: 'g', layout: {
        'icon-image': 'a', 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map'}})!;
    const points = [-5.625, 5.625].map(lng => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, 0]}}));
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: points} as any), 0, 0, 0);
    const labels = buildTile(data, 0, [layer], false).labels;
    const icons = () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any);
    const shown = (onGlobe: boolean) => {
        const tr = new Transform();
        tr.width = 512; tr.height = 512;
        if (onGlobe) { tr.globe = globe; tr.globeStops = [0, 1]; }
        tr.set([0, 0], 1, 30, 0);
        return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), icons).filter((p: any) => p.icon).length;
    };
    assert.equal(shown(false), 2, 'Mercator shows both icons');
    assert.equal(shown(true), 2, 'the globe shows both icons');
});

test('on the globe each corner of an icon on the ground goes through the sphere at its own place (#2194)', () => {
    // A 40-pixel icon at 45° N, 60° E on a globe at zoom 2 that looks at 0°, 0°: off the center the icon is a trapezoid.
    // The corners are taken as the renderer draws them (the center of the icon, the first order of its frame and the
    // second order, see `iconQuads` in gl.ts), and each must be where the sphere has its point, as in MapLibre GL JS.
    // `shift` is the center of the icon from its anchor, in pixels of the icon.
    const corners = (extra: object, shift: number[]) => {
        const layer = compileLayer({id: 'i', type: 'symbol', source: 'g', layout: {
            'icon-image': 'a', 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', ...extra}})!;
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [60, 45]}} as any), 0, 0, 0);
        const labels = buildTile(data, 0, [layer], false).labels;
        const tr = new Transform();
        tr.width = 512; tr.height = 512;
        tr.globe = globe; tr.globeStops = [0, 1];
        tr.set([0, 0], 2, 0, 0);
        const items = renderItems(tr, [id], () => ({labels})), it = items[0] as any;
        const icons = () => ({x: 0, y: 0, width: 40, height: 40, pixelRatio: 1} as any);
        const p = (placeLabels as any)(tr, items, [layer], new EstimateShaper(), new CollisionGrid(), icons)[0];
        const f: number[] = p.icon.frame, l = p.src;
        assert.equal(f.length, 10, 'the frame has a second order on the globe');
        // A pixel of the icon is this many tile units at the anchor (MapLibre GL JS's `getPitchedTextCorrection`).
        const g = Math.cosh(Math.PI * (1 - 2 * l.y / 4096)) * Math.cos(tr.lat * Math.PI / 180), unit = g / it.scale;
        return [[-20, -20], [20, -20], [-20, 20], [20, 20]].map(([u, v]) => {
            const [sx, sy] = tr.projectTile(it.id, l.x + (shift[0] + u) * unit, l.y + (shift[1] + v) * unit);
            const qx = p.icon.x + u * f[0] + v * f[2] + f[4] * u * u + f[6] * u * v + f[8] * v * v, qy = p.icon.y + u * f[1] + v * f[3] + f[5] * u * u + f[7] * u * v + f[9] * v * v;
            return Math.hypot(qx - sx, qy - sy);
        });
    };
    const centered = corners({}, [0, 0]), shifted = corners({'icon-anchor': 'bottom', 'icon-offset': [30, 0]}, [30, -20]);
    assert.ok(centered.every(d => d < 0.3), `the corners of a centered icon are off by ${centered.map(d => d.toFixed(2))} pixels`);
    // (The frame of an icon away from its anchor is the one at its center: with the frame of the anchor its corners were off by up to 4 pixels.)
    assert.ok(shifted.every(d => d < 1), `the corners of an icon away from its anchor are off by ${shifted.map(d => d.toFixed(2))} pixels`);
});
