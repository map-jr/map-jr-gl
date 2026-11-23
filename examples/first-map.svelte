<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  };
  let zoom = $state(13.6);
  // The state of the map is a store. The function runs after each change of the zoom, and not at the start.
  const ready = map => map.state.subscribe(state => state.view.zoom, value => zoom = value);
</script>

<div use:mapJr={{description, ready}} style="height: 400px"></div>
<p>Zoom {zoom.toFixed(1)}</p>
