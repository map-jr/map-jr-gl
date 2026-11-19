import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];

export default function (container, {show}) {
  const map = new Map({container, style, center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25});

  map.on('load', () => {
    // The style has the elevation source "terrarium", relief shading and a terrain with exaggeration 0.5.
    map.setTerrain({source: 'terrarium', exaggeration: 1.5});

    // A contour source is an addition of this library: lines from the elevation tiles.
    map.addSource('contours', {
      type: 'contour', source: 'terrarium',
      multiplier: 3.28084,                       // metres to feet
      thresholds: {11: [200, 1000], 12: [100, 500], 14: [50, 200]},
    });
    map.addLayer({id: 'lines', type: 'line', source: 'contours', 'source-layer': 'contours',
      paint: {'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}}, 'water');
  });

  map.on('click', async e => {
    const metres = await map.queryElevation(e.lngLat);
    show(metres === null ? 'No elevation data here' : `${metres.toFixed(0)} m above sea level`);
  });
  return map;
}
