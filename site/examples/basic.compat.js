import {Map, NavigationControl, ScaleControl, FullscreenControl} from 'map-jr-gl/maplibre-compat';
import {style, NYC} from './shared.js';

export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
  map.addControl(new NavigationControl());
  map.addControl(new ScaleControl(), 'bottom-left');
  map.addControl(new FullscreenControl(), 'top-left');

  map.once('load', () => show(`${map.renderer} rendering`));
  show('Starting');
  return map;
}
