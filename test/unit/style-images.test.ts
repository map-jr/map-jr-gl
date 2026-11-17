// Unit tests for the images of a style in metadata["map-jr:images"] (#495): the bounds, and the server renderer.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';
import {styleImages} from '../../src/style-images.ts';

const square = (fill: string) => `<svg viewBox="0 0 20 20"><rect width="20" height="20" fill="${fill}"/></svg>`;
const style = (images: unknown) => ({
    version: 8,
    metadata: {'map-jr:images': images},
    sources: {p: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}}},
    layers: [{id: 'p', type: 'symbol', source: 'p', layout: {'icon-image': 'sq', 'icon-allow-overlap': true}}],
});
const view = {center: [0, 0] as [number, number], zoom: 2, width: 200, height: 200};

test('style images: the server renderer draws an image of the style, and an image of images takes its place', async () => {
    const own = await renderToSVG({style: style({sq: square('#123456')}), ...view});
    assert.match(own.svg, /#123456/);
    const replaced = await renderToSVG({style: style({sq: square('#123456')}), images: {sq: square('#abcdef')}, ...view});
    assert.match(replaced.svg, /#abcdef/);
    assert.doesNotMatch(replaced.svg, /#123456/);
});

test('style images: a style from a URL brings its images to the server renderer', async () => {
    const fetch = (async () => new Response(JSON.stringify(style({sq: {image: square('#654321'), width: 10, height: 10}})))) as unknown as typeof globalThis.fetch;
    const {svg} = await renderToSVG({style: 'https://styles.test/style.json', fetch, ...view});
    assert.match(svg, /#654321/);
});

test('style images: values that break a bound are left out with a message', () => {
    const faults: string[] = [];
    // (A style takes 500 images (#610): the styles of map-jr-styles have up to 190, and a style with more icons must not lose them.)
    const many = Object.fromEntries(Array.from({length: 505}, (_, i) => ['i' + i, square('#000')]));
    assert.equal(Object.keys(styleImages(style(many), m => faults.push(m))).length, 500);
    assert.equal(faults.length, 5);
    assert.match(faults[0], /the image "i500" .* is left out, because the style has more than 500 images/);
    faults.length = 0;
    const out = styleImages(style({
        ok: square('#000'), url: 'https://images.test/a.png', obj: {image: square('#111'), width: 4},
        local: '<svg><use href="#a"/><image href="data:image/png;base64,AA"/></svg>',
        far: '<svg><image href="https://other.test/a.png"/></svg>', css: '<svg><rect style="fill:url( \'http://x.test/p\')"/></svg>',
        number: 4, big: '<svg>' + ' '.repeat(200_001) + '</svg>',
    }), m => faults.push(m));
    assert.deepEqual(Object.keys(out), ['ok', 'url', 'obj', 'local']);
    assert.equal(faults.length, 4);
    assert.ok(faults.every(f => f.startsWith('[map-jr-gl] the style: the image "')));
    assert.deepEqual(styleImages({version: 8}, () => assert.fail()), {});
    styleImages(style([square('#000')]), m => faults.push(m));
    assert.match(faults.at(-1)!, /is not an object of images by name/);
});
