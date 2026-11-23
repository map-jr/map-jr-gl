# Update the map from app state

This example adds and removes markers with a button, tilts the camera with another button, and shows the zoom and the
style layer under the pointer. The map follows a description that the application changes.

<!-- example:reactive:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text with the state of the
// map and two buttons.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [
  [-74.0134, 40.7033],
  [-74.009, 40.7061],
  [-74.006, 40.7127],
  [-73.9969, 40.7061],
];
// The markers: a point for each place in `data`, and a symbol layer that draws
// the image at each point.
const pins = points(places, {
  lngLat: p => p,
  properties: () => ({color: '#d6453d'}),
});
const pinLayer = {
  id: 'pins',
  type: 'symbol',
  source: 'pins',
  layout: {
    'icon-image': 'dot',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
};

const container = document.getElementById('map');
const readout = document.createElement('p');
const markers = Object.assign(document.createElement('button'), {
  textContent: 'Add markers',
});
const tilt = Object.assign(document.createElement('button'), {
  textContent: 'Tilt',
});
container.after(readout, markers, tilt);

let description = {
  style,
  initialView: {center: NYC, zoom: 13.6},
  interactiveLayers: ['park', 'water'],
  attribution: {compact: true},
  // The image of the markers: an SVG template, 14 pixels wide and high.
  images: {dot: {image: dot, width: 14, height: 14}},
};
const map = createMap(container, description);

// The state is a store. This function runs after each change.
map.state.subscribe(state => {
  const feature = state.hover[0];
  readout.textContent =
    `zoom ${state.view.zoom.toFixed(2)} · ${state.moving ? 'moving' : state.idle ? 'idle' : 'loading'} · under the pointer: ` +
    (feature ? feature.layer.id : 'nothing (move over a park or water)');
});

// A change is a new description. The map finds what is different.
let shown = false;
markers.onclick = () => {
  shown = !shown;
  map.update(
    (description = {
      ...description,
      data: shown ? {pins} : {},
      layers: shown ? [pinLayer] : [],
    }),
  );
  markers.textContent = shown ? 'Remove markers' : 'Add markers';
};
tilt.onclick = () =>
  map.moveTo({pitch: map.state.get().view.pitch ? 0 : 50, duration: 600});
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. Below the map, it adds a line of text with the state of the
// map and two buttons.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [
  [-74.0134, 40.7033],
  [-74.009, 40.7061],
  [-74.006, 40.7127],
  [-73.9969, 40.7061],
];

// With the API of MapLibre GL JS, your code listens for events and calls a
// method for each change.
const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 13.6,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
const markers = Object.assign(document.createElement('button'), {
  textContent: 'Add markers',
});
const tilt = Object.assign(document.createElement('button'), {
  textContent: 'Tilt',
});
map.getContainer().after(readout, markers, tilt);

let under = 'nothing';
const report = () => {
  const zoom = map.getZoom().toFixed(2);
  readout.textContent = `zoom ${zoom} · under the pointer: ${under}`;
};
map.on('move', report);
map.on('mousemove', async e => {
  const features = await map.queryRenderedFeatures(e.point, {
    layers: ['park', 'water'],
  });
  under = features[0]?.layer.id ?? 'nothing';
  report();
});

// The markers: a source with a point for each place, and a symbol layer with an
// image. The image is an SVG template (an addition of this library), and each
// feature fills its slot `color`.
map.addImage('dot', dot, {width: 14, height: 14});
let shown = false;
markers.onclick = () => {
  if (shown) {
    map.removeLayer('pins');
    map.removeSource('pins');
  } else {
    map.addSource('pins', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: places.map(coordinates => ({
          type: 'Feature',
          properties: {color: '#d6453d'},
          geometry: {type: 'Point', coordinates},
        })),
      },
    });
    map.addLayer({
      id: 'pins',
      type: 'symbol',
      source: 'pins',
      layout: {
        'icon-image': 'dot',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
  shown = !shown;
  markers.textContent = shown ? 'Remove markers' : 'Add markers';
};
tilt.onclick = () =>
  map.easeTo({pitch: map.getPitch() ? 0 : 50, duration: 600});
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {computed, ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [
  [-74.0134, 40.7033],
  [-74.009, 40.7061],
  [-74.006, 40.7127],
  [-73.9969, 40.7061],
];

const view = ref({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
// The image of the markers: an SVG template, 14 pixels wide and high.
const images = {dot: {image: dot, width: 14, height: 14}};
// A symbol layer that draws the image at each point of the source "pins".
const layers = [
  {
    id: 'pins',
    type: 'symbol',
    source: 'pins',
    layout: {
      'icon-image': 'dot',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];
const shown = ref(false);
// A key of `data` makes a GeoJSON source with that id. The data of a source is
// compared by identity, so a change is a new object.
const data = computed(() => ({
  pins: points(shown.value ? places : [], {
    lngLat: p => p,
    properties: () => ({color: '#d6453d'}),
  }),
}));
const hover = ref([]);
</script>

<template>
  <MapJr
    :map-style="style"
    v-model:view="view"
    :images="images"
    :data="data"
    :layers="layers"
    :interactive-layers="['park', 'water']"
    :attribution="{compact: true}"
    @hover="hover = $event"
  />
  <p>
    zoom {{ view.zoom.toFixed(2) }} · under the pointer:
    {{ hover[0]?.layer.id ?? 'nothing' }}
  </p>
  <button @click="shown = !shown">
    {{ shown ? 'Remove markers' : 'Add markers' }}
  </button>
  <button @click="view.pitch = view.pitch ? 0 : 50">Tilt</button>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useMemo, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [
  [-74.0134, 40.7033],
  [-74.009, 40.7061],
  [-74.006, 40.7127],
  [-73.9969, 40.7061],
];
// The image of the markers: an SVG template, 14 pixels wide and high.
const images = {dot: {image: dot, width: 14, height: 14}};
// A symbol layer that draws the image at each point of the source "pins".
const layers = [
  {
    id: 'pins',
    type: 'symbol',
    source: 'pins',
    layout: {
      'icon-image': 'dot',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];

export default function Reactive() {
  const [view, setView] = useState({
    center: NYC,
    zoom: 13.6,
    bearing: 0,
    pitch: 0,
  });
  const [shown, setShown] = useState(false);
  const [hover, setHover] = useState([]);
  // A key of `data` makes a GeoJSON source with that id. The data is compared
  // by identity: keep the object until the markers change.
  const data = useMemo(
    () => ({
      pins: points(shown ? places : [], {
        lngLat: p => p,
        properties: () => ({color: '#d6453d'}),
      }),
    }),
    [shown],
  );

  return (
    <>
      <MapJr
        mapStyle={style}
        view={view}
        onViewChange={setView}
        images={images}
        data={data}
        layers={layers}
        interactiveLayers={['park', 'water']}
        attribution={{compact: true}}
        onHover={setHover}
      />
      <p>
        zoom {view.zoom.toFixed(2)} · under the pointer:{' '}
        {hover[0]?.layer.id ?? 'nothing'}
      </p>
      <button onClick={() => setShown(!shown)}>
        {shown ? 'Remove markers' : 'Add markers'}
      </button>
      <button onClick={() => setView({...view, pitch: view.pitch ? 0 : 50})}>
        Tilt
      </button>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const dot =
    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
  const places = [
    [-74.0134, 40.7033],
    [-74.009, 40.7061],
    [-74.006, 40.7127],
    [-73.9969, 40.7061],
  ];
  // A symbol layer that draws the image at each point of the source "pins".
  const pinLayer = {
    id: 'pins',
    type: 'symbol',
    source: 'pins',
    layout: {
      'icon-image': 'dot',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };

  // (`$state.raw`: the map gets the view object itself, not a proxy of it.)
  let view = $state.raw({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
  let shown = $state(false);
  // A key of `data` makes a GeoJSON source with that id. The data is compared
  // by identity: $derived keeps the object until `shown` changes.
  const pins = $derived(
    points(shown ? places : [], {
      lngLat: p => p,
      properties: () => ({color: '#d6453d'}),
    }),
  );
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    view,
    onViewChange: next => (view = next),
    // The image of the markers: an SVG template, 14 pixels wide and high.
    images: {dot: {image: dot, width: 14, height: 14}},
    data: {pins},
    layers: [pinLayer],
    interactiveLayers: ['park', 'water'],
    attribution: {compact: true},
  });
  let map = $state(null);
  // The state of the map as a store: `$live.hover` has the features under the
  // pointer.
  const live = $derived(map && mapState(map));
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>
  zoom {view.zoom.toFixed(2)} · under the pointer: {$live?.hover[0]?.layer.id ??
    'nothing'}
</p>
<button onclick={() => (shown = !shown)}
  >{shown ? 'Remove markers' : 'Add markers'}</button
>
<button onclick={() => (view = {...view, pitch: view.pitch ? 0 : 50})}
  >Tilt</button
>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>One description, and state to watch</title>
<!--
  Below the map, a line of text
  gives the state of the map, and
  two buttons change the map.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  interactive-layers="park water"
  style="height: 500px"
></map-jr>
<p id="readout"></p>
<button id="markers">Add markers</button>
<button id="tilt">Tilt</button>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {points} from '@map-jr/map-jr-gl';

  const dot =
    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
  const places = [
    [-74.0134, 40.7033],
    [-74.009, 40.7061],
    [-74.006, 40.7127],
    [-73.9969, 40.7061],
  ];
  // The markers: a point for each
  // place, and a symbol layer
  // that draws the image at each
  // point.
  const pins = points(places, {
    lngLat: p => p,
    properties: () => ({color: '#d6453d'}),
  });
  const pinLayer = {
    id: 'pins',
    type: 'symbol',
    source: 'pins',
    layout: {
      'icon-image': 'dot',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const markers = document.getElementById('markers');
  map.attribution = {compact: true};
  // The image of the markers: an
  // SVG template, 14 pixels wide
  // and high.
  map.images = {dot: {image: dot, width: 14, height: 14}};

  // The state is a store. This
  // function runs after each
  // change.
  map.addEventListener('map-ready', () =>
    map.state.subscribe(state => {
      const feature = state.hover[0];
      readout.textContent =
        `zoom ${state.view.zoom.toFixed(2)} · ${state.moving ? 'moving' : state.idle ? 'idle' : 'loading'} · under the pointer: ` +
        (feature ? feature.layer.id : 'nothing (move over a park or water)');
    }),
  );

  // A change is a new value of a
  // property. The map finds what
  // is different.
  let shown = false;
  markers.onclick = () => {
    shown = !shown;
    map.data = shown ? {pins} : {};
    map.layers = shown ? [pinLayer] : [];
    markers.textContent = shown ? 'Remove markers' : 'Add markers';
  };
  // A change of the attribute
  // `pitch` moves the map.
  document.getElementById('tilt').onclick = () =>
    map.setAttribute('pitch', map.state.get().view.pitch ? '0' : '50');
</script>
```
<!-- example:reactive:end -->

## How it works

- [`update`](../reference/map.md#update) applies a new description. The map compares it with the one before and changes
  only what differs. Pass the complete description each time; [`patch`](../reference/map.md#patch) changes some fields
  and keeps the others.
- Each key of [`data`](../reference/description.md#data) is the id of a GeoJSON source, and
  [`points`](../reference/exports.md#points) converts records to the points of that source. The map compares the data by
  identity, so a change of the markers is a new object.
- [`state`](../reference/state.md) is a store. `subscribe` calls its listener after each change, with `view`, `moving`,
  `idle` and `hover`.
- `hover` lists the features of [`interactiveLayers`](../reference/description.md#interactivelayers) under the pointer,
  the top one first. `park` and `water` are layer ids of this style.
- [`moveTo`](../reference/map.md#moveto) animates the camera for `duration` milliseconds.

The Vue, React and Svelte forms keep the view in the application with [`view` and
`onViewChange`](../reference/description.md#view-and-onviewchange), so the Tilt button sets the view with no animation.
In the compat entry, the code calls a method of MapLibre GL JS for each change (`addSource`, `removeLayer`, `easeTo`)
and queries the features under the pointer itself.

## See also

- [Keep the view in the application](../guide/view-and-camera.md#keep-the-view-in-the-application) for the view as state
  of a framework.
- [Set the data of a source](../guide/data.md#set-the-data-of-a-source) for `data` and its updates.
- [Draw markers with a symbol layer](../guide/markers-and-popups.md#draw-markers-with-a-symbol-layer) for the image of
  the markers.
