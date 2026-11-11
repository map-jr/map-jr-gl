import {createMap} from 'map-jr-gl';
import {style, NYC} from './shared.js';

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pins = {
  id: 'pins', svg: dot, width: 14, height: 14,
  data: [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]].map(lngLat => ({lngLat, props: {color: '#d6453d'}})),
};

export default function (container, {show, button}) {
  let description = {
    style,
    initialView: {center: NYC, zoom: 13.6},
    interactiveLayers: ['park', 'water'],
    attribution: {compact: true},
  };
  const map = createMap(container, description);

  // The state is a store. This function runs after each change.
  map.state.subscribe(state => {
    const feature = state.hover[0];
    show(`zoom ${state.view.zoom.toFixed(2)} · ${state.moving ? 'moving' : state.idle ? 'idle' : 'loading'} · under the pointer: ` +
      (feature ? feature.layer.id : 'nothing (move over a park or water)'));
  });

  // A change is a new description. The map finds what is different.
  let shown = false;
  button('Add markers', b => {
    shown = !shown;
    map.update(description = {...description, markers: shown ? [pins] : []});
    b.textContent = shown ? 'Remove markers' : 'Add markers';
  });
  button('Tilt', () => map.moveTo({pitch: map.state.get().view.pitch ? 0 : 50, duration: 600}));
  return map;
}
