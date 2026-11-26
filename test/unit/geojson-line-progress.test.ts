// `line-progress` of a GeoJSON line is measured along the full line, as geojson-vt does, and not along the
// simplified points of each tile (#1890).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource, sliceGeoJSON} from '../../src/geojson.ts';
import {mercX, mercY} from '../../src/geo.ts';

// 10,000 vertices that zigzag by 0.002 degrees from -20° to -2°, then a straight part to a corner at 5° and on north.
// Simplification removes the zigzag at low zoom levels and keeps it at high ones.
const coordinates = [...Array.from({length: 10000}, (_, i) => [-20 + i * 0.0018, 0.5 + (i % 2 ? 0.002 : 0)]), [5, 0.5], [5, 5]];
const corner = coordinates.length - 2;

test('GeoJSON line-progress: a kept vertex has the progress along the full line at every zoom', () => {
    const s = prepareSource({type: 'LineString', coordinates}, {}, 18);
    const along: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) along.push(along[i - 1] + Math.hypot(mercX(coordinates[i][0]) - mercX(coordinates[i - 1][0]), mercY(coordinates[i][1]) - mercY(coordinates[i - 1][1])));
    const expected = along[corner] / along[along.length - 1];
    for (const z of [5, 8, 11, 14]) {
        const n = 2 ** z, x = Math.floor(mercX(5) * n), y = Math.floor(mercY(0.5) * n);
        const cx = Math.round((mercX(5) * n - x) * 8192) / 2, cy = Math.round((mercY(0.5) * n - y) * 8192) / 2; // (a line keeps halves of a tile unit)
        let progress: number | undefined;
        for (const f of Object.values(sliceGeoJSON(s, z, x, y, true))[0].features) {
            const c: number[] = [];
            f.geometry(4096, c, []);
            // The progress at a vertex, as the line bucket of MapLibre GL JS computes it from the range of the piece.
            let d = 0, at = -1;
            for (let i = 0; i < c.length; i += 2) {
                if (i) d += Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1]);
                if (c[i] === cx && c[i + 1] === cy) at = d;
            }
            if (at >= 0) progress = f.properties.mapbox_clip_start + (f.properties.mapbox_clip_end - f.properties.mapbox_clip_start) * at / d;
        }
        assert.ok(progress !== undefined && Math.abs(progress - expected) < 1e-4, `z${z}: ${progress}, expected ${expected}`);
    }
});
