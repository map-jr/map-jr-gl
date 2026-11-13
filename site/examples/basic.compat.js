import {Map, NavigationControl, ScaleControl, FullscreenControl} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
  map.addControl(new NavigationControl());
  map.addControl(new ScaleControl(), 'bottom-left');
  map.addControl(new FullscreenControl(), 'top-left');

  map.once('load', () => show(`${map.renderer} rendering`));
  show('Starting');
  return map;
}
