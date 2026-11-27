// renderSVG lets each raster tile reach one pixel past its right and bottom edge, so that tiles at fractional positions leave no lighter line between them (#388).
// test/svg-seams.mjs rasterizes the result in Chromium.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {renderSVG} from '../../src/svg.ts';

test('renderToSVG overlaps neighboring raster tiles by one pixel', () => {
    const tr = new Transform(); tr.width = 600; tr.height = 400; tr.set([0, 0], 2, 0, 0);
    const prop = (v: unknown) => ({dd: false, eval: () => v});
    const layer = {id: 'r', type: 'raster', source: 's', visible: true, minzoom: 0, maxzoom: 25, p: {opacity: prop(1), resampling: prop(undefined), rasterResampling: prop('linear')}};
    const k = 256 / EXTENT, item = (x: number) => ({id: {z: 2, x, y: 0}, matrix: [k, 0, 0, k, 298.19 + x * 256, -32.65], scale: k, clip: [0, 0, EXTENT, EXTENT], tile: {href: 'data:,x'}});
    const svg = renderSVG({tr, layers: [layer] as any, items: new Map([['s', [item(0), item(1)] as any]]), labels: [], images: new Map(), fontFamily: 'sans-serif'});
    // A tile is 256 pixels wide, which is 2048 image units here (EXTENT / 2), so one pixel is 8 units.
    const image = svg.match(/<image [^>]*width="([\d.]+)" height="([\d.]+)"/)!;
    assert.deepEqual([+image[1], +image[2]], [2048 + 8, 2048 + 8], 'the image reaches one pixel past the tile edge');
    assert.match(svg, /<clipPath id="c0"><rect x="0" y="0" width="2056" height="2056"\/>/, 'the clip lets the extra pixel show');
});
