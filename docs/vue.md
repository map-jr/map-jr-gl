# Vue and Nuxt

The entry `map-jr-gl/vue` has a component and a composable for Vue 3.5 or later. They are a thin layer over
[the main API](api.md): the component gives its props to the map as one description.

## The component

```vue
<script setup>
import {ref, shallowRef} from 'vue';
import {MapJr} from 'map-jr-gl/vue';

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

The component fills its parent element. Give the parent a height.

### Props

| Prop | Meaning |
|---|---|
| `map-style` | A style object or the URL of a style. Required. (`style` is the CSS style of an element in Vue, so the prop has this name.) |
| `view` | The view, for `v-model:view`. Without it, the map starts at `initial-view` and the user moves it. |
| `initial-view` | The view at the start. |
| `extend` | Your own sources and layers on a style from a URL: `{sources, layers, terrain}`. See [the main API](api.md). |
| `markers` | A list of marker layers. See [Markers](markers.md). |
| `data` | GeoJSON data for sources of the style, by the id of the source: `:data="{routes}"`. See "GeoJSON data that changes" in [the main API](api.md). Use a `shallowRef` for each value, and give a new object to change it. |
| `interactive-layers` | The ids of style layers whose features are found under the pointer. |
| `controls` | Controls from `map-jr-gl/controls`: `:controls="[navigation(), scale()]"`. See [the main API](api.md). |
| `min-zoom`, `max-zoom`, `max-pitch`, `max-bounds`, `cursor` | As in [the main API](api.md). |
| `renderer`, `fonts`, `font-family`, `glyphs`, `interactive`, `antialias`, `attribution`, `hash` | Read only when the map is made. |
| `ssr` | Render the first view on the server. See below. |

### Events

| Event | Value |
|---|---|
| `update:view` | The view, after each change. |
| `click` | `{point, lngLat, features}` |
| `hover` | The features of `interactive-layers` under the pointer. |
| `load`, `idle` | None |
| `error` | The error |

### The slot

The default slot is drawn over the map. It gets `state` (the state of the map) and `host` (the map, for
`queryFeatures`, `moveTo` and `fitBounds`).

```vue
<MapJr :map-style="style" v-slot="{state}">
  <p v-if="state && !state.loaded">Loading</p>
</MapJr>
```

A template ref on the component also has `host` and `state`.

### Elements of the page on the map

`MapOverlay` puts its content at a position of the map. Use it inside `MapJr`.

```vue
<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from 'map-jr-gl/vue';

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

A component of your own inside `MapJr` gets the map with `useMapHost()` (a ref).

`useMapFeatures(where, options)` gives the features at a place as a ref that stays up to date (see `watchFeatures` in [the API](api.md#queries)). The place and the options can be refs or functions:

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

The component does not see one change: a change inside one marker (`layer.data[3].props.color = '#f00'`). Replace
the marker, as in the table.

To see a change inside each marker, Vue would have to make each marker reactive and look at each one after each
change. The component asks Vue about a data array as a whole. This costs the same for ten markers and for 100,000.

For the best performance with large data:

- Use `shallowRef` for marker data and for a style object, and give a new array or object to change them.
  A `ref` also works; it only makes reactive what your code reads.
- Give the style as a URL, or as an object that is made one time. An object that the template makes again each time
  is compared with the last one by its content.

## The composable

`useMap` makes a map in an element of your own. The description can be a ref, a computed value or a function.

```vue
<script setup>
import {computed, ref, useTemplateRef} from 'vue';
import {useMap} from 'map-jr-gl/vue';

const zoom = ref(13.6);
const {host, state} = useMap(useTemplateRef('el'), computed(() => ({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: zoom.value},
})));
</script>

<template>
  <div ref="el" style="height: 400px" />
  <p>Zoom {{ state?.view.zoom.toFixed(1) }}</p>
</template>
```

`state` is a ref with the state of the map. `host` is a ref with the map when it is there.

## The module for Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({modules: ['map-jr-gl/nuxt']});
```

With the module, a page uses the components without an import:

```vue
<template>
  <div style="height: 400px">
    <LazyMapJr hydrate-on-visible map-style="https://tiles.openfreemap.org/styles/liberty"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}" :controls="[navigationControl()]" ssr />
  </div>
</template>
```

- `MapJr` and `MapOverlay` are registered, and `useMap`, `useMapHost` and `useMapFeatures`.
- The controls have longer names, because `scale` and `navigation` are common words: `navigationControl()`,
  `scaleControl()`, `fullscreenControl()`, `geolocateControl()`, `terrainControl()`.
- `LazyMapJr` puts the code of the map into a file of its own. With `hydrate-on-visible`, the browser loads that file
  and starts the map when the map comes into view. Together with `ssr`, the visitor sees the map from the server at
  once, and a page with a map far down loads no map code until it is necessary.

Without the module, import the components (`import {MapJr} from 'map-jr-gl/vue'`). For lazy loading, use
`defineAsyncComponent` of Vue:

```js
import {defineAsyncComponent, hydrateOnVisible} from 'vue';
const MapJr = defineAsyncComponent({loader: () => import('map-jr-gl/vue').then(m => m.MapJr), hydrate: hydrateOnVisible()});
```

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

- The server renders the map with `renderToSVG` from `map-jr-gl/server`. See [Server rendering](server-rendering.md).
- The page shows the map before a script has run.
- In the browser, Vue takes over the HTML, and the map removes the SVG when it has drawn its first frame. The
  controls show from that moment; they are not in the SVG.
- The server needs the style as an object or as a URL that it can fetch.
- The layout does not shift: the element has its size from your page, and the map changes nothing around it. A
  test of the library measures this.

| Option of `ssr` | Meaning |
|---|---|
| `width`, `height` | The size in pixels that the map has on most screens (800 by 500 without them). The SVG is scaled to the element. |
| `overrides` | Changes to style layers for the server render only, by the id of the layer. Use them to make the SVG smaller for a style that you do not write yourself. The values are those of `map-jr:ssr`: `hidden`, `filter`, `minzoom`, `maxzoom`, `paint`, `layout`, `simplify`, `minSize`. See "Simplify the server render" in [Server rendering](server-rendering.md). |
| `attribution` | The credits to show with the SVG: a string or a list of strings. |

### The credits

The server loads the style and its sources, so it knows their credits. It puts them into the page with the SVG, as
text and links. The map replaces them with its own credits control in the browser. To show other text, give
`attribution` in the `ssr` prop. With `:attribution="false"` on the component, the server shows no credits, and
you show them yourself.

The SVG of a city can be some hundred KB. In the test of this library, three overrides (no buildings, no building
outlines, no small roads) change a page of 245 KB to 115 KB.
