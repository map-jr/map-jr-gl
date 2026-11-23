<!--
  The six reasons to use the library, each as a card with a small figure. Every number comes from docs/status.json through
  the app config (`site.home`, nuxt.config.ts): the sizes that `pnpm status` computes from the built files, the checks
  against MapLibre GL JS, and the last run of the workflow Browsers. The page measures nothing itself.

  A card gets `data-seen` when it first comes into the window, and its bars grow then.
-->
<script setup lang="ts">
const {site} = useAppConfig();
const home = site.home;
const kb = (bytes: number) => (bytes / 1024).toLocaleString('en', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const percent = (share: number) => (share * 100).toLocaleString('en', {maximumFractionDigits: 1}) + '%';
const times = (ratio: number) => ratio.toLocaleString('en', {maximumFractionDigits: 1});

// Size: the entry that the bar shows.
const entry = ref<'main' | 'compat'>('main');
const sizes = computed(() => home.sizes[entry.value]);
const entryName = computed(() => entry.value === 'main' ? '@map-jr/map-jr-gl' : '@map-jr/map-jr-gl/maplibre-compat');
const width = (bytes: number) => bytes / home.sizes.maplibre.total * 100 + '%';

// Speed: load to idle of each pair of system and browser, on one scale.
const slowest = Math.max(...home.speed.load.map(row => Math.max(row.maplibre, row.mapJr)));
const at = (ms: number) => ms / slowest * 100 + '%';

const template = `<svg viewBox="0 0 24 31">
  <path fill="{{color}}" stroke="#fff" d="…"/>
</svg>`;
const importDiff = `- import {Map} from 'maplibre-gl';
+ import {Map} from '@map-jr/map-jr-gl/maplibre-compat';`;
// Markers: three points, each with a color that a click changes.
const colors = ['#d6453d', '#2f7fd1', '#2e9d5b', '#8a4fd3', '#e08a1e'];
const points = ref([0, 1, 2]);
const next = (index: number) => { points.value[index] = (points.value[index]! + 1) % colors.length; };

// Compatibility: three of the checks of docs/status.json, by the start of their names.
const check = (start: string, label: string) => {
    const row = home.checks.find(candidate => candidate.area.startsWith(start));
    return row ? [{label, ...row}] : [];
};
const checks = [
    ...check('Methods of the MapLibre `Map` class', 'Methods of Map'),
    ...check('MapLibre plugins, run in a browser', 'Plugins that were run'),
    ...check('Example pages of the MapLibre documentation', 'Example pages of the MapLibre docs'),
];

// Adapters: the same map in each form.
const style = 'https://styles.map-jr.org/1/elevation.json';
const forms = [
    {id: 'vue', label: 'Vue', code: `<script setup>
import {ref} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

const view = ref({center: [8.33, 47.03], zoom: 10.6});
<\/script>

<template>
  <div style="height: 400px">
    <MapJr
      v-model:view="view"
      map-style="${style}"
      color-scheme="auto"
    />
  </div>
  <p>Zoom {{ view.zoom.toFixed(1) }}</p>
</template>`},
    {id: 'react', label: 'React', code: `import {MapJr, useMapState} from '@map-jr/map-jr-gl/react';

function Zoom() {
  const zoom = useMapState(state => state.view.zoom);
  return <p>Zoom {zoom?.toFixed(1)}</p>;
}

export function CityMap() {
  return (
    <div style={{height: 400}}>
      <MapJr
        mapStyle="${style}"
        initialView={{center: [8.33, 47.03], zoom: 10.6}}
        colorScheme="auto"
      >
        <Zoom />
      </MapJr>
    </div>
  );
}`},
    {id: 'svelte', label: 'Svelte', code: `<script>
  import {mapJr, mapState} from '@map-jr/map-jr-gl/svelte';

  let map = $state(null);
  const description = {
    style: '${style}',
    initialView: {center: [8.33, 47.03], zoom: 10.6},
    colorScheme: 'auto',
  };
  const live = $derived(map && mapState(map));
<\/script>

<div
  use:mapJr={{description, ready: instance => (map = instance)}}
  style="height: 400px"
></div>
{#if live}<p>Zoom {$live.view.zoom.toFixed(1)}</p>{/if}`},
    {id: 'element', label: '<map-jr>', code: `<script
  type="module"
  src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"
><\/script>

<map-jr
  map-style="${style}"
  center="8.33,47.03"
  zoom="10.6"
  style="height: 400px"
></map-jr>`},
    {id: 'js', label: 'JavaScript', code: `import {createMap} from '@map-jr/map-jr-gl';

const description = {
  style: '${style}',
  initialView: {center: [8.33, 47.03], zoom: 10.6},
  colorScheme: 'auto',
};
const map = createMap('map', description);

// A change is the complete description again.
map.update({...description, colorScheme: 'dark'});

// The state of the map is a store.
map.state.subscribe(
  state => state.view.zoom,
  zoom => console.log(zoom),
);`},
];
const form = ref('vue');
const formCode = computed(() => forms.find(item => item.id === form.value)!.code);

const root = useTemplateRef<HTMLElement>('root');
onMounted(() => {
    const cards = [...root.value?.querySelectorAll<HTMLElement>('.home-card') ?? []];
    if (!('IntersectionObserver' in window)) { for (const card of cards) card.dataset.seen = ''; return; }
    const observer = new IntersectionObserver(entries => {
        for (const item of entries) if (item.isIntersecting) { (item.target as HTMLElement).dataset.seen = ''; observer.unobserve(item.target); }
    }, {threshold: 0.3});
    for (const card of cards) observer.observe(card);
    onBeforeUnmount(() => observer.disconnect());
});
</script>

<template>
  <div ref="root" class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
    <!-- Size -->
    <article class="home-card" data-card="size">
      <div class="home-figure">
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="label-text text-muted">KB, gzip</span>
          <div class="home-choices" role="group" aria-label="Entry">
            <button type="button" class="home-choice" :aria-pressed="entry === 'main'" @click="entry = 'main'">Main entry</button>
            <button type="button" class="home-choice" :aria-pressed="entry === 'compat'" @click="entry = 'compat'">Compat entry</button>
          </div>
        </div>
        <div class="space-y-3 figure-text">
          <div>
            <div class="flex justify-between gap-3"><span class="text-highlighted">Map Jr. GL</span><span data-home-size>{{ kb(sizes.total) }}</span></div>
            <div class="home-bar mt-1" :title="`Page script ${kb(sizes.page)} KB, worker file ${kb(sizes.worker)} KB`">
              <div class="home-bar-part bg-primary" :style="{'--w': width(sizes.page)}" />
              <div class="home-bar-part bg-primary" :style="{'--w': width(sizes.worker)}" />
            </div>
            <div class="mt-1 text-muted">page script {{ kb(sizes.page) }} + worker file {{ kb(sizes.worker) }}</div>
          </div>
          <div>
            <div class="flex justify-between gap-3"><span class="text-highlighted">MapLibre GL JS {{ site.maplibre.version }}</span><span>{{ kb(home.sizes.maplibre.total) }}</span></div>
            <div class="home-bar mt-1" :title="`Page script and CSS ${kb(home.sizes.maplibre.page)} KB, worker file ${kb(home.sizes.maplibre.worker)} KB`">
              <div class="home-bar-part bg-inverted" :style="{'--w': width(home.sizes.maplibre.page)}" />
              <div class="home-bar-part bg-inverted" :style="{'--w': width(home.sizes.maplibre.worker)}" />
            </div>
            <div class="mt-1 text-muted">page script and CSS {{ kb(home.sizes.maplibre.page) }} + worker file {{ kb(home.sizes.maplibre.worker) }}</div>
          </div>
        </div>
      </div>
      <div class="home-card-text">
        <h3>{{ percent(sizes.total / home.sizes.maplibre.total) }} of the download</h3>
        <p>A map with <code>{{ entryName }}</code> downloads the page script and the worker file. The build of the library fails when the two are more than a third of the download of MapLibre GL JS.</p>
        <UButton to="/guide/size-and-speed" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Size and speed</UButton>
      </div>
    </article>

    <!-- Speed -->
    <article class="home-card" data-card="speed">
      <div class="home-figure">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span class="label-text text-muted">Load to idle, ms</span>
          <span class="flex gap-3 figure-text text-muted">
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-primary" />Map Jr. GL</span>
            <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full border-2 border-inverted bg-(--site-sheet)" />MapLibre GL JS</span>
          </span>
        </div>
        <div class="figure-text">
          <div v-for="row in home.speed.load" :key="row.name" class="home-speed-row" :title="`${row.name}: Map Jr. GL ${row.mapJr} ms, MapLibre GL JS ${row.maplibre} ms`">
            <span class="truncate text-muted">{{ row.name }}</span>
            <span class="relative h-4">
              <span class="absolute inset-x-0 top-1/2 border-t border-default" />
              <span class="home-speed-line" :style="{left: at(row.mapJr), '--w': `calc(${at(row.maplibre)} - ${at(row.mapJr)})`}" />
              <span class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full border-2 border-inverted bg-(--site-sheet)" :style="{left: at(row.maplibre)}" />
              <span class="absolute top-1/2 size-2.5 -translate-1/2 rounded-full bg-primary ring-2 ring-(--site-sheet)" :style="{left: at(row.mapJr)}" />
            </span>
            <span class="text-end text-highlighted">{{ row.mapJr }}<span class="text-dimmed"> / {{ row.maplibre }}</span></span>
          </div>
        </div>
      </div>
      <div class="home-card-text">
        <h3>The map draws in a worker</h3>
        <p>The page stays free for your code while the map moves. In the run of the workflow Browsers of {{ home.speed.date }}, the map was idle in {{ Math.round(home.speed.loadRatio[0]! * 100) }}% to {{ Math.round(home.speed.loadRatio[1]! * 100) }}% of the time of MapLibre GL JS. The machines of the workflow are virtual, so the figure compares the two libraries and is not the speed of a device.</p>
        <UButton to="/guide/size-and-speed#speed-in-browsers" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Speed in browsers</UButton>
      </div>
    </article>

    <!-- Markers -->
    <article class="home-card" data-card="markers">
      <div class="home-figure">
        <span class="label-text text-muted">An SVG template with a slot</span>
        <HomeCode :code="template" class="mt-2" />
        <div class="mt-3 grid grid-cols-3 gap-2">
          <button v-for="(color, index) in points" :key="index" type="button" class="home-point" :aria-label="`Point ${index + 1}: change the color`" @click="next(index)">
            <svg viewBox="0 0 24 31" class="h-9 w-7" aria-hidden="true"><path :fill="colors[color]" stroke="#fff" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z" /></svg>
            <span class="figure-text text-muted">{color: '<span class="text-highlighted">{{ colors[color] }}</span>'}</span>
          </button>
        </div>
        <p class="mt-2 figure-text text-dimmed">Press a point to change its property.</p>
      </div>
      <div class="home-card-text">
        <h3>100,000 SVG markers in one layer</h3>
        <p>A symbol layer draws a marker for each point from an SVG template, and each point fills the slots of the template from its properties. With 10,000 markers, the map moved at {{ times(home.speed.markersRatio[0]!) }} to {{ times(home.speed.markersRatio[1]!) }} times the frame rate of MapLibre GL JS with its <code>Marker</code> elements, in the same run.</p>
        <UButton to="/guide/markers-and-popups" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Markers and popups</UButton>
      </div>
    </article>

    <!-- Compatibility -->
    <article class="home-card" data-card="compat">
      <div class="home-figure">
        <HomeCode :code="importDiff" aria-label="The change of the import" />
        <div class="mt-4 space-y-2.5 figure-text">
          <div v-for="row in checks" :key="row.label">
            <div class="flex justify-between gap-3"><span class="text-muted">{{ row.label }}</span><span class="text-highlighted">{{ row.passing }} of {{ row.total }}</span></div>
            <div class="home-bar mt-1 h-1.5!"><div class="home-bar-part bg-primary" :style="{'--w': row.passing / row.total * 100 + '%'}" /></div>
          </div>
        </div>
      </div>
      <div class="home-card-text">
        <h3>Change one import</h3>
        <p>The entry <code>@map-jr/map-jr-gl/maplibre-compat</code> has the API of MapLibre GL JS {{ site.maplibre.version.split('.')[0] }}, so code and plugins that were written for that library keep their calls. The library reads the same styles.</p>
        <UButton to="/migrate/from-maplibre" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Migrate from MapLibre GL JS</UButton>
      </div>
    </article>

    <!-- Server rendering -->
    <article class="home-card" data-card="ssr">
      <div class="home-figure">
        <span class="label-text text-muted">What a visitor sees</span>
        <ol class="home-steps mt-3">
          <li><span class="home-step-mark" /><div><strong>The HTML arrives.</strong> It has the first view of the map as SVG.</div></li>
          <li><span class="home-step-mark" /><div><strong>The script and the tiles load.</strong> The SVG stays on the page.</div></li>
          <li><span class="home-step-mark" /><div><strong>The map is ready.</strong> It replaces the SVG in the same element.</div></li>
        </ol>
      </div>
      <div class="home-card-text">
        <h3>The first view from the server</h3>
        <p>The server renderer draws a view of the map as SVG without a browser, in Node.js and in Cloudflare Workers. The map at the top of this page starts as such an SVG. The same function makes an image for an email or a link preview.</p>
        <UButton to="/guide/server-rendering" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Server rendering</UButton>
      </div>
    </article>

    <!-- The reactive API and the adapters -->
    <article class="home-card" data-card="adapters">
      <div class="home-figure p-0!">
        <div class="flex overflow-x-auto border-b border-accented" role="tablist" aria-label="Form of the code">
          <button v-for="item in forms" :id="`home-form-${item.id}`" :key="item.id" type="button" role="tab" :aria-selected="form === item.id" aria-controls="home-form-code" class="home-tab shrink-0 px-3!" @click="form = item.id">{{ item.label }}</button>
        </div>
        <HomeCode id="home-form-code" :code="formCode" role="tabpanel" :aria-labelledby="`home-form-${form}`" tabindex="0" class="h-64 overflow-auto! p-4" />
      </div>
      <div class="home-card-text">
        <h3>One description, in your framework</h3>
        <p>A map is one description, and the library finds what a new description changes. The state of the map is a store that your code watches. The package has adapters for Vue, Nuxt, React and Svelte, and the element <code>&lt;map-jr&gt;</code> for a page with no framework.</p>
        <UButton to="/guide/which-entry" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Which entry to use</UButton>
      </div>
    </article>
  </div>
</template>

<style>
.home-card { display: flex; flex-direction: column; border: 1px solid var(--ui-border-accented); background: var(--ui-bg); box-shadow: 3px 3px 0 var(--ui-border); min-width: 0; }
.home-figure { padding: 1.125rem 1.25rem; background: var(--site-sheet); border-bottom: 1px solid var(--ui-border-accented); min-height: 15rem; min-width: 0; }
.home-card-text { display: flex; flex: 1; flex-direction: column; align-items: flex-start; gap: 0.625rem; padding: 1.125rem 1.25rem 1rem; }
.home-card-text h3 { font-size: 1.5rem; line-height: 1.2; color: var(--ui-text-highlighted); }
.home-card-text p { flex: 1; font-size: 0.9375rem; line-height: 1.55; color: var(--ui-text-toned); text-wrap: pretty; }
.home-card-text code, .home-list code { font-family: var(--font-mono); font-size: 0.875em; color: var(--site-code-fg); overflow-wrap: anywhere; }

/* A bar is a row of parts with a gap of the surface between them. A part grows to its width when its card is seen. */
.home-bar { display: flex; gap: 2px; height: 0.75rem; }
.home-bar-part { width: 0; border-radius: 0 2px 2px 0; transition: width 0.9s cubic-bezier(0.2, 0.7, 0.2, 1); }
[data-seen] .home-bar-part { width: var(--w); }
.home-speed-row { display: grid; grid-template-columns: 8.75rem 1fr 5.25rem; align-items: center; gap: 0.625rem; min-height: 1.375rem; }
.home-speed-line { position: absolute; top: 50%; height: 2px; width: 0; margin-top: -1px; background: var(--ui-text-dimmed); transition: width 0.9s cubic-bezier(0.2, 0.7, 0.2, 1); }
[data-seen] .home-speed-line { width: var(--w); }
.home-point { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem 0.25rem; border: 1px solid var(--ui-border); background: var(--ui-bg); min-width: 0; }
.home-point:hover { border-color: var(--ui-border-inverted); }
.home-point:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }
.home-point span { max-width: 100%; overflow-wrap: anywhere; text-align: center; }
.home-steps { display: grid; gap: 0.875rem; font-size: 0.875rem; line-height: 1.45; color: var(--ui-text-toned); }
.home-steps li { display: grid; grid-template-columns: 0.875rem 1fr; gap: 0.75rem; position: relative; }
.home-steps strong { display: block; font-weight: 600; color: var(--ui-text-highlighted); }
.home-step-mark { width: 0.875rem; height: 0.875rem; margin-top: 0.2rem; border: 2px solid var(--ui-border-inverted); background: var(--site-sheet); z-index: 1; }
.home-steps li:last-child .home-step-mark { background: var(--ui-primary); border-color: var(--ui-primary); }
.home-steps li:not(:last-child)::after { content: ''; position: absolute; left: calc(0.4375rem - 1px); top: 1.1rem; bottom: -1.1rem; border-left: 2px dashed var(--ui-border-accented); }
@media (prefers-reduced-motion: reduce) { .home-bar-part, .home-speed-line { transition: none; } }
</style>
