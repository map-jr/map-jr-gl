// The module script of a page that has <div id="map" style="height: 500px"></div>. Below the map, it adds a line of
// text with the state of the map and two buttons.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];

// With the API of MapLibre GL JS, your code listens for events and calls a method for each change.
const map = new Map({container: 'map', style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
const readout = document.createElement('p');
const markers = Object.assign(document.createElement('button'), {textContent: 'Add markers'});
const tilt = Object.assign(document.createElement('button'), {textContent: 'Tilt'});
map.getContainer().after(readout, markers, tilt);

let under = 'nothing';
const report = () => {
  const zoom = map.getZoom().toFixed(2);
  readout.textContent = `zoom ${zoom} · under the pointer: ${under}`;
};
map.on('move', report);
map.on('mousemove', async e => {
  const features = await map.queryRenderedFeatures(e.point, {layers: ['park', 'water']});
  under = features[0]?.layer.id ?? 'nothing';
  report();
});

// The markers: a source with a point for each place, and a symbol layer with an image. The image is an SVG template
// (an addition of this library), and each feature fills its slot `color`.
map.addImage('dot', dot, {width: 14, height: 14});
let shown = false;
markers.onclick = () => {
  if (shown) { map.removeLayer('pins'); map.removeSource('pins'); }
  else {
    map.addSource('pins', {type: 'geojson', data: {type: 'FeatureCollection', features: places.map(coordinates => ({type: 'Feature', properties: {color: '#d6453d'}, geometry: {type: 'Point', coordinates}}))}});
    map.addLayer({id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true}});
  }
  shown = !shown;
  markers.textContent = shown ? 'Remove markers' : 'Add markers';
};
tilt.onclick = () => map.easeTo({pitch: map.getPitch() ? 0 : 50, duration: 600});
