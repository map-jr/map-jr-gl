// Two line layers that draw the same features (a road and its casing) write the geometry once and draw it with <use> (#982).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {renderSVG} from '../../src/svg.ts';

test('a road and its casing write their path data once', () => {
    const tr = new Transform(); tr.width = 64; tr.height = 64; tr.set([0, 0], 12, 0, 0);
    const layer = (id: string, paint: Record<string, unknown>) => compileLayer({id, type: 'line', source: 's', 'source-layer': 'x', paint} as any)!;
    const geom = {coords: new Int16Array([0, 0, EXTENT, EXTENT, EXTENT, 0]), ringEnds: [3], featEnds: [1]};
    const batch = {type: 'line', geom}, alone = {type: 'line', geom: {...geom, coords: new Int16Array([0, 0, EXTENT, 0]), ringEnds: [2]}};
    const item = {tile: {layers: {casing: batch, road: batch, alone}}, clip: [0, 0, EXTENT, EXTENT], matrix: [0.01, 0, 0, 0.01, 0, 0], scale: 0.01};
    const svg = renderSVG({tr, layers: [layer('casing', {'line-width': 4, 'line-color': '#000'}), layer('road', {'line-width': 2, 'line-color': '#fff'}),
        layer('alone', {'line-width': 1})], items: new Map([['s', [item as any]]]), labels: [], fontFamily: 'sans-serif'});
    assert.equal(svg.match(/d="M0 0l2048 2048v-2048"/g)?.length, 1);
    assert.match(svg, /<defs>.*<path id="p0" vector-effect="non-scaling-stroke" d="M0 0l2048 2048v-2048"\/>.*<\/defs>/);
    assert.match(svg, /<use href="#p0" stroke="#000000" stroke-width="4"\/>.*<use href="#p0" stroke="#ffffff" stroke-width="2"\/>/);
    assert.match(svg, /<path stroke="#000000" stroke-width="1" vector-effect="non-scaling-stroke" d="M0 0h2048"\/>/);
});
