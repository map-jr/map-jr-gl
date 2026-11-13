import {useMemo, useRef, useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]},
  m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]},
};

// Additions to the style: an elevation source, relief shading, contour lines and 3D terrain.
const elevation = (unit, terrain) => ({
  terrain: terrain ? {source: 'dem', exaggeration: 1.5} : null,
  sources: {
    dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
    // Contour lines are made from the elevation tiles, in the tile workers.
    contours: {type: 'contour', source: 'dem', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: thresholds[unit]},
  },
  layers: [
    {id: 'relief', type: 'hillshade', source: 'dem', before: 'water', paint: {'hillshade-shadow-color': '#5a4a3a', 'hillshade-exaggeration': 0.4}},
    {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', before: 'water',
      paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}},
    {id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
      layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'],
        'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m']},
      paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
  ],
});

export default function Terrain() {
  const [unit, setUnit] = useState('ft'), [terrain, setTerrain] = useState(true), [height, setHeight] = useState(null);
  // Other additions when the unit or the terrain changes. The map finds what is different.
  const extend = useMemo(() => elevation(unit, terrain), [unit, terrain]);
  const map = useRef(null);

  return <>
    <MapJr ref={map} mapStyle={style} extend={extend} initialView={{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}}
      onClick={async e => setHeight(await map.current.queryElevation(e.lngLat))} />
    <p>{height === null ? 'Click the map to read the elevation' : `${height.toFixed(0)} m above sea level`}</p>
    <button onClick={() => setUnit(unit === 'ft' ? 'm' : 'ft')}>Contours in {unit === 'ft' ? 'metres' : 'feet'}</button>
    <button onClick={() => setTerrain(!terrain)}>{terrain ? 'Flat map' : '3D terrain'}</button>
  </>;
}
