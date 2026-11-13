import {Map, Popup} from '@map-jr/map-jr-gl/maplibre-compat';

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

const points = list => ({type: 'FeatureCollection', features: list.map((place, id) => ({type: 'Feature', id, properties: place.props, geometry: {type: 'Point', coordinates: place.lngLat}}))});

// The sources and the layers are those of MapLibre GL JS. One thing is an addition of this library: an image can be an
// SVG template with {{slots}}, and each feature fills the slots from its properties.
export default function (container, {show}) {
  const map = new Map({container, style, center: NYC, zoom: 11.4, attributionControl: {compact: true}});

  map.on('load', async () => {
    await map.addImage('dot', dot);
    await map.addImage('pin', pin);
    map.addSource('rest', {type: 'geojson', data: points(places.slice(500))});
    map.addSource('some', {type: 'geojson', data: points(some)});
    // Icons that are always shown: the cost of a frame does not grow with their number.
    const always = {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true};
    map.addLayer({id: 'dots', type: 'symbol', source: 'rest', layout: always});
    // 500 of the places are pins when the zoom is 12 or more, and dots below that.
    map.addLayer({id: 'dots-below-pins', type: 'symbol', source: 'some', maxzoom: 12, layout: always});
    // (Without `icon-allow-overlap`, the pins do not pile up, and map labels keep clear.)
    map.addLayer({id: 'pins', type: 'symbol', source: 'some', minzoom: 12, layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}});
  });

  let popup = null;
  for (const id of ['pins', 'dots-below-pins', 'dots']) map.on('click', id, e => {
    const at = e.features[0].geometry.coordinates;
    popup?.remove();
    popup = new Popup({offset: id === 'pins' ? 30 : 6}).setLngLat(at).setText(`Marker at ${at.map(v => v.toFixed(3)).join(', ')}`).addTo(map);
  });
  map.on('stats', e => show(`50,000 markers, ${e.fps.toFixed(0)} frames per second.`));
  return map;
}
