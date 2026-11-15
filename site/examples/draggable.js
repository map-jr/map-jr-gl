import {createMap, defaultPin} from '@map-jr/map-jr-gl';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = createMap(container, {style, initialView: {center: NYC, zoom: 14}, attribution: {compact: true}});
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

  // The default pin of Marker, which the user can move. The tip of the pin is at the position.
  map.overlay(defaultPin({color: '#d6453d'}), {
    lngLat: NYC, anchor: 'bottom', draggable: true,
    onDrag: lngLat => show(`Moving: ${at(lngLat)}`),
    onDragEnd: lngLat => show(`Dropped at ${at(lngLat)}`),
  });
  show(`Drag the pin. It is at ${at(NYC)}`);
  return map;
}
