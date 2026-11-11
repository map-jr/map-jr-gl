<script setup>
import {ref} from 'vue';
import {MapJr} from 'map-jr-gl/vue';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];

const view = ref({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
const pins = ref({id: 'pins', svg: dot, width: 14, height: 14, data: []});
const hover = ref([]);

function toggleMarkers() {
  // A change in place is seen.
  if (pins.value.data.length) pins.value.data.length = 0;
  else pins.value.data.push(...places.map(lngLat => ({lngLat, props: {color: '#d6453d'}})));
}
</script>

<template>
  <MapJr :map-style="style" v-model:view="view" :markers="[pins]" :interactive-layers="['park', 'water']" :attribution="{compact: true}" @hover="hover = $event" />
  <p>zoom {{ view.zoom.toFixed(2) }} · under the pointer: {{ hover[0]?.layer.id ?? 'nothing' }}</p>
  <button @click="toggleMarkers">{{ pins.data.length ? 'Remove markers' : 'Add markers' }}</button>
  <button @click="view.pitch = view.pitch ? 0 : 50">Tilt</button>
</template>
