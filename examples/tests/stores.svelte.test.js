// @vitest-environment happy-dom

// A test of the component stores.svelte, with Vitest and happy-dom.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {flushSync, mount, unmount} from 'svelte';
import Stores from '../stores.svelte';

// happy-dom has no WebGL, so the test replaces the action mapJr. The stub makes no map: it keeps each description and
// calls `ready` with an object that has `moveTo`, as the map has. The other exports of the entry stay as they are.
const {moveTo, descriptions} = vi.hoisted(() => ({moveTo: vi.fn(), descriptions: []}));
vi.mock('@map-jr/map-jr-gl/svelte', async importOriginal => ({
  ...await importOriginal(),
  mapJr(node, options) {
    descriptions.push(options.description);
    options.ready?.({moveTo});
    return {update: next => descriptions.push(next.description), destroy() {}};
  },
}));

let component;
afterEach(() => unmount(component));

describe('Stores', () => {
  it('gives the map a point for each store', () => {
    component = mount(Stores, {target: document.body});
    flushSync();
    expect(descriptions.at(-1).data.stores.features).toHaveLength(3);
  });

  it('moves the map to a store on a click', () => {
    component = mount(Stores, {target: document.body});
    flushSync();
    [...document.querySelectorAll('button')].find(b => b.textContent === 'Midtown').click();
    expect(moveTo).toHaveBeenCalledWith(expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}));
  });
});
