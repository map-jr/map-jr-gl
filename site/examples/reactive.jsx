import {useMemo, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];
// The image of the markers: an SVG template, 14 pixels wide and high.
const images = {dot: {image: dot, width: 14, height: 14}};

export default function Reactive() {
  const [view, setView] = useState({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
  const [shown, setShown] = useState(false);
  const [hover, setHover] = useState([]);
  // Marker data is compared by identity: keep the object until the markers change.
  const pins = useMemo(() => ({
    id: 'pins', image: 'dot',
    data: shown ? places.map(lngLat => ({lngLat, props: {color: '#d6453d'}})) : [],
  }), [shown]);

  return <>
    <MapJr mapStyle={style} view={view} onViewChange={setView} images={images} markers={[pins]} interactiveLayers={['park', 'water']}
      attribution={{compact: true}} onHover={setHover} />
    <p>zoom {view.zoom.toFixed(2)} · under the pointer: {hover[0]?.layer.id ?? 'nothing'}</p>
    <button onClick={() => setShown(!shown)}>{shown ? 'Remove markers' : 'Add markers'}</button>
    <button onClick={() => setView({...view, pitch: view.pitch ? 0 : 50})}>Tilt</button>
  </>;
}
