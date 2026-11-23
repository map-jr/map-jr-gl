<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const boundaryFile = 'https://map-jr.org/data/natural-earth.pmtiles';

  let map = null;
  let names = $state('Click to list the country and the state or province');
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
    // range requests.
    sources: {
      admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
    },
    layers: [
      {id: 'states', type: 'line', source: 'admin', 'source-layer': 'states', minzoom: 3,
        paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
      {id: 'countries', type: 'line', source: 'admin', 'source-layer': 'countries',
        paint: {'line-color': '#5746af', 'line-width': 2}},
    ],
    initialView: {center: [-98, 39], zoom: 3.2},
    attribution: {compact: true},
    onClick: async e => {
      const features = await map.querySource('admin', e.lngLat);
      names = features.map(f => f.properties.name).filter(Boolean).join(' · ') || 'Nothing here';
    },
  };
</script>

<!-- The legend is in a corner of the map. It takes no pointer events, so a click on it reaches the map. -->
<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px">
  <div class="legend">
    <b>From one PMTiles file</b>
    <div><span style="border-top: 2px solid #5746af"></span>Country borders</div>
    <div><span style="border-top: 1px solid #7c66dc"></span>States and provinces (from zoom 3)</div>
    <small>The base map below them is a usual tile source.</small>
  </div>
</div>
<p>{names}</p>

<style>
  .legend { position: absolute; top: 8px; left: 8px; z-index: 1; pointer-events: none; display: flex; flex-direction: column; padding: 7px 10px; border-radius: 8px; background: #fffe; color: #222; font: 12px/1.5 system-ui, sans-serif; box-shadow: 0 1px 4px #0003; }
  .legend span { display: inline-block; width: 22px; margin-right: 7px; vertical-align: middle; }
</style>
