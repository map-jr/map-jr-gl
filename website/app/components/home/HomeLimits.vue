<!--
  Stop 6: what the library does not do. The list is taken from the section "What is not available" and the table
  "What is different" of docs/reference/maplibre-differences.md.
-->
<script setup lang="ts">
const items = [
    'Video and canvas sources, MapLibre Tiles (MLT) and <code>promoteId</code> in vector sources.',
    'Custom layers with the worker renderer. They need <code>renderer: \'main\'</code>.',
    'A pattern that is different for each feature, and SDF images as <code>fill-pattern</code>.',
    '3D terrain, <code>fill-extrusion</code> layers and custom layers on the globe.',
    'Validation of the style, and checks of the types of expressions, in the production build.',
];
</script>

<template>
  <div>
    <h2 class="font-display text-3xl font-medium tracking-tight text-highlighted">What it does not do</h2>
    <p class="mt-3 text-toned">Read this list before you switch.</p>
    <ul class="mt-4 list-disc space-y-2 ps-5 text-toned marker:text-muted">
      <li v-for="item in items" :key="item" v-html="item" />
    </ul>
    <p class="mt-4"><UButton to="/reference/maplibre-differences" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Every difference from MapLibre GL JS</UButton></p>
  </div>
</template>
