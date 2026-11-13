import {useMemo, useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

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

export default function Markers() {
  // A marker layer is a layer of the style: a click finds its markers. The marker under the click, or null.
  const [selected, setSelected] = useState(null);
  // An image is an SVG template with {{slots}}. Each marker fills the slots from its `props`.
  const images = useMemo(() => ({dot, pin}), []);
  // Marker data is compared by identity: these layers are made one time.
  const layers = useMemo(() => [
    {id: 'dots', image: 'dot', data: places.slice(500)},
    // 500 of the places are pins when the zoom is 12 or more, and dots below that.
    {id: 'dots-below-pins', image: 'dot', maxZoom: 12, data: some},
    {id: 'pins', image: 'pin', anchor: 'bottom', minZoom: 12, overlap: 'hide', data: some},
  ], []);

  return (
    <MapJr mapStyle={style} initialView={{center: NYC, zoom: 11.4}} images={images} markers={layers}
      interactiveLayers={['pins', 'dots-below-pins', 'dots']} onClick={e => setSelected(e.features[0] ?? null)}>
      {selected && (
        <MapOverlay lngLat={selected.geometry.coordinates} offset={[0, selected.layer.id === 'pins' ? -30 : -6]} popup onClose={() => setSelected(null)}>
          Marker at {selected.geometry.coordinates.map(v => v.toFixed(3)).join(', ')}
        </MapOverlay>
      )}
    </MapJr>
  );
}
