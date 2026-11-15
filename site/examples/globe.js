import {createMap} from '@map-jr/map-jr-gl';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://tiles.openfreemap.org/styles/liberty';

export default function (container, {show}) {
  const map = createMap(container, {
    style,
    // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
    projection: {type: 'globe'},
    initialView: {center: [10, 30], zoom: 1.5},
    controls: [navigation(), globe()],
    attribution: {compact: true},
  });

  // The button of the globe control switches between the globe and Mercator.
  map.listen('projectiontransition', e => show(`Projection: ${e.newProjection}`));
  show('Projection: globe');
  return map;
}
