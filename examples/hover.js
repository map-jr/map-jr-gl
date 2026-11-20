// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map names
// the ferry landing under the pointer.
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
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.6930]},
];
// The map can set the state `hover` only on a feature that has an id. `points` takes it from `id`.
const data = {landings: points(landings, {lngLat: l => l.lngLat, id: l => l.id, properties: l => ({name: l.name})})};
// The layer reads the state `hover` with `feature-state`: the landing under the pointer is larger and red.
const hovered = ['boolean', ['feature-state', 'hover'], false];
const layers = [{
  id: 'landings', type: 'circle', source: 'landings',
  paint: {
    'circle-radius': ['case', hovered, 11, 7],
    'circle-color': ['case', hovered, '#d6453d', '#2f7fd1'],
    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
  },
}];

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  attribution: {compact: true},
  data,
  layers,
  // The map gives the top feature of these layers under the pointer the feature state `hover: true`, and removes it
  // when the pointer leaves the feature.
  interactiveLayers: ['landings'],
  hoverState: true,
});

// `state.hover` has the features of `interactiveLayers` under the pointer, the top one first.
map.state.subscribe(state => state.hover, hover => {
  readout.textContent = hover[0]?.properties.name ?? 'Move the pointer over a ferry landing.';
});
readout.textContent = 'Move the pointer over a ferry landing.';
