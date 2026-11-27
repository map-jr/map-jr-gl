// The SVG groups the output of each style layer and names it in `data-layer`, never in `id` (#223).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform, EXTENT} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {renderSVG} from '../../src/svg.ts';

const render = (ids: string[]) => {
    const tr = new Transform(); tr.width = 64; tr.height = 64; tr.set([0, 0], 12, 0, 0);
    const layers = ids.map((id, i) => compileLayer({id, type: 'line', source: 's', 'source-layer': 'x', paint: {'line-width': 2 + i}} as any)!);
    const geom = {coords: new Int16Array([0, 0, EXTENT, EXTENT]), ringEnds: [2], featEnds: [1]};
    const layersIR: Record<string, unknown> = {};
    for (const id of ids) layersIR[id] = {type: 'line', geom};
    const item = {tile: {layers: layersIR}, clip: [0, 0, EXTENT, EXTENT], matrix: [0.01, 0, 0, 0.01, 0, 0], scale: 0.01};
    return renderSVG({tr, layers, items: new Map([['s', [item as any]]]), labels: [], fontFamily: 'sans-serif'});
};

test('each layer that draws is a group with its escaped id in data-layer', () => {
    const svg = render(['road-major', 'a"><script>x</script>&\'', 'c0']);
    assert.match(svg, /<g data-layer="road-major">/);
    assert.ok(svg.includes('<g data-layer="a&#34;&#62;&#60;script&#62;x&#60;/script&#62;&#38;&#39;">'));
    assert.doesNotMatch(svg, /<script/);
    assert.equal((svg.match(/<g data-layer=/g) ?? []).length, 3);
});

test('a layer id never becomes an id attribute, so ids stay unique', () => {
    const svg = render(['c0', 'p0', 'c0']);
    const ids = [...svg.matchAll(/ id="([^"]*)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal((svg.match(/data-layer="c0"/g) ?? []).length, 2);
});
