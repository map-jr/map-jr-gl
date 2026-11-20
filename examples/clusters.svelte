<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const earthquakes = 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';
  let map = null;
  let message = $state('Click a cluster to zoom in to it.');
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-103.6, 40.7], zoom: 3},
    attribution: {compact: true},
    // A source with options is declared in `sources`. With `cluster: true`, the points that are near each other on
    // the screen become one cluster feature with the properties `cluster_id` and `point_count`.
    sources: {earthquakes: {type: 'geojson', data: earthquakes, cluster: true, clusterRadius: 50}},
    layers: [
      // A circle for each cluster, larger for more points, with the number of points on it.
      {id: 'clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'],
        paint: {'circle-color': '#2f7fd1', 'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}},
      {id: 'cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'],
        layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12},
        paint: {'text-color': '#fff'}},
      // A small dot for each point that is in no cluster.
      {id: 'earthquakes', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']],
        paint: {'circle-color': '#d6453d', 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1}},
    ],
    // A click reports the features of these layers in `features`.
    interactiveLayers: ['clusters'],
    onClick: async e => {
      const cluster = e.features[0];
      if (!cluster) return;
      // The zoom level at which the cluster divides into smaller clusters or points.
      const zoom = await map.clusterExpansionZoom('earthquakes', cluster.properties.cluster_id);
      map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
      message = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
    },
  };
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
<p>{message}</p>
