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
    assert.deepEqual(tr.tileCover(0, 22, 512).map(t => t.key).sort(), ['1/0/0', '1/0/1', '1/1/0', '1/1/1']);
    // Zoomed in, the tile under the centre is that of Mercator.
    const close = make([-118.12, 36.6], 4.5);
    close.width = close.height = 256;
    assert.deepEqual(close.tileCover(0, 22, 512, true).map(t => t.key), ['5/5/12']);
    // Over the north pole, the tiles of the top row of the zoom are all there (they meet at the pole).
    const pole = make([0, 84], 2);
    const top = pole.tileCover(0, 22, 512).filter(t => t.y === 0 && t.z === 2);
    assert.equal(top.length, 4);
    // Each tile has w 0: a globe has one world.
    assert.ok(pole.tileCover(0, 22, 512).every(t => t.w === 0));
});

test('globe: the tile level switches a little below a whole zoom, as in MapLibre GL JS 6.17 (#1828)', () => {
    // The views of MapLibre's render tests projection/globe/fill-seams/checkerboard (zoom 7.92: tiles of zoom 7) and
    // projection/globe/terrain/fill-seams/checkerboard (zoom 7.95: tiles of zoom 8, also north of the center).
    const at = (zoom: number) => { const tr = make([-151.855, 61.59], zoom); tr.width = tr.height = 256; return [...new Set(tr.tileCover(0, 22, 512).map(t => t.z))]; };
    assert.deepEqual(at(7.92), [7]);
    assert.deepEqual(at(7.95), [8]);
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

test('globe: the bounds have the edge of the globe and a pole in view, and unproject gives a longitude in -180..180', () => {
    // The numbers of MapLibre GL JS 6.17 for this view: -180, -46.81, 180, 90 (the north pole is in view).
    const tr = make([10, 30], 1.5, 0, 0, [11, 1, 12, 0]);
    assert.deepEqual(globe.bounds(tr).map(v => +v.toFixed(2)), [-180, -46.81, 180, 90]);
    const [lng, lat] = tr.unproject(400, 20);
    assert.deepEqual([+lng.toFixed(2), +lat.toFixed(2)], [-170, 73.19]);
    // Without a pole in view, the bounds are those of the edges, measured from the centre.
    const close = make([10, 30], 4, 0, 0, [11, 1, 12, 0]), [w, s, e, n] = globe.bounds(close);
    assert.ok(w > -20 && w < 10 && e > 10 && e < 40 && s > 10 && n < 45 && n > 30, `${[w, s, e, n]}`);
});

test('globe: a pan without a pointer (a fling) moves the centre along the latitude, and Mercator is as before', () => {
    const tr = make([10, 45], 3, 0, 0, [11, 1, 12, 0]);
    const [lng, lat] = tr.panned(300, 0);
    assert.ok(lng > 10 && Math.abs(lat - 45) < 1e-9, `${lng},${lat}`);
    const flat = make([10, 45], 13, 30, 0, [11, 1, 12, 0]);
    assert.deepEqual(flat.panned(120, -40), flat.unprojectFlat(flat.cx + 120, flat.cy - 40));
});

test('globe: a drag turns the globe as MapLibre GL JS 6.17 does (numbers measured with MapLibre on the same views)', () => {
    // 16 moves of the pointer, as a mouse sends them: the centre at the end, and MapLibre's centre for the same input.
    // The start is the centre of the view, or (edge) the place 60° east of the centre, near the edge of the globe.
    const run = (center: [number, number], bearing: number, edge: boolean, dx: number, dy: number) => {
        const tr = make(center, 1.5, bearing, 0, [11, 1, 12, 0]);
        const start = edge ? tr.project(center[0] + 60, center[1] > 70 ? 60 : center[1]).map(Math.round) : [400, 300];
        for (let i = 1; i <= 16; i++) {
            const x0 = start[0] + dx * (i - 1) / 16, y0 = start[1] + dy * (i - 1) / 16;
            globe.drag(tr, x0, y0, start[0] + dx * i / 16, start[1] + dy * i / 16);
            tr.constrain();
        }
        return [+tr.lng.toFixed(2), +tr.lat.toFixed(2), tr.zoom];
    };
    const cases: [[number, number], number, boolean, number, number, [number, number]][] = [
        [[10, 0], 0, false, 160, 0, [-39.07, 0]],
        [[10, 0], 45, false, 160, 0, [-27.29, 34.45]],
        [[10, 60], 0, false, 160, 0, [-31.81, 59.58]],
        [[10, 60], 45, false, 0, -160, [-14.47, 44.97]],
        // From near the edge of the globe: the pointer leaves the globe, and the drag goes on as at the centre.
        [[10, 0], 0, true, 160, 0, [-32.72, 0]],
        [[10, 60], 0, true, 160, 0, [-48.29, 53.6]],
        // Near the pole: the dial (MapLibre), and a centre that can pass 85° while the pole area fits in the view.
        [[10, 80], 0, false, 110, 110, [-10.7, 84.71]],
        [[10, 80], 45, false, 110, 110, [10, 86.8]],
    ];
    // Past 85.05° the zoom stays (MapLibre: 0.491 at the end of the last case).
    assert.ok(Math.abs(run([10, 80], 45, false, 110, 110)[2] - 0.491) < 0.005, 'the zoom changes past 85.05°');
    for (const [center, bearing, edge, dx, dy, want] of cases) {
        const got = run(center, bearing, edge, dx, dy);
        assert.ok(Math.abs(got[0] - want[0]) < 0.3 && Math.abs(got[1] - want[1]) < 0.3, `${center} b${bearing} ${edge ? 'edge' : 'centre'} by ${dx},${dy}: ${got} against ${want}`);
    }
});

test('globe: a fling far north turns the longitude at most as fast as at 60° while the globe is small (MapLibre)', () => {
    const tr = make([10, 80], 1.5, 0, 0, [11, 1, 12, 0]);
    const [lng] = tr.panned(100, 0), perPx = 360 * Math.cos(80 * Math.PI / 180) / tr.worldSize;
    assert.ok(Math.abs((lng - 10) - 100 * perPx / Math.cos(60 * Math.PI / 180)) < 1e-9, `${lng}`);
});

test('globe: a new centre without a zoom keeps the size of the globe, and the zoom changes (MapLibre GL JS 6.17: zoom -0.048 at 70°N)', () => {
    const tr = make([10, 0], 1.5, 0, 0, [11, 1, 12, 0]), size = (t: Transform) => t.worldSize / Math.cos(Math.min(Math.abs(t.lat), 85.051129) * Math.PI / 180);
    const before = size(tr);
    tr.set([10, 70]);
    assert.ok(Math.abs(tr.zoom - -0.048) < 0.001, `zoom ${tr.zoom}`);
    assert.ok(Math.abs(size(tr) / before - 1) < 1e-9, 'the globe changed its size');
    // With a zoom, the zoom is that zoom; on a Mercator map a new centre keeps the zoom.
    tr.set([10, 0], 1.5);
    assert.equal(tr.zoom, 1.5);
    const flat = make([10, 0], 1.5, 0, 0, null);
    flat.set([10, 70]);
    assert.equal(flat.zoom, 1.5);
});

test('globe: a drag over the area around a pole turns the globe there, and a centre at the pole projects (MapLibre: 85.89° after this drag)', () => {
    const tr = make([10, 64.42], 0.288, 0, 0, [11, 1, 12, 0]);
    for (let i = 1; i <= 20; i++) { globe.drag(tr, 400, 200 + 4 * (i - 1), 400, 200 + 4 * i); tr.constrain(); }
    assert.ok(Math.abs(tr.lat - 85.89) < 0.1, `lat ${tr.lat}`);
    tr.set([10, 90], -2);
    assert.ok(tr.project(10, 80).every(Number.isFinite), `${tr.project(10, 80)}`);
});

test('globe: the rays of the halo (#888) go through the place of the globe under each pixel', () => {
    const tr = make([30, 20], 2, 20, 30), m = globe.rays(tr), {cam} = globe.frame(tr);
    for (const [x, y] of [[400, 300], [330, 250], [480, 360]]) {
        const d = [0, 1, 2].map(i => m[i] * x + m[3 + i] * y + m[6 + i]), l = Math.hypot(...d), r = d.map(v => v / l);
        const b = r[0] * cam[0] + r[1] * cam[1] + r[2] * cam[2], t = -b - Math.sqrt(b * b - (cam[0] ** 2 + cam[1] ** 2 + cam[2] ** 2 - 1));
        const p = cam.map((v, i) => v + r[i] * t), lng = Math.atan2(p[0], p[2]) * 180 / Math.PI, lat = Math.asin(p[1]) * 180 / Math.PI;
        const [mx, my] = globe.toMerc(tr, x, y);
        assert.ok(Math.abs(mercX(lng) - mx) < 1e-9 && Math.abs(mercY(lat) - my) < 1e-9, `${x},${y}`);
    }
});
