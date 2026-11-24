// Unit tests for options with no view in the server renderer (#1640).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG, renderFirstView, renderToImage} from '../../src/server.ts';

const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
const rasteriser = {render: async () => new Uint8Array()};
const calls = [
    ['renderToSVG', (o: any) => renderToSVG(o)],
    ['renderFirstView', (o: any) => renderFirstView(o)],
    ['renderToImage', (o: any) => renderToImage({rasteriser, ...o})],
] as const;

for (const [name, call] of calls) {
    test(`${name}: options with neither center and zoom nor bounds reject with a message`, async () => {
        await assert.rejects(call({style, width: 10, height: 10}),
            {message: /^\[map-jr-gl\] server render: the options have no "center" and no "zoom", and no "bounds"\. Pass "center" and "zoom"/});
        await assert.rejects(call({style, width: 10, height: 10, center: [0, 0]}), {message: /"center" but no "zoom", and no "bounds"/});
        await assert.rejects(call({style, width: 10, height: 10, zoom: 2}), {message: /"zoom" but no "center", and no "bounds"/});
    });
}

test('a view of center and zoom, or of bounds alone, renders', async () => {
    assert.match((await renderToSVG({style, width: 10, height: 10, center: [0, 0], zoom: 2})).svg, /^<svg/);
    assert.match((await renderToSVG({style, width: 10, height: 10, bounds: [-10, -10, 10, 10]})).svg, /^<svg/);
});
