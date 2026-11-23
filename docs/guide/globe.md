# The globe

This page shows how to draw the map on a sphere, how to let the user switch between the globe and the flat map, and
what changes on the globe. The flat map is the Web Mercator projection (`mercator`), which every map uses by default.

## Show the map as a globe

The field [`projection`](../reference/description.md#projection) of the description selects the projection. It
overrides the `projection` of the style.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [10, 30], zoom: 1.5},
  projection: {type: 'globe'},
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// The page has <div id="map" style="height: 400px"></div>.
const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [10, 30],
  zoom: 1.5,
});

// Each new style sets its own projection, so set the globe after each one.
map.on('style.load', () => map.setProjection({type: 'globe'}));
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [10, 30], zoom: 1.5}"
      :projection="{type: 'globe'}"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

const initialView = {center: [10, 30], zoom: 1.5};
const projection = {type: 'globe'};

export default function World() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={initialView}
        projection={projection}
      />
    </div>
  );
}
```

The map accepts three projections:

| `type` | The map draws |
|---|---|
| `'mercator'` | The flat map. |
| `'globe'` | A globe, which turns into the flat map between zoom 11 and zoom 12, as in MapLibre GL JS. |
| `'vertical-perspective'` | A globe at every zoom. |

`type` can also be an `interpolate` expression of `["zoom"]` between two of these names, as in the MapLibre style
specification.

With `projection: null` or no field, the map uses the root property `projection` of the style, and `mercator` when
the style has none.

A new `projection` switches the projection without loading the style again. Pass it to
[`update`](../reference/map.md#update) with the complete description, or to `patch` with only the fields that change. When the map switches from the flat map to the globe, it shows the flat map until the tiles of the view
are ready for the globe, for at most 1 second.

## Let the user switch to the globe

The control [`globe`](controls.md) is a button that switches the projection between `globe` and `mercator`.

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
// The map fills its parent element, so give the parent a height.
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
// ['@map-jr/map-jr-gl/nuxt']. The map fills its parent element, so give the
// parent a height.

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
// The map fills its parent element, so give the parent a height.
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

The map starts as a globe, and a line of text below the map names the projection. In the compat entry, the code sets
the projection with `setProjection` on `style.load`, as in MapLibre GL JS, and adds a `GlobeControl`.

A `patch` of another field keeps the projection that the last click on the globe button set. A `projection` that differs from that of the last
description replaces it, and so does a new `style`. The map then uses the `projection` of the description, or the
projection of the style when the description has none. While the projection is
`globe`, the button has the class `map-jr-ctrl-globe-enabled` and `aria-pressed="true"`.

The event `projectiontransition` fires when the name of the projection changes and when a new style loads.
`newProjection` is `'mercator'`, `'globe'` or `'vertical-perspective'`.

## What the globe draws

On the globe, the map draws the layers of the types `background`, `fill`, `line`, `circle`, `heatmap`, `raster`,
`hillshade`, `fill-extrusion` and `symbol`. The background covers only the sphere, and the space around the sphere is
transparent. To fill it, set the CSS `background` of the container, the element that you pass to `createMap` or as
`container`.

- The map draws [3D terrain](terrain.md) on the sphere. A `fill-extrusion` layer follows the curve of the sphere,
  so the buildings of the styles of `https://styles.map-jr.org/1/` stand on the globe as they do on the flat map.
- A custom layer (the type `custom` of `@map-jr/map-jr-gl/maplibre-compat`) gets the projection data of the globe, as
  in MapLibre GL JS: `shaderData`, `defaultProjectionData` and `getProjectionData` of its `render` describe the sphere,
  also while the map changes between the globe and Mercator.
- With a `sky` in the style, the map draws the sky and the atmosphere around the globe, as MapLibre GL JS does. The
  property `atmosphere-blend` of `sky` sets the opacity of the atmosphere. The map draws no fog on the globe.
- A label whose anchor turns to the far side of the globe is hidden. A `Marker` of the MapLibre compat entry on the far
  side takes the opacity `opacityWhenCovered` (0.2 by default).
- The [server renderer](server-rendering.md) draws the flat map.

## How the camera moves on the globe

- A drag turns the globe and keeps the bearing, as in MapLibre GL JS.
- A move to a new centre without a `zoom` keeps the size of the globe on the screen. The map then changes the zoom
  of the view with the latitude: a view at zoom 1.5 at the equator is at zoom -0.05 at 70 degrees north. A `zoom` that you
  pass is applied unchanged.
- [`maxBounds`](../reference/description.md#maxbounds) has no effect on the globe.

## See also

- [`projection`](../reference/description.md#projection) of the description.
- [Controls](controls.md) for the options of `globe` and the other controls.
- [Terrain and elevation](terrain.md) for 3D terrain on the flat map.
