<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  let map = null;
  let names = $state('Click to list the county, state and ZIP code');
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
    // range requests.
    sources: {
      admin: {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'},
    },
    layers: [
      {id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9,
        paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
      {id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features',
        paint: {'line-color': '#5746af', 'line-width': 2}},
    ],
    initialView: {center: [-74.1, 40.75], zoom: 9.2},
    attribution: {compact: true},
    onClick: async e => {
      const features = await map.querySource('admin', e.point);
      names = features.map(f => f.properties.NAMELSAD ?? f.properties.NAME ?? f.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here';
    },
  };
</script>

<!-- The legend is in a corner of the map. It takes no pointer events, so a click on it reaches the map. -->
<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px">
  <div class="legend">
    <b>From one PMTiles file</b>
    <div><span style="border-top: 2px solid #5746af"></span>County boundaries</div>
    <div><span style="border-top: 1px solid #7c66dc"></span>ZIP code areas (from zoom 9)</div>
    <small>The base map below them is a usual tile source.</small>
  </div>
</div>
<p>{names}</p>

<style>
  .legend { position: absolute; top: 8px; left: 8px; z-index: 1; pointer-events: none; display: flex; flex-direction: column; padding: 7px 10px; border-radius: 8px; background: #fffe; color: #222; font: 12px/1.5 system-ui, sans-serif; box-shadow: 0 1px 4px #0003; }
  .legend span { display: inline-block; width: 22px; margin-right: 7px; vertical-align: middle; }
</style>
