<!--
  The section about the styles of https://styles.map-jr.org/1/ (the repository map-jr/map-jr-styles). The text follows the
  README of that repository. The figure draws the five shield templates of its folder shields/ (components/home/HomeShield.vue) around a route
  number that the visitor sets. The labels of the figure use the font
  stack of the elevation styles, so they show the font of the visitor's system.
-->
<script setup lang="ts">
const route = ref(80);
const step = (by: number) => { route.value = Math.min(9999, Math.max(1, (Number(route.value) || 0) + by)); };
const shown = computed(() => String(Math.min(9999, Math.max(1, Math.round(Number(route.value)) || 1))));
// The look of each shape, with the colors of a network that has it (shields/shields.mjs of map-jr/map-jr-styles).
const shields = [
    {shape: 'us_interstate', name: 'US Interstate', background: '#003f87', color: '#bf2033', border: '#ffffff', text: '#ffffff'},
    {shape: 'us_highway', name: 'US Highway', background: '#ffffff', border: '#1d1d1f', text: '#1d1d1f'},
    {shape: 'pill', name: 'State route', background: '#ffffff', border: '#1d1d1f', text: '#1d1d1f'},
    {shape: 'hex', name: 'Autobahn', background: '#003f87', border: '#ffffff', text: '#ffffff'},
    {shape: 'rect', name: 'Trans-Canada', background: '#ffffff', border: '#006747', text: '#006747'},
] as const;
const code = `createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  colorScheme: 'auto',
  globalState: {language: 'de', 'elevation-unit': 'm'},
});`;
const systemFont = 'system-ui, "Segoe UI", Roboto, sans-serif';

const items = [
    {icon: 'i-lucide-type', title: 'Fonts of the system', text: 'The three elevation styles have no <code>glyphs</code>. The labels use the font of the system (SF Pro, Segoe UI, Roboto), and the map requests no font files.'},
    {icon: 'i-lucide-sun-moon', title: 'Light and dark in one style', text: 'Each elevation style has a light and a dark branch. The map chooses the branch from <code>colorScheme</code>, and loads no second style.'},
    {icon: 'i-lucide-languages', title: 'The language of the names', text: 'The global state <code>language</code> takes a language code of the tiles, such as <code>de</code> or <code>ja</code>. Without it, a name in a script other than Latin also shows its Latin form.'},
    {icon: 'i-lucide-shield', title: 'Road shields', text: 'Five SVG templates stretch around the route number. About 200 road networks have the shape and the colors of their signs, from the definitions of OSM Americana.'},
    {icon: 'i-lucide-shapes', title: 'Icons inside the style', text: 'The icons are SVG templates in the style, and a layer gives them their colors. The map requests no sprite.'},
    {icon: 'i-lucide-server', title: 'A small first view', text: 'Each layer says what the server renderer keeps of it for the first view. With tiles two zooms lower, that SVG is 4 to 12 KB with gzip in most of the views that were measured.'},
];
</script>

<template>
  <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
    <div>
      <div class="home-card">
        <div class="home-figure min-h-0!">
          <div class="flex items-center justify-between gap-3">
            <label for="home-route" class="label-text text-muted">Route number</label>
            <div class="flex items-stretch">
              <UButton icon="i-lucide-minus" color="neutral" variant="outline" size="sm" aria-label="One lower" class="rounded-none" data-home-route-down @click="step(-1)" />
              <input id="home-route" v-model.number="route" type="number" min="1" max="9999" inputmode="numeric" class="home-route w-20 border-y border-accented bg-default px-2 py-1 text-center font-mono text-sm text-highlighted focus:outline-2 focus:outline-primary" data-home-route>
              <UButton icon="i-lucide-plus" color="neutral" variant="outline" size="sm" aria-label="One higher" class="rounded-none" data-home-route-up @click="step(1)" />
            </div>
          </div>
          <div class="mt-5 flex flex-wrap items-end justify-between gap-x-2 gap-y-4" data-home-shields>
            <figure v-for="shield in shields" :key="shield.shape" class="flex flex-col items-center gap-2">
              <HomeShield :shape="shield.shape" :text="shown" :background="shield.background" :border="shield.border" :color="'color' in shield ? shield.color : undefined" :text-color="shield.text" :font-family="systemFont" />
              <figcaption class="figure-text text-muted">{{ shield.name }}</figcaption>
            </figure>
          </div>
        </div>
        <div class="border-b border-accented bg-(--site-sheet) px-5 py-4">
          <span class="label-text text-muted">A label in the font of your system</span>
          <p class="mt-2 text-2xl text-highlighted" :style="{fontFamily: systemFont, fontWeight: 600}">Vierwaldstättersee</p>
          <p class="text-base text-toned italic" :style="{fontFamily: systemFont}">Lake Lucerne · 434 m</p>
        </div>
        <div class="px-5 py-4">
          <HomeCode :code="code" />
        </div>
      </div>
      <p class="mt-4 text-sm text-muted">Change the style, the colors and the language on <a href="#top" class="underline">the map at the top of this page</a>.</p>
    </div>

    <div>
      <p class="max-w-2xl text-lg text-pretty text-toned">The styles at <code class="font-mono text-[0.9em]">styles.map-jr.org</code> are made for the library: Elevation, a terrain map in full color, two more forms of it, and the five styles of OpenFreeMap. Each one is a single JSON file.</p>
      <ul class="home-list mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        <li v-for="item in items" :key="item.title" class="flex gap-3 border-t border-default py-4">
          <UIcon :name="item.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
          <div class="min-w-0">
            <h3 class="font-sans! text-base font-medium text-highlighted">{{ item.title }}</h3>
            <!-- eslint-disable-next-line vue/no-v-html -- the text of this file, not input -->
            <p class="mt-1 text-sm text-pretty text-toned" v-html="item.text" />
          </div>
        </li>
      </ul>
      <p class="mt-4 max-w-2xl text-sm text-pretty text-muted">The three elevation styles also have a version for MapLibre GL JS 5.16 or later, with a sprite and glyph files. The package <code class="font-mono">@map-jr/styles</code> on npm has the same files.</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <UButton to="/styles" trailing-icon="i-lucide-arrow-right">See every style</UButton>
        <UButton to="https://github.com/map-jr/map-jr-styles" target="_blank" color="neutral" variant="outline" icon="i-simple-icons-github">map-jr-styles</UButton>
      </div>
    </div>
  </div>
</template>

<style>
/* The buttons beside the field step the number, so the arrows of the browser are not shown. */
.home-route { appearance: textfield; }
.home-route::-webkit-inner-spin-button, .home-route::-webkit-outer-spin-button { appearance: none; margin: 0; }
</style>
