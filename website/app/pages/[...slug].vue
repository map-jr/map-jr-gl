<!-- A page of docs/, or the list of the pages of a section when the folder of the section has no index.md. -->
<script setup lang="ts">
definePageMeta({layout: 'docs'});

const route = useRoute();
const {site} = useAppConfig();
const {pages, sections, sectionOf} = await useDocs();

// A static server can answer with a trailing slash.
const path = route.path.replace(/(.)\/$/, '$1');
const {data: page} = await useAsyncData('page-' + path, () => queryCollection('docs').path(path).first());
const section = computed(() => sectionOf(path));
if (!page.value && section.value?.path !== path) throw createError({statusCode: 404, statusMessage: 'Page not found', fatal: true});

const entry = computed(() => pages.value.find(candidate => candidate.path === path));
const surround = computed(() => {
    const index = pages.value.findIndex(candidate => candidate.path === path);
    if (index < 0) return undefined;
    const link = (found?: {path: string; title: string}) => found ? {path: found.path, title: found.title, description: sectionOf(found.path)?.title ?? ''} : null;
    return [link(pages.value[index - 1]), link(pages.value[index + 1])];
});
// "Copy page as markdown" and "Copy migration prompt" put the raw markdown of /raw/ on the clipboard. The prompt is the
// block of docs/migrate/prompt.md, without its page. `copied` names the button that shows "Copied" for two seconds.
const copied = ref('');
async function copyRaw(name: string, file: string, block = false) {
    const read = async () => {
        const text = await $fetch<string>(`/raw/${file}`, {responseType: 'text'});
        return block ? /^```[^\n]*\n([\s\S]*?)\n```$/m.exec(text)?.[1] ?? text : text;
    };
    try {
        // The clipboard write starts inside the click and takes the text as a promise. Safari refuses a write that
        // starts after an `await` of the fetch, because the click no longer counts as the reason for it.
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
            await navigator.clipboard.write([new ClipboardItem({'text/plain': read().then(text => new Blob([text], {type: 'text/plain'}))})]);
        } else {
            await navigator.clipboard.writeText(await read());
        }
        copied.value = name;
        setTimeout(() => { if (copied.value === name) copied.value = ''; }, 2000);
    } catch (error) {
        console.warn(`[map-jr site] "${name}": the copy failed, so the page opens /raw/${file}.`, error);
        window.open(`/raw/${file}`, '_blank');
    }
}
const links = computed(() => {
    if (!entry.value) return [];
    const report = new URLSearchParams({
        title: `Docs: ${entry.value.title}`,
        body: `Page: ${site.url}${path}\n\nWhat is wrong or missing:\n`,
    });
    return [
        {label: copied.value === 'page' ? 'Copied' : 'Copy page as markdown', icon: copied.value === 'page' ? 'i-lucide-check' : 'i-lucide-copy', onClick: () => copyRaw('page', entry.value!.file)},
        {label: copied.value === 'prompt' ? 'Copied' : 'Copy migration prompt', icon: copied.value === 'prompt' ? 'i-lucide-check' : 'i-lucide-sparkles', onClick: () => copyRaw('prompt', 'migrate/prompt.md', true)},
        {label: 'Edit this page', icon: 'i-lucide-pencil', to: `${site.repository}/edit/main/docs/${entry.value.file}`, target: '_blank'},
        {label: 'Report a problem with this page', icon: 'i-lucide-flag', to: `${site.repository}/issues/new?${report}`, target: '_blank'},
    ];
});
// One active entry in the table of contents (#1251). The classes of each link replace the ones that the scroll-spy of
// `UContentToc` gives, which marks every heading on the screen.
type TocLink = {id: string; text: string; class?: string; children?: TocLink[]};
const {active: activeHeading, open: tocOpen, choose: chooseHeading} = useTocActive(() => page.value?.body?.toc?.links as TocLink[] | undefined);
const tocLinks = computed(() => {
    const mark = (list: TocLink[]): TocLink[] => list.map(link => ({
        ...link,
        class: link.id === activeHeading.value ? 'text-primary toc-active' : 'text-muted hover:text-default',
        children: link.children && mark(link.children),
    }));
    return mark((page.value?.body?.toc?.links ?? []) as TocLink[]);
});
const firstWithPages = computed(() => sections.value.find(candidate => candidate.pages.length));

const title = computed(() => page.value?.title ?? section.value!.title);
useSeoMeta({title, ogTitle: title, description: () => page.value?.description ?? site.description});
</script>

<template>
  <UPage v-if="page" :ui="{center: 'lg:col-span-7', right: 'lg:col-span-3 order-first lg:order-last'}">
    <SheetHeader :title="page.title" :headline="section?.title" />

    <UPageBody>
      <ContentRenderer :value="page" />

      <USeparator v-if="surround" />
      <UContentSurround v-if="surround" :surround="surround as any" />
      <UPageLinks :links="links" class="lg:hidden" />
    </UPageBody>

    <template v-if="page.body?.toc?.links?.length" #right>
      <UContentToc v-model:open="tocOpen" :links="tocLinks" title="On this page" @move="chooseHeading">
        <template #bottom>
          <UPageLinks title="This page" :links="links" :ui="{title: 'label-text font-medium text-muted', link: 'text-[0.8125rem] items-start', linkLeadingIcon: 'size-4 mt-0.5', linkLabel: () => 'min-w-0', linkLabelExternalIcon: 'hidden'}" />
        </template>
      </UContentToc>
    </template>
  </UPage>

  <UPage v-else-if="section">
    <SheetHeader :title="section.title" headline="Section" />
    <UPageBody>
      <UPageGrid v-if="section.pages.length">
        <UPageCard v-for="item in section.pages" :key="item.path" :to="item.path" :title="item.title" :description="item.description" variant="outline" />
      </UPageGrid>
      <template v-else>
        <p class="text-muted">
          This section has no pages yet.
          <template v-if="firstWithPages">Until it has, read the section "{{ firstWithPages.title }}".</template>
        </p>
        <UButton v-if="firstWithPages" :to="firstWithPages.pages[0]!.path" trailing-icon="i-lucide-arrow-right" color="neutral" variant="outline">
          {{ firstWithPages.title }}
        </UButton>
      </template>
    </UPageBody>
  </UPage>
</template>
