import {createMap} from 'map-jr-gl';
import {style, NYC} from './shared.js';
import {manyMarkers, dot, pin} from '../../demo/markers.mjs';

export default function (container, {show}) {
  const places = manyMarkers(50000, NYC, 0.35).data, some = places.slice(0, 500);

  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 11.4},
    attribution: {compact: true},
    // A marker layer is one SVG template with {{slots}} and a list of positions.
    markers: [
      {id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)},
      // 500 of the places are pins when the zoom is 12 or more, and dots below that.
      {id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some},
      {id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12,
        overlap: 'hide',   // do not pile up
        collide: true,     // map labels keep clear
        data: some},
    ],
  });

  // A click on a marker opens a callout. Map labels move away from it.
  map.listen('markerclick', e => e.layer.openPopup(e.index, `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
  map.listen('stats', e => show(`50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`));
  show('50,000 markers. Zoom in past 12: 500 of them become pins. Click one.');
  return map;
}
