import {useMemo, useRef, useState} from 'react';
import {MapJr} from 'map-jr-gl/react';
import {MATTERHORN} from './shared.js';
import {withElevation} from './terrain-style.js';   // the base style with relief shading, contour lines and terrain

export default function Terrain() {
  const [unit, setUnit] = useState('ft'), [terrain, setTerrain] = useState(true), [elevation, setElevation] = useState(null);
  // A new style object when the unit or the terrain changes. The map finds what is different.
  const style = useMemo(() => withElevation(unit, terrain), [unit, terrain]);
  const map = useRef(null);

  return <>
    <MapJr ref={map} mapStyle={style} initialView={{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}}
      onClick={async e => setElevation(await map.current.queryElevation(e.lngLat))} />
    <p>{elevation === null ? 'Click the map to read the elevation' : `${elevation.toFixed(0)} m above sea level`}</p>
    <button onClick={() => setUnit(unit === 'ft' ? 'm' : 'ft')}>Contours in {unit === 'ft' ? 'metres' : 'feet'}</button>
    <button onClick={() => setTerrain(!terrain)}>{terrain ? 'Flat map' : '3D terrain'}</button>
  </>;
}
