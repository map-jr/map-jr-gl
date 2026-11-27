# Data that changes

This page shows how to put GeoJSON from the application on the map, change it, convert records to points, group
points into clusters, and highlight a feature with its state.

## Set the data of a source

In the main API and the adapters, [`data`](../reference/description.md#data) of the description sets the features of
GeoJSON sources. Each key is the id of a source, and its value is GeoJSON or the URL of a GeoJSON file. When neither
the style nor [`sources`](../reference/description.md#sources) has a source with that id, the map creates one:
`{type: 'geojson'}` with no other option. The layers name the source by its key.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const route = to => ({
  type: 'Feature',
  properties: {},
  geometry: {type: 'LineString', coordinates: [[-74.01, 40.7], to]},
});

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.99, 40.74], zoom: 11.5},
  data: {route: route([-73.97, 40.75])},
  layers: [
    {
      id: 'route',
      type: 'line',
      source: 'route',
      paint: {'line-color': '#d6453d', 'line-width': 3},
    },
  ],
});

function extendRoute(to) {
  // A new object: the map applies `data.route` only when it is a different
  // object.
  map.patch({data: {route: route(to)}});
}
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const route = to => ({
  type: 'Feature',
  properties: {},
  geometry: {type: 'LineString', coordinates: [[-74.01, 40.7], to]},
});

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.99, 40.74],
  zoom: 11.5,
});

map.on('load', () => {
  map.addSource('route', {type: 'geojson', data: route([-73.97, 40.75])});
  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {'line-color': '#d6453d', 'line-width': 3},
  });
});

function extendRoute(to) {
  map.getSource('route').setData(route(to));
}
```

**Vue**

```vue [Vue]
<script setup>
import {shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const route = to => ({
  type: 'Feature',
  properties: {},
  geometry: {type: 'LineString', coordinates: [[-74.01, 40.7], to]},
});
// A shallowRef: the map sees a change only when `data` is a new object.
const data = shallowRef({route: route([-73.97, 40.75])});
const layers = [
  {
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {'line-color': '#d6453d', 'line-width': 3},
  },
];
</script>

<template>
  <div style="height: 400px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-73.99, 40.74], zoom: 11.5}"
      :data="data"
      :layers="layers"
    />
  </div>
  <button @click="data = {route: route([-73.95, 40.78])}">
    Extend the route
  </button>
</template>
```

**React**

```jsx [React]
import {useMemo} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const layers = [
  {
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {'line-color': '#d6453d', 'line-width': 3},
  },
];

// `to` is the end of the route as [lng, lat], for example [-73.97, 40.75].
export function Route({to}) {
  // A new object only when `to` changes: the map applies `data.route` only when
  // it is a different object.
  const data = useMemo(
    () => ({
      route: {
        type: 'Feature',
        properties: {},
        geometry: {type: 'LineString', coordinates: [[-74.01, 40.7], to]},
      },
    }),
    [to],
  );
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="https://styles.map-jr.org/1/elevation-zero.json"
        initialView={{center: [-73.99, 40.74], zoom: 11.5}}
        data={data}
        layers={layers}
      />
    </div>
  );
}
```

> [!WARNING]
> The map compares the value of each key with the last one by identity. A change inside the old object, such as
> `features.push(feature)`, has no effect, so pass a new object.

In the main API,
[`map.patch`](../reference/map.md#patch) merges `data` by key: `map.patch({data: {route: next}})` changes only the
source `route` and keeps the other keys, and `map.patch({data: {route: null}})` removes the source `route`. The
adapters pass the complete description, so with an adapter pass the whole object `data`.

When the style changes, the map keeps the data, and it creates the sources of the keys of `data` again in the new
style.

Three things often go wrong:

- A key is removed from `data`, and a layer still uses its source. The map removes the source, and the layer draws
  nothing. Remove the layer in the same description.
- A key names a source of the style that is not a GeoJSON source, such as a vector source. The data has no effect.
  Use a key that no source of the style has, or the id of a GeoJSON source of the style.
- A wide line is cut off at the edges of the tiles. Set a larger `buffer` on the source, as in the table below.

`buffer` is the margin around each tile in which a GeoJSON source keeps the features that cross the edge of the
tile. It is an option of the source, so declare the source in [`sources`](#set-the-options-of-a-source) to set it.

| Entry | Default `buffer` | Largest value |
|---|---|---|
| `@map-jr/map-jr-gl` | `16` | `512` |
| `@map-jr/map-jr-gl/maplibre-compat` | `128` | `512` |

The unit is the pixel of a tile 512 pixels wide. The default applies to every GeoJSON source that does not set
`buffer`: a source that `data` creates, and a source of `sources` or of the style.

`tolerance` sets how far a simplified line or polygon edge may stray from the data, in the same unit. A tile keeps
fewer vertices at low zoom levels, as in MapLibre GL JS (the Douglas-Peucker method of geojson-vt). The default is
`0.375` in both entries, as in MapLibre GL JS. `0` turns simplification off. A tile at
the `maxzoom` of the source and the tiles drawn above it keep every vertex.

Below the `maxzoom` of the source, a tile also leaves out a line shorter than the tolerance and a ring (an outer ring
or a hole) whose area is under the square of the tolerance, as geojson-vt does. `queryRenderedFeatures` and
`querySourceFeatures` return the simplified coordinates of the tile at the zoom that was queried, and they do not
return a line or a ring that the tile leaves out.

## Set the options of a source

To set options of a GeoJSON source, such as `cluster`, `promoteId` or `attribution`, declare the source in
[`sources`](../reference/description.md#sources) with the same id as the key in `data`. The source in `sources` needs
no `data` of its own, because `data` sets the features, and the options stay when the data changes. In the
development build, a GeoJSON source with no `data` and no key in `data` writes a warning.

```js
import {createMap} from '@map-jr/map-jr-gl';

const stations = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {code: 'WTC', name: 'World Trade Center'},
      geometry: {type: 'Point', coordinates: [-74.0113, 40.7117]},
    },
    {
      type: 'Feature',
      properties: {code: 'HOB', name: 'Hoboken'},
      geometry: {type: 'Point', coordinates: [-74.0276, 40.7353]},
    },
  ],
};

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.02, 40.72], zoom: 13},
  // The property `code` is the id of each feature.
  sources: {
    stations: {
      type: 'geojson',
      promoteId: 'code',
    },
  },
  data: {stations},
  layers: [
    {
      id: 'stations',
      type: 'circle',
      source: 'stations',
      paint: {'circle-radius': 7, 'circle-color': '#2f7fd1'},
    },
  ],
});
```

## Convert records to points

[`points(records, options)`](data.md#convert-records-to-points) from `@map-jr/map-jr-gl` returns a GeoJSON
`FeatureCollection` with a point for each record. It needs no map, so a server can call it too.

```js
import {createMap, points} from '@map-jr/map-jr-gl';

const museums = [
  {id: 'met', name: 'The Met', lng: -73.9632, lat: 40.7794},
  {id: 'moma', name: 'MoMA', lng: -73.9776, lat: 40.7614},
];

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.97, 40.77], zoom: 12.5},
  data: {
    museums: points(museums, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
  },
  layers: [
    {
      id: 'museums',
      type: 'circle',
      source: 'museums',
      paint: {'circle-radius': 7, 'circle-color': '#d6453d'},
    },
  ],
});
```

| Option | Type | Description |
|---|---|---|
| `lngLat` **required** | `(record, index) => [lng, lat]` | The position of the record. |
| `id` | `(record, index) => number \| string` | The id of the feature. Without it, the features have no id. |
| `properties` | `(record, index) => object` | The properties of the feature. Without it, the properties are the record itself. |

Set `id` from a field of the record that stays the same, not from the index: the index of a record changes when a
record before it is removed. A string of decimal digits that is a safe integer, such as `'12'`, becomes the number
`12` in the features that [`queryFeatures`](../reference/map.md#queryfeatures) returns and in `state.hover`.

A record whose position is not two finite numbers, such as `['2.3', '48.8']`, is left out.

## Group points into clusters

A GeoJSON source with `cluster: true` groups the points that are near each other into one cluster feature. A
cluster feature has the properties `cluster: true`, `cluster_id` and `point_count`.

This example groups about 6,100 earthquakes into clusters, shows the number of points on each cluster, and zooms in to
a cluster on a click.

<!-- example:clusters:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map groups about 6,100 earthquakes into clusters, and a
// line of text below the map says what a click on a cluster did.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
readout.textContent = 'Click a cluster to zoom in to it.';

const map = createMap(container, {
  style,
  initialView: {center: [-103.6, 40.7], zoom: 3},
  attribution: {compact: true},
  // A source with options is declared in `sources`. With `cluster: true`, the
  // points that are near each other on the screen become one cluster feature
  // with the properties `cluster_id` and `point_count`.
  sources: {
    earthquakes: {
      type: 'geojson',
      data: earthquakes,
      cluster: true,
      clusterRadius: 50,
    },
  },
  layers: [
    // A circle for each cluster, larger for more points, with the number of
    // points on it.
    {
      id: 'clusters',
      type: 'circle',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2f7fd1',
        'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'cluster-count',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
      },
      paint: {'text-color': '#fff'},
    },
    // A small dot for each point that is in no cluster.
    {
      id: 'earthquakes',
      type: 'circle',
      source: 'earthquakes',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#d6453d',
        'circle-radius': 4,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    },
  ],
  // A click reports the features of these layers in `features`.
  interactiveLayers: ['clusters'],
  onClick: async e => {
    const cluster = e.features[0];
    if (!cluster) return;
    // The zoom level at which the cluster divides into smaller clusters or
    // points.
    const zoom = await map.clusterExpansionZoom(
      'earthquakes',
      cluster.properties.cluster_id,
    );
    map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
    readout.textContent = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
  },
});
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map groups about 6,100 earthquakes into clusters, and a
// line of text below the map says what a click on a cluster did.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';

const map = new Map({
  container: 'map',
  style,
  center: [-103.6, 40.7],
  zoom: 3,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);
readout.textContent = 'Click a cluster to zoom in to it.';

map.on('load', () => {
  // With `cluster: true`, the points that are near each other on the screen
  // become one cluster feature with the properties `cluster_id` and
  // `point_count`.
  map.addSource('earthquakes', {
    type: 'geojson',
    data: earthquakes,
    cluster: true,
    clusterRadius: 50,
  });
  // A circle for each cluster, larger for more points, with the number of
  // points on it.
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#2f7fd1',
      'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: {'text-color': '#fff'},
  });
  // A small dot for each point that is in no cluster.
  map.addLayer({
    id: 'earthquakes',
    type: 'circle',
    source: 'earthquakes',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#d6453d',
      'circle-radius': 4,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
    },
  });
});

map.on('click', 'clusters', async e => {
  const cluster = e.features[0];
  // The zoom level at which the cluster divides into smaller clusters or
  // points.
  const zoom = await map
    .getSource('earthquakes')
    .getClusterExpansionZoom(cluster.properties.cluster_id);
  map.easeTo({center: cluster.geometry.coordinates, zoom, duration: 500});
  readout.textContent = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
});
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
// A source with options is declared in `sources`. With `cluster: true`, the
// points that are near each other on the screen become one cluster feature with
// the properties `cluster_id` and `point_count`.
const sources = {
  earthquakes: {
    type: 'geojson',
    data: earthquakes,
    cluster: true,
    clusterRadius: 50,
  },
};
const layers = [
  // A circle for each cluster, larger for more points, with the number of
  // points on it.
  {
    id: 'clusters',
    type: 'circle',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#2f7fd1',
      'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
  {
    id: 'cluster-count',
    type: 'symbol',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: {'text-color': '#fff'},
  },
  // A small dot for each point that is in no cluster.
  {
    id: 'earthquakes',
    type: 'circle',
    source: 'earthquakes',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#d6453d',
      'circle-radius': 4,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
    },
  },
];

const map = useTemplateRef('map');
const message = ref('Click a cluster to zoom in to it.');

async function zoomIn(event) {
  const cluster = event.features[0];
  if (!cluster) return;
  // The zoom level at which the cluster divides into smaller clusters or
  // points.
  const zoom = await map.value.clusterExpansionZoom(
    'earthquakes',
    cluster.properties.cluster_id,
  );
  map.value?.moveTo({
    center: cluster.geometry.coordinates,
    zoom,
    duration: 500,
  });
  message.value = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
}
</script>

<template>
  <!--
    A click reports the features of the layers of `interactive-layers` in
    `features`.
  -->
  <MapJr
    ref="map"
    :map-style="style"
    :initial-view="{center: [-103.6, 40.7], zoom: 3}"
    :sources="sources"
    :layers="layers"
    :interactive-layers="['clusters']"
    :attribution="{compact: true}"
    @click="zoomIn"
  />
  <p>{{ message }}</p>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
// A source with options is declared in `sources`. With `cluster: true`, the
// points that are near each other on the screen become one cluster feature with
// the properties `cluster_id` and `point_count`.
const sources = {
  earthquakes: {
    type: 'geojson',
    data: earthquakes,
    cluster: true,
    clusterRadius: 50,
  },
};
const layers = [
  // A circle for each cluster, larger for more points, with the number of
  // points on it.
  {
    id: 'clusters',
    type: 'circle',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#2f7fd1',
      'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  },
  {
    id: 'cluster-count',
    type: 'symbol',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
    },
    paint: {'text-color': '#fff'},
  },
  // A small dot for each point that is in no cluster.
  {
    id: 'earthquakes',
    type: 'circle',
    source: 'earthquakes',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#d6453d',
      'circle-radius': 4,
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
    },
  },
];
// A click reports the features of these layers in `features`.
const interactiveLayers = ['clusters'];

export default function Clusters() {
  const map = useRef(null);
  const [message, setMessage] = useState('Click a cluster to zoom in to it.');

  async function zoomIn(event) {
    const cluster = event.features[0];
    if (!cluster) return;
    // The zoom level at which the cluster divides into smaller clusters or
    // points.
    const zoom = await map.current.clusterExpansionZoom(
      'earthquakes',
      cluster.properties.cluster_id,
    );
    map.current?.moveTo({
      center: cluster.geometry.coordinates,
      zoom,
      duration: 500,
    });
    setMessage(
      `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`,
    );
  }

  return (
    <>
      <MapJr
        ref={map}
        mapStyle={style}
        initialView={{center: [-103.6, 40.7], zoom: 3}}
        sources={sources}
        layers={layers}
        interactiveLayers={interactiveLayers}
        attribution={{compact: true}}
        onClick={zoomIn}
      />
      <p>{message}</p>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const earthquakes =
    'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
  let map = null;
  let message = $state('Click a cluster to zoom in to it.');
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-103.6, 40.7], zoom: 3},
    attribution: {compact: true},
    // A source with options is declared in `sources`. With `cluster: true`, the
    // points that are near each other on the screen become one cluster feature
    // with the properties `cluster_id` and `point_count`.
    sources: {
      earthquakes: {
        type: 'geojson',
        data: earthquakes,
        cluster: true,
        clusterRadius: 50,
      },
    },
    layers: [
      // A circle for each cluster, larger for more points, with the number of
      // points on it.
      {
        id: 'clusters',
        type: 'circle',
        source: 'earthquakes',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2f7fd1',
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14,
            100,
            18,
            750,
            24,
          ],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'cluster-count',
        type: 'symbol',
        source: 'earthquakes',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
        },
        paint: {'text-color': '#fff'},
      },
      // A small dot for each point that is in no cluster.
      {
        id: 'earthquakes',
        type: 'circle',
        source: 'earthquakes',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#d6453d',
          'circle-radius': 4,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        },
      },
    ],
    // A click reports the features of these layers in `features`.
    interactiveLayers: ['clusters'],
    onClick: async e => {
      const cluster = e.features[0];
      if (!cluster) return;
      // The zoom level at which the cluster divides into smaller clusters or
      // points.
      const zoom = await map.clusterExpansionZoom(
        'earthquakes',
        cluster.properties.cluster_id,
      );
      map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
      message = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
    },
  };
</script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 500px"
></div>
<p>{message}</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Group points into clusters</title>
<!--
  The map groups about 6,100
  earthquakes into clusters, and a
  line of text below the map says
  what a click on a cluster did.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-103.6,40.7"
  zoom="3"
  interactive-layers="clusters"
  attribution-compact
  style="height: 500px"
></map-jr>
<p id="readout">Click a cluster to zoom in to it.</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  const earthquakes =
    'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  // A source with options is
  // declared in `sources`. With
  // `cluster: true`, the points
  // that are near each other on
  // the screen become one cluster
  // feature with the properties
  // `cluster_id` and
  // `point_count`.
  map.sources = {
    earthquakes: {
      type: 'geojson',
      data: earthquakes,
      cluster: true,
      clusterRadius: 50,
    },
  };
  map.layers = [
    // A circle for each cluster,
    // larger for more points,
    // with the number of points
    // on it.
    {
      id: 'clusters',
      type: 'circle',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2f7fd1',
        'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    },
    {
      id: 'cluster-count',
      type: 'symbol',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
      },
      paint: {'text-color': '#fff'},
    },
    // A small dot for each point
    // that is in no cluster.
    {
      id: 'earthquakes',
      type: 'circle',
      source: 'earthquakes',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#d6453d',
        'circle-radius': 4,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    },
  ];

  // A click reports the features
  // of the layers of
  // `interactive-layers` in
  // `features`.
  map.addEventListener('map-click', async event => {
    const cluster = event.detail.features[0];
    if (!cluster) return;
    // The zoom level at which the
    // cluster divides into
    // smaller clusters or points.
    const zoom = await map.map.clusterExpansionZoom(
      'earthquakes',
      cluster.properties.cluster_id,
    );
    map.map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
    readout.textContent = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
  });
</script>
```
<!-- example:clusters:end -->

- The source is declared in [`sources`](../reference/description.md#sources), because a key of `data` makes a GeoJSON
  source with no options. `clusterRadius` is the distance in pixels within which points join, 50 by default.
  `clusterMaxZoom` is the last zoom level with clusters, and above it every point is drawn on its own.
- `clusterProperties` of the source adds a property to each cluster, such as the largest magnitude of its points. Each
  value is a pair of an operator and an expression that reads each point.
- A cluster also has the property `point_count_abbreviated` (`1.2k`). The filter `['has', 'point_count']` selects the
  clusters, and its negation selects the points that are in no cluster.
- In the compat entry, the source has `getClusterExpansionZoom`, as in MapLibre GL JS.

A click on a circle zooms in until the cluster divides. In the main API, the map has three methods for a
cluster. Each is called with the id of the source and the `cluster_id` of the cluster, and returns a promise:

| Method | The promise resolves to |
|---|---|
| `clusterExpansionZoom(sourceId, clusterId)` | The zoom at which the cluster divides. |
| `clusterChildren(sourceId, clusterId)` | The clusters and points that the cluster divides into, as GeoJSON features. |
| `clusterLeaves(sourceId, clusterId, {limit, offset})` | The points of the cluster as GeoJSON features. `limit` is 10 by default, and `Infinity` returns all of them. `offset` is 0 by default. |

The promise rejects when the source has no cluster with that id.

## Highlight a feature with its state

The state of a feature is an object that the application sets on one feature. A `feature-state` expression in a
layer reads it, so the layer can draw a selected feature in another color without new data.

**Map Jr**

```js [Map Jr]
import {createMap, points} from '@map-jr/map-jr-gl';

const museums = [
  {id: 'met', name: 'The Met', lng: -73.9632, lat: 40.7794},
  {id: 'moma', name: 'MoMA', lng: -73.9776, lat: 40.7614},
];
let selected;

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.97, 40.77], zoom: 12.5},
  data: {
    museums: points(museums, {lngLat: r => [r.lng, r.lat], id: r => r.id}),
  },
  layers: [
    {
      id: 'museums',
      type: 'circle',
      source: 'museums',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#d6453d',
          '#2f7fd1',
        ],
      },
    },
  ],
  interactiveLayers: ['museums'],
  onClick: event => {
    if (selected !== undefined)
      map.removeFeatureState({source: 'museums', id: selected}, 'selected');
    selected = event.features[0]?.id;
    if (selected !== undefined)
      map.setFeatureState({source: 'museums', id: selected}, {selected: true});
  },
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const museums = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: {name: 'The Met'},
      geometry: {type: 'Point', coordinates: [-73.9632, 40.7794]},
    },
    {
      type: 'Feature',
      id: 2,
      properties: {name: 'MoMA'},
      geometry: {type: 'Point', coordinates: [-73.9776, 40.7614]},
    },
  ],
};
let selected;

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.97, 40.77],
  zoom: 12.5,
});

map.on('load', () => {
  map.addSource('museums', {type: 'geojson', data: museums});
  map.addLayer({
    id: 'museums',
    type: 'circle',
    source: 'museums',
    paint: {
      'circle-radius': 8,
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#d6453d',
        '#2f7fd1',
      ],
    },
  });
});

map.on('click', 'museums', event => {
  if (selected !== undefined)
    map.removeFeatureState({source: 'museums', id: selected}, 'selected');
  selected = event.features[0].id;
  map.setFeatureState({source: 'museums', id: selected}, {selected: true});
});
```

A click on a circle turns it red, and the circle that was red before turns blue.

| Method | Effect |
|---|---|
| `setFeatureState(target, state)` | Merges the object `state` into the state of the feature. |
| `removeFeatureState(target, key)` | Removes `key` from the state of the feature. Without `key`, it removes the whole state of the feature. |

`target` is `{source, sourceLayer, id}`:

- `source` is the id of the source.
- `sourceLayer` is the layer of the tiles, and it is required for a vector source.
- `id` is the `id` of the feature, as [`queryFeatures`](../reference/map.md#queryfeatures) and `event.features` return it. A
  feature of a vector source has the numeric id that its tile gives it, or the value of the property that `promoteId` of
  the source names (a property name, or an object with a property name for each source layer). A feature without an id
  cannot have a state. In a GeoJSON source, the id is a number or a string, or the value of the property that `promoteId`
  names.

Without `id`, `removeFeatureState` removes the state of all features of the source.

The map keeps the state until the application removes it, also when the data or the style changes. A source of a new
style with the same id draws the state that was set for the old source. The state is not part of the description, so
`update` and `patch` do not change it.

### Highlight the feature under the pointer

With [`hoverState`](../reference/description.md#hoverstate) set to `true`, the map gives the top feature of
[`interactiveLayers`](../reference/description.md#interactivelayers) under the pointer the feature state `hover: true`,
and the application sets no state itself. This example draws seven ferry landings of New York as circles, draws the
landing under the pointer larger and in red, and names it below the map.

<!-- example:hover:start -->
**Map Jr**

```js [Map Jr]
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

**MapLibre**

```js [MapLibre]
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
// The features under the pointer, from `features` of the event `hover`.
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
    @hover="hover = $event.features"
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
  // pointer leaves the feature. `onHover` gets the features under the pointer
  // as `features`, with the position of the pointer.
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
        onHover={e => setHover(e.features)}
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

  // The event `map-hover` has
  // `features`, the features of
  // `interactive-layers` under
  // the pointer (the top one
  // first), and the position of
  // the pointer.
  map.addEventListener('map-hover', event => {
    readout.textContent =
      event.detail.features[0]?.properties.name ??
      'Move the pointer over a ferry landing.';
  });
</script>
```
<!-- example:hover:end -->

- The map removes the state when the pointer leaves the feature or the map.
- The paint properties read the state with `['feature-state', 'hover']`. A feature that has no state yet has no value
  there, so `['boolean', …, false]` gives `false` for it.
- The map sets a state only on a feature that has an id. [`points`](../reference/exports.md#points) takes the id from
  the option `id`. For GeoJSON of your own, give each feature an `id`, or declare the source with `promoteId` or
  `generateId: true`.
- [`state.hover`](../reference/state.md#mapstate) lists the features of `interactiveLayers` under the pointer, the top
  one first. Vue has it in `features` of the event `hover`, React in `features` of the argument of `onHover`, Svelte in
  [`mapState`](../reference/svelte.md#mapstate) and `<map-jr>` in `detail.features` of the event `map-hover`.
- In the compat entry, the code sets the state itself with `setFeatureState` on `mousemove` and `mouseleave` of the
  layer, as in MapLibre GL JS.

## Show a video or a canvas

A source of the type `video` or `canvas` draws a video or a `<canvas>` of the page at four corners on the map, as in
MapLibre GL JS. Declare it in the style, and draw it with a `raster` layer. The code of these sources loads only when
a map has one of them.

**Map Jr**

```js [Map Jr]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-122.514, 37.562], zoom: 17},
  sources: {
    drone: {
      type: 'video',
      urls: ['https://static-assets.mapbox.com/mapbox-gl-js/drone.mp4'],
      coordinates: [
        [-122.51596391201019, 37.56238816766053],
        [-122.51467645168304, 37.56410183312965],
        [-122.51309394836426, 37.563391708549425],
        [-122.51423120498657, 37.56161849366671],
      ],
    },
  },
  layers: [{id: 'drone', type: 'raster', source: 'drone'}],
});
```

**MapLibre**

```js [MapLibre]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-122.514, 37.562],
  zoom: 17,
});
map.on('load', () => {
  map.addSource('drone', {
    type: 'video',
    urls: ['https://static-assets.mapbox.com/mapbox-gl-js/drone.mp4'],
    coordinates: [
      [-122.51596391201019, 37.56238816766053],
      [-122.51467645168304, 37.56410183312965],
      [-122.51309394836426, 37.563391708549425],
      [-122.51423120498657, 37.56161849366671],
    ],
  });
  map.addLayer({id: 'drone', type: 'raster', source: 'drone'});
});
```

- The video is muted, plays in a loop and starts when the source is added. A video of another origin needs CORS
  headers. When none of `urls` loads, the main API calls `onError`, and the compat entry fires `error`.
- `canvas` is the id of a `<canvas>` of the page. With `animate: true` (the default), the map copies the canvas in
  each frame; with `animate: false`, it copies it once.
- While a video or an animated canvas plays, the map does not become idle.
- In `@map-jr/map-jr-gl/maplibre-compat`, `getSource(id)` of a video source has `getVideo`, `play`, `pause`, `seek` and
  `setCoordinates`, and a canvas source has `getCanvas`, `play`, `pause` and `setCoordinates`. These methods exist once
  the code of the source has loaded, which the map requests when the style with the source has loaded.

## See also

- [`data`](../reference/description.md#data), [`sources`](../reference/description.md#sources) and
  [`hoverState`](../reference/description.md#hoverstate) in the reference of the description.
- [`update` and `patch`](../reference/map.md#update) for `update` and `patch`.
- [Markers and popups](markers-and-popups.md) for points with an image.
- [Query what is at a position](../recipes/query.md) to find the features at a click.
- [Changes inside the data of a source](../reference/vue.md#how-mapjr-sees-changes) for Vue.
