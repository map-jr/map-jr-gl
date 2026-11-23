# Test a component that has a map

This example is a component with a map of three stores and a button for each store, and a test of it for Vue, React and
Svelte. The test environment (happy-dom or jsdom) has no WebGL, so the test replaces the map with a stub and checks what
the component gives to the map and what it asks the map to do.

In a Nuxt app with the [module for Nuxt](../reference/nuxt.md), the Vue code works as it is.

<!-- example:stores:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows three stores, and a button below the map for
// each store moves the map to it.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];

const container = document.getElementById('map');
const map = createMap(container, {
  style,
  initialView: {center: [-73.995, 40.72], zoom: 11.5},
  attribution: {compact: true},
  // A key of `data` makes a GeoJSON source with that id. A circle layer draws
  // its points.
  data: {
    stores: points(stores, {
      lngLat: s => s.at,
      properties: s => ({name: s.name}),
    }),
  },
  layers: [
    {
      id: 'stores',
      type: 'circle',
      source: 'stores',
      paint: {
        'circle-radius': 7,
        'circle-color': '#d6453d',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
  ],
});

container.after(
  ...stores.map(store => {
    const button = Object.assign(document.createElement('button'), {
      textContent: store.name,
    });
    button.onclick = () =>
      map.moveTo({center: store.at, zoom: 15, duration: 500});
    return button;
  }),
);
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows three stores, and a button below the map for
// each store moves the map to it.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];

const map = new Map({
  container: 'map',
  style,
  center: [-73.995, 40.72],
  zoom: 11.5,
  attributionControl: {compact: true},
});
map.on('load', () => {
  map.addSource('stores', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: stores.map(s => ({
        type: 'Feature',
        properties: {name: s.name},
        geometry: {type: 'Point', coordinates: s.at},
      })),
    },
  });
  map.addLayer({
    id: 'stores',
    type: 'circle',
    source: 'stores',
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
});

map.getContainer().after(
  ...stores.map(store => {
    const button = Object.assign(document.createElement('button'), {
      textContent: store.name,
    });
    button.onclick = () =>
      map.easeTo({center: store.at, zoom: 15, duration: 500});
    return button;
  }),
);
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];
// A key of `data` makes a GeoJSON source with that id. A circle layer draws its
// points.
const data = {
  stores: points(stores, {
    lngLat: s => s.at,
    properties: s => ({name: s.name}),
  }),
};
const layers = [
  {
    id: 'stores',
    type: 'circle',
    source: 'stores',
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
];

const map = useTemplateRef('map');
const show = store =>
  map.value?.moveTo({center: store.at, zoom: 15, duration: 500});
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    :initial-view="{center: [-73.995, 40.72], zoom: 11.5}"
    :data="data"
    :layers="layers"
    :attribution="{compact: true}"
  />
  <button v-for="store in stores" :key="store.name" @click="show(store)">
    {{ store.name }}
  </button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];
// A key of `data` makes a GeoJSON source with that id. A circle layer draws its
// points.
const data = {
  stores: points(stores, {
    lngLat: s => s.at,
    properties: s => ({name: s.name}),
  }),
};
const layers = [
  {
    id: 'stores',
    type: 'circle',
    source: 'stores',
    paint: {
      'circle-radius': 7,
      'circle-color': '#d6453d',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
];

export default function Stores() {
  const map = useRef(null);
  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        initialView={{center: [-73.995, 40.72], zoom: 11.5}}
        data={data}
        layers={layers}
        attribution={{compact: true}}
      />
      {stores.map(store => (
        <button
          key={store.name}
          onClick={() =>
            map.current?.moveTo({center: store.at, zoom: 15, duration: 500})
          }
        >
          {store.name}
        </button>
      ))}
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const stores = [
    {name: 'Downtown', at: [-74.0089, 40.7096]},
    {name: 'Midtown', at: [-73.9857, 40.7484]},
    {name: 'Brooklyn', at: [-73.9903, 40.6928]},
  ];
  let map = null;
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-73.995, 40.72], zoom: 11.5},
    attribution: {compact: true},
    // A key of `data` makes a GeoJSON source with that id. A circle layer draws
    // its points.
    data: {
      stores: points(stores, {
        lngLat: s => s.at,
        properties: s => ({name: s.name}),
      }),
    },
    layers: [
      {
        id: 'stores',
        type: 'circle',
        source: 'stores',
        paint: {
          'circle-radius': 7,
          'circle-color': '#d6453d',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      },
    ],
  };
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
{#each stores as store (store.name)}
  <button
    onclick={() => map?.moveTo({center: store.at, zoom: 15, duration: 500})}
    >{store.name}</button
  >
{/each}
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Stores on a map, with a button for each</title>
<!--
  The map shows three stores, and
  a button below the map for each
  store moves the map to it.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-73.995,40.72"
  zoom="11.5"
  attribution-compact
  style="height: 500px"
></map-jr>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {points} from '@map-jr/map-jr-gl';

  const stores = [
    {name: 'Downtown', at: [-74.0089, 40.7096]},
    {name: 'Midtown', at: [-73.9857, 40.7484]},
    {name: 'Brooklyn', at: [-73.9903, 40.6928]},
  ];
  const map = document.getElementById('map');
  // A key of `data` makes a
  // GeoJSON source with that id.
  // A circle layer draws its
  // points.
  map.data = {
    stores: points(stores, {
      lngLat: s => s.at,
      properties: s => ({name: s.name}),
    }),
  };
  map.layers = [
    {
      id: 'stores',
      type: 'circle',
      source: 'stores',
      paint: {
        'circle-radius': 7,
        'circle-color': '#d6453d',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
  ];

  map.after(
    ...stores.map(store => {
      const button = Object.assign(document.createElement('button'), {
        textContent: store.name,
      });
      button.onclick = () =>
        map.map.moveTo({center: store.at, zoom: 15, duration: 500});
      return button;
    }),
  );
</script>
```
<!-- example:stores:end -->

## The tests

Each test runs with [Vitest](https://vitest.dev/) in happy-dom, which the comment `// @vitest-environment happy-dom`
selects. Install `vitest`, `happy-dom` and the packages of your framework, and give `vitest.config.js` its plugin:

| Framework | Packages for the test | `plugins` of `vitest.config.js` |
|---|---|---|
| Vue | `@vue/test-utils`, `@vitejs/plugin-vue` | `[vue()]` |
| React | `@testing-library/react`, `@testing-library/dom`, `@vitejs/plugin-react` | `[react()]` |
| Svelte | `@sveltejs/vite-plugin-svelte` | `[svelte()]` |

Svelte mounts a component only with its browser build, so its configuration also sets `resolve.conditions`:

```js
// vitest.config.js
import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {conditions: ['browser']},
});
```

For Vue, import `vue` from `@vitejs/plugin-vue` and write `plugins: [vue()]` with no `resolve`. For React, do the same
with `react` from `@vitejs/plugin-react`.

**Vue**

<!-- file:tests/stores.vue.test.js:start -->
```js
// @vitest-environment happy-dom

// A test of the component stores.vue, with Vitest, @vue/test-utils and
// happy-dom.
import {describe, expect, it, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import Stores from '../stores.vue';

// happy-dom has no WebGL, so the test replaces MapJr with a stub. The stub
// declares the props that the test reads, and its template ref has `moveTo`, as
// the template ref of MapJr has. The other exports of the adapter stay as they
// are.
const {moveTo} = vi.hoisted(() => ({moveTo: vi.fn()}));
vi.mock('@map-jr/map-jr-gl/vue', async importOriginal => {
  const {defineComponent, h} = await import('vue');
  return {
    ...(await importOriginal()),
    MapJr: defineComponent({
      props: {data: Object},
      setup(props, {expose}) {
        expose({moveTo});
        return () =>
          h('div', {
            'data-test': 'map',
            'data-stores': props.data.stores.features.length,
          });
      },
    }),
  };
});

describe('Stores', () => {
  it('gives the map a point for each store', () => {
    const wrapper = mount(Stores);
    expect(wrapper.get('[data-test="map"]').attributes('data-stores')).toBe(
      '3',
    );
  });

  it('moves the map to a store on a click', async () => {
    const wrapper = mount(Stores);
    await wrapper.findAll('button')[1].trigger('click');
    expect(moveTo).toHaveBeenCalledWith(
      expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}),
    );
  });
});
```
<!-- file:tests/stores.vue.test.js:end -->

**React**

<!-- file:tests/stores.react.test.jsx:start -->
```jsx
// @vitest-environment happy-dom

// A test of the component stores.jsx, with Vitest, @testing-library/react and
// happy-dom.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import Stores from '../stores.jsx';

// happy-dom has no WebGL, so the test replaces MapJr with a stub. The stub
// reads the props that the test checks, and its ref has `moveTo`, as the ref of
// MapJr has. The other exports of the adapter stay as they are.
const {moveTo} = vi.hoisted(() => ({moveTo: vi.fn()}));
vi.mock('@map-jr/map-jr-gl/react', async importOriginal => {
  const {forwardRef, useImperativeHandle} = await import('react');
  return {
    ...(await importOriginal()),
    MapJr: forwardRef(function MapJr({data}, ref) {
      useImperativeHandle(ref, () => ({moveTo}));
      return (
        <div data-testid="map" data-stores={data.stores.features.length} />
      );
    }),
  };
});

afterEach(cleanup);

describe('Stores', () => {
  it('gives the map a point for each store', () => {
    render(<Stores />);
    expect(screen.getByTestId('map').dataset.stores).toBe('3');
  });

  it('moves the map to a store on a click', () => {
    render(<Stores />);
    fireEvent.click(screen.getByRole('button', {name: 'Midtown'}));
    expect(moveTo).toHaveBeenCalledWith(
      expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}),
    );
  });
});
```
<!-- file:tests/stores.react.test.jsx:end -->

**Svelte**

<!-- file:tests/stores.svelte.test.js:start -->
```js
// @vitest-environment happy-dom

// A test of the component stores.svelte, with Vitest and happy-dom.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {flushSync, mount, unmount} from 'svelte';
import Stores from '../stores.svelte';

// happy-dom has no WebGL, so the test replaces the action mapJr. The stub makes
// no map: it keeps each description and calls `ready` with an object that has
// `moveTo`, as the map has. The other exports of the entry stay as they are.
const {moveTo, descriptions} = vi.hoisted(() => ({
  moveTo: vi.fn(),
  descriptions: [],
}));
vi.mock('@map-jr/map-jr-gl/svelte', async importOriginal => ({
  ...(await importOriginal()),
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
    [...document.querySelectorAll('button')]
      .find(b => b.textContent === 'Midtown')
      .click();
    expect(moveTo).toHaveBeenCalledWith(
      expect.objectContaining({center: [-73.9857, 40.7484], zoom: 15}),
    );
  });
});
```
<!-- file:tests/stores.svelte.test.js:end -->

The tests import the component from `../stores.vue`, `../stores.jsx` and `../stores.svelte`. Change the path to the
file of your component.

## How it works

- `vi.mock` replaces one export of the adapter (`MapJr`) or of the Svelte entry (`mapJr`), and `importOriginal` keeps
  the other exports. `points` comes from `@map-jr/map-jr-gl`, which the tests leave as it is. `vi.hoisted` creates the
  spy `moveTo` before `vi.mock` runs, because Vitest moves `vi.mock` to the top of the file.
- The stub declares only the props that the test reads, here `data`. In Vue, the other props become attributes of the
  `<div>` of the stub.
- The stub gives the template ref (Vue), the ref (React) or `ready` (Svelte) an object with `moveTo`, so the test can
  check the call that a click on a button makes.
- In Svelte, the stub replaces the action `mapJr`. It keeps each description that the component gives, so the test
  reads the last one.

## Variations

### Nuxt with `@nuxt/test-utils`

In the environment `nuxt` of `@nuxt/test-utils`, the `vi.mock` call of the Vue test is the same. Change the first line
of the test to `// @vitest-environment nuxt`, and mount the component with `mountSuspended` in place of `mount`. It
returns a promise, so each test that mounts is `async`. `mockComponent('MapJr', …)` does not work: see
[Replace `MapJr` in a component test](../reference/nuxt.md#replace-mapjr-in-a-component-test).

```js
import {mountSuspended} from '@nuxt/test-utils/runtime';

it('gives the map a point for each store', async () => {
  const wrapper = await mountSuspended(Stores);
  expect(wrapper.get('[data-test="map"]').attributes('data-stores')).toBe('3');
});
```

## See also

- [The template ref](../reference/vue.md#the-template-ref) of `MapJr` in Vue, and
  [the ref](../reference/react.md#the-ref) in React.
- [`mapJr`](../reference/svelte.md#mapjr) for the options of the Svelte action.
