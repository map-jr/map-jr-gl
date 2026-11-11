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
| `markers` | A list of marker layers. See [Markers](markers.md). |
| `interactive-layers` | The ids of style layers whose features are found under the pointer. |
| `min-zoom`, `max-zoom`, `max-pitch`, `max-bounds`, `cursor` | As in [the main API](api.md). |
| `renderer`, `fonts`, `font-family`, `interactive`, `antialias`, `attribution`, `hash` | Read only when the map is made. |
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

### Give new objects

The map compares each prop with the last one by identity, and it sends the values to a worker. Thus:

- To change the markers, the view or the style, give a new array or object. Do not change the old one in place.
- Use `shallowRef` for a style object and for marker data. A deep `ref` makes each part reactive, which costs time
  for large data and has no use here.

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

## Nuxt and server rendering

The component works in Nuxt without `<ClientOnly>`. On the server it renders an empty element, or, with the `ssr`
prop, the first view as SVG:

```vue
<MapJr :map-style="style" :initial-view="view" :markers="[pins]" :ssr="{width: 800, height: 500}" />
```

- The server renders the map with `renderToSVG` from `map-jr-gl/server`. See [Server rendering](server-rendering.md).
- The page shows the map before a script has run.
- In the browser, Vue takes over the HTML, and the map removes the SVG when it has drawn its first frame.
- Give the size in pixels that the map has on most screens (`ssr` alone uses 800 by 500). The SVG is scaled to
  the element.
- The SVG of a city can be some hundred KB. To make it smaller, put changes for the server in the style. See
  "Simplify the server render" in [Server rendering](server-rendering.md).
- The server needs the style as an object or as a URL that it can fetch.
