<script setup lang="ts">
const route = useRoute();
const {data: page} = await useAsyncData('page-' + route.path, () => queryCollection('docs').path(route.path).first());
if (!page.value) throw createError({statusCode: 404, statusMessage: 'Page not found', fatal: true});
</script>

<template>
  <UPageBody>
    <ContentRenderer v-if="page" :value="page" />
  </UPageBody>
</template>
