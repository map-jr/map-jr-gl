<script setup lang="ts">
import type {ContentNavigationItem} from '@nuxt/content';
import type {NavigationMenuItem} from '@nuxt/ui';

const props = defineProps<{navigation: ContentNavigationItem[]}>();
const route = useRoute();
const {site} = useAppConfig();
const {start} = await useDocs();

const inSection = (path: string) => route.path === path || route.path.startsWith(path + '/');
const items = computed<NavigationMenuItem[]>(() => {
    const other = ['/recipes', '/reference', '/styles', '/play'].some(inSection);
    return [
        {label: 'Docs', to: start.value, active: route.path !== '/' && !other},
        {label: 'Recipes', to: '/recipes', active: inSection('/recipes')},
        {label: 'Reference', to: '/reference', active: inSection('/reference')},
        {label: 'Styles', to: '/styles', active: inSection('/styles')},
        {label: 'Play', to: '/play', active: inSection('/play')},
    ];
});
</script>

<template>
  <UHeader to="/" :toggle="{'aria-label': 'Open the menu'}">
    <template #title>
      <SiteWordmark />
      <span class="sr-only">Map Jr. GL, home</span>
    </template>

    <UNavigationMenu :items="items" variant="link" aria-label="Site" />

    <template #right>
      <VariantMenu />
      <UContentSearchButton :collapsed="false" class="hidden xl:inline-flex w-56" />
      <UContentSearchButton class="xl:hidden" />
      <UColorModeButton />
      <UButton
        :to="site.repository" target="_blank" icon="i-simple-icons-github" color="neutral" variant="ghost"
        aria-label="Map Jr. GL on GitHub"
      />
      <UButton
        :to="`${site.repository}/blob/main/CHANGELOG.md`" target="_blank" color="neutral" variant="outline" size="xs"
        class="hidden sm:inline-flex figure-text" :aria-label="`Version ${site.version}: the changelog on GitHub`"
      >
        v{{ site.version }}
      </UButton>
    </template>

    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" class="-mx-2.5" aria-label="Site" />
      <USeparator class="my-5" />
      <UContentNavigation :navigation="props.navigation" :collapsible="false" highlight />
      <p class="mt-6 figure-text text-muted">Version {{ site.version }}</p>
    </template>
  </UHeader>
</template>
