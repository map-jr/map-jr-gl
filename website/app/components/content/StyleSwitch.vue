<!--
  The map of /styles (website/build/styles.ts writes the block): one map, buttons that choose the style and the colour
  scheme, the URL of the chosen style for Map Jr. GL or for MapLibre GL JS with one copy button, and the details of the
  style (its text, its global state and its sources with attribution). The styles come from the app config (`site.styles`). The
  query of the address keeps the choice (`?style=elevation&scheme=dark`), so a link opens the same view. The scheme
  buttons are off for a style that does not read `color-scheme`.

  The wrapper of the map has `data-map-state` ("loading", "idle" or "error"), `data-style` and `data-color-scheme`,
  which the checks read.
-->
<script setup lang="ts">
import type {StyleChoice} from '~~/build/styles';

const {site} = useAppConfig();
const styles = (site as {styles?: StyleChoice[]}).styles ?? [];
const route = useRoute();
const router = useRouter();
const colorMode = useColorMode();

const name = ref(styles[0]?.name ?? '');
const scheme = ref<'light' | 'dark'>('light');
const chosen = computed(() => styles.find(style => style.name === name.value) ?? styles[0]);
const state = ref<'loading' | 'idle' | 'error'>('loading');
const copied = ref(false);
// The text that a screen reader announces after a copy.
const status = ref('');
const urlField = useTemplateRef<HTMLElement>('urlField');
// The library of the URL in the field.
const library = ref<'map-jr' | 'maplibre'>('map-jr');
const shownUrl = computed(() => library.value === 'maplibre' && chosen.value?.maplibre ? chosen.value.maplibre.url : chosen.value?.url ?? '');
const controls = [navigationControl()];

// The choice of the address, or the first style and the colour mode of the site. The server renders the default, and
// the page reads the address once it runs, so that the first render matches.
function fromAddress() {
    const style = typeof route.query.style === 'string' ? route.query.style : '';
    name.value = styles.some(candidate => candidate.name === style) ? style : styles[0]?.name ?? '';
    const asked = route.query.scheme;
    scheme.value = asked === 'dark' || asked === 'light' ? asked : colorMode.value === 'dark' ? 'dark' : 'light';
}
// The map starts after the address is read, so that it does not load the default style first.
const ready = ref(false);
onMounted(() => { fromAddress(); ready.value = true; });
watch(() => [route.query.style, route.query.scheme], fromAddress);
// A new style or scheme draws again, and the map sends `idle` when it is ready. An `idle` of an older style can arrive
// while the new style loads, so after a change of the style an `idle` counts only after `styleload` of the new style.
const styleLoaded = ref(true);
watch(() => chosen.value?.url, () => { styleLoaded.value = false; });
watch(() => [chosen.value?.url, scheme.value], () => { state.value = 'loading'; });
function onIdle() {
    if (styleLoaded.value) state.value = 'idle';
}

function choose(next: {style?: string; scheme?: 'light' | 'dark'}) {
    const style = next.style ?? name.value;
    const wanted = next.scheme ?? scheme.value;
    if (style === name.value && wanted === scheme.value) return;
    // A choice replaces the entry of the history, so that Back leaves the page. A style without `color-scheme` has no
    // scheme in the address.
    const reads = styles.find(candidate => candidate.name === style)?.schemes;
    const {scheme: _, ...query} = route.query;
    router.replace({query: {...query, style, ...(reads ? {scheme: wanted} : {})}});
}

async function copy() {
    if (!chosen.value) return;
    try {
        await navigator.clipboard.writeText(shownUrl.value);
        copied.value = true;
        status.value = 'The URL was copied.';
        setTimeout(() => { copied.value = false; }, 2000);
    } catch (error) {
        status.value = 'The copy failed. Select the URL and copy it.';
        urlField.value?.querySelector('input')?.select();
        console.warn('[map-jr site] The copy of the URL of the style failed. Select the URL and copy it.', error);
    }
}
</script>

<template>
  <div v-if="chosen" class="my-5" data-style-switch>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Style">
      <UButton
        v-for="style in styles"
        :key="style.name"
        :label="style.title"
        :data-style-button="style.name"
        :aria-pressed="style.name === chosen.name"
        :variant="style.name === chosen.name ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        @click="choose({style: style.name})"
      />
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Colour scheme">
      <UButton
        v-for="option in (['light', 'dark'] as const)"
        :key="option"
        :label="option === 'light' ? 'Light' : 'Dark'"
        :icon="option === 'light' ? 'i-lucide-sun' : 'i-lucide-moon'"
        :data-scheme-button="option"
        :aria-pressed="chosen.schemes && option === scheme"
        :disabled="!chosen.schemes"
        :variant="chosen.schemes && option === scheme ? 'solid' : 'outline'"
        color="neutral"
        size="sm"
        @click="choose({scheme: option})"
      />
      <span v-if="!chosen.schemes" class="figure-text text-muted">This style has one look: it does not read <code>color-scheme</code>.</span>
    </div>

    <div class="mt-3 border border-inverted bg-(--site-sheet) p-1">
      <div class="h-80 border border-accented sm:h-112" :data-map-state="state" :data-style="chosen.name" :data-color-scheme="chosen.schemes ? scheme : 'light'">
        <MapJr
          v-if="ready"
          :map-style="chosen.url"
          :initial-view="homeView"
          :color-scheme="chosen.schemes ? scheme : 'light'"
          :controls="controls"
          cooperative-gestures
          @styleload="styleLoaded = true"
          @idle="onIdle"
          @error="state = 'error'"
        />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Library of the URL">
      <UButton
        v-for="option in (['map-jr', 'maplibre'] as const)"
        :key="option"
        :label="option === 'map-jr' ? 'Map Jr. GL' : 'MapLibre GL JS'"
        :data-library-button="option"
        :aria-pressed="option === library && (option === 'map-jr' || !!chosen.maplibre)"
        :disabled="option === 'maplibre' && !chosen.maplibre"
        :variant="option === library && (option === 'map-jr' || chosen.maplibre) ? 'solid' : 'outline'"
        color="neutral"
        size="xs"
        @click="library = option"
      />
    </div>
    <div class="mt-1.5 flex min-w-0 items-center gap-1.5">
      <div ref="urlField" class="min-w-0 flex-1"><UInput :model-value="shownUrl" readonly aria-label="URL of the style" class="w-full font-mono" size="sm" data-style-url @focus="(event: FocusEvent) => (event.target as HTMLInputElement).select()" /></div>
      <UButton :label="copied ? 'Copied' : 'Copy'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" color="neutral" variant="outline" size="sm" data-copy-url @click="copy" />
    </div>
    <p class="mt-1 figure-text text-muted">
      <template v-if="library === 'map-jr' || !chosen.maplibre">For Map Jr. GL.<template v-if="!chosen.maplibre"> This style has no form for MapLibre GL JS.</template></template>
      <template v-else-if="chosen.maplibre.own">For MapLibre GL JS 5.16.0 or later.</template>
      <template v-else>This is the style of OpenFreeMap for MapLibre GL JS.</template>
    </p>
    <p class="sr-only" aria-live="polite" data-copy-status>{{ status }}</p>

    <dl class="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]" data-style-details>
      <dt class="font-medium">Style</dt>
      <dd class="min-w-0">{{ chosen.text }}</dd>
      <dt class="font-medium">Global state</dt>
      <dd class="min-w-0">
        <ul v-if="chosen.state.length" class="space-y-0.5">
          <li v-for="row in chosen.state" :key="row.property"><code>{{ row.property }}</code> ({{ row.values }}): {{ row.effect }}</li>
        </ul>
        <template v-else>The style reads no global state.</template>
      </dd>
      <dt class="font-medium">Sources</dt>
      <dd class="min-w-0">
        <ul class="space-y-0.5">
          <li v-for="source in chosen.sources" :key="source.id" class="break-words">
            <code>{{ source.id }}</code> ({{ source.type }}<template v-if="source.url">, <code class="break-all">{{ source.url }}</code></template>).
            Attribution:
            <template v-if="Array.isArray(source.attribution)"><template v-for="(part, index) in source.attribution" :key="index"><a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a><template v-else>{{ part.text }}</template>{{ ' ' }}</template></template>
            <template v-else-if="source.attribution === 'tilejson'">from its TileJSON.</template>
            <template v-else>none.</template>
          </li>
        </ul>
      </dd>
    </dl>
  </div>
</template>
