// A `visibility` that is an expression of the global state hides the layer and its tiles (#998).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToSVG} from '../../src/server.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const n = 2 ** 14, center: [number, number] = [(4823 + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (6160 + 0.5) / n))) * 180 / Math.PI];
const style = (on: boolean) => ({
    version: 8, state: {water: {default: on}},
    sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14}},
    layers: [{id: 'water', type: 'fill', source: 's', 'source-layer': 'water', layout: {visibility: ['case', ['global-state', 'water'], 'visible', 'none']}, paint: {'fill-color': '#0af'}}],
});
const render = async (on: boolean) => {
    const fetched: string[] = [];
    const r = await renderToSVG({style: style(on), center, zoom: 14, width: 300, height: 200,
        fetch: (async (url: unknown) => { fetched.push(String(url)); return new Response(bytes); }) as typeof fetch});
    return {...r, fetched};
};

test('server: a layer whose visibility expression gives "none" is not drawn and its source loads no tiles', async () => {
    const off = await render(false);
    assert.equal(off.fetched.length, 0, off.fetched.join());
    assert.doesNotMatch(off.svg, /#00aaff/);
    const on = await render(true);
    assert.ok(on.fetched.length > 0);
    assert.match(on.svg, /#00aaff/);
});
