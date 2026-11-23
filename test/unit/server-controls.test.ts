// The first view from the server has the controls of the description as static markup (#1396).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlsMarkup, type FirstViewControls} from '../../src/server-controls.ts';
import {navigation, scale, fullscreen, geolocate, terrain, globe, colorScheme} from '../../src/control-specs.ts';
import {renderFirstView, renderElement} from '../../src/server.ts';

const base = (o: Partial<FirstViewControls> = {}): FirstViewControls => ({controls: [], lat: 0, zoom: 10, bearing: 0, width: 800, colorScheme: 'light', credits: false, ...o});
/** The markup without the style sheet, whose rules name the classes too. */
const layer = (html: string) => html.slice(html.indexOf('</style>'));
const corner = (html: string, name: string) => html.match(new RegExp(`<div class="map-jr-ctrl-${name} maplibregl-ctrl-${name}">.*?(?=<div class="map-jr-ctrl-(top|bottom)|</div>$)`, 's'))?.[0] ?? '';

test('each built-in control has its markup in its corner, with the classes of the browser controls', () => {
    const html = controlsMarkup(base({controls: [navigation(), scale(), fullscreen(), geolocate({position: 'top-left'}), terrain({source: 'dem'}), globe(), colorScheme()], terrain: true}));
    for (const c of ['zoom-in', 'zoom-out', 'compass', 'fullscreen', 'globe', 'terrain', 'geolocate', 'color-scheme']) assert.match(html, new RegExp(`<button class="map-jr-ctrl-${c} maplibregl-ctrl-${c}" type="button"`), c);
    assert.match(html, /<div class="map-jr-ctrl-top-left maplibregl-ctrl-top-left"><div class="map-jr-ctrl maplibregl-ctrl map-jr-ctrl-group maplibregl-ctrl-group"><button class="map-jr-ctrl-geolocate/);
    assert.match(html, /<div class="map-jr-ctrl-bottom-left maplibregl-ctrl-bottom-left"><div class="map-jr-ctrl maplibregl-ctrl map-jr-ctrl-scale maplibregl-ctrl-scale map-jr-ssr-s/);
    assert.match(html, /title="Toggle terrain"/);
    assert.match(html, /^<style data-map-jr-ssr="">.*<\/style><div data-map-jr-ssr="" class="map-jr-map map-jr-glass map-jr-ssr-layer">/s);
});

test('the scale has the value of the first view', () => {
    // At zoom 10 on the equator a pixel is 76.4 m: 100 pixels are 7.6 km, and the bar is the 5 km that fit.
    const html = controlsMarkup(base({controls: [scale()]}));
    assert.match(html, />5 km<\/div>/);
    const width = 5000 / (40075016.686 / (512 * 2 ** 10));
    assert.ok(html.includes(`--map-jr-scale:${width}px`), `the bar is ${width}px`);
    assert.match(controlsMarkup(base({controls: [scale({unit: 'imperial'})], zoom: 14, lat: 60})), />(\d+) (ft|mi)<\/div>/);
    assert.match(controlsMarkup(base({controls: [scale({unit: 'nautical'})]})), /nm<\/div>/);
});

test('the compass shows the bearing of the view, and a zoom button is disabled at the limit', () => {
    const html = controlsMarkup(base({controls: [navigation()], bearing: 90, zoom: 22, maxZoom: 22}));
    assert.match(html, />E<\/text>/);
    assert.match(html, /\.map-jr-ssr-r90\{transform:rotateX\(0deg\) rotate\(-90deg\)\}/);
    assert.match(html, /map-jr-ctrl-zoom-in maplibregl-ctrl-zoom-in" type="button" title="Zoom in" aria-label="Zoom in" disabled/);
    assert.doesNotMatch(html, /zoom-out[^>]* disabled/);
    assert.doesNotMatch(layer(controlsMarkup(base({controls: [navigation({showCompass: false})]}))), /compass/);
});

test('the attribution is the lowest control of the bottom right corner, folds on a narrow map, and is escaped', () => {
    const credits = ['<a href="https://example.com/c?a=1&b=2" onclick="x()">Example</a> <script>alert(1)</script>', '<a href="javascript:alert(1)">bad</a>'];
    const html = controlsMarkup(base({controls: [fullscreen()], credits, width: 400, attribution: {customAttribution: ' Mine '}}));
    const right = html.slice(html.indexOf('map-jr-ctrl-bottom-right'));
    assert.ok(right.indexOf('ctrl-attrib') < right.indexOf('ctrl-fullscreen') || !right.includes('ctrl-fullscreen'));
    assert.match(right, /map-jr-compact maplibregl-compact map-jr-compact-show maplibregl-compact-show/);
    assert.match(right, /aria-expanded="true">i<\/button>/);
    assert.match(right, /<a href="https:\/\/example.com\/c\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Example<\/a>/);
    assert.doesNotMatch(html, /<script|onclick|javascript:/);
    assert.match(right, /\| Mine</);
    assert.doesNotMatch(layer(controlsMarkup(base({credits, width: 800}))), /map-jr-compact/);
    assert.doesNotMatch(layer(controlsMarkup(base({credits: false, controls: [navigation()]}))), /ctrl-attrib/);
    assert.ok(corner(html, 'bottom-right').includes('ctrl-attrib'));
});

test('text from the description is escaped, the nonce goes on the style, and a custom control is left out', () => {
    const html = controlsMarkup(base({controls: [navigation(), {key: 'custom:mine', create: () => ({onAdd: () => ({} as HTMLElement), onRemove() {}})}], locale: {'NavigationControl.ZoomIn': '"><img src=x onerror=alert(1)>'}, nonce: 'a"b'}));
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /title="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
    assert.match(html, /<style data-map-jr-ssr="" nonce="a&quot;b">/);
    assert.doesNotMatch(html, /style="/, 'no style attribute: a strict style-src does not block the layout');
});

test('the color scheme sets the class of the layer, and auto gets rules for the browser scheme and both icons', () => {
    assert.match(controlsMarkup(base({controls: [colorScheme()], colorScheme: 'dark'})), /map-jr-glass map-jr-dark map-jr-ssr-layer.*Use light colors/s);
    const auto = controlsMarkup(base({controls: [colorScheme()], colorScheme: 'auto'}));
    assert.match(auto, /map-jr-glass map-jr-auto map-jr-ssr-layer/);
    assert.match(auto, /@media \(prefers-color-scheme:dark\)\{:where\(\.map-jr-auto\) :where\(\.map-jr-ctrl\)\{/);
    assert.match(auto, /@media \(prefers-color-scheme:dark\)\{&\.map-jr-auto\{--map-jr-o:\.45/);
    assert.ok(auto.includes('map-jr-ssr-sun') && auto.includes('map-jr-ssr-moon'));
    const style = auto.match(/<style[^>]*>(.*?)<\/style>/s)![1];
    let depth = 0;
    for (const ch of style.replace(/"[^"]*"/g, '""')) { depth += ch === '{' ? 1 : ch === '}' ? -1 : 0; assert.ok(depth >= 0); }
    assert.equal(depth, 0, 'the braces of the style balance');
});

const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abcdef'}}]};
test('renderFirstView and renderElement put the controls into the first view; without controls renderFirstView keeps the plain credits', async () => {
    const view = {style, center: [0, 0] as [number, number], zoom: 4, width: 600, height: 400, attribution: 'Own <a href="https://example.com">credits</a>'};
    const plain = await renderFirstView(view);
    assert.doesNotMatch(plain, /<style|ctrl-/);
    assert.match(plain, /<div data-map-jr-ssr="" style="position:absolute;right:0;bottom:0/);
    const withControls = await renderFirstView({...view, controls: [navigation(), scale()]});
    assert.match(withControls, /^<svg[^>]*data-map-jr-ssr/);
    assert.match(withControls, /map-jr-ctrl-zoom-in/);
    assert.match(withControls, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">credits<\/a>/);
    const element = await renderElement({style, initialView: {center: [0, 0], zoom: 4}, controls: [navigation()], nonce: 'n1', locale: {'NavigationControl.ZoomOut': 'Dezoomer'}}, {width: 600, height: 400, attribution: 'Credits'});
    assert.match(element, /<style data-map-jr-ssr="" nonce="n1">/);
    assert.match(element, /title="Dezoomer"/);
    assert.match(element, />Credits<\/div><\/div><\/div><\/div><\/map-jr>$/);
    const none = await renderElement({style, initialView: {zoom: 4}, attribution: false}, {width: 600, height: 400});
    assert.doesNotMatch(layer(none), /ctrl-attrib/);
});
