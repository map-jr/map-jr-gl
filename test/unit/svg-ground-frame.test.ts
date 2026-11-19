// A symbol that lies on the ground of a tilted map (`Placed.frame`) is drawn with that frame in the SVG (#1063).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {renderSVG} from '../../src/svg.ts';

test('renderToSVG draws text and icons with their ground frame', () => {
    const tr = new Transform(); tr.width = 64; tr.height = 64; tr.set([0, 0], 12, 0, 60);
    const frame = [1, 0, 0, 0.5];
    const src = {font: '400\u0000Noto Sans', haloWidth: 0, halo: [0, 0, 0, 0], color: [0, 0, 0, 1], spacing: 0, justify: 0};
    const shaped = {width: 100, lines: [{text: 'A', width: 100, chars: ['A']}]};
    const icon = {x: 20, y: 10, w: 8, h: 8, angle: 0, frame, rect: [0, 0, 8, 8], name: 'dot', opacity: 1};
    const label = {x: 20, y: 10, angle: 0, frame, size: 16, shaped, src, icon, key: 'k', layer: 'l', tile: 't', ax: 20, ay: 10, depth: 1, opacity: 1};
    const sprite = {image: 'data:image/png;base64,', width: 8, height: 8, icons: {dot: {}}};
    const svg = renderSVG({tr, layers: [], items: new Map(), labels: [label as any], sprite: sprite as any, fontFamily: 'sans-serif'});
    const m = svg.match(/transform="matrix\(1 0 0 0\.5 0 5\)"/g) ?? [];
    assert.equal(m.length, 2, 'the text and the icon carry the frame about their centre: ' + svg);
});
