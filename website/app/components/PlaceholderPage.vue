<!-- A page of the header that has no content yet. -->
<script setup lang="ts">
const props = defineProps<{title: string; text: string; issue: number}>();
const {site} = useAppConfig();
const {start} = await useDocs();
useSeoMeta({title: props.title});
</script>

<template>
  <UContainer>
    <SheetHeader :title="title" headline="Not here yet" />
    <UPageBody>
      <p class="max-w-prose text-lg text-muted">{{ text }}</p>
      <div class="flex flex-wrap gap-3">
        <UButton :to="start" trailing-icon="i-lucide-arrow-right">Read the docs</UButton>
        <UButton :to="`${site.repository}/issues/${issue}`" target="_blank" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-up-right">
          Issue #{{ issue }}
        </UButton>
      </div>
    </UPageBody>
  </UContainer>
</template>
