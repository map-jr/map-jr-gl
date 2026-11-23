# Show vector tiles from a PMTiles file

This example draws the borders of countries and of states and provinces from one PMTiles file on a file host, over a base
map, and lists the names of the areas at a click.

<!-- example:pmtiles:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A legend is on the map, and a line of text below the map lists
// what a click finds.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads
// the tiles that it needs with HTTP range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {
      id: 'states',
      type: 'line',
      source: 'admin',
      'source-layer': 'states',
      minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6},
    },
    {
      id: 'countries',
      type: 'line',
      source: 'admin',
      'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2},
    },
  ],
};

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
const show = text => {
  readout.textContent = text;
};

const map = createMap(container, {
  style,
  ...boundaries,
  initialView: {center: [-98, 39], zoom: 3.2},
  attribution: {compact: true},
  onClick: async e => {
    const features = await map.querySource('admin', e.lngLat);
    show(
      features
        .map(f => f.properties.name)
        .filter(Boolean)
        .join(' · ') || 'Nothing here',
    );
  },
});

// The legend is in a corner of the map. It takes no pointer events, so a click
// on it reaches the map.
const legend = document.createElement('div');
legend.style.cssText =
  'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;display:flex;flex-direction:column;padding:7px 10px;border-radius:8px;background:#fffe;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 4px #0003';
legend.appendChild(document.createElement('b')).textContent =
  'From one PMTiles file';
for (const [line, text] of [
  ['2px solid #5746af', 'Country borders'],
  ['1px solid #7c66dc', 'States and provinces (from zoom 3)'],
]) {
  const item = legend.appendChild(document.createElement('div'));
  item.appendChild(document.createElement('span')).style.cssText =
    `display:inline-block;width:22px;margin-right:7px;vertical-align:middle;border-top:${line}`;
  item.append(text);
}
legend.appendChild(document.createElement('small')).textContent =
  'The base map below them is a usual tile source.';
container.append(legend);
show('Click to list the country and the state or province');
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A line of text below the map lists what a click finds.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

const map = new Map({
  container: 'map',
  style,
  center: [-98, 39],
  zoom: 3.2,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.on('load', () => {
  // A PMTiles file on a usual file host. You do not need the pmtiles library or
  // `addProtocol`.
  map.addSource('admin', {type: 'vector', url: 'pmtiles://' + boundaryFile});
  map.addLayer({
    id: 'states',
    type: 'line',
    source: 'admin',
    'source-layer': 'states',
    minzoom: 3,
    paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6},
  });
  map.addLayer({
    id: 'countries',
    type: 'line',
    source: 'admin',
    'source-layer': 'countries',
    paint: {'line-color': '#5746af', 'line-width': 2},
  });
});

map.on('click', async e => {
  const features = await map.querySource('admin', e.lngLat);
  readout.textContent =
    features
      .map(f => f.properties.name)
      .filter(Boolean)
      .join(' · ') || 'Nothing here';
});
readout.textContent = 'Click to list the country and the state or province';
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads
// the tiles that it needs with HTTP range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {
      id: 'states',
      type: 'line',
      source: 'admin',
      'source-layer': 'states',
      minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6},
    },
    {
      id: 'countries',
      type: 'line',
      source: 'admin',
      'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2},
    },
  ],
};
const map = useTemplateRef('map'),
  names = ref('Click to list the country and the state or province');

async function ask(event) {
  const features = await map.value.querySource('admin', event.lngLat);
  names.value =
    features
      .map(f => f.properties.name)
      .filter(Boolean)
      .join(' · ') || 'Nothing here';
}
</script>

<template>
  <MapJr
    ref="map"
    :map-style="style"
    v-bind="boundaries"
    :initial-view="{center: [-98, 39], zoom: 3.2}"
    @click="ask"
  />
  <p>{{ names }}</p>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads
// the tiles that it needs with HTTP range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {
      id: 'states',
      type: 'line',
      source: 'admin',
      'source-layer': 'states',
      minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6},
    },
    {
      id: 'countries',
      type: 'line',
      source: 'admin',
      'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2},
    },
  ],
};

export default function Boundaries() {
  const map = useRef(null);
  const [names, setNames] = useState(
    'Click to list the country and the state or province',
  );

  async function ask(event) {
    const features = await map.current.querySource('admin', event.lngLat);
    setNames(
      features
        .map(f => f.properties.name)
        .filter(Boolean)
        .join(' · ') || 'Nothing here',
    );
  }

  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        {...boundaries}
        initialView={{center: [-98, 39], zoom: 3.2}}
        onClick={ask}
      />
      <p>{names}</p>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

  let map = null;
  let names = $state('Click to list the country and the state or province');
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // Additions to the style: a PMTiles file on a usual file host. The map
    // reads the tiles that it needs with HTTP range requests.
    sources: {
      admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
    },
    layers: [
      {
        id: 'states',
        type: 'line',
        source: 'admin',
        'source-layer': 'states',
        minzoom: 3,
        paint: {
          'line-color': '#7c66dc',
          'line-width': 0.6,
          'line-opacity': 0.6,
        },
      },
      {
        id: 'countries',
        type: 'line',
        source: 'admin',
        'source-layer': 'countries',
        paint: {'line-color': '#5746af', 'line-width': 2},
      },
    ],
    initialView: {center: [-98, 39], zoom: 3.2},
    attribution: {compact: true},
    onClick: async e => {
      const features = await map.querySource('admin', e.lngLat);
      names =
        features
          .map(f => f.properties.name)
          .filter(Boolean)
          .join(' · ') || 'Nothing here';
    },
  };
</script>

<!--
  The legend is in a corner of the map. It takes no pointer events, so a click
  on it reaches the map.
-->
<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
>
  <div class="legend">
    <b>From one PMTiles file</b>
    <div>
      <span style="border-top: 2px solid #5746af"></span>Country borders
    </div>
    <div>
      <span style="border-top: 1px solid #7c66dc"></span>States and provinces
      (from zoom 3)
    </div>
    <small>The base map below them is a usual tile source.</small>
  </div>
</div>
<p>{names}</p>

<style>
  .legend {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 1;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    padding: 7px 10px;
    border-radius: 8px;
    background: #fffe;
    color: #222;
    font:
      12px/1.5 system-ui,
      sans-serif;
    box-shadow: 0 1px 4px #0003;
  }
  .legend span {
    display: inline-block;
    width: 22px;
    margin-right: 7px;
    vertical-align: middle;
  }
</style>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>One file of tiles: PMTiles</title>
<!--
  A legend is on the map, and a
  line of text below the map lists
  what a click finds. The legend
  takes no pointer events, so a
  click on it reaches the map.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-98,39"
  zoom="3.2"
  style="height: 500px"
>
  <div
    style="
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 1;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      padding: 7px 10px;
      border-radius: 8px;
      background: #fffe;
      color: #222;
      font:
        12px/1.5 system-ui,
        sans-serif;
      box-shadow: 0 1px 4px #0003;
    "
  >
    <b>From one PMTiles file</b>
    <div>
      <span
        style="
          display: inline-block;
          width: 22px;
          margin-right: 7px;
          vertical-align: middle;
          border-top: 2px solid #5746af;
        "
      ></span
      >Country borders
    </div>
    <div>
      <span
        style="
          display: inline-block;
          width: 22px;
          margin-right: 7px;
          vertical-align: middle;
          border-top: 1px solid #7c66dc;
        "
      ></span
      >States and provinces (from zoom 3)
    </div>
    <small>The base map below them is a usual tile source.</small>
  </div>
</map-jr>
<p id="readout">Click to list the country and the state or province</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  map.attribution = {compact: true};
  // Additions to the style: a
  // PMTiles file on a usual file
  // host. The map reads the tiles
  // that it needs with HTTP range
  // requests.
  map.sources = {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  };
  map.layers = [
    {
      id: 'states',
      type: 'line',
      source: 'admin',
      'source-layer': 'states',
      minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6},
    },
    {
      id: 'countries',
      type: 'line',
      source: 'admin',
      'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2},
    },
  ];

  map.addEventListener('map-click', async event => {
    const features = await map.map.querySource('admin', event.detail.lngLat);
    readout.textContent =
      features
        .map(f => f.properties.name)
        .filter(Boolean)
        .join(' · ') || 'Nothing here';
  });
</script>
```
<!-- example:pmtiles:end -->

## How it works

- A PMTiles archive is one static file of tiles. A `url` that starts with `pmtiles://` followed by the URL of the file
  loads the tiles from it, with HTTP range requests. The host must answer range requests, and it must allow them from
  other origins (CORS) when the file is on another host than the page.
- The file is `https://map-jr.org/data/natural-earth.pmtiles` (1.9 MB, zoom 0 to 6). It holds the countries and the
  states and provinces of [Natural Earth](https://www.naturalearthdata.com/) at the scale 1:50m, which are public domain.
  The docs site serves it with CORS for any origin, so your own page can read it too. Above zoom 6 the map draws the
  tiles of zoom 6 larger.
- The source in [`sources`](../reference/description.md#sources) is a usual `vector` source. Its layers name the layers
  of the file in `source-layer`: `countries` and `states`. Each feature has the property `name`; a country also has
  `iso_a3` and `continent`, and a state has `country` and `iso_3166_2`.
- `minzoom: 3` on the layer `states` hides the states and provinces below zoom 3.
- The attribution of the file (Natural Earth) comes from its metadata and shows in the attribution control.
- [`querySource`](../reference/map.md#querysource) reads the features of the source at the position of the click, also
  the ones that no layer draws, and the example lists their names.

In the compat entry, the `pmtiles://` URL works with no `addProtocol` and no pmtiles library.

## Variations

The variation changes the click handler of the Main API example. `e` is the event of the click, and `map` is the map.

### Handle a tile that does not load

The promise of `querySource` rejects when the tile does not load. Catch the rejection:

```js
const features = await map.querySource('admin', e.lngLat).catch(() => []);
```

## See also

- [Query what is at a position](query.md) for the options of `querySource`.
- [`sources`](../reference/description.md#sources) and [`layers`](../reference/description.md#layers) for sources and
  layers of your own.
