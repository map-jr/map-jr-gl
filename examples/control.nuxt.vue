<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules: ['@map-jr/map-jr-gl/nuxt'].

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The element of the control, made in the browser only, because `document` does not exist during server rendering.
// The map places it in its corner, and <Teleport> renders the button into it.
const corner = shallowRef(null);
const controls = shallowRef([navigationControl()]);
onMounted(() => {
  corner.value = document.createElement('div');
  // `key` names the control: the map keeps it while the list has a control with this key.
  controls.value = [navigationControl(), customControl({key: 'next-style', position: 'top-left', element: corner.value})];
});
</script>

<template>
  <MapJr :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`" :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls" :attribution="{compact: true}" />
  <p>Style: {{ styles[current] }}</p>
  <Teleport v-if="corner" :to="corner">
    <button style="padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer" @click="current = (current + 1) % styles.length">Next style</button>
  </Teleport>
</template>
