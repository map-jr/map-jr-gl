<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {points} from '@map-jr/map-jr-gl';

  const stores = [
    {name: 'Downtown', at: [-74.0089, 40.7096]},
    {name: 'Midtown', at: [-73.9857, 40.7484]},
    {name: 'Brooklyn', at: [-73.9903, 40.6928]},
  ];
  let map = null;
  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-73.995, 40.72], zoom: 11.5},
    attribution: {compact: true},
    // A key of `data` makes a GeoJSON source with that id. A circle layer draws its points.
    data: {stores: points(stores, {lngLat: s => s.at, properties: s => ({name: s.name})})},
    layers: [{id: 'stores', type: 'circle', source: 'stores', paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}}],
  };
</script>

<div use:mapJr={{description, ready: instance => map = instance}} style="height: 500px"></div>
{#each stores as store (store.name)}
  <button onclick={() => map?.moveTo({center: store.at, zoom: 15, duration: 500})}>{store.name}</button>
{/each}
