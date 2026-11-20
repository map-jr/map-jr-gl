// The module script of a page that has <div id="map" style="height: 500px"></div>. Below the map, it adds a line of
// text and a button that fits the map to the data again.
import {Map, LngLatBounds} from '@map-jr/map-jr-gl/maplibre-compat';

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
const layer = {id: 'landings', type: 'circle', source: 'landings', paint: {'circle-radius': 7, 'circle-color': '#2f7fd1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}};
// The box around the data: `extend` grows it to take in each position.
const bounds = new LngLatBounds();
for (const l of landings) bounds.extend(l.lngLat);

// The map starts with the box in the view, and 40 pixels of space around it. The space keeps the circles at the edge
// inside the view.
const map = new Map({container: 'map', style, bounds, fitBoundsOptions: {padding: 40}, attributionControl: {compact: true}});
const readout = document.createElement('p');
const showAll = Object.assign(document.createElement('button'), {textContent: 'Show all landings'});
map.getContainer().after(readout, showAll);

map.on('load', () => {
  map.addSource('landings', {type: 'geojson', data: {
    type: 'FeatureCollection',
    features: landings.map(l => ({type: 'Feature', properties: {name: l.name}, geometry: {type: 'Point', coordinates: l.lngLat}})),
  }});
  map.addLayer(layer);
});

// The same fit later, as an animation of 600 milliseconds.
showAll.onclick = () => map.fitBounds(bounds, {padding: 40, duration: 600});
readout.textContent = 'Move the map, then press Show all landings.';
