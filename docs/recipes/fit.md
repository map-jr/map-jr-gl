# Fit the map to your data

This example starts the map with all seven ferry landings of New York in the view, and fits the map to them again
when the user presses a button.

<!-- example:fit:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text and a button that fits
// the map to the data again.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    properties: l => ({name: l.name}),
  }),
};
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': 7,
      'circle-color': '#2f7fd1',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];
// The box around the data, [west, south, east, north].
const lngs = landings.map(l => l.lngLat[0]),
  lats = landings.map(l => l.lngLat[1]);
const bounds = [
  Math.min(...lngs),
  Math.min(...lats),
  Math.max(...lngs),
  Math.max(...lats),
];

const container = document.getElementById('map');
const readout = document.createElement('p');
const showAll = Object.assign(document.createElement('button'), {
  textContent: 'Show all landings',
});
container.after(readout, showAll);

const map = createMap(container, {
  style,
  // The map starts with the box in the view, and 40 pixels of space around it.
  // The space keeps the circles at the edge inside the view.
  initialView: {bounds, fitPadding: 40},
  attribution: {compact: true},
  data,
  layers,
});

// The same fit later, as an animation of 600 milliseconds.
showAll.onclick = () => map.fitBounds(bounds, {fitPadding: 40, duration: 600});
readout.textContent = 'Move the map, then press Show all landings.';
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text and a button that fits
// the map to the data again.
import {Map, LngLatBounds} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
const layer = {
  id: 'landings',
  type: 'circle',
  source: 'landings',
  paint: {
    'circle-radius': 7,
    'circle-color': '#2f7fd1',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};
// The box around the data: `extend` grows it to take in each position.
const bounds = new LngLatBounds();
for (const l of landings) bounds.extend(l.lngLat);

// The map starts with the box in the view, and 40 pixels of space around it.
// The space keeps the circles at the edge inside the view.
const map = new Map({
  container: 'map',
  style,
  bounds,
  fitBoundsOptions: {padding: 40},
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
const showAll = Object.assign(document.createElement('button'), {
  textContent: 'Show all landings',
});
map.getContainer().after(readout, showAll);

map.on('load', () => {
  map.addSource('landings', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: landings.map(l => ({
        type: 'Feature',
        properties: {name: l.name},
        geometry: {type: 'Point', coordinates: l.lngLat},
      })),
    },
  });
  map.addLayer(layer);
});

// The same fit later, as an animation of 600 milliseconds.
showAll.onclick = () => map.fitBounds(bounds, {padding: 40, duration: 600});
readout.textContent = 'Move the map, then press Show all landings.';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    properties: l => ({name: l.name}),
  }),
};
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': 7,
      'circle-color': '#2f7fd1',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];
// The box around the data, [west, south, east, north].
const lngs = landings.map(l => l.lngLat[0]),
  lats = landings.map(l => l.lngLat[1]);
const bounds = [
  Math.min(...lngs),
  Math.min(...lats),
  Math.max(...lngs),
  Math.max(...lats),
];

const map = useTemplateRef('map');
// The same fit as at the start, as an animation of 600 milliseconds.
const showAll = () =>
  map.value.fitBounds(bounds, {fitPadding: 40, duration: 600});
</script>

<template>
  <!--
    The map starts with the box in the view, and 40 pixels of space around it.
    The space keeps the circles at the edge inside the view.
  -->
  <MapJr
    ref="map"
    :map-style="style"
    :initial-view="{bounds, fitPadding: 40}"
    :data="data"
    :layers="layers"
    :attribution="{compact: true}"
  />
  <p>Move the map, then press Show all landings.</p>
  <button @click="showAll">Show all landings</button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.693]},
];
const data = {
  landings: points(landings, {
    lngLat: l => l.lngLat,
    properties: l => ({name: l.name}),
  }),
};
const layers = [
  {
    id: 'landings',
    type: 'circle',
    source: 'landings',
    paint: {
      'circle-radius': 7,
      'circle-color': '#2f7fd1',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
];
// The box around the data, [west, south, east, north].
const lngs = landings.map(l => l.lngLat[0]),
  lats = landings.map(l => l.lngLat[1]);
const bounds = [
  Math.min(...lngs),
  Math.min(...lats),
  Math.max(...lngs),
  Math.max(...lats),
];

export default function Fit() {
  const map = useRef(null);
  // The map starts with the box in the view, and 40 pixels of space around it.
  // The space keeps the circles at the edge inside the view. The button does
  // the same fit later, as an animation of 600 milliseconds.
  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        initialView={{bounds, fitPadding: 40}}
        data={data}
        layers={layers}
        attribution={{compact: true}}
      />
      <p>Move the map, then press Show all landings.</p>
      <button
        onClick={() =>
          map.current?.fitBounds(bounds, {fitPadding: 40, duration: 600})
        }
      >
        Show all landings
      </button>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
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
  const layers = [
    {
      id: 'landings',
      type: 'circle',
      source: 'landings',
      paint: {
        'circle-radius': 7,
        'circle-color': '#2f7fd1',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    },
  ];
  // The box around the data, [west, south, east, north].
  const lngs = landings.map(l => l.lngLat[0]),
    lats = landings.map(l => l.lngLat[1]);
  const bounds = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // The map starts with the box in the view, and 40 pixels of space around
    // it. The space keeps the circles at the edge inside the view.
    initialView: {bounds, fitPadding: 40},
    attribution: {compact: true},
    data: {
      landings: points(landings, {
        lngLat: l => l.lngLat,
        properties: l => ({name: l.name}),
      }),
    },
    layers,
  };
  let map = null;
  // The same fit as at the start, as an animation of 600 milliseconds.
  const showAll = () => map.fitBounds(bounds, {fitPadding: 40, duration: 600});
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>Move the map, then press Show all landings.</p>
<button onclick={showAll}>Show all landings</button>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Fit the map to your data</title>
<!--
  Below the map, a line of text
  and a button that fits the map
  to the data again.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  style="height: 500px"
></map-jr>
<p>Move the map, then press Show all landings.</p>
<button id="show-all">Show all landings</button>
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
  // The box around the data,
  // [west, south, east, north].
  const lngs = landings.map(l => l.lngLat[0]),
    lats = landings.map(l => l.lngLat[1]);
  const bounds = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  const map = document.getElementById('map');
  map.attribution = {compact: true};
  // The map starts with the box
  // in the view, and 40 pixels of
  // space around it. The space
  // keeps the circles at the edge
  // inside the view.
  map.initialView = {bounds, fitPadding: 40};
  map.data = {
    landings: points(landings, {
      lngLat: l => l.lngLat,
      properties: l => ({name: l.name}),
    }),
  };
  map.layers = [
    {
      id: 'landings',
      type: 'circle',
      source: 'landings',
      paint: {
        'circle-radius': 7,
        'circle-color': '#2f7fd1',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    },
  ];

  // The same fit later, as an
  // animation of 600
  // milliseconds. `map.map` is
  // the map of the element.
  document.getElementById('show-all').onclick = () =>
    map.map?.fitBounds(bounds, {fitPadding: 40, duration: 600});
</script>
```
<!-- example:fit:end -->

## How it works

- The box around the data is `[west, south, east, north]`: the smallest and the largest longitude and latitude of the
  positions. The type [`Bounds`](../reference/types.md#bounds) also accepts `[[west, south], [east, north]]`.
- [`initialView`](../reference/description.md#initialview) with `bounds` fits the box into the view when the map is
  created. `fitPadding` is the space around the box in CSS pixels, a number or `{top, right, bottom, left}`. Without
  it, the circles at the edge of the box are cut in half.
- [`fitBounds`](../reference/map.md#fitbounds) fits the box later. It jumps unless the options set `duration` or `fly`.
- A box of one point, or of points close together, fits at the largest zoom of the map. Set `fitMaxZoom` to stop the fit
  at a lower zoom.

In the compat entry, `LngLatBounds` and its `extend` method make the box, and the options `bounds` and
`fitBoundsOptions` of `Map` start the map with it, as in MapLibre GL JS. `fitBounds` there takes `padding` and
`maxZoom` in place of `fitPadding` and `fitMaxZoom`.

## Variations

Each variation replaces lines of the Main API form. `map` is the map, `container` is its element, and `showAll` is the
button.

### Fit to data that loads later

When the data comes from a URL, the map starts at a view of its own and fits the data once it is there. This code
replaces the lines from `const map = createMap(` to the end. It loads earthquakes from the examples of MapLibre GL JS,
and the source `quakes` starts empty so that its layer has a source before the data arrives.

```js
const url =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
const empty = {type: 'FeatureCollection', features: []};
const map = createMap(container, {
  style,
  initialView: {center: [0, 20], zoom: 1},
  data: {quakes: empty},
  layers: [
    {
      id: 'quakes',
      type: 'circle',
      source: 'quakes',
      paint: {'circle-color': '#d6453d'},
    },
  ],
});

const quakes = await (await fetch(url)).json();
// The positions of points. For lines and polygons, take every position of each
// geometry.
const xs = quakes.features.map(f => f.geometry.coordinates[0]);
const ys = quakes.features.map(f => f.geometry.coordinates[1]);
const box = [
  Math.min(...xs),
  Math.min(...ys),
  Math.max(...xs),
  Math.max(...ys),
];
map.patch({data: {quakes}});
map.fitBounds(box, {fitPadding: 40, duration: 600});
showAll.onclick = () => map.fitBounds(box, {fitPadding: 40, duration: 600});
```

### Leave room for a panel

A panel of 300 pixels over the left side of the map needs more space on that side. Use this object in place of `40` as
`fitPadding`, in `initialView` and in the call of `fitBounds`:

```js
const fitPadding = {top: 40, right: 40, bottom: 40, left: 340};
```

## See also

- [`moveTo`](../reference/map.md#moveto), which takes `bounds`, `fitPadding` and `fitMaxZoom` together with `bearing`
  and `pitch`.
- [`padding`](../reference/description.md#padding) for space that every view of the map keeps, and not only one fit.
- [View and camera](../guide/view-and-camera.md) for the other ways to set the view.
