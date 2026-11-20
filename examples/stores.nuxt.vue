<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].
import {points} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const stores = [
  {name: 'Downtown', at: [-74.0089, 40.7096]},
  {name: 'Midtown', at: [-73.9857, 40.7484]},
  {name: 'Brooklyn', at: [-73.9903, 40.6928]},
];
// A key of `data` makes a GeoJSON source with that id. A circle layer draws its points.
const data = {stores: points(stores, {lngLat: s => s.at, properties: s => ({name: s.name})})};
const layers = [{id: 'stores', type: 'circle', source: 'stores', paint: {'circle-radius': 7, 'circle-color': '#d6453d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}}];

const map = useTemplateRef('map');
const show = store => map.value?.moveTo({center: store.at, zoom: 15, duration: 500});
</script>

<template>
  <MapJr ref="map" :map-style="style" :initial-view="{center: [-73.995, 40.72], zoom: 11.5}" :data="data" :layers="layers" :attribution="{compact: true}" />
  <button v-for="store in stores" :key="store.name" @click="show(store)">{{ store.name }}</button>
</template>
