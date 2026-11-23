<script setup>
// The map fills its parent element, so give the parent a height.
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, scale, fullscreen} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">{{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}</p>
  </MapJr>
</template>
