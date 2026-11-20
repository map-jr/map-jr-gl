import {useRef} from 'react';
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
// The box around the data, [west, south, east, north].
const lngs = landings.map(l => l.lngLat[0]), lats = landings.map(l => l.lngLat[1]);
const bounds = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];

export default function Fit() {
  const map = useRef(null);
  // The map starts with the box in the view, and 40 pixels of space around it. The space keeps the circles at the
  // edge inside the view. The button does the same fit later, as an animation of 600 milliseconds.
  return <>
    <MapJr ref={map} mapStyle={style} initialView={{bounds, fitPadding: 40}} data={data} layers={layers} attribution={{compact: true}} />
    <p>Move the map, then press Show all landings.</p>
    <button onClick={() => map.current?.fitBounds(bounds, {fitPadding: 40, duration: 600})}>Show all landings</button>
  </>;
}
