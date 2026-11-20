// The module script of a page that has <div id="map" style="height: 500px"></div>. The map shows three stores, and a
// button below the map for each store moves the map to it.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];

const container = document.getElementById('map');
const map = createMap(container, {
  style,
  initialView: {center: [-73.995, 40.72], zoom: 11.5},
  attribution: {compact: true},
  // A key of `data` makes a GeoJSON source with that id. A circle layer draws its points.
  data: {stores: points(stores, {lngLat: s => s.at, properties: s => ({name: s.name})})},
  layers: [{id: 'stores', type: 'circle', source: 'stores', paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}}],
});

container.after(...stores.map(store => {
  const button = Object.assign(document.createElement('button'), {textContent: store.name});
  button.onclick = () => map.moveTo({center: store.at, zoom: 15, duration: 500});
  return button;
}));
