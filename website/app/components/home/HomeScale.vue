<!--
  Stop 1: a scale bar of what the map costs. The first bar is measured on this device (HomeMap.vue sends the bytes of
  the scripts and the time to idle). The second is the download of MapLibre GL JS from docs/status.json (its page script
  with CSS plus its worker file, gzip, the version named beside it). Both bars use one scale.
-->
<script setup lang="ts">
defineProps<{measure?: {idleMs: number; bytes: number; files: number}}>();
const {site} = useAppConfig();
const kb = (bytes: number) => (bytes / 1000).toLocaleString('en', {maximumFractionDigits: 0}) + ' KB';
const seconds = (ms: number) => (ms / 1000).toLocaleString('en', {maximumFractionDigits: 1}) + ' s';
const width = (bytes: number) => Math.max(1, Math.min(100, bytes / site.maplibre.bytes * 100)) + '%';
</script>

<template>
  <div data-home-measure :data-state="measure ? 'measured' : 'measuring'">
    <h2 class="font-display text-3xl font-medium tracking-tight text-highlighted">Check the size on this page</h2>
    <p class="mt-3 text-toned">The first bar is the size of the library files that this page fetched for the map you see, as your browser measured it: the page script, the chunks that it loaded and the worker file. The bar counts the body of each file as the server sent it.</p>
    <div class="mt-5 space-y-4 figure-text">
      <div>
        <div class="flex justify-between gap-3"><span class="text-highlighted">Map Jr. GL, on this page</span><span data-home-bytes :data-bytes="measure?.bytes">{{ measure ? kb(measure.bytes) : 'measuring…' }}</span></div>
        <div class="mt-1 h-3 border border-inverted"><div class="h-full bg-primary" :style="{width: measure ? width(measure.bytes) : '0%'}" /></div>
      </div>
      <div>
        <div class="flex justify-between gap-3"><span class="text-highlighted">MapLibre GL JS {{ site.maplibre.version }}</span><span>{{ kb(site.maplibre.bytes) }}</span></div>
        <div class="mt-1 h-3 border border-inverted"><div class="h-full bg-inverted" style="width: 100%" /></div>
      </div>
    </div>
    <p class="mt-4 figure-text text-muted">
      <template v-if="measure">The map was idle {{ seconds(measure.idleMs) }} after this page started to load, on this device.</template>
      <template v-else>The time to idle appears when the map is ready.</template>
    </p>
    <p class="mt-2 text-sm text-muted">
      The MapLibre GL JS figure is gzip: its page script with its CSS plus its worker file, from <a class="underline" :href="`${site.repository}/blob/main/docs/status.json`">docs/status.json</a>, which <code>pnpm status</code> writes. Your figure is the size of the bodies that the server sent, so a server without compression shows a larger number.
    </p>
  </div>
</template>
