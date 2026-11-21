<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const projection = ref('globe');
</script>

<template>
  <!-- The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS. -->
  <MapJr
    :map-style="style"
    :projection="{type: 'globe'}"
    :initial-view="{center: [10, 30], zoom: 1.5}"
    :controls="[navigationControl(), globeControl()]"
    :attribution="{compact: true}"
    @projectiontransition="e => projection = e.newProjection"
  >
    <p class="note">Projection: {{ projection }}</p>
  </MapJr>
</template>
