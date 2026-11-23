<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

  let scheme = $state('auto');
  // A new description updates the map, so it passes the value that the button set.
  const description = $derived({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.0065, 40.7085], zoom: 13},
    controls: [navigation(), colorScheme()],
    attribution: {compact: true},
    colorScheme: scheme,
    onColorSchemeChange: value => scheme = value,
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Scheme: {scheme}</p>
