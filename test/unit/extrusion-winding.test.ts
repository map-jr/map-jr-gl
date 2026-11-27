// The renderer draws only the front faces of a fill-extrusion, as MapLibre GL JS does (`CullFaceMode.backCCW`): the
// inside of a wall is not drawn, so on 3D terrain it does not show below the ground (#2341). A face is front or back
// by the winding of its triangle, so the roof and the outside of every wall must wind the same way, whichever way
// the ring of the polygon runs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tessellate} from '../../src/tile.ts';

/** A square of 100 units with a hole of 40 units in its middle; `flip` runs both rings the other way. */
const square = (flip: boolean) => {
    const ring = (a: number, b: number, hole: boolean) => { const r = [[a, a], [b, a], [b, b], [a, b]]; return hole !== flip ? r.reverse() : r; };
    const coords = [...ring(0, 100, false), ...ring(30, 70, true)].flat();
    return {coords: Int16Array.from(coords), ringEnds: Uint32Array.from([4, 8]), featEnds: Uint32Array.from([1])};
};

for (const flip of [false, true]) {
    test(`fill-extrusion: the roof and the outside of each wall wind the same way (${flip ? 'rings reversed' : 'rings as in a vector tile'})`, () => {
        const b = tessellate({type: 'fill', geom: square(flip), height: Float32Array.from([30]), base: Float32Array.from([0])}) as any;
        const p = (i: number) => [b.v[i * 4], b.v[i * 4 + 1], b.v[i * 4 + 2]];
        const signs = new Set<number>();
        for (let t = 0; t < b.idx.length; t += 3) {
            const [a, c, d] = [0, 1, 2].map(k => p(b.idx[t + k]));
            const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
            const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
            const mx = (a[0] + c[0] + d[0]) / 3, my = (a[1] + c[1] + d[1]) / 3;
            // The outside: up for the roof, away from the middle for an outer wall and toward it for a wall of the hole.
            const roof = a[2] === c[2] && c[2] === d[2], hole = Math.abs(mx - 50) <= 20 && Math.abs(my - 50) <= 20;
            const out = roof ? [0, 0, 1] : [(mx - 50) * (hole ? -1 : 1), (my - 50) * (hole ? -1 : 1), 0];
            signs.add(Math.sign(n[0] * out[0] + n[1] * out[1] + n[2] * out[2]));
        }
        assert.deepEqual([...signs], [[...signs][0]]);
        assert.notEqual([...signs][0], 0);
    });
}
