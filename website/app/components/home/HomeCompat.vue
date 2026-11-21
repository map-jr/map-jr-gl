<!--
  Stop 2: the change of one import for the compat entry, and a map beside it that runs the code after the change (a
  frame of components/MapFrame.vue, which loads when it comes near the screen).
-->
<script setup lang="ts">
const code = `import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
});
map.addControl(new NavigationControl());
`;
</script>

<template>
  <div>
    <h2 class="font-display text-3xl font-medium tracking-tight text-highlighted">Change one import</h2>
    <p class="mt-3 text-toned">The entry <code>@map-jr/map-jr-gl/maplibre-compat</code> has the API of MapLibre GL JS 6. For many applications, the import is the first line that changes.</p>
    <pre class="mt-4 overflow-x-auto border border-accented bg-(--site-pre-bg) p-3 font-mono text-[0.8125rem] leading-relaxed" aria-label="The change of the import"><code><span class="text-error">- import {Map} from 'maplibre-gl';</span>
<span class="text-success">+ import {Map} from '@map-jr/map-jr-gl/maplibre-compat';</span></code></pre>
    <p class="mt-4 text-sm text-muted">The small map below runs the code after the change with the compat entry. The map behind the page uses the main entry.</p>
    <div class="mt-2 h-56 overflow-hidden border border-accented">
      <LazyMapFrame form="compat" :code="code" title="A map made with the compat entry" />
    </div>
    <p class="mt-4"><UButton to="/migrate/from-maplibre" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Migrate from MapLibre GL JS</UButton></p>
  </div>
</template>
