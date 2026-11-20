// @vitest-environment happy-dom

// A test of the component stores.vue, with Vitest, @vue/test-utils and happy-dom.
import {describe, expect, it, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import Stores from '../stores.vue';

// happy-dom has no WebGL, so the test replaces MapJr with a stub. The stub declares the props that the test reads, and
// its template ref has `moveTo`, as the template ref of MapJr has. The other exports of the adapter stay as they are.
const {moveTo} = vi.hoisted(() => ({moveTo: vi.fn()}));
vi.mock('@map-jr/map-jr-gl/vue', async importOriginal => {
  const {defineComponent, h} = await import('vue');
  return {
    ...await importOriginal(),
    MapJr: defineComponent({
      props: {data: Object},
      setup(props, {expose}) {
        expose({moveTo});
        return () => h('div', {'data-test': 'map', 'data-stores': props.data.stores.features.length});
      },
    }),
  };
});

describe('Stores', () => {
  it('gives the map a point for each store', () => {
    const wrapper = mount(Stores);
    expect(wrapper.get('[data-test="map"]').attributes('data-stores')).toBe('3');
  });

  it('moves the map to a store on a click', async () => {
    const wrapper = mount(Stores);
    await wrapper.findAll('button')[1].trigger('click');
    expect(moveTo).toHaveBeenCalledWith(expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}));
  });
});
