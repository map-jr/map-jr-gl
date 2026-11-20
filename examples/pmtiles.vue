<script setup>
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
// range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
    {id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features',
      paint: {'line-color': '#5746af', 'line-width': 2}},
  ],
};
const map = useTemplateRef('map'), names = ref('Click to list the county, state and ZIP code');

async function ask(event) {
  const features = await map.value.map.querySource('admin', event.point);
  names.value = features.map(f => f.properties.NAMELSAD ?? f.properties.NAME).filter(Boolean).join(' · ') || 'Nothing here';
}
</script>

<template>
  <MapJr ref="map" :map-style="style" v-bind="boundaries" :initial-view="{center: [-74.1, 40.75], zoom: 9.2}" @click="ask" />
  <p>{{ names }}</p>
</template>
