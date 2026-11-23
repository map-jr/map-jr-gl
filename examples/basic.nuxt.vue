<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].
// The map fills its parent element, so give the parent a height.

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: NYC, zoom: 13.6}"
    :controls="[navigationControl(), scaleControl({position: 'bottom-left'}), fullscreenControl({position: 'top-left'})]"
    :attribution="{compact: true}"
    v-slot="{state}"
  >
    <p class="note">{{ state?.renderer ? `${state.renderer} rendering` : 'Starting' }}</p>
  </MapJr>
</template>
