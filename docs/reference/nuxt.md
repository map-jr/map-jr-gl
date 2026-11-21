# Nuxt

The module `@map-jr/map-jr-gl/nuxt` sets up the [Vue components and composables](vue.md) of `@map-jr/map-jr-gl/vue`
in Nuxt. With the module, Vite loads the tile workers in development. The module requires `@nuxt/kit` 3 or 4 as a peer dependency. The module has no options: a key `mapJr` in
`nuxt.config.ts` is accepted and has no effect.

```ts
// nuxt.config.ts
export default defineNuxtConfig({modules: ['@map-jr/map-jr-gl/nuxt']});
```

```vue
<!-- app/pages/index.vue (pages/index.vue in Nuxt 3) -->
<template>
  <div style="height: 400px">
    <LazyMapJr
      hydrate-on-visible
      ssr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}"
      :controls="[navigationControl()]"
    />
  </div>
</template>
```

## Components, composables and controls

| Name | Kind | Source |
|---|---|---|
| `MapJr`, `MapOverlay`, `MapImage` | Components, and `LazyMapJr` (see [`LazyMapJr`](#lazymapjr)) | [`@map-jr/map-jr-gl/vue`](vue.md) |
| `useMapJr`, `useMapInstance`, `useMapFeatures`, `useMapSource` | Composables | [`@map-jr/map-jr-gl/vue`](vue.md) |
| `navigationControl`, `scaleControl`, `fullscreenControl`, `geolocateControl`, `terrainControl`, `globeControl`, `colorSchemeControl`, `customControl` | Functions that create controls | `navigation`, `scale`, `fullscreen`, `geolocate`, `terrain`, `globe`, `colorScheme` and `custom` of `@map-jr/map-jr-gl/controls` |

The controls have longer names than their exports, because `scale` and `navigation` are common words. A file that
imports from `@map-jr/map-jr-gl/controls` itself uses the short names.

The module also adds `@map-jr/map-jr-gl`, `@map-jr/map-jr-gl/vue` and `@map-jr/map-jr-gl/controls` to
`vite.optimizeDeps.exclude`. When Vite pre-bundles the package in development, the tile workers do not load. Without
the module, set it yourself:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      exclude: [
        '@map-jr/map-jr-gl',
        '@map-jr/map-jr-gl/vue',
        '@map-jr/map-jr-gl/controls',
      ],
    },
  },
});
```

## `LazyMapJr`

`LazyMapJr` is `MapJr` with the code of the map in a file of its own. With `hydrate-on-visible`, the browser loads
that file and starts the map when the map comes into view, so a page with a map far down loads no map code before
then. With the prop [`ssr`](vue.md#ssr), the page shows the first view from the server at once.

The Nitro server then
fetches the style and the tiles while it renders the page, within the
[limits for requests](server.md#limits-for-requests) of the server renderer: see
[Server rendering](../guide/server-rendering.md). A route that Nuxt does not render on the server (`ssr: false`)
has no first view, and the map starts in the browser.

The other exports of `@map-jr/map-jr-gl/vue` do not load the code of the map. A component that uses `MapOverlay`,
`MapImage` or `useMapInstance` next to a `LazyMapJr` does not bring that code into the page.

A template ref on `LazyMapJr` with `hydrate-on-visible`, or with another `hydrate-*` prop, holds the wrapper that
Nuxt puts around `MapJr`. It has none of the members of the map, also after hydration. Reach the map in one of these ways:

- `@load` receives the map, as in the example below.
- The default slot receives `map` and `state`: `<LazyMapJr hydrate-on-visible v-slot="{map}">`.
- `useMapInstance()` in a component of your own inside `LazyMapJr` returns a ref with the map.

```vue
<script setup>
// A shallowRef keeps the map as it is, with no reactive proxy around it.
const map = shallowRef(null);
</script>

<template>
  <div style="height: 400px">
    <LazyMapJr
      hydrate-on-visible
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}"
      @load="instance => (map = instance)"
    />
  </div>
  <button @click="map?.moveTo({zoom: 15, duration: 500})">Zoom to 15</button>
</template>
```

Without a `hydrate-*` prop, the template ref on `LazyMapJr` holds [the members of `MapJr`](vue.md#the-template-ref).

## Replace `MapJr` in a component test

A test environment such as happy-dom or jsdom has no WebGL, so a component test replaces `MapJr` with a stub. The
module registers the named export `MapJr` of `@map-jr/map-jr-gl/vue`, so `mockComponent('MapJr', …)` of
`@nuxt/test-utils` does not replace it. The test then fails with
`No "MapJr" export is defined on the "@map-jr/map-jr-gl/vue" mock`. Replace the export with `vi.mock` of Vitest
instead. This works with the module and without it.

```ts
// test/StoreMap.test.ts, in the environment `nuxt` of @nuxt/test-utils
import {describe, expect, it, vi} from 'vitest';
import {mountSuspended} from '@nuxt/test-utils/runtime';
import StoreMap from '../app/components/StoreMap.vue';

// The stub replaces only MapJr. The other exports of the adapter stay as they
// are.
vi.mock('@map-jr/map-jr-gl/vue', async importOriginal => {
  const {defineComponent, h} = await import('vue');
  return {
    ...(await importOriginal<typeof import('@map-jr/map-jr-gl/vue')>()),
    MapJr: defineComponent({
      props: {mapStyle: String},
      setup:
        (props, {slots}) =>
        () =>
          h(
            'div',
            {'data-test': 'map', 'data-style': props.mapStyle},
            slots.default?.(),
          ),
    }),
  };
});

describe('StoreMap', () => {
  it('passes the style to the map', async () => {
    const wrapper = await mountSuspended(StoreMap);
    expect(wrapper.find('[data-test="map"]').attributes('data-style')).toBe(
      'https://styles.map-jr.org/1/elevation-zero.json',
    );
  });
});
```

`StoreMap.vue` is a component with a `<MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" />`. In
Vitest without Nuxt, the `vi.mock` call is the same, and `mount` of `@vue/test-utils` replaces `mountSuspended`.

## See also

- [Vue](vue.md) for the props, events and slots of the components.
- [The `ssr` prop of `<MapJr>`](server.md#the-ssr-prop-of-mapjr) for the first view from the server.
- [Controls](../guide/controls.md) for the options of each control.
