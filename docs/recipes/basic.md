# Show a map with controls

This example shows a map of a MapLibre style with the zoom, compass, scale and fullscreen controls. A line of text below
the map names the thread that renders the map.

Each block below is a complete file of the [gallery](https://map-jr.github.io/map-jr-gl/). The two `js` files are the
module script of a page that has `<div id="map" style="height: 500px"></div>`, and each one creates the line of text
below the map itself. The Vue and React components fill their parent element, so give the parent a height. The Svelte
component and the `<map-jr>` page give the element of the map a height of 500 pixels.

The Nuxt form has no imports, because the [module for Nuxt](../reference/nuxt.md) imports the components and the
controls automatically, and it names the controls `navigationControl`, `globeControl` and so on.

<!-- example:basic:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map says which thread draws it.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  controls: [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ],
  attribution: {compact: true},
});

// The thread that draws is known when the map has started.
map.state.subscribe(
  state => state.renderer,
  renderer => show(`${renderer} rendering`),
);
map.listen('stats', e => {
  const fps = e.fps.toFixed(0);
  show(`${map.state.get().renderer} rendering, ${fps} frames per second`);
});
show('Starting');
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map says which thread draws it.
import {
  Map,
  NavigationControl,
  ScaleControl,
  FullscreenControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 13.6,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');
map.addControl(new FullscreenControl(), 'top-left');

map.once('load', () => {
  readout.textContent = `${map.renderer} rendering`;
});
readout.textContent = 'Starting';
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[
      navigation(),
      scale({position: 'bottom-left'}),
      fullscreen({position: 'top-left'}),
    ]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">
      {{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}
    </p>
  </MapJr>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt']. The module imports MapJr and the other
// components, the composables and the controls (as navigationControl() and so
// on), and Nuxt imports the functions of Vue.

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[
      navigationControl(),
      scaleControl({position: 'bottom-left'}),
      fullscreenControl({position: 'top-left'}),
    ]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">
      {{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}
    </p>
  </MapJr>
</template>
```

**React**

```jsx [React]
import {MapJr, useMapState} from '@map-jr/map-jr-gl/react';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

function Renderer() {
  const renderer = useMapState(state => state.renderer);
  return (
    <p className="note">{renderer ? `${renderer} rendering` : 'Starting'}</p>
  );
}

export default function Basic() {
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 13.6}}
      controls={[
        navigation(),
        scale({position: 'bottom-left'}),
        fullscreen({position: 'top-left'}),
      ]}
      attribution={{compact: true}}
    >
      <Renderer />
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    controls: [
      navigation(),
      scale({position: 'bottom-left'}),
      fullscreen({position: 'top-left'}),
    ],
    attribution: {compact: true},
  };
  let map = $state(null);
  // The state of the map as a store, once the map exists.
  const live = $derived(map && mapState(map));
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>{$live?.renderer ? `${$live.renderer} rendering` : 'Starting'}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A MapLibre style, drawn off the main thread</title>
<!--
  A line of text below the map
  says which thread draws it.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  style="height: 500px"
></map-jr>
<p id="readout">Starting</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  // Objects are properties of the
  // element. Set before the map
  // starts, they are part of the
  // first description.
  map.controls = [
    navigation(),
    scale({position: 'bottom-left'}),
    fullscreen({position: 'top-left'}),
  ];
  map.attribution = {compact: true};

  // The thread that draws is
  // known when the map has
  // started.
  map.addEventListener('map-ready', () => {
    map.state.subscribe(
      state => state.renderer,
      renderer => {
        readout.textContent = `${renderer} rendering`;
      },
    );
  });
  map.addEventListener('map-stats', event => {
    readout.textContent = `${map.state.get().renderer} rendering, ${event.detail.fps.toFixed(0)} frames per second`;
  });
</script>
```
<!-- example:basic:end -->

## How it works

- [`createMap`](../reference/create-map.md) creates the map in an element of the page from one object, the description
  ([`MapDescription`](../reference/description.md)). `style` is the URL of a MapLibre style.
- [`initialView`](../reference/description.md#initialview) sets the first view: `center` as `[lng, lat]` and `zoom`.
- [`controls`](../reference/description.md#controls) is a list of controls from `@map-jr/map-jr-gl/controls`. Each
  control accepts a [`position`](../reference/controls.md#position).
- The map renders in a worker when the browser can render there, and on the main thread otherwise.
  [`renderer`](../reference/state.md#mapstate) of the state is `'worker'` or `'main'` once the map has loaded, and
  `undefined` before.
- The [`stats`](../reference/events.md#mapevents) event reports the frames per second about once a second while the map
  renders.

In the compat entry, each control is a class of MapLibre GL JS that `addControl` adds, and `map.renderer` names the
thread.

## Variations

The variation adds a field to the description of the Main API example.

### Render on the main thread

```js
const map = createMap(container, {style, renderer: 'main'});
```

[`renderer`](../reference/description.md#renderer) selects the thread: `'auto'` (the default), `'worker'` or `'main'`.
`'worker'` renders as `'auto'` does, and warns once when the map renders on the main thread instead.

## See also

- [Getting started](../guide/getting-started.md) to install the package and show a first map.
- [Controls](../guide/controls.md) to change, translate and style the controls, and to add a control of your own.
