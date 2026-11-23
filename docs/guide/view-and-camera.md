# The view and the camera

The view is the position of the camera. This page shows how to set the first view, move the camera from code, keep
the view in the state of the application, and read the view.

| Member | Type | Meaning |
|---|---|---|
| `center` | `[lng, lat]` | The position at the centre of the map. |
| `zoom` | `number` | The zoom level. |
| `bearing` | `number` | The compass direction at the top of the map, in degrees: 90 puts east at the top. |
| `pitch` | `number` | The tilt in degrees: 0 looks straight down. The largest pitch is `maxPitch` of the description, 60 by default. |

## Set the first view

[`initialView`](../reference/description.md#initialview) sets the camera once, when the map is created. After that,
the user moves the map.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30},
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  pitch: 30,
});
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
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30}"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Harbor() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-74.0065, 40.7085], zoom: 13.6, pitch: 30}}
      />
    </div>
  );
}
```

A member that is not set has the value 0: `center` is `[0, 0]`, and `zoom`, `bearing` and `pitch` are 0. A map
without `initialView` starts at that view.

To show an area whatever the size of the map, set `bounds` in place of `center` and `zoom`. The map fits the box
into the view. This example starts the map with all seven ferry landings of New York in the view, and fits the map to
them again when the user presses a button:

<!-- example:fit:start -->
**Map Jr**

```js [Map Jr]
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

**MapLibre**

```js [MapLibre]
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

- The box around the data is `[west, south, east, north]`: the smallest and the largest longitude and latitude of the
  positions. The type [`Bounds`](../reference/types.md#bounds) also accepts `[[west, south], [east, north]]`.
- [`fitBounds`](../reference/map.md#fitbounds) fits the box later. It jumps unless the options set `duration` or `fly`.
  When the data comes from a URL, start the map at a view of its own, and call `fitBounds` once the data is there.
- A box of one point, or of points close together, fits at the largest zoom of the map. Set `fitMaxZoom` to stop the
  fit at a lower zoom.
- In the compat entry, `LngLatBounds` and its `extend` method make the box, and the options `bounds` and
  `fitBoundsOptions` of `Map` start the map with it, as in MapLibre GL JS.

Two options belong to the fit:

| Option | Main API | MapLibre compat | Default | Effect |
|---|---|---|---|---|
| `fitPadding` | in `initialView` | `padding` in `fitBoundsOptions` | `0` | The space in CSS pixels between the box and the edges of the map, for this fit only: a number, or `{top, right, bottom, left}`. |
| `fitMaxZoom` | in `initialView` | `maxZoom` in `fitBoundsOptions` | `maxZoom` of the map | The largest zoom of the fit. |

Without `fitPadding`, circles at the edge of the box are cut in half. For a panel of 300 pixels over the left side of
the map, pass `{top: 40, right: 40, bottom: 40, left: 340}`.

The fit of `initialView` does not add the [`padding`](../reference/description.md#padding) of the description.

Two settings override `initialView`:

- [`view`](#keep-the-view-in-the-application) overrides each member that it sets. When the description has `view`,
  the map ignores `bounds`, also when `view` sets only some members.
- With [`hash`](../reference/description.md#hash), a view in the URL of the page overrides `center`, `zoom`,
  `bearing` and `pitch`. It does not override `bounds`.

## Move the camera from code

In the main API, [`map.moveTo`](view-and-camera.md) moves the camera each time that it is called. It accepts the
members of the view, or `bounds` with `fitPadding` and `fitMaxZoom` as in `initialView`, and two members for the movement:

| Member | Type | Default | Effect |
|---|---|---|---|
| `duration` | `number` | `0` | The time of the movement in milliseconds. With 0 the camera jumps. |
| `fly` | `boolean \| FlyOptions` | `false` | The camera zooms out and back in on the way. See [Fly along a curve](#fly-along-a-curve) for the options. |

The examples read the current zoom from [`map.state`](#read-the-view).

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 12},
});

function zoomIn() {
  map.moveTo({zoom: map.state.get().view.zoom + 1, duration: 300});
}

function flyToParis() {
  map.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
}

function showManhattan() {
  map.moveTo({
    bounds: [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    padding: 40,
    duration: 800,
  });
}
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 12,
});

function zoomIn() {
  map.easeTo({zoom: map.getZoom() + 1, duration: 300});
}

function flyToParis() {
  map.flyTo({center: [2.35, 48.86], zoom: 12});
}

function showManhattan() {
  map.fitBounds(
    [
      [-74.05, 40.68],
      [-73.9, 40.82],
    ],
    {padding: 40, duration: 800},
  );
}
```

**Vue**

```vue [Vue]
<script setup>
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

// The ref has the members of the map once the map has loaded, after the
// component is mounted.
const component = useTemplateRef('component');
const flyToParis = () =>
  component.value.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      ref="component"
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 12}"
    />
  </div>
  <button @click="flyToParis">Paris</button>
</template>
```

**React**

```jsx [React]
import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Places() {
  // The ref is the map of the main API, or null before the component has
  // created it.
  const map = useRef(null);
  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          ref={map}
          mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
          initialView={{center: [-74.0065, 40.7085], zoom: 12}}
        />
      </div>
      <button
        onClick={() =>
          map.current?.moveTo({center: [2.35, 48.86], zoom: 12, fly: true})
        }
      >
        Paris
      </button>
    </>
  );
}
```

A member that `moveTo` is not passed keeps its value, so `{zoom: 15}` keeps the centre. With `bounds`:

- The map turns to bearing 0 unless `bearing` is set.
- `pitch` does not change the fit. The map computes the centre and the zoom of the fit at the current pitch, so with
  a different `pitch` the box can extend past the edges of the map. To fit a box at a pitch, set the pitch first.
- The `fitPadding` of `moveTo` is added to the [`padding`](../reference/description.md#padding) of the description.
  `moveTo` does not change the `padding` of the description.

When the system asks for reduced motion (`prefers-reduced-motion: reduce`), the camera jumps.

[`map.fitBounds(bounds, options)`](view-and-camera.md) is the same as `map.moveTo({bounds, ...options})`. It
jumps unless `options` sets `duration` or `fly`.

### Fly along a curve

`fly` is `true`, or an object with these options. They have the names and defaults of `flyTo` of MapLibre GL JS.

| Option | Type | Default | Effect |
|---|---|---|---|
| `curve` | `number` | `1.42` | How far the camera zooms out on the way. A larger value zooms out more. |
| `speed` | `number` | `1.2` | The average speed along the curve. A larger value is faster. |
| `screenSpeed` | `number` | | The average speed in screens per second. It overrides `speed`. |
| `minZoom` | `number` | | The zoom at the highest point of the curve. It overrides `curve`. |
| `maxDuration` | `number` | no limit | The longest flight in milliseconds. A longer flight is a jump. |

Without `duration`, the map computes the duration of the flight from the distance and the speed. A `duration`
overrides `speed` and `screenSpeed`, and the map then ignores `maxDuration`.

## Keep the view in the application

Set [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange) when the application needs the
view in its own state, for example to show it or to store it in a URL. The map reports the first view to
`onViewChange` once, right after it is created and before `load`, and then each change of the view. The application
passes the view back in the next description, and a view that the map reported does not move it. To move the map, the application
passes a different view.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

let view = {center: [-74.0065, 40.7085], zoom: 13.6};
const describe = () => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  view,
  // The map calls onViewChange only after createMap has returned, so `map` is
  // set here.
  onViewChange: next => {
    view = next;
    map.update(describe());
  },
});
const map = createMap('map', describe());

function showPier() {
  view = {...view, center: [-74.0134, 40.7033], zoom: 16};
  map.update(describe());
}
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  bearing: 0,
  pitch: 0,
});
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      v-model:view="view"
    />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
  <button @click="view = {...view, center: [-74.0134, 40.7033], zoom: 16}">
    Pier A
  </button>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export function Harbor() {
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6});
  return (
    <>
      <div style={{height: 400}}>
        <MapJr
          mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
          view={view}
          onViewChange={setView}
        />
      </div>
      <p>Zoom {view.zoom.toFixed(1)}</p>
      <button
        onClick={() =>
          setView({...view, center: [-74.0134, 40.7033], zoom: 16})
        }
      >
        Pier A
      </button>
    </>
  );
}
```

The map applies a new `view` with no animation. To animate the camera, call `moveTo` with `duration` instead: the
map then reports the new views to `onViewChange` as it moves.

The map does not wait for the application. When the application passes back a view that the map reported, the map
ignores it, so a slow application does not pull the map back while the user moves it.

### Return to a stored view

A `view` has no effect when its `center`, `zoom`, `bearing` and `pitch` equal those of one of the last 60 views that
the map reported to `onViewChange`, however long ago. So a button "back to where I was" that sets `view` to a stored
view often does nothing. Call `moveTo` with the stored view instead: `moveTo` always moves the map. In the compat
entry, `jumpTo`, `easeTo` and `flyTo` always move the map, as in MapLibre GL JS.

<!-- example:back:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text and a button that goes
// back to the view before the last click.
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

const container = document.getElementById('map');
const readout = document.createElement('p');
const back = Object.assign(document.createElement('button'), {
  textContent: 'Back',
  disabled: true,
});
container.after(readout, back);

let last = null;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  attribution: {compact: true},
  data,
  layers,
  interactiveLayers: ['landings'],
  onClick: e => {
    const feature = e.features[0];
    if (!feature) return;
    // Store the view before the move, without `bounds`: a target with `bounds`
    // fits that box instead.
    const {center, zoom, bearing, pitch} = map.state.get().view;
    last = {center, zoom, bearing, pitch};
    map.moveTo({center: feature.geometry.coordinates, zoom: 17, duration: 800});
    back.disabled = false;
    readout.textContent = `${feature.properties.name}. Press Back to return.`;
  },
});

back.onclick = () => {
  map.moveTo({...last, duration: 800});
  back.disabled = true;
  readout.textContent = 'Click a ferry landing to zoom in.';
};
readout.textContent = 'Click a ferry landing to zoom in.';
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text and a button that goes
// back to the view before the last click.
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

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 13.6,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
const back = Object.assign(document.createElement('button'), {
  textContent: 'Back',
  disabled: true,
});
map.getContainer().after(readout, back);

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
map.on('mouseenter', 'landings', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'landings', () => {
  map.getCanvas().style.cursor = '';
});

let last = null;
map.on('click', 'landings', e => {
  const feature = e.features[0];
  // The view before the move.
  last = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
  map.easeTo({center: feature.geometry.coordinates, zoom: 17, duration: 800});
  back.disabled = false;
  readout.textContent = `${feature.properties.name}. Press Back to return.`;
});

back.onclick = () => {
  map.easeTo({...last, duration: 800});
  back.disabled = true;
  readout.textContent = 'Click a ferry landing to zoom in.';
};
readout.textContent = 'Click a ferry landing to zoom in.';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {ref, shallowRef, useTemplateRef} from 'vue';
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

const view = ref({
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  bearing: 0,
  pitch: 0,
});
const map = useTemplateRef('map');
// The view before the last click, and the landing of that click.
const last = shallowRef(null);

function zoomTo(event) {
  const feature = event.features[0];
  if (!feature) return;
  // Store the view before the move, without `bounds`: a target with `bounds`
  // fits that box instead.
  const {center, zoom, bearing, pitch} = view.value;
  last.value = {
    view: {center, zoom, bearing, pitch},
    name: feature.properties.name,
  };
  map.value.moveTo({
    center: feature.geometry.coordinates,
    zoom: 17,
    duration: 800,
  });
}

// `moveTo` and not `view = last.view`: `moveTo` animates, and the map ignores a
// `view` equal to one of the last 60 views that it reported.
function goBack() {
  map.value.moveTo({...last.value.view, duration: 800});
  last.value = null;
}
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    v-model:view="view"
    :data="data"
    :layers="layers"
    :interactive-layers="['landings']"
    :attribution="{compact: true}"
    @click="zoomTo"
  />
  <p>
    {{
      last
        ? `${last.name}. Press Back to return.`
        : 'Click a ferry landing to zoom in.'
    }}
  </p>
  <button :disabled="!last" @click="goBack">Back</button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useRef, useState} from 'react';
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

export default function Back() {
  const map = useRef(null);
  const [view, setView] = useState({
    center: [-74.0065, 40.7085],
    zoom: 13.6,
    bearing: 0,
    pitch: 0,
  });
  // The view before the last click, and the landing of that click.
  const [last, setLast] = useState(null);

  function zoomTo(event) {
    const feature = event.features[0];
    if (!feature) return;
    // Store the view before the move, without `bounds`: a target with `bounds`
    // fits that box instead.
    const {center, zoom, bearing, pitch} = view;
    setLast({
      view: {center, zoom, bearing, pitch},
      name: feature.properties.name,
    });
    map.current.moveTo({
      center: feature.geometry.coordinates,
      zoom: 17,
      duration: 800,
    });
  }

  // `moveTo` and not `setView(last.view)`: `moveTo` animates, and the map
  // ignores a `view` equal to one of the last 60 views that it reported.
  function goBack() {
    map.current.moveTo({...last.view, duration: 800});
    setLast(null);
  }

  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        view={view}
        onViewChange={setView}
        data={data}
        layers={layers}
        interactiveLayers={['landings']}
        attribution={{compact: true}}
        onClick={zoomTo}
      />
      <p>
        {last
          ? `${last.name}. Press Back to return.`
          : 'Click a ferry landing to zoom in.'}
      </p>
      <button disabled={!last} onClick={goBack}>
        Back
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

  let map = null;
  // The view before the last click, and the landing of that click.
  let last = $state.raw(null);
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    attribution: {compact: true},
    data: {
      landings: points(landings, {
        lngLat: l => l.lngLat,
        properties: l => ({name: l.name}),
      }),
    },
    layers,
    interactiveLayers: ['landings'],
    onClick: e => {
      const feature = e.features[0];
      if (!feature) return;
      // Store the view before the move, without `bounds`: a target with
      // `bounds` fits that box instead.
      const {center, zoom, bearing, pitch} = map.state.get().view;
      last = {
        view: {center, zoom, bearing, pitch},
        name: feature.properties.name,
      };
      map.moveTo({
        center: feature.geometry.coordinates,
        zoom: 17,
        duration: 800,
      });
    },
  };

  function goBack() {
    map.moveTo({...last.view, duration: 800});
    last = null;
  }
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>
  {last
    ? `${last.name}. Press Back to return.`
    : 'Click a ferry landing to zoom in.'}
</p>
<button disabled={!last} onclick={goBack}>Back</button>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Go back to the last view</title>
<!--
  Below the map, a line of text
  and a button that goes back to
  the view before the last click.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  interactive-layers="landings"
  style="height: 500px"
></map-jr>
<p id="readout">Click a ferry landing to zoom in.</p>
<button id="go-back" disabled>Back</button>
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

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const back = document.getElementById('go-back');
  map.attribution = {compact: true};
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

  let last = null;
  map.addEventListener('map-click', event => {
    const feature = event.detail.features[0];
    if (!feature) return;
    // Store the view before the
    // move, without `bounds`: a
    // target with `bounds` fits
    // that box instead. `map.map`
    // is the map of the element.
    const {center, zoom, bearing, pitch} = map.state.get().view;
    last = {center, zoom, bearing, pitch};
    map.map.moveTo({
      center: feature.geometry.coordinates,
      zoom: 17,
      duration: 800,
    });
    back.disabled = false;
    readout.textContent = `${feature.properties.name}. Press Back to return.`;
  });

  // `moveTo` and not the
  // attributes `center` and
  // `zoom`: `moveTo` always moves
  // the map.
  back.onclick = () => {
    map.map.moveTo({...last, duration: 800});
    back.disabled = true;
    readout.textContent = 'Click a ferry landing to zoom in.';
  };
</script>
```
<!-- example:back:end -->

A click on a ferry landing zooms to it, and the button Back below the map returns to the view before the click.

- The click handler stores the view before it moves the map. The Map Jr, Svelte and `<map-jr>` forms read it from
  [`state.get().view`](../reference/state.md#mapstate). The Vue and React forms keep the view in the application with
  `view` and `onViewChange`, and read it there.
- The stored view has `center`, `zoom`, `bearing` and `pitch`, and not `bounds`. A target of `moveTo` with `bounds`
  fits that box and ignores `center` and `zoom`.
- To go back more than one step, push each view onto a list in place of `last`, and pass the view that `pop()` returns
  to `moveTo`.
- In the compat entry, the code stores the view with `getCenter`, `getZoom`, `getBearing` and `getPitch`, and moves the
  map with `easeTo`, as in MapLibre GL JS.

The option [`hash`](../reference/description.md#hash) keeps the view in the URL of the page, so that a link or a
reload opens the same view.

To start at the last view of the visit before, keep the view in `localStorage`. Read it before the call of
`createMap`, and store each view where the map stops:

```js
import {createMap} from '@map-jr/map-jr-gl';

const saved = JSON.parse(localStorage.getItem('view') ?? 'null');
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: saved ?? {center: [-74.0065, 40.7085], zoom: 13.6},
});

map.listen('moveend', () => {
  const {center, zoom, bearing, pitch} = map.state.get().view;
  localStorage.setItem('view', JSON.stringify({center, zoom, bearing, pitch}));
});
```

## Read the view

In the main API, [`map.state`](../reference/state.md#mapstate) holds the current view in `view`, with one more member, `bounds`.
`bounds` is the smallest box `[[west, south], [east, north]]` that contains the visible map, also when the map is
rotated or pitched. It changes when the map moves and when the size of the map changes.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});

const showView = view => {
  document.title = `${view.center[1].toFixed(4)}, ${view.center[0].toFixed(4)} at zoom ${view.zoom.toFixed(1)}`;
};
// The listener runs only when the view changes, so show the current view first.
showView(map.state.get().view);
map.state.subscribe(state => state.view, showView);
```

`state.moving` is `true` while the camera moves. In the compat entry, call `getCenter()`, `getZoom()`,
`getBearing()`, `getPitch()` and `getBounds()`, as in MapLibre GL JS.

## See also

- [`initialView`](../reference/description.md#initialview), [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange),
  [`padding`](../reference/description.md#padding), [`hash`](../reference/description.md#hash) and
  [`maxBounds`](../reference/description.md#maxbounds) in the reference of the description.
- [The camera](view-and-camera.md) for `moveTo` and `fitBounds`.
- [The view of `v-model:view`](../reference/vue.md#view) for the Vue component.
