<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {defaultPin} from '@map-jr/map-jr-gl';

  const NYC = [-74.0065, 40.7085];
  const description = {style: 'https://styles.map-jr.org/1/elevation-zero.json', initialView: {center: NYC, zoom: 14}, attribution: {compact: true}};
  const at = ([lng, lat]) => `${lng.toFixed(5)}, ${lat.toFixed(5)}`;
  let text = $state(`Drag the pin. It is at ${at(NYC)}`);

  // The default pin of Marker, which the user can move. The tip of the pin is at the position.
  function ready(map) {
    map.overlay(defaultPin({color: '#d6453d'}), {
      lngLat: NYC, anchor: 'bottom', draggable: true,
      onDrag: lngLat => text = `Moving: ${at(lngLat)}`,
      onDragEnd: lngLat => text = `Dropped at ${at(lngLat)}`,
    });
  }
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>{text}</p>
