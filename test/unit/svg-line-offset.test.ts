// The server renderer moves a line by `line-offset` to the right of its direction, as the map does (#1887).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const svg = async (offset: unknown) => (await renderToSVG({center: [0, 0], zoom: 1, width: 600, height: 200, style: {version: 8,
    sources: {l: {type: 'geojson', data: {type: 'FeatureCollection', features: [
        {type: 'Feature', properties: {o: 20}, geometry: {type: 'LineString', coordinates: [[-90, 0], [90, 0]]}},
        {type: 'Feature', properties: {o: -20}, geometry: {type: 'LineString', coordinates: [[-90, 30], [90, 30]]}}]}}},
    layers: [{id: 'l', type: 'line', source: 'l', paint: {'line-color': '#000', 'line-width': 2, ...(offset === undefined ? {} : {'line-offset': offset})}}]}})).svg;
/** The screen y of the start of each path. */
const ys = (out: string) => {
    const m = out.match(/matrix\(([^)]+)\)/)!, t = m[1].split(' ').map(Number);
    return [...out.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map(p => +p[2] * t[3] + t[5]);
};

test('a constant line-offset moves a line to the right of its direction by that many pixels', async () => {
    const a = ys(await svg(undefined)), b = ys(await svg(10));
    assert.ok(a.length && a.length === b.length);
    for (let i = 0; i < a.length; i++) assert.ok(Math.abs(b[i] - a[i] - 10) < 1, `${a[i]} ${b[i]}`);
});

test('a data-driven line-offset moves each feature by its own value', async () => {
    const a = ys(await svg(undefined)), b = ys(await svg(['get', 'o']));
    const d = b.map((y, i) => y - a[i]).sort((x, y) => x - y);
    // (A line is split over several paths, one for each tile that it crosses.)
    assert.ok(d.length >= 2 && d.every(v => Math.abs(Math.abs(v) - 20) < 1), String(d));
    assert.ok(d[0] < 0 && d[d.length - 1] > 0, String(d));
});
