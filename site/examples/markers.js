import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];
const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const pin = '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';

// 50,000 places around the centre, in five colours.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const places = Array.from({length: 50000}, (_, i) => {
  const r = Math.sqrt(Math.random()) * 0.35, a = Math.random() * 2 * Math.PI;
  return {lngLat: [NYC[0] + r * Math.cos(a) * 1.3, NYC[1] + r * Math.sin(a)], props: {color: colors[i % 5]}};
});
const some = places.slice(0, 500);

export default function (container, {show}) {
  let popup = null;
  const map = createMap(container, {
    style,
    initialView: {center: NYC, zoom: 11.4},
    attribution: {compact: true},
    // An image is an SVG template with {{slots}}. Each marker fills the slots from its `props`.
    images: {dot, pin},
    // A marker layer draws an image at a list of positions.
    markers: [
      {id: 'dots', image: 'dot', data: places.slice(500)},
      // 500 of the places are pins when the zoom is 12 or more, and dots below that.
      {id: 'dots-below-pins', image: 'dot', maxZoom: 12, data: some},
      {id: 'pins', image: 'pin', anchor: 'bottom', minZoom: 12,
        overlap: 'hide',   // do not pile up; map labels keep clear
        data: some},
    ],
    // A marker layer is a layer of the style: a click finds its markers.
    interactiveLayers: ['pins', 'dots-below-pins', 'dots'],
    onClick: e => {
      popup?.remove();
      popup = null;
      const marker = e.features[0];
      if (!marker) return;
      const at = marker.geometry.coordinates, text = document.createElement('div');
      text.textContent = `Marker at ${at.map(v => v.toFixed(3)).join(', ')}`;
      // A popup that points at the marker, above it.
      popup = map.overlay(text, {lngLat: at, popup: true, offset: [0, marker.layer.id === 'pins' ? -30 : -6], onClose: () => { popup?.remove(); popup = null; }});
    },
  });

  map.listen('stats', e => show(`50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`));
  show('50,000 markers. Zoom in past 12: 500 of them become pins. Click one.');
  return map;
}
