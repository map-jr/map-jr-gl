<script setup>
import {shallowRef, useTemplateRef} from 'vue';
import {MapJr} from 'map-jr-gl/vue';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];
// The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
const box = 'position:absolute;top:8px;left:8px;z-index:1;pointer-events:none;max-width:240px;padding:8px 10px;border-radius:8px;background:#fff;color:#222;font:12px/1.5 system-ui,sans-serif;box-shadow:0 1px 6px #0004';

const map = useTemplateRef('map');
const found = shallowRef(null);
let clicks = 0;

async function ask(event) {
  const click = ++clicks;
  // With `sources`, the query reads the tile data of these sources within 8 pixels of the click. It also finds
  // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
  // A query fails when its tile cannot be loaded: the answer is then `null` here.
  const features = await map.value.host.queryFeatures(event.lngLat, {sources: ['openmaptiles'], radius: 8}).catch(() => null);
  // An earlier click can get its answer after a later click. Only the last click is shown.
  if (click === clicks) found.value = {features};
}
</script>

<template>
  <MapJr ref="map" :map-style="style" :initial-view="{center: NYC, zoom: 16.2}" cursor="crosshair" @click="ask">
    <div v-if="found" :style="box">
      <div v-for="f in found.features?.slice(0, 8)"><b>{{ f.sourceLayer }}</b> {{ f.properties.name ?? f.properties.class }}</div>
      <div v-if="!found.features">The tile data did not load</div>
      <div v-else-if="!found.features.length">Nothing here</div>
    </div>
  </MapJr>
</template>
