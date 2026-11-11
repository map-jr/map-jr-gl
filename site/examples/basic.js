import {createMap} from 'map-jr-gl';
import {navigation, scale, fullscreen} from 'map-jr-gl/controls';
import {style, NYC} from './shared.js';

export default function (container, {show}) {
  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 13.6},
    controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
    attribution: {compact: true},
  });

  // The thread that draws is known when the map has started.
  map.state.subscribe(state => state.renderer, renderer => show(`${renderer} rendering`));
  map.listen('stats', e => show(`${map.state.get().renderer} rendering, ${e.fps.toFixed(0)} frames per second`));
  show('Starting');
  return map;
}
