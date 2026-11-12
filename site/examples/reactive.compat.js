import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];

// With the API of MapLibre GL JS, your code listens for events and calls a method for each change.
export default function (container, {show, button}) {
  const map = new Map({container, style, center: NYC, zoom: 13.6, attributionControl: {compact: true}});
  let under = 'nothing';
  const report = () => show(`zoom ${map.getZoom().toFixed(2)} · under the pointer: ${under}`);
  map.on('move', report);
  map.on('mousemove', async e => {
    const features = await map.queryRenderedFeatures(e.point, {layers: ['park', 'water']});
    under = features[0]?.layer.id ?? 'nothing';
    report();
  });

  let layer = null;
  button('Add markers', b => {
    if (layer) { layer.remove(); layer = null; }
    else layer = map.addMarkerLayer({id: 'pins', svg: dot, width: 14, height: 14, data: places.map(lngLat => ({lngLat, props: {color: '#d6453d'}}))});
    b.textContent = layer ? 'Remove markers' : 'Add markers';
  });
  button('Tilt', () => map.easeTo({pitch: map.getPitch() ? 0 : 50, duration: 600}));
  return map;
}
