// A `background-pattern` that is set but names no image, the empty text included, draws nothing, as in MapLibre GL JS
// (render test regressions/mapbox-gl-js#9518). Only an unset `background-pattern` draws `background-color` (#643).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {renderSVG} from '../../src/svg.ts';

const draw = (paint: Record<string, unknown>) => {
    const tr = new Transform(); tr.width = 8; tr.height = 8; tr.set([0, 0], 3, 0, 0);
    return renderSVG({tr, layers: [compileLayer({id: 'b', type: 'background', paint} as any)!], items: new Map(), labels: [], fontFamily: 'sans-serif'});
};

test('background-pattern: unset draws the color, and an empty name draws nothing', () => {
    assert.match(draw({'background-color': '#f00'}), /<rect width="100%"/);
    assert.doesNotMatch(draw({'background-color': '#f00', 'background-pattern': ''}), /<rect width="100%"/);
    assert.doesNotMatch(draw({'background-pattern': ['step', ['zoom'], '', 5, 'cemetery_icon']}), /<rect width="100%"/);
    assert.equal(compileLayer({id: 'b', type: 'background'} as any)!.p.pattern.eval(3), null);
    assert.equal(compileLayer({id: 'b', type: 'background', paint: {'background-pattern': ''}} as any)!.p.pattern.eval(3), '');
});
