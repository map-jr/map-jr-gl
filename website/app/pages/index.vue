<!--
  The home page (issue #1120): one live map fills the stage behind the text, and each stop of the scroll is one argument for
  switching, with a place for the camera to go to. The first paint is the SVG of the server renderer (components/home/
  HomeMap.vue). The map takes no scroll, wheel or key until "Explore the map" is pressed. Without WebGL 2 the SVG stays,
  and the text of every stop still works. Stop 5 of the plan, the race of the two libraries, is not on the page yet.
-->
<script setup lang="ts">
import {playScene, playText, showcases, stopScenes, type Scene} from '~/utils/home-scenes';

const {site} = useAppConfig();
const {start} = await useDocs();
useSeoMeta({title: site.name, ogTitle: site.name});

const ways = [
    {title: 'Docs', description: 'How to make a map and change it, with Vue, Nuxt, React, Svelte or plain JavaScript.', to: start.value, icon: 'i-lucide-book-open'},
    {title: 'Recipes', description: 'Short answers to single tasks.', to: '/recipes', icon: 'i-lucide-list-checks'},
    {title: 'Reference', description: 'Each field of the description, each event and each method.', to: '/reference', icon: 'i-lucide-braces'},
    {title: 'Styles', description: 'The styles that the examples use.', to: '/styles', icon: 'i-lucide-layers'},
];

// The stops, in the order of the page. `stop` is the one that crosses the middle of the screen.
const stops = ['hero', 'scale', 'compat', 'play', 'showcase', 'limits', 'install'] as const;
type Stop = typeof stops[number];
const stop = ref<Stop>('hero');
const scene = shallowRef<Scene>(stopScenes.hero);
const playScene_ = shallowRef<Scene>(playScene(playText));
const showcase = useTemplateRef<{show: () => void}>('showcase');
const measure = ref<{idleMs: number; bytes: number; files: number}>();
const mapState = ref('loading');
const nearPlay = ref(false);
const exploring = ref(false);

function enter(next: Stop) {
    stop.value = next;
    if (next === 'play') { nearPlay.value = true; scene.value = playScene_.value; }
    else if (next === 'showcase') showcase.value?.show();
    else scene.value = stopScenes[next];
}
function onPlay(next: Scene) {
    playScene_.value = next;
    if (stop.value === 'play') scene.value = next;
}

let observer: IntersectionObserver | undefined;
onMounted(() => {
    // The stop that crosses the middle line of the screen is the active one. The editor loads one screen early.
    observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            const name = (entry.target as HTMLElement).dataset.stop as Stop;
            if (entry.isIntersecting && stop.value !== name) enter(name);
        }
    }, {rootMargin: '-50% 0px -50% 0px'});
    for (const element of document.querySelectorAll('[data-stop]')) observer.observe(element);
    const early = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { nearPlay.value = true; early.disconnect(); } }, {rootMargin: '100% 0px'});
    const play = document.querySelector('[data-stop="play"]');
    if (play) early.observe(play);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    document.documentElement.style.overflow = '';
});

function explore(on: boolean) {
    exploring.value = on;
    document.documentElement.style.overflow = on ? 'hidden' : '';
}
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && exploring.value) explore(false); };
onMounted(() => addEventListener('keydown', onKey));
onBeforeUnmount(() => removeEventListener('keydown', onKey));

const card = 'pointer-events-auto w-full border border-inverted bg-default/90 p-5 backdrop-blur-sm sm:p-6';
const section = 'pointer-events-none flex min-h-[calc(100svh-var(--ui-header-height))] items-end pb-20 sm:items-center sm:pb-0';
</script>

<template>
  <div>
    <div class="relative border-b border-accented">
      <div class="sticky top-(--ui-header-height) h-[calc(100svh-var(--ui-header-height))] overflow-hidden">
        <HomeMap :scene="scene" :exploring="exploring" @measure="measure = $event" @state="mapState = $event" />
        <div class="absolute left-3 top-3">
          <UButton
            size="lg" :color="exploring ? 'primary' : 'neutral'" :variant="exploring ? 'solid' : 'subtle'" class="shadow-lg"
            :icon="exploring ? 'i-lucide-arrow-left' : 'i-lucide-move'" :aria-pressed="exploring" data-explore
            @click="explore(!exploring)"
          >{{ exploring ? 'Back to the page' : 'Explore the map' }}</UButton>
        </div>
      </div>

      <div class="pointer-events-none relative -mt-[calc(100svh-var(--ui-header-height))]" :class="exploring ? 'invisible' : ''" :inert="exploring">
        <UContainer class="pointer-events-none">
          <section data-stop="hero" :class="section">
            <div :class="[card, 'max-w-xl']">
              <p class="label-text font-medium text-primary">A map library for the web / v{{ site.version }}</p>
              <h1 class="mt-4 font-display text-5xl font-medium tracking-tight text-highlighted sm:text-6xl">
                Map Jr. <span class="font-mono text-[0.42em] font-medium tracking-normal text-primary">GL</span>
              </h1>
              <p class="mt-4 max-w-md text-lg text-pretty text-toned">{{ site.description }}</p>
              <div class="mt-6 flex flex-wrap gap-3">
                <UButton :to="start" size="lg" trailing-icon="i-lucide-arrow-right">Read the docs</UButton>
                <UButton :to="site.repository" target="_blank" size="lg" color="neutral" variant="outline" icon="i-simple-icons-github">GitHub</UButton>
              </div>
            </div>
          </section>
          <section data-stop="scale" :class="section"><div :class="[card, 'max-w-lg']"><HomeScale :measure="measure" /></div></section>
          <section data-stop="compat" :class="section"><div :class="[card, 'max-w-xl']"><HomeCompat /></div></section>
          <section data-stop="play" :class="section"><div :class="[card, 'max-w-xl']"><HomePlay :near="nearPlay" @scene="onPlay" /></div></section>
          <section data-stop="showcase" :class="section"><div :class="[card, 'max-w-lg']"><HomeShowcase ref="showcase" @scene="scene = $event" /></div></section>
          <section data-stop="limits" :class="section"><div :class="[card, 'max-w-lg']"><HomeLimits /></div></section>
          <section data-stop="install" :class="section"><div :class="[card, 'max-w-lg']"><HomeInstall /></div></section>
        </UContainer>
      </div>

    </div>

    <UContainer class="py-12 lg:py-16">
      <UPageGrid class="lg:grid-cols-4">
        <UPageCard v-for="way in ways" :key="way.title" v-bind="way" variant="outline" />
      </UPageGrid>
    </UContainer>
  </div>
</template>
