<script setup lang="ts">
import type {NuxtError} from '#app';

const props = defineProps<{error: NuxtError}>();
const missing = computed(() => props.error.statusCode === 404);
useSeoMeta({title: () => missing.value ? 'Page not found' : 'Error'});
</script>

<template>
  <UApp>
    <UContainer class="min-h-svh flex flex-col justify-center py-16">
      <NuxtLink to="/" aria-label="Map Jr. GL, home"><SiteWordmark /></NuxtLink>
      <SheetHeader
        :title="missing ? 'This place is not on the map' : 'The page failed'"
        :headline="String(error.statusCode)"
        :description="missing ? 'No page has this address. It may have moved.' : error.statusMessage"
      />
      <div class="mt-8 flex flex-wrap gap-3">
        <UButton trailing-icon="i-lucide-arrow-right" @click="clearError({redirect: '/'})">Go to the home page</UButton>
      </div>
    </UContainer>
  </UApp>
</template>
