// Unit tests for the size of the server render and for style values that reach the markup (#1668).
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
const view = {style, center: [0, 0], zoom: 2};

for (const [name, call] of calls) {
    test(`${name}: a width or height that is not a finite number greater than 0 rejects with a message`, async () => {
        for (const side of ['width', 'height'] as const) {
            for (const bad of ['200" onload="alert(1)', '200', NaN, 0, -10, Infinity, undefined]) {
                await assert.rejects(call({...view, width: 100, height: 100, [side]: bad}),
                    {message: new RegExp(`^\\[map-jr-gl\\] E1670 server render: "${side}" is .*\\. Pass the ${side} in CSS pixels as a number greater than 0`)}, `${side}: ${String(bad)}`);
            }
        }
    });
    test(`${name}: a valid size renders`, async () => {
        await assert.doesNotReject(call({...view, width: 100.5, height: 50}));
    });
}

test('the message shows a string as written', async () => {
    await assert.rejects(renderToSVG({...view, width: '200" onload="alert(1)', height: 10} as any), {message: /"width" is "200\\" onload=\\"alert\(1\)"\./});
});

test('a valid size reaches the SVG', async () => {
    assert.match((await renderToSVG({...view, width: 100.5, height: 50} as any)).svg, /^<svg [^>]*width="100.5" height="50" viewBox="0 0 100.5 50"/);
});

test('line-cap, line-join and line-miter-limit of the style do not add attributes to the SVG', async () => {
    const line = (layout: object) => ({version: 8, sources: {g: {type: 'geojson', data: {type: 'LineString', coordinates: [[-10, 0], [10, 0]]}}},
        layers: [{id: 'l', type: 'line', source: 'g', layout}]});
    const {svg} = await renderToSVG({style: line({'line-cap': 'x" onload="alert(1)', 'line-join': 'y" onclick="z', 'line-miter-limit': 'q" a="b'}), width: 100, height: 100, center: [0, 0], zoom: 2} as any);
    assert.doesNotMatch(svg, /onload|onclick| a="b/);
    assert.match(svg, /stroke-miterlimit="2"/);
    const round = (await renderToSVG({style: line({'line-cap': 'round', 'line-join': 'bevel'}), width: 100, height: 100, center: [0, 0], zoom: 2} as any)).svg;
    assert.match(round, /stroke-linecap="round" stroke-linejoin="bevel"/);
});
