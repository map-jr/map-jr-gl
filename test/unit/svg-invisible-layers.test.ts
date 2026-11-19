// A line or fill layer that draws nothing at the zoom of the render writes no paths (#981).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {renderSVG} from '../../src/svg.ts';

const draw = (type: 'line' | 'fill', paint: Record<string, unknown>, width?: Float32Array) => {
    const tr = new Transform(); tr.width = 64; tr.height = 64; tr.set([0, 0], 12, 0, 0);
    const L = compileLayer({id: 'l', type, source: 's', 'source-layer': 'x', paint} as any)!;
    const geom = {coords: new Int16Array([0, 0, EXTENT, EXTENT, EXTENT, 0]), ringEnds: [3], featEnds: [1]};
    const batch = {type, geom, width};
    const item = {tile: {layers: {l: batch}}, clip: [0, 0, EXTENT, EXTENT], matrix: [0.01, 0, 0, 0.01, 0, 0], scale: 0.01};
    return renderSVG({tr, layers: [L], items: new Map([['s', [item as any]]]), labels: [], fontFamily: 'sans-serif'});
};

test('a line or fill that draws nothing at this zoom writes no paths', () => {
    assert.match(draw('line', {'line-width': 2}), /<path /);
    assert.doesNotMatch(draw('line', {'line-width': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14, 2]}), /<path |<g /);
    assert.doesNotMatch(draw('line', {'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 12.5, 1]}), /<path |<g /);
    assert.doesNotMatch(draw('line', {'line-color': 'rgba(0,0,0,0)'}), /<path |<g /);
    assert.doesNotMatch(draw('line', {'line-width': ['get', 'w']}, new Float32Array([0])), /<path |<g /);
    assert.match(draw('fill', {}), /<path /);
    assert.doesNotMatch(draw('fill', {'fill-opacity': 0}), /<path |<g /);
    assert.match(draw('fill', {'fill-color': 'rgba(0,0,0,0)', 'fill-outline-color': '#000'}), /<path /);
});
