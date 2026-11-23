# Data that changes

This page shows how to put GeoJSON from the application on the map, change it, convert records to points, group
points into clusters, and highlight a feature with its state.

## Set the data of a source

In the main API and the adapters, [`data`](../reference/description.md#data) of the description sets the features of
GeoJSON sources. Each key is the id of a source, and its value is GeoJSON or the URL of a GeoJSON file. When neither
the style nor [`sources`](../reference/description.md#sources) has a source with that id, the map creates one:
`{type: 'geojson'}` with no other option. The layers name the source by its key.

**Main API**

```js [Main API]
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

**MapLibre compat**

```js [MapLibre compat]
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

The map compares the value of each key with the last one by identity. A change inside the old object, such as
`features.push(feature)`, has no effect, so pass a new object. In the main API,
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

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-103.6, 40.7], zoom: 3},
  sources: {
    earthquakes: {
      type: 'geojson',
      cluster: true,
      data: earthquakes,
    },
  },
  layers: [
    {
      id: 'clusters',
      type: 'circle',
      source: 'earthquakes',
      filter: ['has', 'point_count'],
      paint: {'circle-radius': 14, 'circle-color': '#2f7fd1'},
    },
    {
      id: 'earthquakes',
      type: 'circle',
      source: 'earthquakes',
      filter: ['!', ['has', 'point_count']],
      paint: {'circle-radius': 4, 'circle-color': '#d6453d'},
    },
  ],
  interactiveLayers: ['clusters'],
  onClick: async event => {
    const cluster = event.features[0];
    if (!cluster) return;
    // The zoom at which the cluster divides into smaller clusters or points.
    const zoom = await map.clusterExpansionZoom(
      'earthquakes',
      cluster.properties.cluster_id,
    );
    map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
  },
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const earthquakes =
  'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-103.6, 40.7],
  zoom: 3,
});

map.on('load', () => {
  map.addSource('earthquakes', {
    type: 'geojson',
    cluster: true,
    data: earthquakes,
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'earthquakes',
    filter: ['has', 'point_count'],
    paint: {'circle-radius': 14, 'circle-color': '#2f7fd1'},
  });
  map.addLayer({
    id: 'earthquakes',
    type: 'circle',
    source: 'earthquakes',
    filter: ['!', ['has', 'point_count']],
    paint: {'circle-radius': 4, 'circle-color': '#d6453d'},
  });
});

map.on('click', 'clusters', async event => {
  const cluster = event.features[0];
  const zoom = await map
    .getSource('earthquakes')
    .getClusterExpansionZoom(cluster.properties.cluster_id);
  map.easeTo({center: cluster.geometry.coordinates, zoom});
});
```

A click on a blue circle zooms in until the cluster divides. In the main API, the map has three methods for a
cluster. Each is called with the id of the source and the `cluster_id` of the cluster, and returns a promise:

| Method | The promise resolves to |
|---|---|
| `clusterExpansionZoom(sourceId, clusterId)` | The zoom at which the cluster divides. |
| `clusterChildren(sourceId, clusterId)` | The clusters and points that the cluster divides into, as GeoJSON features. |
| `clusterLeaves(sourceId, clusterId, {limit, offset})` | The points of the cluster as GeoJSON features. `limit` is 10 by default, and `Infinity` returns all of them. `offset` is 0 by default. |

The promise rejects when the source has no cluster with that id.

## Highlight a feature with its state

The state of a feature is an object that the application sets on one feature. A `feature-state` expression in a
layer reads it, so the layer can draw a selected feature in another colour without new data.

**Main API**

```js [Main API]
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

**MapLibre compat**

```js [MapLibre compat]
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
`update` and `patch` do not change it. To highlight the feature under the pointer, set
[`hoverState`](../reference/description.md#hoverstate) in place of this code.

## See also

- [`data`](../reference/description.md#data), [`sources`](../reference/description.md#sources) and
  [`hoverState`](../reference/description.md#hoverstate) in the reference of the description.
- [`update` and `patch`](../reference/map.md#update) for `update` and `patch`.
- [Markers and popups](markers-and-popups.md) for points with an image.
- [Query what is at a position](../recipes/query.md) to find the features at a click.
- [Changes inside the data of a source](../reference/vue.md#how-mapjr-sees-changes) for Vue.
