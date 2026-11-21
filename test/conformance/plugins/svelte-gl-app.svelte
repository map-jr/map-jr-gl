<script>
  // The component of the scenario svelte-gl.js: svelte-maplibre-gl with a source, a layer, a marker and the control Hash.
  import {MapLibre, GeoJSONSource, CircleLayer, Marker, NavigationControl, Hash} from 'svelte-maplibre-gl';
  let {style, onready} = $props();
  const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.0, 40.71]}}]};
  let map = $state();
  $effect(() => { if (map) onready(map); });
</script>

<MapLibre bind:map {style} center={[-74.0065, 40.7085]} zoom={12} class="svelte-gl-map" onload={() => onready(map, true)}>
  <NavigationControl position="top-right" />
  <GeoJSONSource id="points" {data}>
    <CircleLayer id="points" paint={{'circle-radius': 8, 'circle-color': '#e33'}} />
  </GeoJSONSource>
  <Marker lnglat={[-74.0065, 40.7085]} />
  <Hash />
</MapLibre>

<style>
  :global(.svelte-gl-map) { width: 100%; height: 100%; }
</style>
