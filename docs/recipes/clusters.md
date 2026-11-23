# Group points into clusters

This example groups about 6,100 earthquakes into clusters, shows the number of points on each cluster, and zooms in to
a cluster on a click.

In a Nuxt app with the [module for Nuxt](../reference/nuxt.md), the Vue code works as it is.

<!-- example:clusters:start -->
**Main API**

```js [Main API]
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

**MapLibre compat**

```js [MapLibre compat]
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

## How it works

- A GeoJSON source with [`cluster: true`](../guide/data.md#group-points-into-clusters) groups the points that are near
  each other on the screen. It is declared in [`sources`](../reference/description.md#sources), because a key of `data`
  makes a GeoJSON source with no options. `clusterRadius` is the distance in pixels within which points join, 50 by
  default.
- A cluster is a feature with the properties `cluster: true`, `cluster_id`, `point_count` and
  `point_count_abbreviated` (`1.2k`). The filter `['has', 'point_count']` selects the clusters, and its negation the
  points that are in no cluster.
- [`interactiveLayers`](../reference/description.md#interactivelayers) makes a click report the clusters under the
  pointer in `features`, with their geometry.
- [`clusterExpansionZoom`](../reference/map.md#clusterexpansionzoom) returns a promise of the zoom level at which the
  cluster divides. [`moveTo`](../reference/map.md#moveto) moves the camera there. In the compat entry, the source has
  `getClusterExpansionZoom`, as in MapLibre GL JS.

## Variations

Each variation changes the Main API example. `map` is the map, and `cluster` is the feature of the click. The
`sources` of a variation replaces the `sources` of the description.

### List the points of a cluster

[`clusterLeaves`](../reference/map.md#clusterleaves) returns the points of a cluster as GeoJSON features, 10 by
default. A `limit` of `Infinity` returns all of them.

```js
const leaves = await map.clusterLeaves(
  'earthquakes',
  cluster.properties.cluster_id,
  {limit: 5},
);
console.log(leaves.map(f => f.properties.mag));
```

### Add a property of the points to each cluster

`clusterProperties` of the source adds a property to each cluster. Each value is a pair of an operator and an
expression that reads each point. With these `sources`, each cluster has the largest magnitude of its points:

```js
const sources = {
  earthquakes: {
    type: 'geojson',
    data: earthquakes,
    cluster: true,
    clusterProperties: {maxMag: ['max', ['get', 'mag']]},
  },
};
```

A layer can then read `['get', 'maxMag']`, for example in `circle-color`.

### Stop clustering at a zoom level

`clusterMaxZoom` of the source is the last zoom level with clusters. Above it, every point is drawn on its own.

```js
const sources = {
  earthquakes: {
    type: 'geojson',
    data: earthquakes,
    cluster: true,
    clusterMaxZoom: 10,
  },
};
```

## See also

- [Group points into clusters](../guide/data.md#group-points-into-clusters) in the guide to data.
- [`clusterChildren`](../reference/map.md#clusterchildren) for the clusters and points that a cluster divides into.
- [Query what is at a position](query.md) for a click on other features.
