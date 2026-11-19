import {Map, NavigationControl, GlobeControl} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

export default function (container, {show}) {
  const map = new Map({container, style, center: [10, 30], zoom: 1.5, attributionControl: {compact: true}});
  map.addControl(new NavigationControl());
  map.addControl(new GlobeControl());

  // As in MapLibre GL JS, the projection is set when the style has loaded. The globe turns into Mercator between zoom 11 and 12.
  map.on('style.load', () => map.setProjection({type: 'globe'}));
  map.on('projectiontransition', e => show(`Projection: ${e.newProjection}`));
  show('Starting');
  return map;
}
