// The map fills its parent element, so give the parent a height.
import {useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
// range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {id: 'states', type: 'line', source: 'admin', 'source-layer': 'states', minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
    {id: 'countries', type: 'line', source: 'admin', 'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2}},
  ],
};

export default function Boundaries() {
  const map = useRef(null);
  const [names, setNames] = useState('Click to list the country and the state or province');

  async function ask(event) {
    const features = await map.current.querySource('admin', event.lngLat);
    setNames(features.map(f => f.properties.name).filter(Boolean).join(' · ') || 'Nothing here');
  }

  return <>
    <MapJr ref={map} mapStyle={style} {...boundaries} initialView={{center: [-98, 39], zoom: 3.2}} onClick={ask} />
    <p>{names}</p>
  </>;
}
