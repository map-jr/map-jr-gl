<!--
  The smaller features that the library has without a plugin, as a list with a link for each. Each sentence follows the
  page that its link names.
-->
<script setup lang="ts">
const items = [
    {icon: 'i-lucide-waves', title: 'Contour lines', to: '/recipes/terrain', text: 'A source of the type <code>contour</code> makes contour lines from the elevation tiles in the browser.'},
    {icon: 'i-lucide-mountain-snow', title: 'Terrain and elevation queries', to: '/guide/terrain', text: '3D terrain, hillshade and <code>queryElevation</code> read the same elevation source.'},
    {icon: 'i-lucide-package', title: 'PMTiles', to: '/recipes/pmtiles', text: 'A source URL that starts with <code>pmtiles://</code> reads a PMTiles file. The page needs no plugin.'},
    {icon: 'i-lucide-sun-moon', title: 'Colour scheme', to: '/guide/color-scheme', text: 'With <code>colorScheme: \'auto\'</code>, the map, the controls and the popups follow the setting of the system.'},
    {icon: 'i-lucide-layers', title: 'A control for styles', to: '/reference/controls#styles', text: 'The control <code>styles()</code> opens a list of styles with a picture of each, and sets the chosen style.'},
    {icon: 'i-lucide-languages', title: 'Text in every script', to: '/reference/maplibre-differences', text: 'The fonts of the browser draw the characters that the glyph files of a style do not have, and the text that a browser must shape, such as Arabic.'},
    {icon: 'i-lucide-search', title: 'Queries of the data', to: '/recipes/query', text: '<code>querySource</code> reads the tile data of a source and returns a promise. It needs no style layer.'},
    {icon: 'i-lucide-globe', title: 'The globe', to: '/guide/globe', text: 'The projection <code>globe</code> draws the world as a sphere, with terrain and <code>fill-extrusion</code> layers on it.'},
    {icon: 'i-lucide-link', title: 'The view in the URL', to: '/reference/description#hash', text: 'With <code>hash</code>, the map keeps its view in the hash of the URL. Its code loads only for a map that sets the field.'},
    {icon: 'i-lucide-image-down', title: 'Export', to: '/guide/server-rendering#export-an-svg-in-the-browser', text: '<code>toBlob</code> returns the map as an image, and the server renderer also runs in the browser to export an SVG.'},
    {icon: 'i-lucide-message-square-warning', title: 'Messages for mistakes', to: '/guide/loading#the-development-build', text: 'The development build checks the description and says what to write instead. The production build does not have these checks.'},
    {icon: 'i-lucide-accessibility', title: 'Keyboard and reduced motion', to: '/guide/accessibility', text: 'The map and its controls work with the keyboard, and the camera jumps when the system asks for reduced motion.'},
];
</script>

<template>
  <ul class="home-list grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2 xl:grid-cols-3">
    <li v-for="item in items" :key="item.title" class="flex gap-3 border-t border-default py-4">
      <UIcon :name="item.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
      <div class="min-w-0">
        <NuxtLink :to="item.to" class="font-medium text-highlighted hover:text-primary">{{ item.title }}</NuxtLink>
        <!-- eslint-disable-next-line vue/no-v-html -- the text of this file, not input -->
        <p class="mt-1 text-sm text-pretty text-toned" v-html="item.text" />
      </div>
    </li>
  </ul>
</template>
