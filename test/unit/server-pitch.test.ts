// The server render draws the pitch of the view with the projection of the map, so that the live map takes over without a jump (#395).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG, firstViewOptions} from '../../src/server.ts';
import {Transform, mercX, mercY} from '../../src/geo.ts';

const fc = (geometry: object) => ({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry}]});
const corners = [[-0.004, -0.002], [0.004, -0.002], [0.004, 0.002], [-0.004, 0.002]];
const dots = [[0.002, 0.001], [-0.003, -0.0015]];
const style = {
    version: 8,
    sources: {
        square: {type: 'geojson', data: fc({type: 'Polygon', coordinates: [[...corners, corners[0]]]})},
        dots: {type: 'geojson', data: {type: 'FeatureCollection', features: dots.map(c => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}))}},
        // A line from far ahead of the view to far behind the camera, which the near plane cuts.
        road: {type: 'geojson', data: fc({type: 'LineString', coordinates: [[0.001, 2], [0.001, -2]]})},
    },
    layers: [
        {id: 'fill', type: 'fill', source: 'square', paint: {'fill-color': '#f00'}},
        {id: 'road', type: 'line', source: 'road', paint: {'line-color': '#00f', 'line-width': 2}},
        {id: 'dots', type: 'circle', source: 'dots', paint: {'circle-radius': 5, 'circle-color': '#0f0'}},
    ],
};
const view = {center: [0, 0] as [number, number], zoom: 13.9, bearing: 20, pitch: 60, width: 400, height: 300};
const fetch = async (url: any): Promise<Response> => { throw new Error(`no request expected: ${url}`); };
const tr = new Transform();
tr.width = view.width; tr.height = view.height; tr.set(view.center, view.zoom, view.bearing, view.pitch);

/** The points of each path of the SVG (absolute `M`, then relative `h`, `v` and `l`) in pixels, with the scale of its group. */
function points(d: string, scale: number): number[][][] {
    const rings: number[][][] = [];
    let x = 0, y = 0;
    for (const [, c, a] of d.matchAll(/([Mhvlz])([^Mhvlz]*)/g)) {
        const n = a.trim().split(/[ ,]+/).filter(Boolean).map(Number);
        if (c === 'z') continue;
        if (c === 'M') { [x, y] = n; rings.push([[x * scale, y * scale]]); continue; }
        if (c === 'h') x += n[0]; else if (c === 'v') y += n[0]; else { x += n[0]; y += n[1]; }
        rings.at(-1)!.push([x * scale, y * scale]);
    }
    return rings;
}

const distance = ([ax, ay]: number[], [bx, by]: number[], [px, py]: number[]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};

test('renderToSVG draws a fill and circles of a tilted view where the map draws them (#395)', async () => {
    const {svg} = await renderToSVG({style, ...view, fetch});
    // (The square lies on four tiles: a corner is in one of them.)
    const ring = [...svg.matchAll(/<g transform="matrix\(([^)]*)\)"[^>]*><path fill="#ff0000" d="([^"]*)"/g)].flatMap(m => points(m[2], +m[1].split(' ')[0]).flat());
    assert.ok(ring.length, 'the fill is drawn');
    for (const [lng, lat] of corners) {
        const [px, py] = tr.project(lng, lat);
        assert.ok(ring.some(([x, y]) => Math.hypot(x - px, y - py) < 1), `a corner of the fill is at ${px.toFixed(1)}, ${py.toFixed(1)}: ${JSON.stringify(ring)}`);
    }
    const circles = [...svg.matchAll(/<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)"/g)].map(m => m.slice(1).map(Number));
    assert.equal(circles.length, 2);
    for (const [lng, lat] of dots) {
        const [px, py] = tr.project(lng, lat);
        const near = circles.find(([x, y]) => Math.hypot(x - px, y - py) < 0.5);
        assert.ok(near, `a circle is at ${px.toFixed(1)}, ${py.toFixed(1)}: ${JSON.stringify(circles)}`);
        // circle-pitch-scale "map" (the default): larger nearer the camera, by the camera distance over the depth.
        assert.ok(Math.abs(near[2] - 5 * tr.perspectiveAt(mercX(lng), mercY(lat))) < 0.05, `the radius ${near[2]}`);
    }
});

test('renderToSVG cuts a line of a tilted view at the near plane, and draws the part in view where the map draws it (#395)', async () => {
    const {svg} = await renderToSVG({style, ...view, fetch});
    const layer = svg.slice(svg.indexOf('<g data-layer="road">'), svg.indexOf('<g data-layer="dots">'));
    // (The groups of the tiles have the scale 0.5, and a path that two tiles draw is in <defs>.)
    assert.match(layer, /^<g data-layer="road"><g transform="matrix\(0\.5 0 0 0\.5 0 0\)"/);
    const shared = (id: string) => new RegExp(`<path id="${id}"[^>]* d="([^"]*)"`).exec(svg)![1];
    const all = [...layer.matchAll(/<path [^>]*d="([^"]*)"|<use href="#(\w+)"/g)].flatMap(m => points(m[1] ?? shared(m[2]), 0.5));
    assert.ok(all.length, 'the line is drawn');
    // The near plane is at a tenth of the camera distance, which is 9 times the camera distance times cot(pitch) below the center
    // of the screen. Without the cut, the line reaches behind the camera, where it is drawn above the horizon.
    // The ground ends at the horizon, which is the camera distance times cot(pitch) above the center of the screen.
    const cot = 1 / Math.tan(view.pitch * Math.PI / 180), bottom = tr.height / 2 + 9 * tr.cameraDistance * cot + 1, horizon = tr.height / 2 - tr.cameraDistance * cot;
    for (const [x, y] of all.flat()) assert.ok(Math.abs(x) < 20 * view.height && y > horizon && y < bottom, `a point of the line at ${x}, ${y}`);
    assert.ok(all.flat().some(([, y]) => y > bottom - 2), 'the line reaches the near plane');
    // The point of the line at the latitude of the center of the view is on the drawn line.
    const [cx, cy] = tr.project(0.001, 0);
    assert.ok(all.some(line => line.some((p, i) => i && distance(line[i - 1], p, [cx, cy]) < 1)), `the line goes through ${cx}, ${cy}`);
});

test('renderToSVG draws a raster tile of a tilted view in cells that meet where the map draws the corners of the tile (#395)', async () => {
    const raster = {version: 8, sources: {r: {type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'], tileSize: 512}}, layers: [{id: 'r', type: 'raster', source: 'r'}]};
    const at = {center: [10, 5] as [number, number], zoom: 2.5, bearing: 20, pitch: 50, width: 400, height: 300};
    const {svg} = await renderToSVG({style: raster, ...at, fetch});
    // Each tile is one image in <defs>, which its cells use.
    const images = [...svg.matchAll(/<image id="(r\d+)" href="https:\/\/example\.com\/\d+\/\d+\/\d+\.png"/g)].map(m => m[1]);
    const cells = [...svg.matchAll(/<g transform="matrix\(([^)]*)\)"><svg viewBox="([^"]*)"[^>]*><use href="#(r\d+)"\/><\/svg><\/g>/g)];
    assert.ok(images.length >= 4 && cells.length > images.length * 8, `${images.length} images, ${cells.length} cells`);
    assert.ok(cells.every(m => images.includes(m[3])));
    // The corner of the tiles at 0, 0 is the corner of a cell.
    const view = new Transform();
    view.width = at.width; view.height = at.height; view.set(at.center, at.zoom, at.bearing, at.pitch);
    const [px, py] = view.project(0, 0);
    const starts = cells.map(m => { const [a, b, c, d, e, f] = m[1].split(' ').map(Number), [x, y] = m[2].split(' ').map(Number); return [a * x + c * y + e, b * x + d * y + f]; });
    assert.ok(starts.some(([x, y]) => Math.hypot(x - px, y - py) < 0.5), `a cell starts at ${px}, ${py}`);
});

test('renderToSVG draws each glyph of text along a line of a tilted view in its frame on the ground (#395)', async () => {
    const named = {...style, layers: [{id: 'name', type: 'symbol', source: 'road', layout: {'symbol-placement': 'line', 'text-field': 'Main Street', 'text-size': 14}}]};
    const {svg} = await renderToSVG({style: named, ...view, fetch});
    const glyphs = [...svg.matchAll(/<text transform="matrix\(([^)]*)\)">([^<]*)<\/text>/g)];
    assert.ok(glyphs.length >= 'MainStreet'.length, svg.slice(svg.indexOf('<g font-family')));
    // The perspective of the ground stretches or skews each glyph, so its frame is not a rotation (as `rotate` of SVG text would be).
    for (const [, m] of glyphs) {
        const [a, b, c, d] = m.split(' ').map(Number), along = Math.hypot(a, b), across = Math.hypot(c, d);
        assert.ok(Math.abs(along - across) > 0.05 * across || Math.abs(a * c + b * d) > 0.05 * along * across, m);
    }
});

test('firstViewOptions passes the pitch of the description to the render (#2513)', () => {
    assert.equal(firstViewOptions({style, initialView: {center: [0, 0], zoom: 1, pitch: 30}} as any).pitch, 30);
});
