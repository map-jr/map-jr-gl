<script setup>
import {computed, ref, useTemplateRef} from 'vue';
import {MapJr} from 'map-jr-gl/vue';
import {MATTERHORN} from './shared.js';
import {withElevation} from './terrain-style.js';   // the base style with relief shading, contour lines and terrain

const unit = ref('ft'), terrain = ref(true), elevation = ref(null);
// A new style object when the unit or the terrain changes. The map finds what is different.
const style = computed(() => withElevation(unit.value, terrain.value));
const map = useTemplateRef('map');

async function read(event) {
  elevation.value = await map.value.host.queryElevation(event.lngLat);
}
</script>

<template>
  <MapJr ref="map" :map-style="style" :initial-view="{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}" @click="read" />
  <p>{{ elevation === null ? 'Click the map to read the elevation' : `${elevation.toFixed(0)} m above sea level` }}</p>
  <button @click="unit = unit === 'ft' ? 'm' : 'ft'">Contours in {{ unit === 'ft' ? 'metres' : 'feet' }}</button>
  <button @click="terrain = !terrain">{{ terrain ? 'Flat map' : '3D terrain' }}</button>
</template>
