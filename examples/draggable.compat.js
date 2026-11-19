import {Map, Marker} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 14, attributionControl: {compact: true}});
  const at = ({lng, lat}) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;

  const marker = new Marker({color: '#d6453d', draggable: true}).setLngLat(NYC).addTo(map);
  marker.on('drag', () => show(`Moving: ${at(marker.getLngLat())}`));
  marker.on('dragend', () => show(`Dropped at ${at(marker.getLngLat())}`));
  show(`Drag the pin. It is at ${at(marker.getLngLat())}`);
  return map;
}
