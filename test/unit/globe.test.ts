// The globe projection (#463, src/globe.ts): it agrees with Mercator near the centre, goes back and forth between the
// screen and the sphere, hides the far side, picks the tiles in view, and turns into Mercator between zoom 11 and 12.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, globeStops, globenessAt, mercX, mercY} from '../../src/geo.ts';
import * as globe from '../../src/globe.ts';

const make = (center: [number, number], zoom: number, bearing = 0, pitch = 0, stops: number[] | null = [0, 1]) => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.globe = globe; tr.globeStops = stops;
    tr.set(center, zoom, bearing, pitch);
    return tr;
};

test('globe: the projection names give their stops, and the globe turns into Mercator between zoom 11 and 12', () => {
    assert.deepEqual(globeStops('globe'), [11, 1, 12, 0]);
    assert.deepEqual(globeStops('vertical-perspective'), [0, 1]);
    assert.equal(globeStops('mercator'), null);
    assert.equal(globeStops('identity'), null);
    assert.deepEqual(globeStops(['interpolate', ['linear'], ['zoom'], 5, 'vertical-perspective', 8, 'mercator']), [5, 1, 8, 0]);
    assert.deepEqual([3, 11, 11.25, 11.5, 12, 15].map(z => globenessAt([11, 1, 12, 0], z)), [1, 1, 0.75, 0.5, 0, 0]);
    // A transform without globe.ts draws Mercator, also with the stops of a globe.
    const tr = new Transform();
    tr.globeStops = [11, 1, 12, 0];
    assert.equal(tr.globeness, 0);
});

test('globe: near the centre the globe and Mercator agree, with bearing, pitch and padding', () => {
    for (const [bearing, pitch, pad] of [[0, 0, 0], [30, 45, 0], [-70, 60, 80]]) {
        const tr = make([10, 45], 10, bearing, pitch);
        tr.padding = [pad, 0, 0, pad];
        const near = [[10.05, 45.02], [9.97, 44.98], [10, 45]] as const;
        for (const [lng, lat] of near) {
            const g = tr.project(lng, lat);
            tr.globe = undefined;
            const m = tr.project(lng, lat);
            tr.globe = globe;
            assert.ok(Math.hypot(g[0] - m[0], g[1] - m[1]) < 0.1, `${bearing}/${pitch}/${pad}: ${g} against ${m}`);
        }
    }
});

test('globe: unproject inverts project, and a point off the globe gives a point of the horizon', () => {
    const tr = make([-40, 20], 2.5, 25, 30);
    for (const [px, py] of [[400, 300], [123, 456], [600, 200]]) {
        const [mx, my] = tr.screenToMerc(px, py), [x, y] = tr.mercToScreen(mx, my);
        assert.ok(Math.hypot(x - px, y - py) < 1e-6, `${px},${py}`);
    }
    // (At zoom 0 the globe is about 163 pixels across: the corner of the screen is off the globe.)
    const small = make([0, 0], 0);
    const [mx, my] = small.screenToMerc(0, 0), [x, y] = small.mercToScreen(mx, my);
    assert.ok(Math.hypot(x - 400, y - 300) < 100, 'the point is on the edge of the globe, toward the corner');
    assert.ok(!globe.hidden(small, mx, my, 1e-6));
});

test('globe: the far side is hidden, and the tiles in view are chosen, also over a pole', () => {
    const tr = make([0, 0], 1);
    assert.equal(globe.hidden(tr, mercX(180), mercY(0)), true);
    assert.equal(globe.hidden(tr, mercX(30), mercY(10)), false);
    assert.deepEqual(tr.coveringTiles(0, 22, 512).map(t => t.key).sort(), ['1/0/0', '1/0/1', '1/1/0', '1/1/1']);
    // Zoomed in, the tile under the centre is that of Mercator.
    const close = make([-118.12, 36.6], 4.5);
    close.width = close.height = 256;
    assert.deepEqual(close.coveringTiles(0, 22, 512, true).map(t => t.key), ['5/5/12']);
    // Over the north pole, the tiles of the top row of the zoom are all there (they meet at the pole).
    const pole = make([0, 84], 2);
    const top = pole.coveringTiles(0, 22, 512).filter(t => t.y === 0 && t.z === 2);
    assert.equal(top.length, 4);
    // Each tile has w 0: a globe has one world.
    assert.ok(pole.coveringTiles(0, 22, 512).every(t => t.w === 0));
});

test('globe: a drag turns the globe so that the place stays under the pointer, and keeps the size of the planet', () => {
    const tr = make([0, 0], 2);
    const [lng, lat] = tr.unproject(500, 350);
    tr.setLocationAt(lng, lat, 450, 250);
    const [x, y] = tr.project(lng, lat);
    assert.ok(Math.hypot(x - 450, y - 250) < 0.5, `${x},${y}`);
    // The zoom changed with the latitude so that the radius of the globe in pixels is the same.
    const before = make([0, 0], 2), after = tr;
    assert.ok(Math.abs(globe.frame(before).radius - globe.frame(after).radius) < 1e-6);
    // A globe can be smaller than the view: the zoom is not raised to fill it, and a latitude is kept.
    const small = make([10, 70], -1);
    assert.deepEqual([small.zoom, small.lat], [-1, 70]);
});

test('globe: between zoom 11 and 12 the position mixes the two projections, and from 12 the map is Mercator', () => {
    const at = (zoom: number) => {
        const tr = make([10, 45], zoom, 0, 0, [11, 1, 12, 0]);
        const lng = 10 + 0.5 / 2 ** (zoom - 11), lat = 45;
        const g = tr.project(lng, lat);
        tr.globe = undefined;
        const m = tr.project(lng, lat);
        return Math.hypot(g[0] - m[0], g[1] - m[1]);
    };
    assert.ok(at(10.5) > 0.5, 'a globe at zoom 10.5 bends a point 300 px away');
    assert.ok(at(11.5) < at(10.5) && at(11.5) > 0);
    assert.equal(at(12), 0);
});
