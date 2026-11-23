<script setup>
// The map fills its parent element, so give the parent a height.
import {ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const boundaryFile = 'https://styles.map-jr.org/data/natural-earth-5.1.2.pmtiles';

// Additions to the style: a PMTiles file on a usual file host. The map reads the tiles that it needs with HTTP
// range requests.
const boundaries = {
  sources: {
    admin: {type: 'vector', url: 'pmtiles://' + boundaryFile},
  },
  layers: [
    {id: 'states', type: 'line', source: 'admin', 'source-layer': 'states', minzoom: 3,
      paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}},
    {id: 'countries', type: 'line', source: 'admin', 'source-layer': 'countries',
      paint: {'line-color': '#5746af', 'line-width': 2}},
  ],
};
const map = useTemplateRef('map'), names = ref('Click to list the country and the state or province');

async function ask(event) {
  const features = await map.value.querySource('admin', event.lngLat);
  names.value = features.map(f => f.properties.name).filter(Boolean).join(' · ') || 'Nothing here';
}
</script>

<template>
  <MapJr ref="map" :map-style="style" v-bind="boundaries" :initial-view="{center: [-98, 39], zoom: 3.2}" @click="ask" />
  <p>{{ names }}</p>
</template>
