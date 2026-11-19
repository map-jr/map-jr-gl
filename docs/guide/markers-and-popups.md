# Markers and popups

This page shows how to draw markers, change them, open a popup for the marker that the user clicks, and let the user
move a marker.

## Choose how to draw a marker

| | A symbol layer with an image | An element of the page |
|---|---|---|
| Use it for | Many markers that look alike | A few markers with HTML content, or a marker that the user moves |
| Number of markers | 100,000 and more | Tens. The browser becomes slow with thousands. |
| A click | Finds the feature of the marker | Is an event of the element |
| During a movement of the map | Is drawn with the map | Can trail the map by about one frame |
| With 3D terrain | On the ground. Ground in front does not hide it. | On the ground |

Start with a symbol layer when you are not sure.

## Draw markers with a symbol layer

The markers need an image, a GeoJSON source with a point for each marker, and a symbol layer that draws the image
at each point.

**Main API**

```js [Main API]
import {createMap, points} from '@map-jr/map-jr-gl';

// {{color}} is a slot: each marker fills it from its property "color".
const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {id: 2, name: 'Empire State Building', lng: -73.9857, lat: 40.7484, color: '#2f7fd1'},
];
// A GeoJSON point for each record. The properties of a point are its record.
const toPoints = records => points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id});

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  data: {places: toPoints(places)},
  layers: [{
    id: 'places', type: 'symbol', source: 'places',
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
  }],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// {{color}} is a slot: each marker fills it from its property "color". MapLibre GL JS has no such images.
const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = {type: 'FeatureCollection', features: [
  {type: 'Feature', id: 1, properties: {name: 'City Hall', color: '#d6453d'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', id: 2, properties: {name: 'Empire State Building', color: '#2f7fd1'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]};

const map = new Map({container: 'map', style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-73.996, 40.73], zoom: 11.5});

map.on('load', async () => {
  await map.addImage('pin', pin);
  map.addSource('places', {type: 'geojson', data: places});
  map.addLayer({
    id: 'places', type: 'symbol', source: 'places',
    layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
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
const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {id: 2, name: 'Empire State Building', lng: -73.9857, lat: 40.7484, color: '#2f7fd1'},
];
// A GeoJSON point for each record, in a shallowRef: the map needs a new object to see a change.
const data = shallowRef({places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id})});
const layers = [{
  id: 'places', type: 'symbol', source: 'places',
  layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
}];
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
const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const images = {pin};
const layers = [{
  id: 'places', type: 'symbol', source: 'places',
  layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
}];

// `places` is a list of records such as {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'}.
export function Places({places}) {
  // A GeoJSON point for each record. The map needs a new object to see a change, and only then.
  const data = useMemo(() => ({places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id})}), [places]);

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
[`points`](../api.md#points-from-records) converts the records to GeoJSON.

The layout properties decide how the markers behave among each other and among the labels of the map:

| What you want | Write |
|---|---|
| The tip of the image on the position | `'icon-anchor': 'bottom'`. The default is `'center'`. |
| Every marker shows, also where markers cover each other | `'icon-allow-overlap': true` |
| The labels of the map do not keep away from the markers | `'icon-ignore-placement': true` |
| Markers in a zoom range only | `minzoom` and `maxzoom` of the layer |
| Markers below the labels of the map | `before` of the layer (main API), or the second argument of `addLayer` |
| Text beside the image | `text-field` in `layout` |

A marker has the size of its image, and an SVG image has the size of its `viewBox` in CSS pixels. For another size,
set the image to `{image: pin, width: 36, height: 46}`. See [`images`](../reference/description.md#images) for the
other forms of an image.

## Change the markers

Set new GeoJSON on the source. The code below continues the first example.

**Main API**

```js [Main API]
// The map compares the data by identity: create new GeoJSON, and do not change the old one in place.
places[1] = {...places[1], color: '#2e9d5b'};
map.patch({data: {places: toPoints(places)}});

// Remove the markers.
map.patch({data: {}, layers: []});
```

**MapLibre compat**

```js [MapLibre compat]
places.features[1].properties.color = '#2e9d5b';
map.getSource('places').setData(places);

// Remove the markers.
map.removeLayer('places');
map.removeSource('places');
```

In Vue and React, pass a new object to the `data` prop. In the examples above, assign to `data.value` in Vue, and
pass other `places` to the component in React.

## Open a popup when the user clicks a marker

A marker of a symbol layer is a feature of that layer, so a click finds it. The code for the main API and for the
compat entry continues the first example.

**Main API**

```js [Main API]
let popup;
map.patch({
  // A click reports the features of these layers.
  interactiveLayers: ['places'],
  onClick: event => {
    popup?.remove();
    const place = event.features[0];
    if (!place) return;
    const content = document.createElement('div');
    content.textContent = place.properties.name;
    // The pin is 31 pixels tall, so the popup points at a place 30 pixels above the position.
    popup = map.overlay(content, {lngLat: place.geometry.coordinates, popup: true, offset: [0, -30], onClose: () => popup.remove()});
  },
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Popup} from '@map-jr/map-jr-gl/maplibre-compat';

map.on('click', 'places', event => {
  const place = event.features[0];
  new Popup({offset: 30}).setLngLat(place.geometry.coordinates).setText(place.properties.name).addTo(map);
});
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';
import {points} from '@map-jr/map-jr-gl';

const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = [
  {id: 1, name: 'City Hall', lng: -74.006, lat: 40.7128, color: '#d6453d'},
  {id: 2, name: 'Empire State Building', lng: -73.9857, lat: 40.7484, color: '#2f7fd1'},
];
const data = shallowRef({places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id})});
const layers = [{
  id: 'places', type: 'symbol', source: 'places',
  layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
}];
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
      @click="event => selected = event.features[0] ?? null"
    >
      <!-- The pin is 31 pixels tall, so the popup points at a place 30 pixels above the position. -->
      <MapOverlay v-if="selected" :lng-lat="selected.geometry.coordinates" :offset="[0, -30]" popup @close="selected = null">
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

const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const images = {pin};
const layers = [{
  id: 'places', type: 'symbol', source: 'places',
  layout: {'icon-image': 'pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true},
}];
const interactiveLayers = ['places'];

export function Places({places}) {
  const data = useMemo(() => ({places: points(places, {lngLat: r => [r.lng, r.lat], id: r => r.id})}), [places]);
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
        {/* The pin is 31 pixels tall, so the popup points at a place 30 pixels above the position. */}
        {selected && (
          <MapOverlay lngLat={selected.geometry.coordinates} offset={[0, -30]} popup onClose={() => setSelected(null)}>
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
- The popup has no button to close it. A popup of `overlay` and of `MapOverlay` has the button only with `onClose`
  (`@close` in Vue), and it stays open until your code removes it.

## Put an element of the page on the map, and let the user move it

An element of the page can be a marker: an image, a button or any other HTML. With `draggable`, the user moves it
with the mouse, a finger or a pen. The code for the main API and for the compat entry continues the first example.

**Main API**

```js [Main API]
import {defaultPin} from '@map-jr/map-jr-gl';

let home = [-74.0065, 40.7085];
// defaultPin() creates the pin of MapLibre GL JS. Any element of your own works in its place.
const marker = map.overlay(defaultPin({color: '#c0392b'}), {
  lngLat: home, anchor: 'bottom', draggable: true,
  onDragEnd: lngLat => { home = lngLat; },
});

// Later: move it from code, and remove it. Pass all the options to `update` again.
marker.update({lngLat: [-74.0, 40.71], anchor: 'bottom', draggable: true});
marker.remove();
```

**MapLibre compat**

```js [MapLibre compat]
import {Marker} from '@map-jr/map-jr-gl/maplibre-compat';

const marker = new Marker({color: '#c0392b', draggable: true}).setLngLat([-74.0065, 40.7085]).addTo(map);
marker.on('dragend', () => console.log(marker.getLngLat()));

// Later: move it from code, and remove it.
marker.setLngLat([-74.0, 40.71]);
marker.remove();
```

**Vue**

```vue [Vue]
<script setup>
import {ref} from 'vue';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/vue';

const home = ref([-74.0065, 40.7085]);
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" :initial-view="{center: [-74.0065, 40.7085], zoom: 14}">
      <MapOverlay :lng-lat="home" anchor="bottom" draggable @dragend="home = $event">
        <svg width="27" height="41" viewBox="0 0 27 41"><path d="M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z" fill="#c0392b"/><circle cx="13.5" cy="13.5" r="5.5" fill="#fff"/></svg>
      </MapOverlay>
    </MapJr>
  </div>
  <p>{{ home[0].toFixed(5) }}, {{ home[1].toFixed(5) }}</p>
</template>
```

**React**

```jsx [React]
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

const start = [-74.0065, 40.7085];

export function Home() {
  const [home, setHome] = useState(start);
  return (
    <>
      <div style={{height: 400}}>
        <MapJr mapStyle="https://styles.map-jr.org/1/elevation-zero.json" initialView={{center: start, zoom: 14}}>
          <MapOverlay lngLat={home} anchor="bottom" draggable onDragEnd={setHome}>
            <svg width="27" height="41" viewBox="0 0 27 41"><path d="M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z" fill="#c0392b" /><circle cx="13.5" cy="13.5" r="5.5" fill="#fff" /></svg>
          </MapOverlay>
        </MapJr>
      </div>
      <p>{home[0].toFixed(5)}, {home[1].toFixed(5)}</p>
    </>
  );
}
```

The user drags the pin, and the new position arrives as `[lng, lat]` when the drag ends.

After a drag, the pin stays where the user dropped it until `lngLat` changes. So store the position that the drag
reports and pass it back, as the examples do. In Svelte and in the `<map-jr>` element, call `overlay` of the map.

## Keep many markers fast

A symbol layer draws its icons at a cost that does not grow with their number when the layer has no text, has
`symbol-placement: 'point'` (the default) and has `icon-allow-overlap: true`. The layers of this page are such
layers. See [Which icons are fast](../markers.md#which-icons-are-fast) for the other conditions, and for how such
icons differ from icons that the map places among the labels.

With very many markers in view, also set `icon-ignore-placement: true`. Without it, the labels of the map keep away
from each marker, and that work grows with the number of markers.

To show groups in place of single markers, see [Clusters](../api.md#clusters).

## See also

- [`data`](../reference/description.md#data), [`images`](../reference/description.md#images),
  [`layers`](../reference/description.md#layers), [`interactiveLayers`](../reference/description.md#interactivelayers)
  and [`onClick`](../reference/description.md#onclick) in the reference of the description.
- [Elements of the page on the map](../api.md#elements-of-the-page-on-the-map) for every option of `overlay`.
- [An image that is a template](../api.md#an-image-that-is-a-template) for slots that an expression fills.
- [Query what is at a position](../recipes/query.md) to find features that are not markers.
- [Server rendering](../server-rendering.md) for markers in an image that a server renders.
