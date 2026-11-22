// Unit test for #1459: the heights of 3D terrain on the CPU (the centre of the camera, queryTerrainElevation) agree with
// the full elevation image, as MapLibre GL JS reads it. The grid took one pixel in four of a tile of 512 pixels, and over
// the Alps the centre at zoom 8 lay 430 m above the height that MapLibre GL JS gives.
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TileBuilder} from '../../src/tiles.ts';
import {groundHeight} from '../../src/geo.ts';

test('the height grid of a 512-pixel elevation tile agrees with the full image within 150 m (#1459)', async () => {
    // A ridged terrain in the terrarium encoding, 900 m to 3100 m, with ridges 16 to 20 pixels apart. (The grid of one
    // pixel in four was up to 418 m off here; a grid of means is about 100 m off, mostly from interpolation between cells.)
    const W = 512, height = (x: number, y: number) => 2000 + 800 * Math.sin(x * 0.4) * Math.cos(y * 0.3) + 300 * Math.sin((x + 2 * y) * 0.15);
    const data = new Uint8Array(W * W * 4);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const v = height(x, y) + 32768, k = (y * W + x) * 4;
        data[k] = Math.floor(v / 256); data[k + 1] = Math.floor(v % 256); data[k + 2] = Math.floor(v % 1 * 256); data[k + 3] = 255;
    }
    const b = new TileBuilder((async () => new Response(new Uint8Array(1))) as typeof fetch);
    b.decodeImage = () => ({width: W, height: W, data});
    const tile = (await b.loadElevation({id: 1, url: 'https://tiles.test/0/0/0.png', encoding: 'terrarium'}))!;
    // The full image read as MapLibre GL JS reads it: bilinear between the centres of the pixels.
    const full = (fx: number, fy: number) => {
        const x = Math.min(Math.max(fx * W - 0.5, 0), W - 1), y = Math.min(Math.max(fy * W - 0.5, 0), W - 1), x0 = Math.floor(x), y0 = Math.floor(y);
        const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(W - 1, y0 + 1), tx = x - x0, ty = y - y0;
        return (height(x0, y0) * (1 - tx) + height(x1, y0) * tx) * (1 - ty) + (height(x0, y1) * (1 - tx) + height(x1, y1) * tx) * ty;
    };
    const grids = new Map([['0/0/0', tile.grid]]);
    let worst = 0;
    for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) {
        const fx = (i + 0.37) / 40, fy = (j + 0.61) / 40, want = full(fx, fy);
        worst = Math.max(worst, Math.abs(groundHeight(grids, fx, fy, 0) - want));
    }
    assert.ok(worst < 150, `the grid is ${worst.toFixed(0)} m off the full image at worst`);
    assert.ok(tile.lo < 1000 && tile.hi > 3000, `lo and hi are those of the full image: ${tile.lo}, ${tile.hi}`);
});
