// A dashed line with a square cap has butt dashes in the SVG of the server renderer, as in MapLibre GL JS (#2175).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const svg = async (cap: string, dash?: number[]) => (await renderToSVG({center: [0, 0], zoom: 1, width: 600, height: 200, style: {version: 8,
    sources: {l: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-90, 0], [90, 0]]}}}},
    layers: [{id: 'l', type: 'line', source: 'l', layout: {'line-cap': cap}, paint: {'line-color': '#000', 'line-width': 6, ...(dash ? {'line-dasharray': dash} : {})}}]}})).svg;

test('a dashed line with a square cap has no square cap on its dashes', async () => {
    const dashed = await svg('square', [2, 2]);
    assert.match(dashed, /stroke-dasharray="12 12"/);
    assert.doesNotMatch(dashed, /stroke-linecap/);
});

test('a dashed line with a square cap reaches half the width past its start (#2177)', async () => {
    const out = await svg('square', [2, 2]);
    const dashed = out.match(/<path [^>]*stroke-dasharray="12 12"[^>]*d="M([-\d.]+) ([-\d.]+)h(-?\d+)"/);
    assert.ok(dashed, out);
    const x = +dashed[1];
    // The extensions are solid segments (no dash pattern) of half the width, 3 pixels, at the ends of the line.
    const solid = [...out.matchAll(/<path [^>]*stroke-width="6"(?![^>]*stroke-dasharray)[^>]*d="([^"]+)"/g)].map(m => m[1])[0];
    assert.ok(solid, 'no extension of the ends: ' + out);
    const ext = [...solid.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)];
    assert.ok(ext.length === 2, solid);
    assert.equal(+ext[0][3], x);
    assert.ok(+ext[0][1] < x);
});

test('a dashed line with a butt cap has no extension', async () => {
    assert.doesNotMatch(await svg('butt', [2, 2]), /L[-\d.]+ [-\d.]+"/);
});

test('a solid line with a square cap and a dashed line with a round cap keep their cap', async () => {
    assert.match(await svg('square'), /stroke-linecap="square"/);
    assert.match(await svg('round', [2, 2]), /stroke-linecap="round"/);
});
