// renderToSVG draws an image inside `format` text in its place on the line, as the browser does (#1079).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {renderSVG} from '../../src/svg.ts';
import {EstimateShaper, EM} from '../../src/text.ts';

test('renderToSVG draws images inside format text', () => {
    const tr = new Transform(); tr.width = 200; tr.height = 100; tr.set([0, 0], 2, 0, 0);
    const shaper = new EstimateShaper();
    shaper.images = name => name === 'arrow' ? {width: 20, height: 10, pixelRatio: 1} : undefined;
    const shaped = shaper.shape('Exit arrow', '400\u0000Noto Sans', 10, 0, 1.2, 16);
    const src = {font: '400\u0000Noto Sans', haloWidth: 0, halo: [0, 0, 0, 0], color: [0, 0, 0, 1], spacing: 0, justify: 0};
    const label = {x: 100, y: 50, angle: 0, size: 16, shaped, src, key: 'k', layer: 'l', tile: 't', ax: 100, ay: 50, depth: 1, opacity: 1};
    const images = new Map([['arrow', {svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><path d="M0 0h20v10z"/></svg>', width: 20, height: 10}]]);
    const svg = renderSVG({tr, layers: [], items: new Map(), labels: [label as any], images, fontFamily: 'sans-serif'});
    const use = svg.match(/<use href="#i0" x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/);
    assert.ok(use, 'the image is drawn: ' + svg);
    const [x, y, w, h] = use.slice(1).map(Number), line = shaped.lines[0], k = 16 / EM;
    assert.deepEqual([w, h], [20, 10], 'the image keeps its own size');
    assert.ok(Math.abs(x + w - (100 + line.width / 2 * k)) < 0.5, `the image ends the line: x ${x}, line ends at ${100 + line.width / 2 * k}`);
    assert.ok(Math.abs(y + h / 2 - 50) < 0.5, 'the image is in the middle of the line');
});
