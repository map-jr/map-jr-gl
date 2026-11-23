# Highlight the feature under the pointer

This example draws seven ferry landings of New York as circles, draws the landing under the pointer larger and in red,
and names it below the map.

<!-- example:hover:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map names the ferry landing under the
// pointer.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
// The map can set the state `hover` only on a feature that has an id. `points`
// takes it from `id`.
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    id: l => l.id,
    properties: l => ({name: l.name}),
  }),
};
// The layer reads the state `hover` with `feature-state`: the landing under the
// pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': ['case', hovered, 11, 7],
      'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  attribution: {compact: true},
  data,
  layers,
  // The map gives the top feature of these layers under the pointer the feature
  // state `hover: true`, and removes it when the pointer leaves the feature.
  interactiveLayers: ['landings'],
  hoverState: true,
});

// `state.hover` has the features of `interactiveLayers` under the pointer, the
// top one first.
map.state.subscribe(
  state => state.hover,
  hover => {
    readout.textContent =
      hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.';
  },
);
readout.textContent = 'Move the pointer over a ferry landing.';
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map names the ferry landing under the
// pointer.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
// The layer reads the state `hover` with `feature-state`: the landing under the
// pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layer = {
  id: 'landings',
  type: 'circle',
  source: 'landings',
  paint: {
    'circle-radius': ['case', hovered, 11, 7],
    'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 13.6,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.on('load', () => {
  // A feature needs an id for its state. Here each feature has one;
  // `generateId: true` on the source also gives them.
  map.addSource('landings', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: landings.map(l => ({
        type: 'Feature',
        id: l.id,
        properties: {name: l.name},
        geometry: {type: 'Point', coordinates: l.lngLat},
      })),
    },
  });
  map.addLayer(layer);
});

// As in MapLibre GL JS, the code sets the state `hover` itself, and removes it
// from the landing that it had before.
let hoveredId = null;
const leave = () => {
  if (hoveredId !== null)
    map.setFeatureState({source: 'landings', id: hoveredId}, {hover: false});
  hoveredId = null;
};
map.on('mousemove', 'landings', e => {
  const feature = e.features[0];
  if (feature.id === hoveredId) return;
  leave();
  hoveredId = feature.id;
  map.setFeatureState({source: 'landings', id: hoveredId}, {hover: true});
  map.getCanvas().style.cursor = 'pointer';
  readout.textContent = feature.properties.name;
});
map.on('mouseleave', 'landings', () => {
  leave();
  map.getCanvas().style.cursor = '';
  readout.textContent = 'Move the pointer over a ferry landing.';
});
readout.textContent = 'Move the pointer over a ferry landing.';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
// The map can set the state `hover` only on a feature that has an id. `points`
// takes it from `id`.
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    id: l => l.id,
    properties: l => ({name: l.name}),
  }),
};
// The layer reads the state `hover` with `feature-state`: the landing under the
// pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': ['case', hovered, 11, 7],
      'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];
// The features under the pointer, from the event `hover`.
const hover = ref([]);
</script>

<template>
  <!--
    With `hover-state`, the map gives the top feature of `interactive-layers`
    under the pointer the feature state `hover: true`, and removes it when the
    pointer leaves the feature.
  -->
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :data="data"
    :layers="layers"
    :interactive-layers="['landings']"
    hover-state
    :attribution="{compact: true}"
    @hover="hover = $event"
  />
  <p>
    {{ hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.' }}
  </p>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
// The map can set the state `hover` only on a feature that has an id. `points`
// takes it from `id`.
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    id: l => l.id,
    properties: l => ({name: l.name}),
  }),
};
// The layer reads the state `hover` with `feature-state`: the landing under the
// pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': ['case', hovered, 11, 7],
      'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];

export default function Hover() {
  const [hover, setHover] = useState([]);
  // With `hoverState`, the map gives the top feature of `interactiveLayers`
  // under the pointer the feature state `hover: true`, and removes it when the
  // pointer leaves the feature.
  return (
    <>
      <MapJr
        mapStyle={style}
        initialView={{center: NYC, zoom: 13.6}}
        data={data}
        layers={layers}
        interactiveLayers={['landings']}
        hoverState
        attribution={{compact: true}}
        onHover={setHover}
      />
      <p>
        {hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.'}
      </p>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const landings = [
    {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
    {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
    {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
    {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
    {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
    {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
    {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
  ];
  // The map can set the state `hover` only on a feature that has an id.
  // `points` takes it from `id`.
  const data = {
    landings: points(landings, {
      lngLat: l => l.lngLat,
      id: l => l.id,
      properties: l => ({name: l.name}),
    }),
  };
  // The layer reads the state `hover` with `feature-state`: the landing under
  // the pointer is larger and red.
  const hovered = ['boolean', ['feature-state', 'hover'], false];
  const layers = [
    {
      id: 'landings',
      type: 'circle',
      source: 'landings',
      paint: {
        'circle-radius': ['case', hovered, 11, 7],
        'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    },
  ];

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    attribution: {compact: true},
    data,
    layers,
    // The map gives the top feature of these layers under the pointer the
    // feature state `hover: true`, and removes it when the pointer leaves the
    // feature.
    interactiveLayers: ['landings'],
    hoverState: true,
  };
  let map = $state(null);
  // The state of the map as a store: `$live.hover` has the features under the
  // pointer, the top one first.
  const live = $derived(map && mapState(map));
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>
  {$live?.hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.'}
</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Highlight the feature under the pointer</title>
<!--
  A line of text below the map
  names the ferry landing under
  the pointer. With the attribute
  `hover-state`, the map gives the
  top feature of
  `interactive-layers` under the
  pointer the feature state
  `hover: true`, and removes it
  when the pointer leaves the
  feature.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  interactive-layers="landings"
  hover-state
  style="height: 500px"
></map-jr>
<p id="readout">Move the pointer over a ferry landing.</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {points} from '@map-jr/map-jr-gl';

  const landings = [
    {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
    {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
    {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
    {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
    {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
    {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
    {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
  ];
  // The map can set the state
  // `hover` only on a feature
  // that has an id. `points`
  // takes it from `id`.
  const data = {
    landings: points(landings, {
      lngLat: l => l.lngLat,
      id: l => l.id,
      properties: l => ({name: l.name}),
    }),
  };
  // The layer reads the state
  // `hover` with `feature-state`:
  // the landing under the pointer
  // is larger and red.
  const hovered = ['boolean', ['feature-state', 'hover'], false];
  const layers = [
    {
      id: 'landings',
      type: 'circle',
      source: 'landings',
      paint: {
        'circle-radius': ['case', hovered, 11, 7],
        'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    },
  ];

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  map.attribution = {compact: true};
  map.data = data;
  map.layers = layers;

  // The event `map-hover` has the
  // features of
  // `interactive-layers` under
  // the pointer, the top one
  // first.
  map.addEventListener('map-hover', event => {
    readout.textContent =
      event.detail[0]?.properties.name ??
      'Move the pointer over a ferry landing.';
  });
</script>
```
<!-- example:hover:end -->

## How it works

- With [`hoverState`](../reference/description.md#hoverstate) set to `true`, the map gives the top feature of
  [`interactiveLayers`](../reference/description.md#interactivelayers) under the pointer the feature state
  `hover: true`. It removes the state when the pointer leaves the feature or the map.
- The paint properties read the state with `['feature-state', 'hover']`. A feature that has no state yet has no value
  there, so `['boolean', …, false]` gives `false` for it.
- The map sets a state only on a feature that has an id. [`points`](../reference/exports.md#points) takes the id from
  the option `id`. For GeoJSON of your own, give each feature an `id`, or
  [declare the source](../guide/data.md#set-the-options-of-a-source) with `promoteId` or `generateId: true`.
- A `fill` or `line` layer reads the state in the same way, as the polygon in the entry
  [`hoverState`](../reference/description.md#hoverstate) does.
- [`state.hover`](../reference/state.md#mapstate) lists the features of `interactiveLayers` under the pointer, the top
  one first. Vue has it in the event `hover`, React in `onHover`, Svelte in [`mapState`](../reference/svelte.md#mapstate)
  and `<map-jr>` in the event `map-hover`.

In the compat entry, the code sets the state itself with `setFeatureState` on `mousemove` and `mouseleave` of the
layer, as in MapLibre GL JS.

## Variations

Each variation changes the Main API form. `map` is the map, and `container` is its element.

### Highlight the landing that the user clicks

The state `hover` follows the pointer. A state that stays until the next click is set with
[`setFeatureState`](../reference/map.md#setfeaturestate). The layer reads the state `selected`, so this line replaces
the line `const hovered = …` (the name stays, so that `layers` needs no change):

```js
const hovered = ['boolean', ['feature-state', 'selected'], false];
```

This call of `createMap` replaces the one of the example:

```js
let selected;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  data,
  layers,
  interactiveLayers: ['landings'],
  onClick: e => {
    if (selected !== undefined)
      map.removeFeatureState({source: 'landings', id: selected}, 'selected');
    selected = e.features[0]?.id;
    if (selected !== undefined)
      map.setFeatureState({source: 'landings', id: selected}, {selected: true});
  },
});
```

## See also

- [Highlight a feature with its state](../guide/data.md#highlight-a-feature-with-its-state) for the state of a feature,
  `setFeatureState` and `removeFeatureState`.
- [`interactiveLayers`](../reference/description.md#interactivelayers) and
  [`onClick`](../reference/description.md#onclick) for the features under a click.
- [Query what is at a position](query.md) for the features at a position that no layer of `interactiveLayers` draws.
