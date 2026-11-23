# Go back to the last view

This example zooms to a ferry landing of New York when the user clicks it, and a Back button returns the map to the
view before the click.

<!-- example:back:start -->
**Main API**

```js [Main API]
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

**MapLibre compat**

```js [MapLibre compat]
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

## How it works

- A click reports the features of [`interactiveLayers`](../reference/description.md#interactivelayers) under the
  pointer in `e.features`, the top one first. A feature has its position in `geometry.coordinates`, so the code needs no
  list of its own to find it.
- The click handler stores the view before it moves the map. The Main API, Svelte and `<map-jr>` forms read it from
  [`state.get().view`](../reference/state.md#mapstate). The Vue and React forms keep the view in the application with
  [`view` and `onViewChange`](../reference/description.md#view-and-onviewchange) and read it there.
- The stored view has `center`, `zoom`, `bearing` and `pitch`, and not `bounds`. A target of `moveTo` with `bounds`
  fits that box and ignores `center` and `zoom`.
- [`moveTo`](../reference/map.md#moveto) with `duration` animates the camera for that many milliseconds, both to the
  landing and back. The Vue and React forms call `moveTo` too, and do not set `view` to the stored view, for the reason
  in [Return to a stored view](../guide/view-and-camera.md#return-to-a-stored-view).

In the compat entry, the code stores the view with `getCenter`, `getZoom`, `getBearing` and `getPitch`, and moves the
map with `easeTo`, as in MapLibre GL JS.

## Variations

Each variation changes the Main API form. `map` is the map, and `back` is the button.

### Go back more than one step

A list of views goes back one click at a time. The click handler adds the view to the list in place of `last`:

```js
const views = [];
// In onClick, in place of `last = {center, zoom, bearing, pitch}`:
views.push({center, zoom, bearing, pitch});

back.onclick = () => {
  map.moveTo({...views.pop(), duration: 800});
  back.disabled = !views.length;
};
```

### Start at the last view of the visit before

`localStorage` keeps the view when the page is closed, and the map starts there at the next visit. Read the stored view
before the call of `createMap`, and write `initialView,` in the description in place of
`initialView: {center: NYC, zoom: 13.6},`:

```js
const saved = JSON.parse(localStorage.getItem('view') ?? 'null');
const initialView = saved ?? {center: NYC, zoom: 13.6};
```

After the call of `createMap`, store each view where the map stops:

```js
map.listen('moveend', () => {
  const {center, zoom, bearing, pitch} = map.state.get().view;
  localStorage.setItem('view', JSON.stringify({center, zoom, bearing, pitch}));
});
```

The option [`hash`](../reference/description.md#hash) keeps the view in the URL of the page instead, so that a link
opens the same view.

## See also

- [Return to a stored view](../guide/view-and-camera.md#return-to-a-stored-view) in the guide to the view and camera.
- [`moveTo`](../reference/map.md#moveto) for `duration` and `fly`.
- [Fit the map to your data](fit.md) to show all of the landings again.
