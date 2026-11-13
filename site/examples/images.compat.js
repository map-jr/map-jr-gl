import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
// addImage in MapLibre GL JS takes pixels. This library also takes an SVG document as a string.
const pin = '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="#d6453d" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const parkPin = pin.replace('#d6453d', '#2e9d5b');
const places = {type: 'FeatureCollection', features: [
  {type: 'Feature', properties: {name: 'City Hall', kind: 'civic'}, geometry: {type: 'Point', coordinates: [-74.0060, 40.7128]}},
  {type: 'Feature', properties: {name: 'Washington Square', kind: 'park'}, geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]}},
  {type: 'Feature', properties: {name: 'Battery Park', kind: 'park'}, geometry: {type: 'Point', coordinates: [-74.0170, 40.7033]}},
  {type: 'Feature', properties: {name: 'Brooklyn Bridge', kind: 'civic'}, geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]}},
]};

export default function (container, {show}) {
  const map = new Map({container, style, center: [-74.006, 40.7175], zoom: 12.7, attributionControl: {compact: true}});
  map.on('load', () => {
    map.addImage('pin', pin);
    map.addImage('pin-park', parkPin);
    map.addSource('places', {type: 'geojson', data: places});
    // A symbol layer draws the image and a label beside it.
    map.addLayer({
      id: 'places', type: 'symbol', source: 'places',
      layout: {
        'icon-image': ['match', ['get', 'kind'], 'park', 'pin-park', 'pin'],
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [0.9, -1.1],
      },
      paint: {'text-color': '#222', 'text-halo-color': '#fff', 'text-halo-width': 1.5},
    });
  });
  show('Four places. Each has an SVG image from addImage, and its name beside it.');
  return map;
}
