<!--
  What a reader gives up with the library. The first list follows the section "What is not available" of
  docs/reference/maplibre-differences.md, and its figures are the checks of docs/status.json (`site.home.checks`). The second
  follows "Custom layers" of that page, docs/migrate/wrappers.md and the table of docs/guide/markers-and-popups.md. The
  frame rates of the third are those of the last run of the workflow Browsers.
-->
<script setup lang="ts">
const {site} = useAppConfig();
const home = site.home;
const share = (start: string) => {
    const row = home.checks.find(candidate => candidate.area.startsWith(start));
    return row ? `${row.passing.toLocaleString('en')} of ${row.total.toLocaleString('en')}` : '';
};
const ratio = (value: number) => value.toLocaleString('en', {maximumFractionDigits: 2});
const missing = [
    'MapLibre Tiles (MLT) and projections other than Mercator and the globe.',
    'The expressions <code>within</code> and <code>distance</code>, and <code>text-writing-mode</code>.',
    'Some paint properties with a value for each feature, such as <code>line-offset</code> and <code>line-blur</code>.',
    'Validation of the style. The library warns about a layer or a property that it cannot draw.',
];
</script>

<template>
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <article class="home-limit">
      <h3>It does not do all that MapLibre GL JS does</h3>
      <p>The library draws {{ share('MapLibre render tests, the same or near') }} render tests of MapLibre GL JS the same or nearly the same, and reads {{ share('Properties of the MapLibre style specification') }} properties of the style specification. It passes {{ share('MapLibre expression tests') }} expression tests. These are not available:</p>
      <ul>
        <!-- eslint-disable-next-line vue/no-v-html -- the text of this file, not input -->
        <li v-for="item in missing" :key="item" v-html="item" />
      </ul>
      <UButton to="/reference/maplibre-differences" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Every difference from MapLibre GL JS</UButton>
    </article>

    <article class="home-limit">
      <h3>Some maps are better on the thread of the page</h3>
      <p>The worker renderer is the default. Set <code>renderer: 'main'</code> to draw on the thread of the page, as MapLibre GL JS does, in these cases:</p>
      <ul>
        <li>A custom layer, which deck.gl uses in its interleaved mode, shares the WebGL context of the page. It needs the compat entry and <code>renderer: 'main'</code>. deck.gl with <code>interleaved: true</code> is not checked.</li>
        <li>A marker or a popup that is an element of the page can trail the map by about one frame while the map moves. A symbol layer draws its markers with the map.</li>
      </ul>
      <UButton to="/guide/browser-support#what-each-renderer-needs" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">What each renderer needs</UButton>
    </article>

    <article class="home-limit">
      <h3>It is new</h3>
      <p>The version is {{ site.version }}, and a version before 1.0 can change the API.</p>
      <ul>
        <li>A browser needs WebGL 2.</li>
        <li>The frame rate of a moving map was {{ ratio(home.speed.movingRatio[0]!) }} to {{ ratio(home.speed.movingRatio[1]!) }} times that of MapLibre GL JS in the run of the workflow Browsers of {{ home.speed.date }}. It was lower in most of the browsers of that run.</li>
        <li>The server renderer draws Mercator, and it does not draw <code>heatmap</code>, <code>hillshade</code> and <code>color-relief</code> layers.</li>
      </ul>
      <UButton to="/guide/browser-support" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0">Browser support</UButton>
    </article>
  </div>
</template>

<style>
.home-limit { display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; padding: 1.25rem; border: 1px dashed var(--ui-border-inverted); background: var(--ui-bg); }
.home-limit h3 { font-size: 1.375rem; line-height: 1.2; color: var(--ui-text-highlighted); }
.home-limit p, .home-limit li { font-size: 0.9375rem; line-height: 1.55; color: var(--ui-text-toned); text-wrap: pretty; }
.home-limit ul { flex: 1; list-style: disc; padding-inline-start: 1.125rem; display: grid; gap: 0.5rem; align-content: start; }
.home-limit li::marker { color: var(--ui-text-dimmed); }
.home-limit code { font-family: var(--font-mono); font-size: 0.875em; color: var(--site-code-fg); overflow-wrap: anywhere; }
</style>
