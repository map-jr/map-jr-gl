<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes = 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
// A source with options is declared in `sources`. With `cluster: true`, the points that are near each other on the
// screen become one cluster feature with the properties `cluster_id` and `point_count`.
const sources = {earthquakes: {type: 'geojson', data: earthquakes, cluster: true, clusterRadius: 50}};
const layers = [
  // A circle for each cluster, larger for more points, with the number of points on it.
  {id: 'clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'],
    paint: {'circle-color': '#2f7fd1', 'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}},
  {id: 'cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'],
    layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12},
    paint: {'text-color': '#fff'}},
  // A small dot for each point that is in no cluster.
  {id: 'earthquakes', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']],
    paint: {'circle-color': '#d6453d', 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1}},
];

const map = useTemplateRef('map');
const message = ref('Click a cluster to zoom in to it.');

async function zoomIn(event) {
  const cluster = event.features[0];
  if (!cluster) return;
  // The zoom level at which the cluster divides into smaller clusters or points.
  const zoom = await map.value.clusterExpansionZoom('earthquakes', cluster.properties.cluster_id);
  map.value?.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
  message.value = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
}
</script>

<template>
  <!-- A click reports the features of the layers of `interactive-layers` in `features`. -->
  <MapJr ref="map" :map-style="style" :initial-view="{center: [-103.6, 40.7], zoom: 3}" :sources="sources" :layers="layers"
    :interactive-layers="['clusters']" :attribution="{compact: true}" @click="zoomIn" />
  <p>{{ message }}</p>
</template>
