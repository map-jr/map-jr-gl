// The markup of the server renderer has at most one `style` attribute on an element (#466): a browser ignores the second one.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderFirstView, renderElement} from '../../src/server.ts';
import {navigation, scale} from '../../src/control-specs.ts';

const style = {version: 8, sources: {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Credit'}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'l', type: 'line', source: 's'}]};
const view = {center: [0, 0] as [number, number], zoom: 2, width: 100, height: 100};

/** The number of `style` attributes of each start tag of the markup, outside the text of `<style>`. */
function styleCounts(html: string): number[] {
    const counts: number[] = [];
    for (const [tag] of html.replace(/<style[^>]*>.*?<\/style>/gs, '').matchAll(/<[a-z][^>]*>/gi)) counts.push([...tag.matchAll(/\sstyle\s*=/gi)].length);
    return counts;
}

test('renderFirstView has no element with two style attributes', async () => {
    for (const extra of [{}, {controls: [navigation(), scale()]}, {attribution: false}, {colorScheme: 'dark' as const}, {nonce: 'abc'}]) {
        const html = (await renderFirstView({style, ...view, ...extra} as any)).html;
        // With a nonce the markup has no style attribute at all (see server-controls.test.ts).
        assert.ok(styleCounts(html).length > 1 && Math.max(...styleCounts(html)) === ('nonce' in extra ? 0 : 1), html.slice(0, 300));
    }
});

test('renderElement has one style attribute on the element, whatever the case of the name in attributes', async () => {
    const description = {style, initialView: {center: [0, 0] as [number, number], zoom: 2}};
    for (const attributes of [{}, {style: 'color:red'}, {Style: 'color:red'}, {STYLE: 'color:red', style: 'top:1px'}]) {
        const html = await renderElement(description as any, {attributes});
        const tag = html.match(/^<map-jr [^>]*>/)![0];
        assert.equal([...tag.matchAll(/\sstyle\s*=/gi)].length, 1, tag);
        assert.ok(Math.max(...styleCounts(html)) === 1, html.slice(0, 300));
        for (const value of Object.values(attributes)) assert.ok(tag.includes(value), `${tag} keeps ${value}`);
    }
});

test('renderElement writes each attribute once, whatever the case of the name in attributes (#2404)', async () => {
    const description = {style, initialView: {center: [0, 0] as [number, number], zoom: 3}, nonce: 'n'};
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    let html: string;
    try { html = await renderElement(description as any, {attributes: {nonce: 'x', Zoom: '5', id: 'a', ID: 'b', class: 'c'}}); } finally { console.warn = warn; }
    const dropped = warnings.filter(w => w.includes('E2404'));
    assert.equal(dropped.length, 3, dropped.join('\n'));
    assert.ok(dropped.some(w => w.includes('attributes.Zoom is dropped')) && dropped.every(w => w.startsWith('[map-jr-gl] E2404 renderElement(): attributes.')));
    const tag = html.match(/^<map-jr [^>]*>/)![0];
    const names = [...tag.matchAll(/\s([\w:.-]+)(?==|\s|>)/g)].map(m => m[1].toLowerCase());
    assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), [], tag);
    assert.ok(tag.includes('nonce="n"') && tag.includes('zoom="3"') && tag.includes('id="a"') && tag.includes('class="c"'), tag);
});
