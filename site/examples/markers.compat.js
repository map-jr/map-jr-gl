import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
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

// Marker layers are not a part of MapLibre GL JS. This entry has them as an addition.
export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 11.4, attributionControl: {compact: true}});

  map.addMarkerLayer({id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)});
  map.addMarkerLayer({id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some});
  map.addMarkerLayer({id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some});

  map.on('markerclick', e => e.layer.openPopup(e.index, `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
  map.on('stats', e => show(`50,000 markers, ${e.fps.toFixed(0)} frames per second.`));
  return map;
}
