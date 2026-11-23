<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [-74.0065, 40.7085], zoom: 13.6});
</script>

<template>
  <div style="height: 400px">
    <MapJr map-style="https://styles.map-jr.org/1/elevation-zero.json" v-model:view="view" />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>
