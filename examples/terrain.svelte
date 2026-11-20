<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const thresholds = {
    ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]},
    m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]},
  };

  // Additions to the style, which has the elevation source "terrarium" and relief shading: contour lines and
  // stronger 3D terrain. `null` makes the map flat, although the style has a terrain.
  const elevation = (unit, terrain) => ({
    terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
    sources: {
      // Contour lines are made from the elevation tiles, in the tile workers.
      contours: {type: 'contour', source: 'terrarium', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: thresholds[unit]},
    },
    layers: [
      {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', before: 'water',
        paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}},
      {id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
        layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'],
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m']},
        paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
    ],
  });

  let map = null;
  let unit = $state('ft'), terrain = $state(true), height = $state(null);
  // Other additions when the unit or the terrain changes. The map finds what is different.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation.json',
    ...elevation(unit, terrain),
    initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, bearing: 25},
    attribution: {compact: true},
    onClick: async e => { height = await map.queryElevation(e.lngLat); },
  });
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
<p>{height === null ? 'Click the map to read the elevation' : `${height.toFixed(0)} m above sea level`}</p>
<button onclick={() => unit = unit === 'ft' ? 'm' : 'ft'}>Contours in {unit === 'ft' ? 'metres' : 'feet'}</button>
<button onclick={() => terrain = !terrain}>{terrain ? 'Flat map' : '3D terrain'}</button>
