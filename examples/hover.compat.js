// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map names
// the ferry landing under the pointer.
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
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.6930]},
];
// The layer reads the state `hover` with `feature-state`: the landing under the pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layer = {
  id: 'landings', type: 'circle', source: 'landings',
  paint: {
    'circle-radius': ['case', hovered, 11, 7],
    'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
  },
};

const map = new Map({container: 'map', style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
const readout = document.createElement('p');
map.getContainer().after(readout);

map.on('load', () => {
  // A feature needs an id for its state. Here each feature has one; `generateId: true` on the source also gives them.
  map.addSource('landings', {type: 'geojson', data: {
    type: 'FeatureCollection',
    features: landings.map(l => ({type: 'Feature', id: l.id, properties: {name: l.name}, geometry: {type: 'Point', coordinates: l.lngLat}})),
  }});
  map.addLayer(layer);
});

// As in MapLibre GL JS, the code sets the state `hover` itself, and removes it from the landing that it had before.
let hoveredId = null;
const leave = () => {
  if (hoveredId !== null) map.setFeatureState({source: 'landings', id: hoveredId}, {hover: false});
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
