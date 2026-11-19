<script setup lang="ts">
import type {ContentNavigationItem} from '@nuxt/content';

const {site} = useAppConfig();
const {sections} = await useDocs();

// The navigation at the left and in the menu of a phone: each section that has pages, with its pages below it.
const navigation = computed<ContentNavigationItem[]>(() => sections.value
    .filter(section => section.pages.length)
    .map(section => ({
        title: section.title,
        path: section.path ?? section.pages[0]!.path,
        children: section.pages.map(page => ({title: page.title, path: page.path})),
    })));
provide('navigation', navigation);

// The text of the pages for the search. The browser loads it when the application has started.
const {data: files} = useLazyAsyncData('search', () => queryCollectionSearchSections('docs'), {server: false});

useHead({titleTemplate: title => title && title !== site.name ? `${title} · ${site.name}` : site.name});
useSeoMeta({description: site.description, ogSiteName: site.name});
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <SiteHeader :navigation="navigation" />
    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>
    <SiteFooter />
    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" :fuse="{resultLimit: 30}" />
    </ClientOnly>
  </UApp>
</template>
