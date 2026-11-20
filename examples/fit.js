// The module script of a page that has <div id="map" style="height: 500px"></div>. Below the map, it adds a line of
// text and a button that fits the map to the data again.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

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
// The box around the data, [west, south, east, north].
const lngs = landings.map(l => l.lngLat[0]), lats = landings.map(l => l.lngLat[1]);
const bounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];

const container = document.getElementById('map');
const readout = document.createElement('p');
const showAll = Object.assign(document.createElement('button'), {textContent: 'Show all landings'});
container.after(readout, showAll);

const map = createMap(container, {
  style,
  // The map starts with the box in the view, and 40 pixels of space around it. The space keeps the circles at the
  // edge inside the view.
  initialView: {bounds, fitPadding: 40},
  attribution: {compact: true},
  data,
  layers,
});

// The same fit later, as an animation of 600 milliseconds.
showAll.onclick = () => map.fitBounds(bounds, {fitPadding: 40, duration: 600});
readout.textContent = 'Move the map, then press Show all landings.';
