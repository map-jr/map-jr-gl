<script setup>
import {shallowRef, useTemplateRef} from 'vue';
import {MapJr, MapOverlay} from 'map-jr-gl/vue';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

const map = useTemplateRef('map');
const found = shallowRef(null);

async function ask(event) {
  // The features of the tile data near the point. You do not need a style layer.
  const features = await map.value.host.queryFeatures(event.point, {radius: 8});
  found.value = {lngLat: event.lngLat, features};
}
</script>

<template>
  <MapJr ref="map" :map-style="style" :initial-view="{center: NYC, zoom: 16.2}" cursor="crosshair" @click="ask">
    <MapOverlay v-if="found" :lng-lat="found.lngLat" popup @close="found = null">
      <div v-for="f in found.features.slice(0, 8)"><b>{{ f.sourceLayer }}</b> {{ f.properties.name ?? f.properties.class }}</div>
      <div v-if="!found.features.length">Nothing here</div>
    </MapOverlay>
  </MapJr>
</template>
