import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';

const landings = [
  {id: 1, name: 'Whitehall Terminal', lngLat: [-74.0131, 40.7013]},
  {id: 2, name: 'Pier 11 / Wall St', lngLat: [-74.0067, 40.7034]},
  {id: 3, name: 'Battery Park City', lngLat: [-74.0181, 40.7147]},
  {id: 4, name: 'Dumbo', lngLat: [-73.9946, 40.7036]},
  {id: 5, name: 'Governors Island', lngLat: [-74.0189, 40.6928]},
  {id: 6, name: 'Corlears Hook', lngLat: [-73.9785, 40.7116]},
  {id: 7, name: 'Brooklyn Bridge Park Pier 6', lngLat: [-73.9997, 40.6930]},
];
const data = {landings: points(landings, {lngLat: l => l.lngLat, properties: l => ({name: l.name})})};
const layers = [{id: 'landings', type: 'circle', source: 'landings', paint: {'circle-radius': 7, 'circle-color': '#2f7fd1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff'}}];

export default function Back() {
  const map = useRef(null);
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6, bearing: 0, pitch: 0});
  // The view before the last click, and the landing of that click.
  const [last, setLast] = useState(null);

  function zoomTo(event) {
    const feature = event.features[0];
    if (!feature) return;
    // Store the view before the move, without `bounds`: a target with `bounds` fits that box instead.
    const {center, zoom, bearing, pitch} = view;
    setLast({view: {center, zoom, bearing, pitch}, name: feature.properties.name});
    map.current.moveTo({center: feature.geometry.coordinates, zoom: 17, duration: 800});
  }

  // `moveTo` and not `setView(last.view)`: `moveTo` animates, and the map ignores a `view` equal to one of the last 60
  // views that it reported.
  function goBack() {
    map.current.moveTo({...last.view, duration: 800});
    setLast(null);
  }

  return <>
    <MapJr ref={map} mapStyle={style} view={view} onViewChange={setView} data={data} layers={layers} interactiveLayers={['landings']}
      attribution={{compact: true}} onClick={zoomTo} />
    <p>{last ? `${last.name}. Press Back to return.` : 'Click a ferry landing to zoom in.'}</p>
    <button disabled={!last} onClick={goBack}>Back</button>
  </>;
}
