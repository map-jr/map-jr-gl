<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, styles} from '@map-jr/map-jr-gl/controls';

  const base = 'https://styles.map-jr.org/1/';
  const entries = [
    {label: 'Elevation', style: base + 'elevation-zero.json'},
    {label: 'Positron', style: base + 'openfreemap-positron.json'},
    {label: 'Dark', style: base + 'openfreemap-dark.json'},
  ];
  const sights = {
    type: 'FeatureCollection',
    features: [
      ['Chapel Bridge', 8.3077, 47.0516],
      ['Lion Monument', 8.3103, 47.0584],
      ['KKL Luzern', 8.3125, 47.0502],
      ['Swiss Museum of Transport', 8.3357, 47.0527],
    ].map(([name, lng, lat]) => ({type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [lng, lat]}})),
  };
  const sightsLayer = {id: 'sights', type: 'circle', source: 'sights',
    paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}};

  // A change is a new description, which passes `style` again. `onStyleChange` keeps the chosen entry, so that the
  // map keeps the chosen style.
  let entry = $state.raw(entries[0]);
  let shown = $state(true);
  const controls = [navigation(), styles({entries, onStyleChange: chosen => entry = chosen})];
  const description = $derived({
    style: entry.style,
    initialView: {center: [8.32, 47.054], zoom: 13.5},
    data: {sights},
    layers: shown ? [sightsLayer] : [],
    controls,
    attribution: {compact: true},
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Style: {entry.label}</p>
<button onclick={() => shown = !shown}>{shown ? 'Hide sights' : 'Show sights'}</button>
