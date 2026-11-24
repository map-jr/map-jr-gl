// Anchors along a line of an over-zoomed tile (#1094): MapLibre GL JS cuts a tile of the deepest level of the source into
// tiles of a deeper zoom (4 below the `maxZoom` of the map), and each of them places its anchors from its own edges.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineLabels} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

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
