// The module script of a page that has <div id="map" style="height: 500px"></div>. Below the map, it adds a line of
// text and a button that goes back to the view before the last click.
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
const data = {landings: points(landings, {lngLat: l => l.lngLat, properties: l => ({name: l.name})})};
const layers = [{id: 'landings', type: 'circle', source: 'landings', paint: {'circle-radius': 7, 'circle-color': '#2f7fd1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}}];

const container = document.getElementById('map');
const readout = document.createElement('p');
const back = Object.assign(document.createElement('button'), {textContent: 'Back', disabled: true});
container.after(readout, back);

let last = null;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 13.6},
  attribution: {compact: true},
  data,
  layers,
  interactiveLayers: ['landings'],
  onClick: e => {
    const feature = e.features[0];
    if (!feature) return;
    // Store the view before the move, without `bounds`: a target with `bounds` fits that box instead.
    const {center, zoom, bearing, pitch} = map.state.get().view;
    last = {center, zoom, bearing, pitch};
    map.moveTo({center: feature.geometry.coordinates, zoom: 17, duration: 800});
    back.disabled = false;
    readout.textContent = `${feature.properties.name}. Press Back to return.`;
  },
});

back.onclick = () => {
  map.moveTo({...last, duration: 800});
  back.disabled = true;
  readout.textContent = 'Click a ferry landing to zoom in.';
};
readout.textContent = 'Click a ferry landing to zoom in.';
