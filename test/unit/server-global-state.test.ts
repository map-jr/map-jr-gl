// The first view from the server uses the description's global state and color scheme, as the map does (#1426).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderFirstView, renderElement} from '../../src/server.ts';

const style = (name: string, d: string) => ({version: 8, state: {[name]: {default: d}}, sources: {}, layers: [
    {id: 'bg', type: 'background', paint: {'background-color': ['case', ['==', ['global-state', name], 'dark'], '#000000', '#ffffff']}}]});
const view = {center: [0, 0] as [number, number], zoom: 1, width: 100, height: 100, attribution: false as const};

test('renderFirstView and renderElement draw with globalState over the default of the style', async () => {
    assert.match(await renderFirstView({...view, style: style('mode', 'light')}), /fill="#ffffff"/);
    assert.match(await renderFirstView({...view, style: style('mode', 'light'), globalState: {mode: 'dark'}}), /fill="#000000"/);
    assert.match(await renderFirstView({...view, style: style('mode', 'dark'), globalState: {mode: null}}), /fill="#000000"/);
    assert.match(await renderElement({style: style('mode', 'light'), globalState: {mode: 'dark'}, attribution: false}, {width: 100, height: 100}), /fill="#000000"/);
});

test('the color scheme is the global state "color-scheme", unless globalState sets it', async () => {
    assert.match(await renderFirstView({...view, style: style('color-scheme', 'light'), colorScheme: 'dark'}), /fill="#000000"/);
    assert.match(await renderFirstView({...view, style: style('color-scheme', 'light'), colorScheme: 'dark', globalState: {'color-scheme': 'light'}}), /fill="#ffffff"/);
    // Without `colorScheme` the map sets `color-scheme` to 'light', whatever the default of the style is.
    assert.match(await renderFirstView({...view, style: style('color-scheme', 'dark')}), /fill="#ffffff"/);
    assert.match(await renderElement({style: style('color-scheme', 'light'), colorScheme: 'dark', attribution: false}, {width: 100, height: 100}), /fill="#000000"/);
});
