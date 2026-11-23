<!--
  The home page. The top is one live map with a panel of demos beside it (components/home/HomeMap.vue and HomeDemo.vue): a
  choice of the panel changes the description of the map. The first paint of the map is the SVG of the server renderer.
  Below the map are the reasons to use the library as cards, the smaller features, the styles, what the library does not
  do, and how to install it. The figures of the page come from docs/status.json (nuxt.config.ts).

  From the width `lg`, the panel is the left column and the map stays in the window while the column scrolls. On a
  narrower window the map comes between the title and the panel, and it stays at the top while the panel scrolls.
-->
<script setup lang="ts">
import {demoProps, firstCamera, firstState, type Camera, type HomeClick, type HomeView} from '~/utils/home-scenes';

const {site} = useAppConfig();
const {start} = await useDocs();
useSeoMeta({title: site.name, ogTitle: site.name});

const ways = [
    {title: 'Docs', description: 'How to make a map and change it, with Vue, Nuxt, React, Svelte or plain JavaScript.', to: start.value, icon: 'i-lucide-book-open'},
    {title: 'Recipes', description: 'Short answers to single tasks.', to: '/recipes', icon: 'i-lucide-list-checks'},
    {title: 'Reference', description: 'Each field of the description, each event and each method.', to: '/reference', icon: 'i-lucide-braces'},
    {title: 'Play', description: 'An editor with a map that runs your code.', to: '/play', icon: 'i-lucide-play'},
];

const mapProps = shallowRef<Record<string, unknown>>(demoProps('styles', firstState()));
const camera = shallowRef<Camera>(firstCamera);
// The color scheme of the map: the color mode of the site at first, and then the choice of the panel (HomeDemo.vue).
// The panel sets it when the page runs in the browser, before the map is made.
const scheme = ref<'light' | 'dark'>('light');
const renderer = ref('');
const view = shallowRef<HomeView>();
const click = shallowRef<HomeClick>();
const map = useTemplateRef<{instance: () => any}>('map');
const instance = () => map.value?.instance() ?? null;
</script>

<template>
  <div id="top">
    <div class="home-stage border-b border-accented">
      <div class="home-stage-hero">
        <h1 class="font-display text-4xl tracking-tight text-highlighted sm:text-[2.75rem] sm:leading-[1.08]">A small, fast map library for the web</h1>
        <p class="mt-3 max-w-md text-lg text-pretty text-toned">Map Jr. GL reads MapLibre styles and draws them in a worker.</p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <UButton :to="start" size="lg" trailing-icon="i-lucide-arrow-right">Read the docs</UButton>
          <UButton :to="site.repository" target="_blank" size="lg" color="neutral" variant="outline" icon="i-simple-icons-github">GitHub</UButton>
          <span class="figure-text text-muted" data-home-version>v{{ site.version }}</span>
        </div>
      </div>
      <div class="home-stage-map">
        <HomeMap ref="map" :map-props="mapProps" :camera="camera" :scheme="scheme" @renderer="renderer = $event" @view="view = $event" @click="click = $event" />
      </div>
      <div class="home-stage-panel">
        <HomeDemo :map="instance" :view="view" :click="click" :renderer="renderer" @update:map-props="mapProps = $event" @update:camera="camera = $event" @update:scheme="scheme = $event" />
      </div>
    </div>

    <UContainer class="py-14 lg:py-20">
      <section aria-labelledby="home-why" data-home-section="why">
        <h2 id="home-why" class="home-title">Six reasons to switch</h2>
        <HomeFeatures class="mt-8" />
      </section>

      <section class="mt-20 lg:mt-28" aria-labelledby="home-built-in" data-home-section="built-in">
        <h2 id="home-built-in" class="home-title">What the library has built in</h2>
        <HomeBuiltIn class="mt-8" />
      </section>
    </UContainer>

    <div class="relative overflow-hidden border-y border-accented bg-default">
      <div class="contours contours-rising" aria-hidden="true" />
      <UContainer class="relative py-14 lg:py-20">
        <section aria-labelledby="home-styles" data-home-section="styles">
          <h2 id="home-styles" class="home-title">Styles that carry their fonts, icons and shields</h2>
          <HomeStyles class="mt-8" />
        </section>
      </UContainer>
    </div>

    <UContainer class="py-14 lg:py-20">
      <section aria-labelledby="home-limits" data-home-section="limits">
        <h2 id="home-limits" class="home-title">What it does not do</h2>
        <HomeLimits class="mt-8" />
      </section>

      <section class="mt-20 grid grid-cols-1 gap-10 lg:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14" aria-label="Install" data-home-section="install">
        <div class="home-card p-6"><HomeInstall /></div>
        <UPageGrid class="sm:grid-cols-2 lg:grid-cols-2">
          <UPageCard v-for="way in ways" :key="way.title" v-bind="way" variant="outline" />
        </UPageGrid>
      </section>
    </UContainer>
  </div>
</template>

<style>
.home-title { max-width: 46rem; font-size: 2.25rem; line-height: 1.1; color: var(--ui-text-highlighted); }
@media (min-width: 40rem) { .home-title { font-size: 2.75rem; } }

/* The stage: the title, the map and the panel. */
.home-stage { display: grid; grid-template-columns: minmax(0, 1fr); background: var(--ui-bg); }
.home-stage-hero { padding: 1.5rem 1rem 1.25rem; }
.home-stage-map { position: sticky; top: var(--ui-header-height); z-index: 5; height: 44svh; min-height: 17rem; overflow: hidden; border-block: 1px solid var(--ui-border-accented); }
.home-stage-panel { padding: 1.25rem 1rem 1.75rem; min-width: 0; }
@media (min-width: 64rem) {
  .home-stage { grid-template-columns: minmax(25rem, 31rem) minmax(0, 1fr); grid-template-rows: auto 1fr; min-height: calc(100svh - var(--ui-header-height)); }
  .home-stage-hero { grid-area: 1 / 1; padding: 2.25rem 2rem 0.5rem 2.25rem; }
  .home-stage-panel { grid-area: 2 / 1; padding: 1.5rem 2rem 2rem 2.25rem; }
  .home-stage-map { grid-area: 1 / 2 / 3 / 3; height: calc(100svh - var(--ui-header-height)); border-block: 0; border-inline-start: 1px solid var(--ui-border-accented); }
}
</style>
