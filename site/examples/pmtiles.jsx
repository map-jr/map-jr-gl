import {useRef, useState} from 'react';
import {MapJr} from 'map-jr-gl/react';
import {style} from './shared.js';

// The base style, with one source more: a PMTiles file on a usual file host.
const withBoundaries = {
  ...style,
  sources: {...style.sources, admin: {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'}},
  layers: [
    ...style.layers,
    {id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9, paint: {'line-color': '#7c66dc', 'line-width': 0.6}},
    {id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features', paint: {'line-color': '#5746af', 'line-width': 2}},
  ],
};

export default function Boundaries() {
  const map = useRef(null);
  const [names, setNames] = useState('Click to list the county, state and ZIP code');

  async function ask(event) {
    const features = await map.current.queryFeatures(event.point, {sources: ['admin']});
    setNames(features.map(f => f.properties.NAMELSAD ?? f.properties.NAME).filter(Boolean).join(' · ') || 'Nothing here');
  }

  return <>
    <MapJr ref={map} mapStyle={withBoundaries} initialView={{center: [-74.1, 40.75], zoom: 9.2}} onClick={ask} />
    <p>{names}</p>
  </>;
}
