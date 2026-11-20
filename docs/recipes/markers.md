# Show many markers and open a popup on click

This example draws 50,000 markers with symbol layers and opens a popup at the marker that the user clicks. Past zoom 12,
500 of the markers change from a dot to a pin.

Each block below is a complete file of the [gallery](https://map-jr.github.io/map-jr-gl/). The two `js` files are the
module script of a page that has `<div id="map" style="height: 500px"></div>`, and each one creates the line of text
below the map itself. The Vue and React components fill their parent element, so give the parent a height. The Svelte
component and the `<map-jr>` page give the element of the map a height of 500 pixels.

In Nuxt, the code is the Vue code without the imports, because the [module for Nuxt](../reference/nuxt.md) imports the
components, the composables and the controls automatically.

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
  a marker opens a
  popup.
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

## How it works

- [`images`](../reference/description.md#images) provides the images that `icon-image` names. An SVG document with slots
  (`{{color}}`) is a template, and each feature fills the slots from its properties.
- Each key of [`data`](../reference/description.md#data) is the id of a GeoJSON source.
  [`points`](../reference/exports.md#points) converts the records to the points of that source: `rest` has 49,500 points
  and `some` has 500.
- Symbol layers of [`layers`](../reference/description.md#layers) draw the images. The layer `dots` draws `rest` at
  every zoom. The 500 points of `some` are drawn by `dots-below-pins` below zoom 12 (`maxzoom: 12`) and by `pins` from
  zoom 12 (`minzoom: 12`).
- With `icon-allow-overlap` and `icon-ignore-placement`, every dot is drawn. The pins have neither, so a pin that
  overlaps another pin or a label of the map is hidden.
- A click reports the features of [`interactiveLayers`](../reference/description.md#interactivelayers) under the pointer
  in `e.features`, the top one first.
- [`overlay`](../reference/map.md#overlay) with `popup: true` shows an element of the page in a popup at a position.
  `offset` moves it up, so that its tip points at the top of the marker.

In Vue and React, the `MapOverlay` component shows the popup. In the compat entry, the code adds the sources and the
layers with `addSource` and `addLayer` on `load`, and opens a `Popup` of MapLibre GL JS.

## Variations

Each variation changes the Main API example. `places`, `pointsOf` and `map` are the names of that example.

### Let the dots hide each other

Without `icon-allow-overlap` and `icon-ignore-placement`, a dot that overlaps another dot or a label of the map is not
drawn. Replace the definition of `always`:

```js
const always = {'icon-image': 'dot'};
```

### Change the colour of the markers

Each point fills the slot `color` from its property `color`. To show other colours, pass new data.
[`patch`](../reference/map.md#patch) replaces the whole field `data`, so pass both sources:

```js
const grey = places.map(p => ({...p, props: {color: '#888'}}));
map.patch({
  data: {rest: pointsOf(grey.slice(500)), some: pointsOf(grey.slice(0, 500))},
});
```

## See also

- [Markers and popups](../guide/markers-and-popups.md) to choose between a symbol layer and an element of the page.
- [Keep many markers fast](../guide/markers-and-popups.md#keep-many-markers-fast).
- [`images`](../reference/description.md#images) for the images of the description and their slots.
