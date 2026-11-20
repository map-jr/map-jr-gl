<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {globe, navigation} from '@map-jr/map-jr-gl/controls';

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
    projection: {type: 'globe'},
    initialView: {center: [10, 30], zoom: 1.5},
    controls: [navigation(), globe()],
    attribution: {compact: true},
  };
  let projection = $state('globe');

  // The button of the globe control switches between the globe and Mercator.
  const ready = map => map.listen('projectiontransition', e => projection = e.newProjection);
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>Projection: {projection}</p>
