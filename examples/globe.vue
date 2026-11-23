<script setup>
// The map fills its parent element, so give the parent a height.
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const projection = ref('globe');
</script>

<template>
  <!-- The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS. -->
  <MapJr
    :map-style="style"
    :projection="{type: 'globe'}"
    :initial-view="{center: [10, 30], zoom: 1.5}"
    :controls="[navigation(), globe()]"
    :attribution="{compact: true}"
    @projectiontransition="e => projection = e.newProjection"
  >
    <p class="note">Projection: {{ projection }}</p>
  </MapJr>
</template>
