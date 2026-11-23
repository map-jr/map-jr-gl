<!--
  The section about the styles of https://styles.map-jr.org/1/ (the repository map-jr/map-jr-styles). The text follows the
  README of that repository. The figure draws the five shield templates of its folder shields/ around a route number that
  the visitor types: the plates stretch as `icon-text-fit` stretches them on the map. The labels of the figure use the font
  stack of the elevation styles, so they show the font of the visitor's system.
-->
<script setup lang="ts">
const route = ref('80');
const shown = computed(() => route.value.trim().slice(0, 6) || '80');
// The look of each shape, with the colours of a network that has it (shields/shields.mjs of map-jr/map-jr-styles).
const shields = [
    {shape: 'interstate', name: 'US Interstate', background: '#003f87', border: '#ffffff', text: '#ffffff'},
    {shape: 'highway', name: 'US Highway', background: '#ffffff', border: '#1d1d1f', text: '#1d1d1f'},
    {shape: 'pill', name: 'State route', background: '#ffffff', border: '#1d1d1f', text: '#1d1d1f'},
    {shape: 'hex', name: 'Autobahn', background: '#003f87', border: '#ffffff', text: '#ffffff'},
    {shape: 'rect', name: 'Trans-Canada', background: '#ffffff', border: '#006747', text: '#006747'},
];
const systemFont = 'system-ui, "Segoe UI", Roboto, sans-serif';

const items = [
    {icon: 'i-lucide-type', title: 'Fonts of the system', text: 'The three elevation styles have no <code>glyphs</code>. The labels use the font of the system (SF Pro, Segoe UI, Roboto), and the map requests no font files.'},
    {icon: 'i-lucide-sun-moon', title: 'Light and dark in one style', text: 'Each elevation style has a light and a dark branch. The map chooses the branch from <code>colorScheme</code>, and loads no second style.'},
    {icon: 'i-lucide-languages', title: 'The language of the names', text: 'The global state <code>language</code> takes a language code of the tiles, such as <code>de</code> or <code>ja</code>. Without it, a name in a script other than Latin also shows its Latin form.'},
    {icon: 'i-lucide-shield', title: 'Road shields', text: 'Five SVG templates stretch around the route number. About 200 road networks have the shape and the colours of their signs, from the definitions of OSM Americana.'},
    {icon: 'i-lucide-shapes', title: 'Icons inside the style', text: 'The icons are SVG templates in the style, and a layer gives them their colours. The map requests no sprite.'},
    {icon: 'i-lucide-server', title: 'A small first view', text: 'Each layer says what the server renderer keeps of it for the first view. With tiles two zooms lower, that SVG is 4 to 12 KB with gzip in most of the views that were measured.'},
];
</script>

<template>
  <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
    <div>
      <div class="home-card">
        <div class="home-figure min-h-0!">
          <label class="flex items-center justify-between gap-3">
            <span class="label-text text-muted">Route number</span>
            <input v-model="route" type="text" maxlength="6" inputmode="text" autocomplete="off" spellcheck="false" class="w-28 border border-accented bg-default px-2 py-1 text-end font-mono text-sm text-highlighted focus:outline-2 focus:outline-primary" data-home-route>
          </label>
          <div class="mt-5 flex flex-wrap items-end gap-x-5 gap-y-4" data-home-shields>
            <figure v-for="shield in shields" :key="shield.shape" class="flex flex-col items-center gap-2">
              <span class="home-shield" :class="`home-shield-${shield.shape}`" :style="{'--plate': shield.background, '--edge': shield.border, color: shield.text, fontFamily: systemFont}">
                <span>{{ shown }}</span>
              </span>
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
          <pre class="overflow-x-auto font-mono text-[0.75rem] leading-relaxed text-(--site-pre-fg)"><code>createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation.json',
  colorScheme: 'auto',
  globalState: {language: 'de', 'elevation-unit': 'm'},
});</code></pre>
        </div>
      </div>
      <p class="mt-4 text-sm text-muted">Change the style, the colours and the language on <a href="#top" class="underline">the map at the top of this page</a>.</p>
    </div>

    <div>
      <p class="max-w-2xl text-lg text-pretty text-toned">The styles at <code class="font-mono text-[0.9em]">styles.map-jr.org</code> are made for the library: Elevation, a terrain map in full colour, two more forms of it, and the five styles of OpenFreeMap. Each one is a single JSON file.</p>
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
/* A shield is a plate that grows with its number. The Interstate and the US Highway plates are the SVG templates of the styles as masks. */
.home-shield { display: inline-flex; align-items: center; justify-content: center; min-width: 2.5rem; height: 2rem; padding: 0 0.625rem; font-size: 0.9375rem; font-weight: 700; line-height: 1; white-space: nowrap; background: var(--plate); border: 2px solid var(--edge); box-shadow: 0 0 0 1px rgb(0 0 0 / 0.25); }
.home-shield-rect { border-radius: 5px; }
.home-shield-pill { border-radius: 999px; }
.home-shield-hex { border: 0; box-shadow: none; padding: 0 1.125rem; background: var(--edge); clip-path: polygon(0.75rem 0, calc(100% - 0.75rem) 0, 100% 50%, calc(100% - 0.75rem) 100%, 0.75rem 100%, 0 50%); position: relative; isolation: isolate; }
.home-shield-hex::before { content: ''; position: absolute; inset: 2px; z-index: -1; background: var(--plate); clip-path: polygon(0.7rem 0, calc(100% - 0.7rem) 0, 100% 50%, calc(100% - 0.7rem) 100%, 0.7rem 100%, 0 50%); }
.home-shield-interstate { border: 0; box-shadow: none; height: 2.75rem; min-width: 2.75rem; padding: 0.875rem 0.75rem 0.5rem; background: linear-gradient(#bf2033 0 0.8rem, #fff 0.8rem 0.9rem, var(--plate) 0.9rem); border-radius: 0.25rem 0.25rem 50% 50% / 0.25rem 0.25rem 85% 85%; outline: 2px solid var(--edge); outline-offset: -2px; filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.5)); }
.home-shield-highway { height: 2.5rem; min-width: 2.75rem; border-radius: 0.5rem 0.5rem 50% 50% / 0.5rem 0.5rem 60% 60%; padding-bottom: 0.25rem; }
</style>
