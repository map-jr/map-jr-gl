<script setup>
// The map fills its parent element, so give the parent a height.
import {computed, ref, useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation.json';
const MATTERHORN = [7.6586, 45.9763];
const thresholds = {
  ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]},
  m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]},
};

// Additions to the style, which has the elevation source "terrarium" and relief shading: contour lines and
// stronger 3D terrain. `null` makes the map flat, although the style has a terrain. The style shows the heights of
// peaks in the unit of its state "elevation-unit", so `globalState` sets the unit of the contour lines there too.
const elevation = (unit, terrain) => ({
  terrain: terrain ? {source: 'terrarium', exaggeration: 1.5} : null,
  globalState: {'elevation-unit': unit},
  sources: {
    // For each zoom level, `thresholds` sets the interval between lines and between major lines, in feet or meters.
    contours: {type: 'contour', source: 'terrarium', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: thresholds[unit]},
  },
  layers: [
    {id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', before: 'water',
      paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}},
    {id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
      layout: {'symbol-placement': 'line', 'text-size': 10, 'text-font': ['Noto Sans Bold'],
        'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m']},
      paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}},
  ],
});

const unit = ref('ft'), terrain = ref(true), height = ref(null);
// Other additions when the unit or the terrain changes. The map finds what is different.
const additions = computed(() => elevation(unit.value, terrain.value));
const map = useTemplateRef('map');

async function read(event) {
  height.value = await map.value.queryElevation(event.lngLat);
}
</script>

<template>
  <MapJr ref="map" :map-style="style" v-bind="additions" :initial-view="{center: MATTERHORN, zoom: 12.4, pitch: 60, bearing: 25}" @click="read" />
  <p>{{ height === null ? 'Click the map to read the elevation' : `${height.toFixed(0)} m above sea level` }}</p>
  <button @click="unit = unit === 'ft' ? 'm' : 'ft'">Contours in {{ unit === 'ft' ? 'meters' : 'feet' }}</button>
  <button @click="terrain = !terrain">{{ terrain ? 'Flat map' : '3D terrain' }}</button>
</template>
