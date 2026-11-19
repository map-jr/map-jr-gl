// The module script of a page that has <div id="map" style="height: 500px"></div>. A line of text below the map gives
// the frame rate.
import {createMap, points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin = '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35, a = Math.random() * 2 * Math.PI;
  return {lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)], props: {color: colors[i % 5]}};
});
const some = places.slice(0, 500);
// A GeoJSON FeatureCollection with a point for each place. The properties of a point are the `props` of its place.
const pointsOf = list => points(list, {lngLat: p => p.lngLat, properties: p => p.props});
const always = {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true};

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

let popup = null;
const map = createMap(container, {
  style,
  initialView: {center: NYC, zoom: 11.4},
  attribution: {compact: true},
  // An image is an SVG template with {{slots}}. Each feature fills the slots from its properties.
  images: {dot, pin},
  // Each key of `data` makes a GeoJSON source with that id.
  data: {rest: pointsOf(places.slice(500)), some: pointsOf(some)},
  // Symbol layers draw an image at each point of a source.
  layers: [
    // Icons that are always shown: the cost of a frame does not grow with their number.
    {id: 'dots', type: 'symbol', source: 'rest', layout: always},
    // 500 of the places are pins when the zoom is 12 or more, and dots below that.
    {id: 'dots-below-pins', type: 'symbol', source: 'some', maxzoom: 12, layout: always},
    // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep clear.)
    {id: 'pins', type: 'symbol', source: 'some', minzoom: 12, layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}},
  ],
  // A click finds the features of these layers.
  interactiveLayers: ['pins', 'dots-below-pins', 'dots'],
  onClick: e => {
    popup?.remove();
    popup = null;
    const marker = e.features[0];
    if (!marker) return;
    const at = marker.geometry.coordinates, text = document.createElement('div');
    text.textContent = `Marker at ${at.map(v => v.toFixed(3)).join(', ')}`;
    // A popup that points at the marker, above it.
    popup = map.overlay(text, {lngLat: at, popup: true, offset: [0, marker.layer.id === 'pins' ? -30 : -6], onClose: () => { popup?.remove(); popup = null; }});
  },
});

map.listen('stats', e => { readout.textContent = `50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`; });
readout.textContent = '50,000 markers. Zoom in past 12: 500 of them become pins. Click one.';
