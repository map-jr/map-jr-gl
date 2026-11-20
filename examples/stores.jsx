import {useRef} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];
// A key of `data` makes a GeoJSON source with that id. A circle layer draws its points.
const data = {stores: points(stores, {lngLat: s => s.at, properties: s => ({name: s.name})})};
const layers = [{id: 'stores', type: 'circle', source: 'stores', paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}}];

export default function Stores() {
  const map = useRef(null);
  return <>
    <MapJr ref={map} mapStyle={style} initialView={{center: [-73.995, 40.72], zoom: 11.5}} data={data} layers={layers} attribution={{compact: true}} />
    {stores.map(store => <button key={store.name} onClick={() => map.current?.moveTo({center: store.at, zoom: 15, duration: 500})}>{store.name}</button>)}
  </>;
}
