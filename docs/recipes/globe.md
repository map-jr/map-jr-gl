# Show the world as a globe

This example shows the map as a globe with a button that switches between the globe and the flat map, and names the
projection below the map.

Each block below is a complete file of the [gallery](https://map-jr.github.io/map-jr-gl/). The two `js` files are the
module script of a page that has `<div id="map" style="height: 500px"></div>`, and each one creates the line of text
below the map itself. The Vue and React components fill their parent element, so give the parent a height. The Svelte
component and the `<map-jr>` page give the element of the map a height of 500 pixels.

<!-- example:globe:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map names the projection.
import {createMap} from '@map-jr/map-jr-gl';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

const map = createMap(container, {
  style,
  // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  projection: {type: 'globe'},
  initialView: {center: [10, 30], zoom: 1.5},
  controls: [navigation(), globe()],
  attribution: {compact: true},
});

// The button of the globe control switches between the globe and Mercator.
map.listen('projectiontransition', e => {
  readout.textContent = `Projection: ${e.newProjection}`;
});
readout.textContent = 'Projection: globe';
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map names the projection.
import {
  Map,
  NavigationControl,
  GlobeControl,
} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const map = new Map({
  container: 'map',
  style,
  center: [10, 30],
  zoom: 1.5,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.addControl(new NavigationControl());
map.addControl(new GlobeControl());

// As in MapLibre GL JS, the projection is set when the style has loaded. The
// globe turns into Mercator between zoom 11 and 12.
map.on('style.load', () => map.setProjection({type: 'globe'}));
map.on('projectiontransition', e => {
  readout.textContent = `Projection: ${e.newProjection}`;
});
readout.textContent = 'Starting';
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const projection = ref('globe');
</script>

<template>
  <!--
    The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  -->
  <MapJr
    :map-style="style"
    :projection="{type: 'globe'}"
    :initial-view="{center: [10, 30], zoom: 1.5}"
    :controls="[navigation(), globe()]"
    :attribution="{compact: true}"
    @projectiontransition="e => (projection = e.newProjection)"
  >
    <p class="note">Projection: {{ projection }}</p>
  </MapJr>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt'].

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const projection = ref('globe');
</script>

<template>
  <!--
    The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  -->
  <MapJr
    :map-style="style"
    :projection="{type: 'globe'}"
    :initial-view="{center: [10, 30], zoom: 1.5}"
    :controls="[navigationControl(), globeControl()]"
    :attribution="{compact: true}"
    @projectiontransition="e => (projection = e.newProjection)"
  >
    <p class="note">Projection: {{ projection }}</p>
  </MapJr>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const controls = [navigation(), globe()];

export default function Globe() {
  const [projection, setProjection] = useState('globe');
  // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  return (
    <MapJr
      mapStyle={style}
      projection={{type: 'globe'}}
      initialView={{center: [10, 30], zoom: 1.5}}
      controls={controls}
      attribution={{compact: true}}
      onProjectiontransition={e => setProjection(e.newProjection)}
    >
      <p className="note">Projection: {projection}</p>
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {globe, navigation} from '@map-jr/map-jr-gl/controls';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL
    // JS.
    projection: {type: 'globe'},
    initialView: {center: [10, 30], zoom: 1.5},
    controls: [navigation(), globe()],
    attribution: {compact: true},
  };
  let projection = $state('globe');

  // The button of the globe control switches between the globe and Mercator.
  const ready = map =>
    map.listen('projectiontransition', e => (projection = e.newProjection));
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>Projection: {projection}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>The world as a globe</title>
<!--
  A line of text below the map
  names the projection. The globe
  turns into Mercator between zoom
  11 and 12, as in MapLibre GL JS.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  projection="globe"
  center="10,30"
  zoom="1.5"
  style="height: 500px"
></map-jr>
<p id="readout">Projection: globe</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {globe, navigation} from '@map-jr/map-jr-gl/controls';

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  map.controls = [navigation(), globe()];
  map.attribution = {compact: true};

  // The button of the globe
  // control switches between the
  // globe and Mercator.
  map.addEventListener('map-projectiontransition', event => {
    readout.textContent = `Projection: ${event.detail.newProjection}`;
  });
</script>
```
<!-- example:globe:end -->

## How it works

- [`projection`](../reference/description.md#projection) `{type: 'globe'}` draws the map on a sphere. Between zoom 11
  and 12, the globe turns into the flat map, as in MapLibre GL JS.
- The control [`globe()`](../reference/controls.md#globe) is a button that switches the projection between `globe` and
  `mercator`.
- The [`projectiontransition`](../reference/events.md#mapevents) event fires when a projection is applied, with its name
  in `newProjection`.

In the compat entry, the code sets the projection with `setProjection` on `style.load`, as in MapLibre GL JS, and adds a
`GlobeControl`.

## Variations

The variation changes `projection` in the description of the Main API example.

### A globe at every zoom

The projection `vertical-perspective` draws a globe at every zoom, also zoomed in. See [the values of
`projection`](../reference/description.md#projection).

```js
const map = createMap(container, {
  style,
  projection: {type: 'vertical-perspective'},
});
```

## See also

- [Globe](../guide/globe.md) for what the globe draws and how the camera moves on it.
