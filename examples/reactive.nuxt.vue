<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].
// The map fills its parent element, so give the parent a height.
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

const dot = '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="{{color}}" stroke="#fff" stroke-width="1.5"/></svg>';
const places = [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]];

const view = ref({center: NYC, zoom: 13.6, bearing: 0, pitch: 0});
// The image of the markers: an SVG template, 14 pixels wide and high.
const images = {dot: {image: dot, width: 14, height: 14}};
// A symbol layer that draws the image at each point of the source "pins".
const layers = [{id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}];
const shown = ref(false);
// A key of `data` makes a GeoJSON source with that id. The data of a source is compared by identity, so a change is a new object.
const data = computed(() => ({pins: points(shown.value ? places : [], {lngLat: p => p, properties: () => ({color: '#d6453d'})})}));
const hover = ref([]);
</script>

<template>
  <MapJr :map-style="style" v-model:view="view" :images="images" :data="data" :layers="layers" :interactive-layers="['park', 'water']" :attribution="{compact: true}" @hover="hover = $event" />
  <p>zoom {{ view.zoom.toFixed(2) }} · under the pointer: {{ hover[0]?.layer.id ?? 'nothing' }}</p>
  <button @click="shown = !shown">{{ shown ? 'Remove markers' : 'Add markers' }}</button>
  <button @click="view.pitch = view.pitch ? 0 : 50">Tilt</button>
</template>
