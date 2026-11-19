<!-- A placeholder home page: the wordmark, one sentence, a live map and the ways into the site. Issue #1120 has the pitch. -->
<script setup lang="ts">
const {site} = useAppConfig();
const {start} = await useDocs();
useSeoMeta({title: site.name, ogTitle: site.name});

const ways = [
    {title: 'Docs', description: 'How to make a map and change it, with Vue, Nuxt, React, Svelte or plain JavaScript.', to: start.value, icon: 'i-lucide-book-open'},
    {title: 'Recipes', description: 'Short answers to single tasks.', to: '/recipes', icon: 'i-lucide-list-checks'},
    {title: 'Reference', description: 'Each field of the description, each event and each method.', to: '/reference', icon: 'i-lucide-braces'},
    {title: 'Styles', description: 'The styles that the examples use.', to: '/styles', icon: 'i-lucide-layers'},
];
</script>

<template>
  <div>
    <section class="relative isolate overflow-hidden border-b border-accented">
      <div class="contours -z-10" aria-hidden="true" />
      <UContainer class="grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-20">
        <div>
          <p class="label-text font-medium text-primary">A map library for the web / v{{ site.version }}</p>
          <h1 class="mt-5 font-display text-6xl font-medium tracking-tight text-highlighted sm:text-7xl">
            Map Jr. <span class="font-mono text-[0.42em] font-medium tracking-normal text-primary">GL</span>
          </h1>
          <p class="mt-6 max-w-md text-xl text-pretty text-toned">{{ site.description }}</p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UButton :to="start" size="xl" trailing-icon="i-lucide-arrow-right">Read the docs</UButton>
            <UButton :to="site.repository" target="_blank" size="xl" color="neutral" variant="outline" icon="i-simple-icons-github">GitHub</UButton>
          </div>
          <p class="mt-8 figure-text text-muted">
            <span class="select-none text-dimmed" aria-hidden="true">$ </span>pnpm add @map-jr/map-jr-gl
          </p>
        </div>
        <MapSheet />
      </UContainer>
    </section>

    <UContainer class="py-12 lg:py-16">
      <UPageGrid class="lg:grid-cols-4">
        <UPageCard v-for="way in ways" :key="way.title" v-bind="way" variant="outline" />
      </UPageGrid>
    </UContainer>
  </div>
</template>
