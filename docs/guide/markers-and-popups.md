# Markers and popups

This page shows how to draw markers, change them, open a popup for the marker that the user clicks, and let the user
move a marker.

## Choose how to draw a marker

| | A symbol layer with an image | An element of the page |
|---|---|---|
| Use it for | Many markers that look alike | A few markers with HTML content, or a marker that the user moves |
| Number of markers | 100,000 and more | Hundreds at most. The browser becomes slow with thousands. |
| A click | Finds the feature of the marker | Is an event of the element |
| During a movement of the map | Is drawn with the map | Can trail the map by about one frame |

Start with a symbol layer when you are not sure.

## Draw markers with a symbol layer

The markers need an image, a GeoJSON source with a point for each marker, and a symbol layer that draws the image
at each point.

**Main API**

```js [Main API]
import {createMap, points} from '@map-jr/map-jr-gl';

// {{color}} is a slot: each marker fills it from its property "color".
const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {
    id: 2,
    name: 'Empire State Building',
    lng: -73.9857,
    lat: 40.7484,
    color: '#2f7fd1',
  },
];
// A GeoJSON point for each record. The properties of a point are all the fields
// of its record.
const toPoints = records =>
  points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id});

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  data: {places: toPoints(places)},
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': 'pin',
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// {{color}} is a slot: each marker fills it from its property "color". MapLibre
// GL JS has no such images.
const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {name: 'City Hall', color: '#d6453d'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      id: 2,
      properties: {name: 'Empire State Building', color: '#2f7fd1'},
      geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]},
    },
  ],
};

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.996, 40.73],
  zoom: 11.5,
});

map.on('load', async () => {
  await map.addImage('pin', pin);
  map.addSource('places', {type: 'geojson', data: places});
  map.addLayer({
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
});
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

// {{color}} is a slot: each marker fills it from its property "color".
const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {
    id: 2,
    name: 'Empire State Building',
    lng: -73.9857,
    lat: 40.7484,
    color: '#2f7fd1',
  },
];
// A GeoJSON point for each record, in a shallowRef: the map needs a new object
// to see a change.
const data = shallowRef({
  places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
});
const layers = [
  {
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-73.996, 40.73], zoom: 11.5}"
      :images="{pin}"
      :data="data"
      :layers="layers"
    />
  </div>
</template>
```

**React**

```jsx [React]
import {useMemo} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

// {{color}} is a slot: each marker fills it from its property "color".
const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const images = {pin};
const layers = [
  {
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];

// `places` is a list of records such as {id: 1, name: 'City Hall', lng:
// -74.006, lat: 40.7128, color: '#d6453d'}.
export function Places({places}) {
  // A GeoJSON point for each record. The map needs a new object to see a
  // change, and only then.
  const data = useMemo(
    () => ({
      places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
    }),
    [places],
  );

  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-73.996, 40.73], zoom: 11.5}}
        images={images}
        data={data}
        layers={layers}
      />
    </div>
  );
}
```

The map shows a red and a blue pin, each with its tip on its position.

In the main API and the adapters, the key `places` in `data` creates the GeoJSON source `places`.
[`points`](data.md#convert-records-to-points) converts the records to GeoJSON.

The layout properties decide how the markers behave among each other and among the labels of the map:

| What you want | Write |
|---|---|
| The tip of the image on the position | `'icon-anchor': 'bottom'`. The default is `'center'`. |
| Every marker shows, also where markers cover each other | `'icon-allow-overlap': true` |
| The labels of the map do not keep away from the markers | `'icon-ignore-placement': true` |
| Markers in a zoom range only | `minzoom` and `maxzoom` of the layer |
| Markers below the labels of the map | `before` of the layer (main API), or the second argument of `addLayer`: the id of a symbol layer in `layers` of the style JSON |
| Text beside the image | `text-field` in `layout` |

A marker has the size of its image, and an SVG image has the size of its `viewBox` in CSS pixels. For another size,
set the image to `{image: pin, width: 36, height: 46}`. See [`images`](../reference/description.md#images) for the
other forms of an image.

## Change the markers

Set new GeoJSON on the source. In the main API, [`map.patch`](../reference/map.md#patch) replaces the fields that it
is passed and keeps the other fields of the description.

**Main API**

```js [Main API]
import {createMap, points} from '@map-jr/map-jr-gl';

let places = [
  {id: 1, lng: -74.006, lat: 40.7128},
  {id: 2, lng: -73.9857, lat: 40.7484},
];
const toPoints = records =>
  points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id});

// Circles keep this example short. Markers with an image change in the same
// way.
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  data: {places: toPoints(places)},
  layers: [
    {
      id: 'places',
      type: 'circle',
      source: 'places',
      paint: {'circle-radius': 7, 'circle-color': '#d6453d'},
    },
  ],
});

function movePlace(id, lng, lat) {
  places = places.map(place =>
    place.id === id ? {...place, lng, lat} : place,
  );
  // toPoints() returns a new GeoJSON object. The map applies `data.places` only
  // when it is a new object.
  map.patch({data: {places: toPoints(places)}});
}

function removePlaces() {
  // `null` removes the source `places`, and `layers: []` removes every layer
  // of `layers`.
  map.patch({data: {places: null}, layers: []});
}
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      id: 2,
      properties: {},
      geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]},
    },
  ],
};

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.996, 40.73],
  zoom: 11.5,
});

// Circles keep this example short. Markers with an image change in the same
// way.
map.on('load', () => {
  map.addSource('places', {type: 'geojson', data: places});
  map.addLayer({
    id: 'places',
    type: 'circle',
    source: 'places',
    paint: {'circle-radius': 7, 'circle-color': '#d6453d'},
  });
});

function movePlace(id, lng, lat) {
  places.features.find(feature => feature.id === id).geometry.coordinates = [
    lng,
    lat,
  ];
  // setData() always applies the data, also when it is the same object as
  // before.
  map.getSource('places').setData(places);
}

function removePlaces() {
  map.removeLayer('places');
  map.removeSource('places');
}
```

In Vue and React, pass a new object to the `data` prop. In the examples of the first section, assign to `data.value` in Vue,
and pass a new `places` array to the component in React.

## Open a popup when the user clicks a marker

A marker of a symbol layer is a feature of that layer, so a click finds it. In the main API,
[`map.overlay`](../reference/map.md#overlay) places an element of the page at a position of the map,
and `popup: true` shows the element in a popup. `MapOverlay` does the same in Vue and React.

**Main API**

```js [Main API]
import {createMap, points} from '@map-jr/map-jr-gl';

const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {
    id: 2,
    name: 'Empire State Building',
    lng: -73.9857,
    lat: 40.7484,
    color: '#2f7fd1',
  },
];
let popup = null;

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  data: {places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id})},
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': 'pin',
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ],
  // A click reports the features of these layers.
  interactiveLayers: ['places'],
  onClick: event => {
    popup?.remove();
    popup = null;
    const place = event.features[0];
    if (!place) return;
    const content = document.createElement('div');
    content.textContent = place.properties.name;
    // `offset` is [right, down] in pixels. The pin is 31 pixels tall, so [0,
    // -30] moves the tip of the popup to the top of the pin.
    popup = map.overlay(content, {
      lngLat: place.geometry.coordinates,
      popup: true,
      offset: [0, -30],
      onClose: () => {
        popup = null;
      },
    });
  },
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {name: 'City Hall', color: '#d6453d'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      id: 2,
      properties: {name: 'Empire State Building', color: '#2f7fd1'},
      geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]},
    },
  ],
};

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.996, 40.73],
  zoom: 11.5,
});

map.on('load', async () => {
  await map.addImage('pin', pin);
  map.addSource('places', {type: 'geojson', data: places});
  map.addLayer({
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
});

map.on('click', 'places', event => {
  const place = event.features[0];
  // As in MapLibre GL JS, a number as `offset` moves the popup that many pixels
  // away from the position, here up.
  new Popup({offset: 30})
    .setLngLat(place.geometry.coordinates)
    .setText(place.properties.name)
    .addTo(map);
});
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {
    id: 2,
    name: 'Empire State Building',
    lng: -73.9857,
    lat: 40.7484,
    color: '#2f7fd1',
  },
];
const data = shallowRef({
  places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
});
const layers = [
  {
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];
// The feature of the marker that the user clicked, or null.
const selected = shallowRef(null);
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-73.996, 40.73], zoom: 11.5}"
      :images="{pin}"
      :data="data"
      :layers="layers"
      :interactive-layers="['places']"
      @click="event => (selected = event.features[0] ?? null)"
    >
      <!--
        `offset` is [right, down] in pixels. The pin is 31 pixels tall, so [0,
        -30] moves the tip of the popup to the top of the pin.
      -->
      <MapOverlay
        v-if="selected"
        :lng-lat="selected.geometry.coordinates"
        :offset="[0, -30]"
        popup
        @close="selected = null"
      >
        {{ selected.properties.name }}
      </MapOverlay>
    </MapJr>
  </div>
</template>
```

**React**

```jsx [React]
import {useMemo, useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const pin =
  '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const images = {pin};
const layers = [
  {
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': 'pin',
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];
const interactiveLayers = ['places'];

export function Places({places}) {
  const data = useMemo(
    () => ({
      places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
    }),
    [places],
  );
  // The feature of the marker that the user clicked, or null.
  const [selected, setSelected] = useState(null);

  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-73.996, 40.73], zoom: 11.5}}
        images={images}
        data={data}
        layers={layers}
        interactiveLayers={interactiveLayers}
        onClick={event => setSelected(event.features[0] ?? null)}
      >
        {/* `offset` is [right, down] in pixels. The pin is 31 pixels tall, so [0, -30] moves the tip of the popup to the top of the pin. */}
        {selected && (
          <MapOverlay
            lngLat={selected.geometry.coordinates}
            offset={[0, -30]}
            popup
            onClose={() => setSelected(null)}
          >
            {selected.properties.name}
          </MapOverlay>
        )}
      </MapJr>
    </div>
  );
}
```

A click on a pin opens a popup with the name of the place. Where markers cover each other, the one on top is the
first of `features`.

Two things often go wrong:

- `features` is empty. In the main API and the adapters, a click reports only the features of the layers in
  `interactiveLayers`.
- The popup has no button to close it. A popup of `overlay` and of `MapOverlay` has a close button only when
  `onClose` (`@close` in Vue) is set. The button closes the popup and then calls `onClose`.

## Put an element of the page on the map, and let the user move it

An element of the page can be a marker: an image, a button or any other HTML. With `draggable`, the user moves it
with the mouse, a finger or a pen.

<!-- example:draggable:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the position of the pin.
import {createMap, defaultPin} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};
const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 14},
  attribution: {compact: true},
});

// The default pin of Marker, which the user can move. The tip of the pin is at
// the position.
map.overlay(defaultPin({color: '#d6453d'}), {
  lngLat: NYC,
  anchor: 'bottom',
  draggable: true,
  onDrag: lngLat => show(`Moving: ${at(lngLat)}`),
  onDragEnd: lngLat => show(`Dropped at ${at(lngLat)}`),
});
show(`Drag the pin. It is at ${at(NYC)}`);
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the position of the pin.
import {Map, Marker} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const at = ({lng, lat}) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 14,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);
const show = text => {
  readout.textContent = text;
};

const marker = new Marker({color: '#d6453d', draggable: true})
  .setLngLat(NYC)
  .addTo(map);
marker.on('drag', () => show(`Moving: ${at(marker.getLngLat())}`));
marker.on('dragend', () => show(`Dropped at ${at(marker.getLngLat())}`));
show(`Drag the pin. It is at ${at(marker.getLngLat())}`);
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// The outline of the pin.
const pinPath =
  'M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z';
const pin = ref([-74.0065, 40.7085]);
const moving = ref(false);
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: pin, zoom: 14}"
    :attribution="{compact: true}"
  >
    <!--
      The new position comes with dragend. The pin stays where it was dropped
      until lng-lat changes.
    -->
    <MapOverlay
      :lng-lat="pin"
      anchor="bottom"
      draggable
      @dragstart="moving = true"
      @dragend="
        p => {
          pin = p;
          moving = false;
        }
      "
    >
      <svg width="27" height="41" viewBox="0 0 27 41">
        <path :d="pinPath" fill="#d6453d" />
        <circle cx="13.5" cy="13.5" r="5.5" fill="#fff" />
      </svg>
    </MapOverlay>
    <p class="note">
      {{
        moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`
      }}
    </p>
  </MapJr>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
// The outline of the pin.
const pinPath =
  'M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z';

export default function Draggable() {
  const [pin, setPin] = useState(NYC);
  const [moving, setMoving] = useState(false);
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 14}}
      attribution={{compact: true}}
    >
      {/* The new position comes with onDragEnd. The pin stays where it was dropped until lngLat changes. */}
      <MapOverlay
        lngLat={pin}
        anchor="bottom"
        draggable
        onDragStart={() => setMoving(true)}
        onDragEnd={p => {
          setPin(p);
          setMoving(false);
        }}
      >
        <svg width="27" height="41" viewBox="0 0 27 41">
          <path d={pinPath} fill="#d6453d" />
          <circle cx="13.5" cy="13.5" r="5.5" fill="#fff" />
        </svg>
      </MapOverlay>
      <p className="note">
        {moving
          ? 'Moving'
          : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`}
      </p>
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {defaultPin} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: NYC, zoom: 14},
    attribution: {compact: true},
  };
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  let text = $state(`Drag the pin. It is at ${at(NYC)}`);

  // The default pin of Marker, which the user can move. The tip of the pin is
  // at the position.
  function ready(map) {
    map.overlay(defaultPin({color: '#d6453d'}), {
      lngLat: NYC,
      anchor: 'bottom',
      draggable: true,
      onDrag: lngLat => (text = `Moving: ${at(lngLat)}`),
      onDragEnd: lngLat => (text = `Dropped at ${at(lngLat)}`),
    });
  }
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>{text}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A pin that the user moves</title>
<!--
  A line of text below the map
  gives the position of the pin.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="14"
  style="height: 500px"
></map-jr>
<p id="readout"></p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {defaultPin} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  map.attribution = {compact: true};

  // The default pin of Marker,
  // which the user can move. The
  // tip of the pin is at the
  // position.
  map.addEventListener('map-ready', event => {
    event.detail.overlay(defaultPin({color: '#d6453d'}), {
      lngLat: NYC,
      anchor: 'bottom',
      draggable: true,
      onDrag: lngLat => {
        readout.textContent = `Moving: ${at(lngLat)}`;
      },
      onDragEnd: lngLat => {
        readout.textContent = `Dropped at ${at(lngLat)}`;
      },
    });
  });
  readout.textContent = `Drag the pin. It is at ${at(NYC)}`;
</script>
```
<!-- example:draggable:end -->

The user drags the pin, and a line of text below the map shows its position while it moves and where it is dropped.

- [`defaultPin`](../reference/exports.md#defaultpin) returns the pin of `Marker` of MapLibre GL JS as an element.
  `anchor: 'bottom'` puts the tip of the pin at the position. Any other element can be dragged in the same way.
- A drag starts once the pointer has moved 3 CSS pixels, so a click stays a click. The map does not pan while the pin
  is dragged.
- `onDrag` receives the position as `[lng, lat]` at each move, and `onDragEnd` receives the position where the pin was
  dropped. See [`OverlayOptions`](../reference/map.md#overlayoptions) for every option.
- In the compat entry, a `Marker` of MapLibre GL JS with `draggable: true` fires `drag` and `dragend`.

After a drag, the pin stays where the user dropped it until `lngLat` changes. So store the position that the drag
reports and pass it back, as the examples do. With Svelte and with the custom element `<map-jr>`, call `map.overlay` as in the main API. See
[Svelte](../reference/svelte.md) and [The element](../reference/element.md) for how to get the map.

## Keep many markers fast

A frame takes the same time for 100 markers and for 100,000 when the symbol layer has no text, has
`symbol-placement: 'point'` (the default) and has `icon-allow-overlap: true`. The layers of this page are such
layers. The map then draws the icons from a buffer on the GPU, without a place among the labels. All of these must
be true:

- The feature has no text.
- `symbol-placement` is `point` (the default).
- `icon-allow-overlap` is `true`. The icon is then always shown.
- `icon-text-fit` is `none` (the default).
- The layer has no `symbol-sort-key`, and `icon-anchor`, `icon-offset`, `icon-rotation-alignment`,
  `icon-pitch-alignment`, `icon-color` and `icon-padding` have one value for the layer. `icon-size`, `icon-rotate` and
  `icon-opacity` can have a value for each feature.
- `icon-pitch-alignment` is not `map`, and it is not `auto` together with `icon-rotation-alignment: 'map'`.
- `icon-ignore-placement` has the same value for every feature of the tile.
- A halo counts only when it is not transparent: `icon-halo-width` above 0 with an `icon-halo-color` that has alpha.

The map places other icons among the labels, and their cost grows with their number. An icon from a buffer differs
from a placed icon in these points:

- With 3D terrain it stands on the ground, and ground in front of it does not hide it. (MapLibre GL JS and a placed
  icon are hidden.)
- It shows with its tile and does not fade in.
- The icons of a layer that is above each layer with labels are drawn over the labels. The icons of another layer
  are drawn below all labels and below all placed icons.
- The map asks for the image of each icon of a tile (`styleimagemissing`), also for an icon outside the view.

One cost still grows with the number of markers in view. Without `icon-ignore-placement: true`, the labels of the
map avoid each marker, and the map does that work each time that it places the labels. So set
`icon-ignore-placement: true` for very many markers.

These are measurements with software WebGL (headless Chromium, the main-thread renderer, 500 different images), for
the script time of one frame while the map moves. They were not made on a GPU.

| Icons | Always shown, labels do not keep away | Always shown, labels keep away |
|---|---|---|
| 10,000 | 6 ms | 6 ms |
| 100,000 | 5 to 8 ms | 14 to 20 ms on average; the frames that place the labels took more than 100 ms each |

The data of a GeoJSON source is cut into tiles when it is given. With 100,000 points the map was ready 2 to 3 seconds
after that in the same measurement, and with 200,000 points after 7 seconds or more.

This example draws 50,000 markers and opens a popup at the marker that the user clicks. Past zoom 12, 500 of the
markers change from a dot to a pin.

<!-- example:markers:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the frame rate.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35,
    a = Math.random() * 2 * Math.PI;
  return {
    lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
    props: {color: colors[i % 5]},
  };
});
const some = places.slice(0, 500);
// A GeoJSON FeatureCollection with a point for each place. The properties of a
// point are the `props` of its place.
const pointsOf = list =>
  points(list, {lngLat: p => p.lngLat, properties: p => p.props});
const always = {
  'icon-image': 'dot',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

let popup = null;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 11.4},
  attribution: {compact: true},
  // An image is an SVG template with {{slots}}. Each feature fills the slots
  // from its properties.
  images: {dot, pin},
  // Each key of `data` makes a GeoJSON source with that id.
  data: {rest: pointsOf(places.slice(500)), some: pointsOf(some)},
  // Symbol layers draw an image at each point of a source.
  layers: [
    // Icons that are always shown: the cost of a frame does not grow with their
    // number.
    {id: 'dots', type: 'symbol', source: 'rest', layout: always},
    // 500 of the places are pins when the zoom is 12 or more, and dots below
    // that.
    {
      id: 'dots-below-pins',
      type: 'symbol',
      source: 'some',
      maxzoom: 12,
      layout: always,
    },
    // (Without `icon-allow-overlap`, the pins do not pile up, and map labels
    // keep clear.)
    {
      id: 'pins',
      type: 'symbol',
      source: 'some',
      minzoom: 12,
      layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
    },
  ],
  // A click finds the features of these layers.
  interactiveLayers: ['pins', 'dots-below-pins', 'dots'],
  onClick: e => {
    popup?.remove();
    popup = null;
    const marker = e.features[0];
    if (!marker) return;
    const at = marker.geometry.coordinates,
      text = document.createElement('div');
    text.textContent = `Marker at ${at.map(v => v.toFixed(3)).join(', ')}`;
    // A popup that points at the marker, above it.
    popup = map.overlay(text, {
      lngLat: at,
      popup: true,
      offset: [0, marker.layer.id === 'pins' ? -30 : -6],
      onClose: () => {
        popup?.remove();
        popup = null;
      },
    });
  },
});

map.listen('stats', e => {
  readout.textContent = `50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`;
});
readout.textContent =
  '50,000 markers. Zoom in past 12: 500 of them become pins. Click one.';
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map gives the frame rate.
import {Map, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35,
    a = Math.random() * 2 * Math.PI;
  return {
    lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
    props: {color: colors[i % 5]},
  };
});
const some = places.slice(0, 500);

const points = list => ({
  type: 'FeatureCollection',
  features: list.map((place, id) => ({
    type: 'Feature',
    id,
    properties: place.props,
    geometry: {type: 'Point', coordinates: place.lngLat},
  })),
});

// The sources and the layers are those of MapLibre GL JS. One thing is an
// addition of this library: an image can be an SVG template with {{slots}}, and
// each feature fills the slots from its properties.
const map = new Map({
  container: 'map',
  style,
  center: NYC,
  zoom: 11.4,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.on('load', async () => {
  await map.addImage('dot', dot);
  await map.addImage('pin', pin);
  map.addSource('rest', {type: 'geojson', data: points(places.slice(500))});
  map.addSource('some', {type: 'geojson', data: points(some)});
  // Icons that are always shown: the cost of a frame does not grow with their
  // number.
  const always = {
    'icon-image': 'dot',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };
  map.addLayer({id: 'dots', type: 'symbol', source: 'rest', layout: always});
  // 500 of the places are pins when the zoom is 12 or more, and dots below
  // that.
  map.addLayer({
    id: 'dots-below-pins',
    type: 'symbol',
    source: 'some',
    maxzoom: 12,
    layout: always,
  });
  // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep
  // clear.)
  map.addLayer({
    id: 'pins',
    type: 'symbol',
    source: 'some',
    minzoom: 12,
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
  });
});

let popup = null;
for (const id of ['pins', 'dots-below-pins', 'dots'])
  map.on('click', id, e => {
    const at = e.features[0].geometry.coordinates;
    popup?.remove();
    popup = new Popup({offset: id === 'pins' ? 30 : 6})
      .setLngLat(at)
      .setText(`Marker at ${at.map(v => v.toFixed(3)).join(', ')}`)
      .addTo(map);
  });
map.on('stats', e => {
  const fps = e.fps.toFixed(0);
  readout.textContent = `50,000 markers, ${fps} frames per second.`;
});
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {shallowRef} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35,
    a = Math.random() * 2 * Math.PI;
  return {
    lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
    props: {color: colors[i % 5]},
  };
});
const some = places.slice(0, 500);

// A GeoJSON FeatureCollection with a point for each place. The properties of a
// point are the `props` of its place.
const pointsOf = list =>
  points(list, {lngLat: p => p.lngLat, properties: p => p.props});
// Each key of `data` makes a GeoJSON source with that id. (A plain object, not
// a ref: Vue does not make 50,000 points reactive.)
const data = {rest: pointsOf(places.slice(500)), some: pointsOf(some)};
const always = {
  'icon-image': 'dot',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};
// Symbol layers draw an image at each point of a source.
const layers = [
  // Icons that are always shown: the cost of a frame does not grow with their
  // number.
  {id: 'dots', type: 'symbol', source: 'rest', layout: always},
  // 500 of the places are pins when the zoom is 12 or more, and dots below
  // that.
  {
    id: 'dots-below-pins',
    type: 'symbol',
    source: 'some',
    maxzoom: 12,
    layout: always,
  },
  // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep
  // clear.)
  {
    id: 'pins',
    type: 'symbol',
    source: 'some',
    minzoom: 12,
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
  },
];
// A click finds the features of the layers in `interactive-layers`. The feature
// under the click, or null.
const selected = shallowRef(null);
</script>

<template>
  <!--
    An image is an SVG template with {{slots}}. Each feature fills the slots
    from its properties.
  -->
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 11.4}"
    :images="{dot, pin}"
    :data="data"
    :layers="layers"
    :interactive-layers="['pins', 'dots-below-pins', 'dots']"
    @click="e => (selected = e.features[0] ?? null)"
  >
    <MapOverlay
      v-if="selected"
      :lng-lat="selected.geometry.coordinates"
      :offset="[0, selected.layer.id === 'pins' ? -30 : -6]"
      popup
      @close="selected = null"
    >
      Marker at
      {{ selected.geometry.coordinates.map(v => v.toFixed(3)).join(', ') }}
    </MapOverlay>
  </MapJr>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useMemo, useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot =
  '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35,
    a = Math.random() * 2 * Math.PI;
  return {
    lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
    props: {color: colors[i % 5]},
  };
});
const some = places.slice(0, 500);
// A GeoJSON FeatureCollection with a point for each place. The properties of a
// point are the `props` of its place.
const pointsOf = list =>
  points(list, {lngLat: p => p.lngLat, properties: p => p.props});
const always = {
  'icon-image': 'dot',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
};
// Symbol layers draw an image at each point of a source.
const layers = [
  // Icons that are always shown: the cost of a frame does not grow with their
  // number.
  {id: 'dots', type: 'symbol', source: 'rest', layout: always},
  // 500 of the places are pins when the zoom is 12 or more, and dots below
  // that.
  {
    id: 'dots-below-pins',
    type: 'symbol',
    source: 'some',
    maxzoom: 12,
    layout: always,
  },
  // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep
  // clear.)
  {
    id: 'pins',
    type: 'symbol',
    source: 'some',
    minzoom: 12,
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
  },
];

export default function Markers() {
  // A click finds the features of the layers in `interactiveLayers`. The
  // feature under the click, or null.
  const [selected, setSelected] = useState(null);
  // An image is an SVG template with {{slots}}. Each feature fills the slots
  // from its properties.
  const images = useMemo(() => ({dot, pin}), []);
  // The data of a source is compared by identity: these sources are made one
  // time. Each key makes a GeoJSON source.
  const data = useMemo(
    () => ({rest: pointsOf(places.slice(500)), some: pointsOf(some)}),
    [],
  );

  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 11.4}}
      images={images}
      data={data}
      layers={layers}
      interactiveLayers={['pins', 'dots-below-pins', 'dots']}
      onClick={e => setSelected(e.features[0] ?? null)}
    >
      {selected && (
        <MapOverlay
          lngLat={selected.geometry.coordinates}
          offset={[0, selected.layer.id === 'pins' ? -30 : -6]}
          popup
          onClose={() => setSelected(null)}
        >
          Marker at{' '}
          {selected.geometry.coordinates.map(v => v.toFixed(3)).join(', ')}
        </MapOverlay>
      )}
    </MapJr>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const dot =
    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
  const pin =
    '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

  // 50,000 places around the centre, in five colours.
  const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
  const places = Array.from({length: 50000}, (_, i) => {
    const r = Math.sqrt(Math.random()) * 0.35,
      a = Math.random() * 2 * Math.PI;
    return {
      lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
      props: {color: colors[i % 5]},
    };
  });
  const some = places.slice(0, 500);
  // A GeoJSON FeatureCollection with a point for each place. The properties of
  // a point are the `props` of its place.
  const pointsOf = list =>
    points(list, {lngLat: p => p.lngLat, properties: p => p.props});
  const always = {
    'icon-image': 'dot',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };

  let map = null,
    popup = null;
  let text = $state(
    '50,000 markers. Zoom in past 12: 500 of them become pins. Click one.',
  );
  // (A plain object, not $state: Svelte does not make 50,000 points reactive.)
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: NYC, zoom: 11.4},
    attribution: {compact: true},
    // An image is an SVG template with {{slots}}. Each feature fills the slots
    // from its properties.
    images: {dot, pin},
    // Each key of `data` makes a GeoJSON source with that id.
    data: {rest: pointsOf(places.slice(500)), some: pointsOf(some)},
    // Symbol layers draw an image at each point of a source.
    layers: [
      // Icons that are always shown: the cost of a frame does not grow with
      // their number.
      {id: 'dots', type: 'symbol', source: 'rest', layout: always},
      // 500 of the places are pins when the zoom is 12 or more, and dots below
      // that.
      {
        id: 'dots-below-pins',
        type: 'symbol',
        source: 'some',
        maxzoom: 12,
        layout: always,
      },
      // (Without `icon-allow-overlap`, the pins do not pile up, and map labels
      // keep clear.)
      {
        id: 'pins',
        type: 'symbol',
        source: 'some',
        minzoom: 12,
        layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
      },
    ],
    // A click finds the features of these layers.
    interactiveLayers: ['pins', 'dots-below-pins', 'dots'],
    onClick: e => {
      popup?.remove();
      popup = null;
      const marker = e.features[0];
      if (!marker) return;
      const at = marker.geometry.coordinates,
        content = document.createElement('div');
      content.textContent = `Marker at ${at.map(v => v.toFixed(3)).join(', ')}`;
      // A popup that points at the marker, above it.
      popup = map.overlay(content, {
        lngLat: at,
        popup: true,
        offset: [0, marker.layer.id === 'pins' ? -30 : -6],
        onClose: () => {
          popup?.remove();
          popup = null;
        },
      });
    },
  };

  function ready(instance) {
    map = instance;
    map.listen(
      'stats',
      e =>
        (text = `50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`),
    );
  }
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>{text}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Tens of thousands of markers, drawn on the canvas</title>
<!--
  A line of text below the map
  gives the frame rate. A click on
  a marker opens a popup.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="11.4"
  interactive-layers="pins dots-below-pins dots"
  style="height: 500px"
></map-jr>
<p id="readout">
  50,000 markers. Zoom in past 12: 500 of them become pins. Click one.
</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {points} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const dot =
    '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
  const pin =
    '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

  // 50,000 places around the
  // centre, in five colours.
  const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
  const places = Array.from({length: 50000}, (_, i) => {
    const r = Math.sqrt(Math.random()) * 0.35,
      a = Math.random() * 2 * Math.PI;
    return {
      lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)],
      props: {color: colors[i % 5]},
    };
  });
  const some = places.slice(0, 500);
  // A GeoJSON FeatureCollection
  // with a point for each place.
  // The properties of a point are
  // the `props` of its place.
  const pointsOf = list =>
    points(list, {lngLat: p => p.lngLat, properties: p => p.props});
  const always = {
    'icon-image': 'dot',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  map.attribution = {compact: true};
  // An image is an SVG template
  // with {{slots}}. Each feature
  // fills the slots from its
  // properties.
  map.images = {dot, pin};
  // Each key of `data` makes a
  // GeoJSON source with that id.
  map.data = {rest: pointsOf(places.slice(500)), some: pointsOf(some)};
  // Symbol layers draw an image
  // at each point of a source.
  map.layers = [
    // Icons that are always
    // shown: the cost of a frame
    // does not grow with their
    // number.
    {id: 'dots', type: 'symbol', source: 'rest', layout: always},
    // 500 of the places are pins
    // when the zoom is 12 or
    // more, and dots below that.
    {
      id: 'dots-below-pins',
      type: 'symbol',
      source: 'some',
      maxzoom: 12,
      layout: always,
    },
    // (Without
    // `icon-allow-overlap`, the
    // pins do not pile up, and
    // map labels keep clear.)
    {
      id: 'pins',
      type: 'symbol',
      source: 'some',
      minzoom: 12,
      layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'},
    },
  ];

  // A click finds the features of
  // the layers in
  // `interactive-layers`.
  let popup = null;
  map.addEventListener('map-click', event => {
    popup?.remove();
    popup = null;
    const marker = event.detail.features[0];
    if (!marker) return;
    const at = marker.geometry.coordinates,
      text = document.createElement('div');
    text.textContent = `Marker at ${at.map(v => v.toFixed(3)).join(', ')}`;
    // A popup that points at the
    // marker, above it.
    popup = map.map.overlay(text, {
      lngLat: at,
      popup: true,
      offset: [0, marker.layer.id === 'pins' ? -30 : -6],
      onClose: () => {
        popup?.remove();
        popup = null;
      },
    });
  });
  map.addEventListener('map-stats', event => {
    readout.textContent = `50,000 markers, ${event.detail.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`;
  });
</script>
```
<!-- example:markers:end -->

- The image `dot` is an SVG document with a slot (`{{color}}`), so it is a template, and each feature fills the slot
  from its property `color`. See [`images`](../reference/description.md#images).
- [`points`](../reference/exports.md#points) converts the records to the points of a source: `rest` has 49,500 points
  and `some` has 500.
- The layer `dots` draws `rest` at every zoom. The 500 points of `some` are drawn by `dots-below-pins` below zoom 12
  (`maxzoom: 12`) and by `pins` from zoom 12 (`minzoom: 12`).
- The dots have `icon-allow-overlap` and `icon-ignore-placement`, so every dot is drawn from the buffer. The pins have
  neither, so a pin that overlaps another pin or a label of the map is hidden.
- In the compat entry, the code adds the sources and the layers with `addSource` and `addLayer` on `load`, and opens a
  `Popup` of MapLibre GL JS.

To show groups in place of single markers, see [Group points into clusters](data.md#group-points-into-clusters).

## See also

- [`data`](../reference/description.md#data), [`images`](../reference/description.md#images),
  [`layers`](../reference/description.md#layers), [`interactiveLayers`](../reference/description.md#interactivelayers)
  and [`onClick`](../reference/description.md#onclick) in the reference of the description.
- [Elements of the page on the map](../reference/map.md#overlay) for every option of `overlay`.
- [An image that is a template](../reference/description.md#images) for slots that an expression fills.
- [Query what is at a position](../recipes/query.md) to find features that are not markers.
- [Server rendering](server-rendering.md) for markers in an image that a server renders.
