<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';
  import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
    attribution: {compact: true},
  };
  let map = $state(null);
  // The state of the map as a store, once the map exists.
  const live = $derived(map && mapState(map));
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
<p>{$live?.renderer ? `${$live.renderer} rendering` : 'Starting'}</p>
