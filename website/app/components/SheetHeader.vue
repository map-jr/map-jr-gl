<!-- The header of a page, with contour lines behind it. -->
<script setup lang="ts">
defineProps<{title: string; headline?: string; description?: string}>();
</script>

<template>
  <div class="relative isolate overflow-hidden">
    <div class="contours -z-10" aria-hidden="true" />
    <UPageHeader :title="title" :headline="headline" :description="description" />
  </div>
</template>
