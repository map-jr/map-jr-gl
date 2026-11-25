// Anchors along a line of an over-zoomed tile (#1094): MapLibre GL JS cuts a tile of the deepest level of the source into
// tiles of a deeper zoom (4 below the `maxZoom` of the map), and each of them places its anchors from its own edges.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineLabels} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('a line of a z14 tile shown at z22 has its anchors in the rhythm of the z18 squares, as in MapLibre GL JS', () => {
    const spacing = 350 * 4096 / 512 / 256;
    // A straight line across the tile, from its west edge. At z22 the tile is cut into 16 squares a side of 256 units.
    const label: any = {text: '', line: [0, 100, 4096, 100], lineSpacing: spacing, tpr: 4096 / 512 / 256, ov: 256, tz: 14, window: 0, maxAngle: 45, size0: 10, size1: 10};
    const xs = lineLabels([label], new EstimateShaper() as any, undefined, 22).map(l => l.x).filter(x => x >= 256 && x < 512);
    assert.ok(xs.length > 10, `anchors in the second square: ${xs.length}`);
    for (const x of xs) {
        const n = (x - 256) / spacing;
        assert.ok(Math.abs(n - Math.round(n)) < 1e-6, `the anchor at ${x} is not a whole number of spacings from the edge of the square`);
    }
});

test('the path of text along a gentle slope in a z14 tile shown at z22 keeps the slope, as in MapLibre GL JS', () => {
    // The line falls by 1 unit over 1000: at z22 a unit is 16 pixels. Rounding the path to whole units made the text flat,
    // with a step where the rounding changed. (The ends of the part in a square and the path are each rounded to 1 / 16.)
    const spacing = 350 * 4096 / 512 / 256;
    const label: any = {text: 'Luhova Street', font: 'Noto Sans Regular', spacing: 0, lineHeight: 1.2, line: [0, 2000, 4096, 2004.096], lineSpacing: spacing, tpr: 4096 / 512 / 256, ov: 256, tz: 14, window: 30, maxAngle: 45, size0: 16, size1: 16};
    const out = lineLabels([label], new EstimateShaper() as any, undefined, 22, () => [8 * 16 + 7]);
    assert.ok(out.length > 0);
    for (const l of out) {
        const p = l.path!;
        for (let i = 0; i < p.length; i += 2) {
            const want = 2000 + p[i] / 1000;
            assert.ok(Math.abs(p[i + 1] - want) <= 1 / 16 + 1e-9, `the point ${p[i]}, ${p[i + 1]} of the path is off the line (${want})`);
        }
    }
});

test('the path of line-center text along a gentle slope in a z14 tile shown at z22 keeps the slope and passes through the anchor', () => {
    // As above, for the anchor that the tile finds itself (`symbol-placement: line-center`). Rounding the path to whole
    // units put the anchor of the path up to half a unit (8 pixels at z22) from the label, and made the slope flat.
    const z = 14, tx = 8000, ty = 5000, n = 2 ** z;
    const lngOf = (x: number) => x / n * 360 - 180, latOf = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const ends = [[0.01, 0.5], [0.99, 0.5007]], geometry = {type: 'LineString', coordinates: ends.map(([x, y]) => [lngOf(tx + x), latOf(ty + y)])};
    const layer = compileLayer({id: 'c', type: 'symbol', source: 'g', layout: {'symbol-placement': 'line-center', 'text-field': 'Luhova Street', 'text-size': 16}} as any)!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty);
    const [l] = buildTile(data, z, [layer], 22).labels.c as any[];
    const p = l.path as number[], i = l.pathIndex as number, slope = (p[p.length - 1] - p[1]) / (p[p.length - 2] - p[0]);
    assert.ok(Math.hypot(p[i * 2] - l.x, p[i * 2 + 1] - l.y) <= 1 / 16, `the anchor of the path ${p[i * 2]}, ${p[i * 2 + 1]} is not at the label ${l.x}, ${l.y}`);
    for (let j = 0; j < p.length; j += 2) {
        const want = l.y + (p[j] - l.x) * slope;
        assert.ok(Math.abs(p[j + 1] - want) <= 1 / 16, `the point ${p[j]}, ${p[j + 1]} of the path is off the line (${want})`);
    }
});

test('a line of a z0 tile shown at z22 has anchors only in the squares in view, and is laid out quickly', () => {
    // At z22 a z0 tile is cut into 2^18 squares a side. Only the 3 by 3 squares in view are laid out.
    const ov = 2 ** 22, line: number[] = [];
    for (let i = 0; i <= 200; i++) line.push(i * 20, (i % 2) * 4000 + 50);
    const label: any = {text: 'Road', line, lineSpacing: 350 * 8 / ov, tpr: 8 / ov, ov, tz: 0, window: 0, maxAngle: 45, size0: 10, size1: 10};
    let asked = 0;
    const view = (k: number) => {
        asked = k;
        const x = Math.floor(1010 / 4096 * k), y = Math.floor(2050 / 4096 * k), out: number[] = [];
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push((x + i) * k + y + j);
        return out;
    };
    const t = performance.now(), out = lineLabels([label], new EstimateShaper() as any, undefined, 22, view), ms = performance.now() - t;
    assert.equal(asked, 2 ** 18);
    assert.ok(out.length > 0);
    const size = 4096 / asked;
    for (const l of out) assert.ok(Math.abs(l.x - 1010) < 2 * size && Math.abs(l.y - 2050) < 2 * size, `an anchor out of view at ${l.x}, ${l.y}`);
    // (About 10 ms; it took 3.5 s when every square that the line crosses was laid out.)
    assert.ok(ms < 500, `${ms.toFixed(0)} ms`);
});
