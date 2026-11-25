import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance} from '../../src/within.ts';

const tile: [number, number, number] = [10, 512, 340];
const lngLat = (x: number, y: number) => {
    const mx = (x / 8192 + tile[1]) / 1024, my = (y / 8192 + tile[2]) / 1024;
    return [mx * 360 - 180, 360 / Math.PI * Math.atan(Math.exp((180 - my * 360) * Math.PI / 180)) - 90];
};
const feature = (type: number, coords: number[], ends: number[]) =>
    ({type, properties: {}, geometry(_e: number, c: number[], e: number[]) { c.push(...coords); e.push(...ends); return 1; }}) as any;

test('distance: the lines of a multi-line feature are not joined', () => {
    // Two short lines at the left and the right edge of the tile, and a point between them.
    const two = feature(2, [0, 0, 0, 100, 8000, 100, 8000, 0], [2, 4]);
    const left = feature(2, [0, 0, 0, 100], [2]);
    const point = {type: 'Point', coordinates: lngLat(4000, 100)};
    assert.ok(Math.abs(distance(point, two, tile) - distance(point, left, tile)) < 1e-6 * distance(point, left, tile));
});

test('distance: a line of 100,000 vertices against a polygon gives the nearest distance', () => {
    const n = 100_000, coordinates = Array.from({length: n}, (_, i) => lngLat(20000 + i * 0.5, 4000 + (i % 2) * 50));
    const square = feature(3, [1000, 1000, 2000, 1000, 2000, 2000, 1000, 2000, 1000, 1000], [5]);
    const near = distance({type: 'LineString', coordinates}, square, tile);
    const first = distance({type: 'LineString', coordinates: coordinates.slice(0, 2)}, square, tile);
    assert.ok(Math.abs(near - first) < 1e-6 * first);
});
