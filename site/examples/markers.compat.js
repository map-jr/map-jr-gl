import {Map} from 'map-jr-gl/maplibre-compat';
import {style, NYC} from './shared.js';
import {manyMarkers, dot, pin} from '../../demo/markers.mjs';

// Marker layers are not a part of MapLibre GL JS. This entry has them as an addition.
export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 11.4, attributionControl: {compact: true}});
  const places = manyMarkers(50000, NYC, 0.35).data, some = places.slice(0, 500);

  map.addMarkerLayer({id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)});
  map.addMarkerLayer({id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some});
  map.addMarkerLayer({id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some});

  map.on('markerclick', e => e.layer.openPopup(e.index, `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
  map.on('stats', e => show(`50,000 markers, ${e.fps.toFixed(0)} frames per second.`));
  return map;
}
