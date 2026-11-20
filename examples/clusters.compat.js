// The module script of a page that has <div id="map" style="height: 500px"></div>. The map groups about 6,100
// earthquakes into clusters, and a line of text below the map says what a click on a cluster did.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const earthquakes = 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson';

const map = new Map({container: 'map', style, center: [-103.6, 40.7], zoom: 3, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);
readout.textContent = 'Click a cluster to zoom in to it.';

map.on('load', () => {
  // With `cluster: true`, the points that are near each other on the screen become one cluster feature with the
  // properties `cluster_id` and `point_count`.
  map.addSource('earthquakes', {type: 'geojson', data: earthquakes, cluster: true, clusterRadius: 50});
  // A circle for each cluster, larger for more points, with the number of points on it.
  map.addLayer({id: 'clusters', type: 'circle', source: 'earthquakes', filter: ['has', 'point_count'],
    paint: {'circle-color': '#2f7fd1', 'circle-radius': ['step', ['get', 'point_count'], 14, 100, 18, 750, 24], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
  map.addLayer({id: 'cluster-count', type: 'symbol', source: 'earthquakes', filter: ['has', 'point_count'],
    layout: {'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12},
    paint: {'text-color': '#fff'}});
  // A small dot for each point that is in no cluster.
  map.addLayer({id: 'earthquakes', type: 'circle', source: 'earthquakes', filter: ['!', ['has', 'point_count']],
    paint: {'circle-color': '#d6453d', 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1}});
});

map.on('click', 'clusters', async e => {
  const cluster = e.features[0];
  // The zoom level at which the cluster divides into smaller clusters or points.
  const zoom = await map.getSource('earthquakes').getClusterExpansionZoom(cluster.properties.cluster_id);
  map.easeTo({center: cluster.geometry.coordinates, zoom, duration: 500});
  readout.textContent = `${cluster.properties.point_count} earthquakes. The cluster divides at zoom ${zoom}.`;
});
map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
