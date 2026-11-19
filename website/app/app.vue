<script setup lang="ts">
const {data: navigation} = await useAsyncData('navigation', () => queryCollectionNavigation('docs'));
const {data: files} = useLazyAsyncData('search', () => queryCollectionSearchSections('docs'), {server: false});
provide('navigation', navigation);
</script>

<template>
  <UApp>
    <UHeader title="Map Jr. GL spike">
      <template #right>
        <UContentSearchButton />
      </template>
    </UHeader>
    <UMain>
      <UContainer>
        <UPage>
          <template #left>
            <UPageAside>
              <UContentNavigation :navigation="navigation" />
              <NuxtLink id="to-map" to="/map">Map</NuxtLink>
            </UPageAside>
          </template>
          <NuxtPage />
        </UPage>
      </UContainer>
    </UMain>
    <ClientOnly>
      <LazyUContentSearch :files="files" :navigation="navigation" />
    </ClientOnly>
  </UApp>
</template>
