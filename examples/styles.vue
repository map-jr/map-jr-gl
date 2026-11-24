<script setup>
// The map fills its parent element, so give the parent a height.
import {computed, ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
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
const data = {sights};
const sightsLayer = {id: 'sights', type: 'circle', source: 'sights',
  paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}};

// The component passes `map-style` again at each change of another prop. `onStyleChange` keeps the chosen entry, so
// that the map keeps the chosen style.
const entry = shallowRef(entries[0]);
const shown = ref(true);
const layers = computed(() => shown.value ? [sightsLayer] : []);
const controls = [navigation(), styles({entries, onStyleChange: chosen => { entry.value = chosen; }})];
</script>

<template>
  <MapJr :map-style="entry.style" :initial-view="{center: [8.32, 47.054], zoom: 13.5}" :data="data" :layers="layers"
    :controls="controls" :attribution="{compact: true}" />
  <p>Style: {{ entry.label }}</p>
  <button @click="shown = !shown">{{ shown ? 'Hide sights' : 'Show sights' }}</button>
</template>
