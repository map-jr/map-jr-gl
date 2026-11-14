# Vue and Nuxt

The entry `@map-jr/map-jr-gl/vue` has a component and a composable for Vue 3.5 or later. They are a thin layer over
[the main API](api.md): the component gives its props to the map as one description.

## The component

```vue
<script setup>
import {ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
const pins = shallowRef({
  id: 'places',
  svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>',
  width: 24, height: 24,
  data: [{lngLat: [-74.0065, 40.7085], props: {color: '#d6453d'}}],
});
const hovered = ref([]);
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://tiles.openfreemap.org/styles/liberty"
      v-model:view="view"
      :markers="[pins]"
      :interactive-layers="['poi_r1', 'poi_r7']"
      @hover="hovered = $event"
      @click="event => console.log(event.lngLat, event.features)"
    />
  </div>
</template>
```

The component fills its parent element (`height: 100%`). Give the parent a height. A parent that has only
`min-height` gives the component a height of 0, because a percentage height needs a parent with a set height: write
`height` on the parent, or make the parent a flex or grid container. The development build warns about a container
with a height of 0. Vite and the module for Nuxt use the development build in development (`vite`, `nuxt dev`). A
production build has no such warning, and there the map stays empty without a message.

### Props

| Prop | Meaning |
|---|---|
| `map-style` | A style object or the URL of a style. Required. (`style` is the CSS style of an element in Vue, so the prop has this name.) |
| `view` | The view, for `v-model:view`. Without it, the map starts at `initial-view` and the user moves it. |
| `initial-view` | The view at the start. |
| `extend` | Your own sources and layers on a style from a URL: `{sources, layers, terrain}`. See [the main API](api.md). |
| `images` | Images for the style layers, by name: `:images="{pin: pinSvg}"`. See [Images for style layers](api.md#images-for-style-layers). The render on the server draws those that are SVG documents. |
| `markers` | A list of marker layers, each with the name of an image of `images` (or of a `MapImage`). See [Markers](markers.md). |
| `data` | GeoJSON data for sources of the style, by the id of the source: `:data="{routes}"`. See "GeoJSON data that changes" in [the main API](api.md). Use a `shallowRef` for each value, and give a new object to change it. |
| `interactive-layers` | The ids of style layers whose features are found under the pointer. |
| `controls` | Controls from `@map-jr/map-jr-gl/controls`: `:controls="[navigation(), scale()]"`. See [the main API](api.md). |
| `min-zoom`, `max-zoom`, `max-pitch`, `max-bounds`, `cursor` | As in [the main API](api.md). |
| `renderer`, `fonts`, `font-family`, `glyphs`, `interactive`, `antialias`, `attribution`, `hash` | Read only when the map is made. |
| `ssr` | Render the first view on the server. See below. |

### Events

| Event | Value |
|---|---|
| `update:view` | The view, after each change. |
| `click` | `{point, lngLat, features}` |
| `hover` | The features of `interactive-layers` under the pointer. |
| `load` | The map (the `MapHost`). `load` comes once, before the first `idle`. When `load` comes, `host.state.get().idle` is still `false`. |
| `idle` | None. |
| `error` | Each error of the map (an `Error`). Without a listener for this event, the map writes each error to the console. |
| Each other event of the map | The event of `listen` of the main API: `@moveend`, `@zoomend`, `@styleimagemissing`, `@sourcedata` and the others. See [Events](api.md#events) for the list. The event `style.load` has the name `styleload` here. |

The component listens to an event of the map only when it has a listener for it when it is made. The events
`click`, `load`, `idle` and `error` of the component have the values of the table, not the events of the map with
those names: use `host.listen` for those.

An image that the style asks for and the map does not have:

```vue
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const images = ref({});
// The name is in `id`. Add an image with that name, and the map draws it.
function missing(event) {
  if (event.id.startsWith('badge-')) images.value[event.id] = `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#d6453d"/></svg>`;
}
</script>

<template>
  <MapJr map-style="https://tiles.openfreemap.org/styles/liberty" :images="images" @styleimagemissing="missing" />
</template>
```

### The slot

The default slot is drawn over the map. It gets `state` (the state of the map) and `host` (the map, for
`queryFeatures`, `moveTo` and `fitBounds`).

```vue
<MapJr :map-style="style" v-slot="{state}">
  <p v-if="state && !state.loaded">Loading</p>
</MapJr>
```

A template ref on the component also has `host` (the map, `null` until it is made) and `state`. In TypeScript,
type the ref as `InstanceType<typeof MapJr>`: `useTemplateRef<InstanceType<typeof MapJr>>('map')`. The type
`MapJrExposed` of `@map-jr/map-jr-gl/vue` has only these two members. A template ref on `LazyMapJr` of Nuxt with a
`hydrate-*` prop does not reach them (see [The module for Nuxt](#the-module-for-nuxt)).

### Elements of the page on the map

`MapOverlay` puts its content at a position of the map. Use it inside `MapJr`.

```vue
<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const selected = ref(null);
</script>

<template>
  <MapJr :map-style="style" :interactive-layers="['places']" @click="e => selected = e.features[0] && {lngLat: e.lngLat, name: e.features[0].properties.name}">
    <MapOverlay :lng-lat="[-74.0065, 40.7085]" anchor="bottom"><img src="/pin.svg" alt="Office"></MapOverlay>
    <MapOverlay v-if="selected" :lng-lat="selected.lngLat" popup @close="selected = null">{{ selected.name }}</MapOverlay>
  </MapJr>
</template>
```

| Prop | Meaning |
|---|---|
| `lng-lat` | The position. Required. |
| `anchor` | The part of the content that is at the position: `center` (the default), `bottom`, `top-left` and others. |
| `offset` | A distance in pixels from the position, to the right and down. |
| `popup` | Show the content in a box with a pointer to the position. |

With a listener for `close`, a popup has a button to close it.

The content is Vue content: it can have components, events and reactive values. Use `MapOverlay` for some elements.
For many markers, use the `markers` prop: those are drawn on the canvas.

### An image in the template

`MapImage` gives an image to the style layers of the map. Use it inside `MapJr`, and write the SVG in its slot. A
layer uses the image by its name in `icon-image`.

```vue
<script setup>
import {MapJr, MapImage} from '@map-jr/map-jr-gl/vue';

const places = {type: 'FeatureCollection', features: [
  {type: 'Feature', properties: {color: '#d6453d'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', properties: {color: '#2f7fd1'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]};
const extend = {
  sources: {places: {type: 'geojson', data: places}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true}}],
};
</script>

<template>
  <MapJr map-style="https://tiles.openfreemap.org/styles/liberty" :initial-view="{center: [-73.996, 40.73], zoom: 11.5}" :extend="extend">
    <MapImage name="pin" :params="['color']" v-slot="{color}">
      <svg viewBox="0 0 24 31"><path :fill="color" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>
    </MapImage>
  </MapJr>
</template>
```

| Prop | Meaning |
|---|---|
| `name` | The name of the image. Required. |
| `params` | The names of the parameters of the image. The slot gets a prop for each name. |
| `src` | The URL of an image, in place of an SVG in the slot: `<MapImage name="photo" src="/photo.png" />`. |
| `width`, `height` | The size in CSS pixels. Without them, an SVG has the size of its `viewBox` or else of its `width` and `height` attributes, and another image has its own size. |
| `pixel-ratio` | The number of image pixels for one CSS pixel. The default is 1. |

A parameter is not a value of Vue. Each feature of the layer gives it a value: the property of the feature that has
the name of the parameter, or the value of an expression in the layer (`['image', 'pin', {params: {color: ...}}]`).
See [An image that is a template](api.md#an-image-that-is-a-template). Vue renders the SVG one time, and the map
draws it one time for each different set of values.

- Bind a parameter to an attribute (`:fill="color"`) or write it as text (`<text>{{ label }}</text>`).
- The rest of the SVG is Vue content, also components. When it changes, the map gets the image again.
- The SVG is not in the page: a `<style>` or an `id` inside it has no effect on the page.
- An image of a `MapImage` is used before an image of the prop `images` with the same name. With two `MapImage` of
  one name, the map has the image while one of them is there.
- In the development build, a `MapImage` outside `MapJr`, and a `MapImage` with no `<svg>` and no `src`, give a
  warning.
- With TypeScript, a prop of the slot that is not in `params` is a type error.
- The server renderer does not draw the image.

A component of your own inside `MapJr` gets the map with `useMapHost()` (a ref).

`useMapFeatures(at, options)` gives the features at a place as a ref that stays up to date (see `watchFeatures` in [the API](api.md#queries)). The place and the options can be refs or functions:

```js
const rain = useMapFeatures(() => [props.lng, props.lat], {sources: ['rain']});
```

### How the component sees changes

You can change the props as in other Vue code. The component sees these changes:

| Change | Example |
|---|---|
| A new value for a prop | `view = {center, zoom}`, `markers = [...]` |
| A field of the view | `view.zoom = 15` |
| A marker layer added or removed | `markers.push(layer)`, `markers.splice(0, 1)` |
| A marker added, removed or replaced | `layer.data.push(marker)`, `layer.data[3] = {...layer.data[3], props}` |
| A part of a reactive style object | `style.layers[4].paint['fill-color'] = '#f00'` |
| An array or object that the template makes again each time | `:controls="[navigation()]"`, `:interactive-layers="['places']"` |

### The view of `v-model:view`

The component writes each view of the map to `view`, and it moves the map when your code changes `view`. There is
one exception. The map keeps the last 60 views that it reported, with no time limit, and it ignores a view whose
`center`, `zoom`, `bearing` and `pitch` are all equal to those of one of them. This stops a slow page from pulling
the map back while the user moves it.

So a button that stores the view and gives it back a moment later ("back to where I was") can do nothing. Move the
map with `moveTo` for this:

```vue
<script setup>
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6, bearing: 0, pitch: 0});
const map = useTemplateRef('map');
let stored = view.value;
</script>

<template>
  <div style="height: 400px">
    <MapJr ref="map" map-style="https://tiles.openfreemap.org/styles/liberty" v-model:view="view" />
  </div>
  <button @click="stored = view">Remember this view</button>
  <button @click="map.host.moveTo({...stored, duration: 500})">Back to where I was</button>
</template>
```

### Changes inside a marker

The component does not see one change: a change inside one marker (`layer.data[3].props.color = '#f00'`). Replace
the marker, as in the table.

To see a change inside each marker, Vue would have to make each marker reactive and look at each one after each
change. The component asks Vue about a data array as a whole. This costs the same for ten markers and for 100,000.

For the best performance with large data:

- Use `shallowRef` for marker data and for a style object, and give a new array or object to change them.
  A `ref` also works; it only makes reactive what your code reads.
- Give the style as a URL, or as an object that is made one time. An object that the template makes again each time
  is compared with the last one by its content.

Reactive objects (proxies made by `reactive()` or `ref()`) are accepted in both entries, also when a map of
`@map-jr/map-jr-gl/maplibre-compat` gets them in `addSource`, `setData`, `setStyle` or `jumpTo`. Structured clone
cannot copy a proxy, so the map sends such data to its workers as a JSON copy. That copy costs time for large GeoJSON,
and `shallowRef` or `toRaw()` avoids it. Data that JSON cannot copy either, such as an object that contains itself, is
an `error` event with a `[map-jr-gl]` message. A map object kept in the data of a component is not made reactive.

## The composable

`useMap` makes a map in an element of your own. The description (`MapSpec`, see [the main API](api.md)) can be a
ref, a computed value or a function.

```vue
<script setup>
import {computed, ref, useTemplateRef} from 'vue';
import {useMap} from '@map-jr/map-jr-gl/vue';

const measuring = ref(false);
const {host, state} = useMap(useTemplateRef('el'), computed(() => ({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  cursor: measuring.value ? 'crosshair' : undefined,
})));
</script>

<template>
  <div ref="el" style="height: 400px" />
  <p>Zoom {{ state?.view.zoom.toFixed(1) }}</p>
  <button @click="measuring = !measuring">Measure</button>
  <button @click="host?.moveTo({zoom: 15, duration: 500})">Zoom to 15</button>
</template>
```

`state` is a ref with the state of the map. `host` is a ref with the map when it is there.

`useMap` calls `update` of the map each time that the description is a new object:

- Give a new description object for each change. A computed value or a function does this when a ref that it reads
  changes, as `measuring` does in the example.
- A change inside a `ref` is not seen. With `const description = ref({style, cursor: ''})`, the assignment
  `description.value.cursor = 'crosshair'` does nothing. Write
  `description.value = {...description.value, cursor: 'crosshair'}`.
- `initialView` is read only when the map is made, so a ref inside `initialView` does not move the map. To move the
  map, call `host.value.moveTo(view)`, or give `view` and `onViewChange` in the description. See "A view that the
  application owns" in [the main API](api.md).

## The module for Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({modules: ['@map-jr/map-jr-gl/nuxt']});
```

The module adds `@map-jr/map-jr-gl` to `vite.optimizeDeps.exclude`, so that Vite in development does not pre-bundle
the package and the tile workers load (see `docs/loading.md`). Without the module, add that setting yourself.

With the module, a page uses the components without an import:

```vue
<template>
  <div style="height: 400px">
    <LazyMapJr hydrate-on-visible map-style="https://tiles.openfreemap.org/styles/liberty"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}" :controls="[navigationControl()]" ssr />
  </div>
</template>
```

- `MapJr`, `MapOverlay` and `MapImage` are registered, and `useMap`, `useMapHost` and `useMapFeatures`.
- The controls have longer names, because `scale` and `navigation` are common words: `navigationControl()`,
  `scaleControl()`, `fullscreenControl()`, `geolocateControl()`, `terrainControl()`.
- `LazyMapJr` puts the code of the map into a file of its own. With `hydrate-on-visible`, the browser loads that file
  and starts the map when the map comes into view. Together with `ssr`, the visitor sees the map from the server at
  once, and a page with a map far down loads no map code until it is necessary.
- The other exports of `@map-jr/map-jr-gl/vue` do not load the map code. `MapJr` and `useMap` load it with `import()`
  when the map is mounted, so a component that uses `MapOverlay`, `MapImage` or `useMapHost` next to a `LazyMapJr`
  does not bring the map code into the page. The file `vue.js` and what it imports are about 3 KB (gzip). The `host`
  of `useMap` is `null` until that code has loaded, also in `onMounted`.
- A template ref on `LazyMapJr` with `hydrate-on-visible` (or another `hydrate-*` prop) is the lazy wrapper that
  Nuxt puts around `MapJr`, and it has no `host` and no `state`, also after hydration. Without a `hydrate-*` prop,
  the ref on `LazyMapJr` has them. To reach the map of a lazily hydrated map, use one of these:
  - `@load`, which gets the map: `<LazyMapJr hydrate-on-visible @load="host => (map = host)" ... />`.
  - The default slot, which gets `host` and `state`: `<LazyMapJr hydrate-on-visible v-slot="{host}">`.
  - `useMapHost()` in a component of your own inside `LazyMapJr`.

Without the module, import the components (`import {MapJr} from '@map-jr/map-jr-gl/vue'`). For lazy loading, use
`defineAsyncComponent` of Vue:

```js
import {defineAsyncComponent, hydrateOnVisible} from 'vue';
const MapJr = defineAsyncComponent({loader: () => import('@map-jr/map-jr-gl/vue').then(m => m.MapJr), hydrate: hydrateOnVisible()});
```

### `MapJr` in a component test

A component test usually replaces `MapJr` with a stub, because the test environment (happy-dom or jsdom) has no
WebGL. Replace the export `MapJr` of `@map-jr/map-jr-gl/vue` with `vi.mock` of Vitest. This works with the module
for Nuxt and without it, because the module registers `MapJr` from that same module name.

`mockComponent('MapJr', ...)` of `@nuxt/test-utils` does not work with the module: it replaces the default export of
the file that registers the component, but the module registers the named export `MapJr`. The test then fails with
`No "MapJr" export is defined on the "@map-jr/map-jr-gl/vue" mock`.

The component under test, `app/components/StoreMap.vue`:

```vue
<template>
  <div style="height: 400px">
    <MapJr map-style="https://tiles.openfreemap.org/styles/liberty" :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}" />
  </div>
</template>
```

A test with `@nuxt/test-utils` (environment `nuxt` in `vitest.config.ts`):

```ts
// test/StoreMap.test.ts
import {describe, expect, it, vi} from 'vitest';
import {mountSuspended} from '@nuxt/test-utils/runtime';
import StoreMap from '../app/components/StoreMap.vue';

// The stub replaces only MapJr. The other exports of the adapter stay as they are.
vi.mock('@map-jr/map-jr-gl/vue', async importOriginal => {
    const {defineComponent, h} = await import('vue');
    return {
        ...await importOriginal<typeof import('@map-jr/map-jr-gl/vue')>(),
        MapJr: defineComponent({
            props: {mapStyle: String},
            setup: (props, {slots}) => () => h('div', {'data-test': 'map', 'data-style': props.mapStyle}, slots.default?.()),
        }),
    };
});

describe('StoreMap', () => {
    it('passes the style to the map', async () => {
        const wrapper = await mountSuspended(StoreMap);
        expect(wrapper.find('[data-test="map"]').attributes('data-style')).toBe('https://tiles.openfreemap.org/styles/liberty');
    });
});
```

In plain Vitest without Nuxt, the `vi.mock` call is the same. Mount the component with `mount` of `@vue/test-utils`
instead of `mountSuspended`. The stub renders the default slot of `MapJr`. It declares only the props that the test reads, and
Vue passes the other props (here `initial-view`) on as attributes of the `div`.

## Nuxt and server rendering

The component works in Nuxt without `<ClientOnly>`. On the server it renders an empty element. In the browser the
map starts in that element, with its controls and credits. This is the same with and without the `ssr` prop.

With the `ssr` prop, the server also renders the first view as SVG:

```vue
<MapJr
  map-style="https://tiles.openfreemap.org/styles/liberty"
  :initial-view="view"
  :markers="[pins]"
  :controls="[navigation()]"
  :ssr="{
    width: 800, height: 500,
    overrides: {building: {hidden: true}, 'road_minor': {minzoom: 15}, poi_r20: {hidden: true}},
  }"
/>
```

- The server renders the map with `renderToSVG` from `@map-jr/map-jr-gl/server`. See [Server rendering](server-rendering.md).
- The page shows the map before a script has run.
- In the browser, Vue takes over the HTML, and the map removes the SVG when it has drawn its first frame. The
  controls show from that moment; they are not in the SVG.
- The server needs the style as an object or as a URL that it can fetch.
- The server renders `map-style`, the centre, the zoom and the bearing of the view, the sources and layers of
  `extend`, the GeoJSON of `data`, and `markers` with the images of `images` that are SVG documents. It renders a
  tilted view (`pitch`) from straight above.
- The requests of the server have time limits: 10 seconds for one request and 30 seconds for all requests of one
  render. Change them with `timeout` and `requestTimeout` in the `ssr` prop, limit the size of a response with
  `maxBytes`, and the hosts with `allowHosts`. When the render fails, the component does not catch the error. See
  "Limits for requests" in [Server rendering](server-rendering.md).
- The layout does not shift: the element has its size from your page, and the map changes nothing around it. A
  test of the library measures this.

| Option of `ssr` | Meaning |
|---|---|
| `width`, `height` | The size in pixels that the map has on most screens (800 by 500 without them). The SVG is scaled to the element. |
| `overrides` | Changes to style layers for the server render only, by the id of the layer. Use them to make the SVG smaller for a style that you do not write yourself. The values are those of `map-jr:ssr`: `hidden`, `filter`, `minzoom`, `maxzoom`, `paint`, `layout`, `simplify`, `minSize`. See "Simplify the server render" in [Server rendering](server-rendering.md). |
| `attribution` | The credits to show with the SVG: a string or a list of strings. |
| `timeout`, `requestTimeout`, `maxBytes`, `allowHosts` | The limits for the requests of the server render, as in `renderToSVG`. The defaults are 30000 ms, 10000 ms, no limit and all hosts. |

### The credits

The server loads the style and its sources, so it knows their credits. It puts them into the page with the SVG, as
text and links. The map replaces them with its own credits control in the browser. To show other text, give
`attribution` in the `ssr` prop. With `:attribution="false"` on the component, the server shows no credits, and
you show them yourself.

The SVG of a city can be some hundred KB. In the test of this library, three overrides (no buildings, no building
outlines, no small roads) change a page of 245 KB to 115 KB.
