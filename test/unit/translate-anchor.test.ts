// `*-translate-anchor` of circle and symbol layers: with `map` (the default) the direction of the translate turns with
// the bearing of the map, and with `viewport` it stays fixed on the screen (#600).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer, screenTranslate} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const close = (a: number, b: number, message?: string) => assert.ok(Math.abs(a - b) < 1e-6, `${message ?? ''} ${a} is not ${b}`);

test('translate: the anchor map turns the direction with the bearing, and the anchor viewport does not', () => {
    assert.deepEqual(screenTranslate([10, 5], 'map', 0), [10, 5]);
    assert.deepEqual(screenTranslate([10, 5], 'viewport', 90), [10, 5]);
    assert.deepEqual(screenTranslate(null, 'map', 90), [0, 0]);
    assert.deepEqual(screenTranslate({stops: [[16, [15, 15]]]}, 'map', 90), [0, 0]);
    // At a bearing of 90 degrees, east on the map (x) is up on the screen.
    const [x, y] = screenTranslate([10, 0], 'map', 90);
    close(x, 0); close(y, -10);
});

test('translate: circle and symbol layers have the anchor, and map is the default', () => {
    const circle: any = compileLayer({id: 'c', type: 'circle', source: 's', paint: {'circle-translate-anchor': 'viewport'}})!;
    assert.equal(circle.p.translateAnchor.eval(0), 'viewport');
    const symbol: any = compileLayer({id: 't', type: 'symbol', source: 's', paint: {'icon-translate-anchor': 'viewport'}})!;
    assert.equal(symbol.p.translateAnchor.eval(0), 'map');
    assert.equal(symbol.p.iconTranslateAnchor.eval(0), 'viewport');
});

test('translate: a label with text-translate moves along the turned direction on a map with a bearing', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, lat]}}), z, tx, ty);
    const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};
    const at = (bearing: number, paint: Record<string, unknown>) => {
        const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'text-field': 'A'}, paint})!;
        const labels = buildTile(data, z, [layer], false).labels;
        const tr = new Transform();
        tr.width = 800; tr.height = 600;
        tr.set([lng, lat], z, bearing, 0);
        const [p] = placeLabels(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid());
        return [p.x, p.y];
    };
    const still = at(90, {});
    const map = at(90, {'text-translate': [20, 0]}), viewport = at(90, {'text-translate': [20, 0], 'text-translate-anchor': 'viewport'});
    close(map[0] - still[0], 0, 'map, x:'); close(map[1] - still[1], -20, 'map, y:');
    close(viewport[0] - still[0], 20, 'viewport, x:'); close(viewport[1] - still[1], 0, 'viewport, y:');
});

test('translate: text-translate and icon-translate take a legacy function of the zoom or an expression, read at the zoom of the map', () => {
    // (The render tests `text-translate/function` and `icon-translate/function` of MapLibre GL JS.)
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, lat]}}), z, tx, ty);
    const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};
    const icon = {x: 0, y: 0, width: 10, height: 10, pixelRatio: 1} as any;
    const at = (zoom: number, paint: Record<string, unknown>) => {
        const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'text-field': 'A', 'icon-image': 'pin'}, paint})!;
        const labels = buildTile(data, z, [layer], false).labels;
        const tr = new Transform();
        tr.width = 800; tr.height = 600;
        tr.set([lng, lat], zoom, 0, 0);
        const [p] = placeLabels(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), () => icon);
        return [p.x, p.y, p.icon!.x, p.icon!.y];
    };
    const legacy = {stops: [[10, [0, 0]], [11, [20, 40]]]}, expression = ['interpolate', ['linear'], ['zoom'], 10, ['literal', [0, 0]], 11, ['literal', [20, 40]]];
    // The tile has the zoom 10 and the map has the zoom 10.5: the translate is the one of the zoom 10.5.
    const still = at(10.5, {});
    for (const value of [legacy, expression]) {
        const text = at(10.5, {'text-translate': value}), image = at(10.5, {'icon-translate': value});
        close(text[0] - still[0], 10, 'text, x:'); close(text[1] - still[1], 20, 'text, y:');
        close(text[2] - still[2], 0, 'text, the icon stays, x:'); close(text[3] - still[3], 0, 'text, the icon stays, y:');
        close(image[2] - still[2], 10, 'icon, x:'); close(image[3] - still[3], 20, 'icon, y:');
        close(image[0] - still[0], 0, 'icon, the text stays, x:'); close(image[1] - still[1], 0, 'icon, the text stays, y:');
    }
});
