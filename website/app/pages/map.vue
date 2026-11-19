<script setup lang="ts">
import * as vue from 'vue';

// For the check that the page has one copy of Vue: the map component must be made by the Vue of the application.
const state = ref('waiting');
const sameVue = ref('unknown');
function onLoad(map: any) {
    state.value = 'load';
    (window as any).__map = map;
}
onMounted(() => {
    (window as any).__appVueVersion = vue.version;
    (window as any).__appVue = vue;
});
</script>

<template>
  <div>
    <h1>Map</h1>
    <p id="state">{{ state }}</p>
    <p id="same-vue">{{ sameVue }}</p>
    <div style="height: 400px">
      <MapJr
        map-style="https://styles.map-jr.org/1/elevation-zero.json"
        :initial-view="{center: [-74.0065, 40.7085], zoom: 12}"
        @load="onLoad"
        @idle="state = 'idle'"
        @error="state = 'error: ' + $event.message"
      />
    </div>
  </div>
</template>
