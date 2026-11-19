<script setup lang="ts">
const {site} = useAppConfig();
const view = useHomeView();

const links = [
    {label: 'GitHub', to: site.repository},
    {label: 'npm', to: 'https://www.npmjs.com/package/@map-jr/map-jr-gl'},
    {label: 'Changelog', to: `${site.repository}/blob/main/CHANGELOG.md`},
    {label: 'Licence (MIT)', to: `${site.repository}/blob/main/LICENSE`},
];
</script>

<template>
  <footer class="relative isolate overflow-hidden mt-8">
    <div class="graduated-rule" aria-hidden="true" />
    <div class="contours contours-rising -z-10" aria-hidden="true" />
    <UContainer class="py-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <SiteWordmark />
        <p class="text-sm text-muted max-w-md">
          {{ site.description }} A project of Sam Margulies and whatismyelevation.com.
        </p>
      </div>
      <div class="space-y-3 lg:text-end">
        <ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:justify-end">
          <li v-for="link in links" :key="link.to">
            <ULink :to="link.to" target="_blank" class="underline-offset-4 hover:underline">{{ link.label }}</ULink>
          </li>
        </ul>
        <!-- The centre of the map on the home page. It follows the map while the visitor moves it. -->
        <p class="figure-text text-muted whitespace-pre-wrap">
          <NuxtLink to="/" class="hover:text-default" aria-label="The centre of the map on the home page">{{ formatCoordinates(view.center) }}</NuxtLink>
          <span class="mx-2" aria-hidden="true">/</span>v{{ site.version }}
        </p>
      </div>
    </UContainer>
  </footer>
</template>
