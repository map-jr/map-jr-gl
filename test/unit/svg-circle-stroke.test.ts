// A circle in the SVG output takes circle-stroke-opacity, and circle-opacity does not reach its stroke (#1967).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {renderSVG} from '../../src/svg.ts';

const draw = (paint: Record<string, unknown>) => {
    const tr = new Transform(); tr.width = 64; tr.height = 64; tr.set([0, 0], 12, 0, 0);
    const L = compileLayer({id: 'l', type: 'circle', source: 's', 'source-layer': 'x', paint} as any)!;
    const geom = {coords: new Int16Array([EXTENT / 2, EXTENT / 2]), ringEnds: [1], featEnds: [1]};
    const item = {tile: {layers: {l: {type: 'circle', geom}}}, clip: [0, 0, EXTENT, EXTENT], matrix: [0.01, 0, 0, 0.01, 0, 0], scale: 0.01};
    return renderSVG({tr, layers: [L], items: new Map([['s', [item as any]]]), labels: [], fontFamily: 'sans-serif'});
};

test('circle-stroke-opacity is the stroke opacity, and circle-opacity is not', () => {
    const stroke = {'circle-stroke-width': 4, 'circle-stroke-color': '#0000ff'};
    const svg = draw({...stroke, 'circle-stroke-opacity': 0.3, 'circle-opacity': 0.5});
    assert.match(svg, /stroke-opacity="0\.3"/);
    assert.match(svg, /fill-opacity="0\.5"/);
    assert.doesNotMatch(draw({...stroke, 'circle-opacity': 0.5}), /stroke-opacity/);
    assert.match(draw({...stroke, 'circle-stroke-color': 'rgba(0,0,255,0.5)', 'circle-stroke-opacity': 0.3}), /stroke-opacity="0\.15"/);
});

test("a circle with circle-opacity 0 still draws its stroke, and without a stroke it writes nothing", () => {
    assert.match(draw({"circle-opacity": 0, "circle-stroke-width": 4}), /<circle [^>]*stroke-width="4"/);
    assert.doesNotMatch(draw({"circle-opacity": 0}), /<circle /);
});
