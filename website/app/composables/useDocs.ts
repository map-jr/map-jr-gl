// The pages of the docs in the order of docs/nav.yml. The manifest gives the sections and the order, and the
// collection gives the title of each page (its first heading).
export interface DocsPage {
    path: string;
    title: string;
    description?: string;
    // The markdown file, relative to docs/.
    file: string;
    // The variants of the code groups of the page (website/build/variants.ts).
    variants: string[];
}

export interface DocsSection {
    title: string;
    // The route of the section, for a section that is a folder of docs/.
    path?: string;
    pages: DocsPage[];
}

export async function useDocs() {
    const {site} = useAppConfig();
    const {data} = await useAsyncData('docs-pages', () => queryCollection('docs').select('path', 'title', 'description', 'stem', 'extension', 'variants').all());

    const sections = computed<DocsSection[]>(() => site.sections.map((section) => {
        const base = section.folder ? '/' + section.folder : undefined;
        const pages = (data.value ?? [])
            .map(page => ({path: page.path, title: page.title, description: page.description, file: `${page.stem}.${page.extension}`, variants: page.variants ?? []}))
            .filter(page => base ? page.file.startsWith(section.folder + '/') : section.pages.includes(page.file));
        // The place of a page in the list of the manifest. A page of a folder that the list does not name comes last.
        const place = (page: DocsPage) => {
            const index = section.pages.indexOf(base ? page.file.slice(section.folder!.length + 1) : page.file);
            return index < 0 ? section.pages.length : index;
        };
        pages.sort((a, b) => place(a) - place(b) || a.file.localeCompare(b.file));
        return {title: section.title, path: base, pages};
    }));

    const pages = computed(() => sections.value.flatMap(section => section.pages));
    // Where "Docs" of the header leads: the first page of the first section that has pages.
    const start = computed(() => pages.value[0]?.path ?? '/');
    const sectionOf = (path: string) => sections.value.find(section => section.path === path || section.pages.some(page => page.path === path));

    return {sections, pages, start, sectionOf};
}

export function formatCoordinates([lng, lat]: [number, number]) {
    const part = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(4)}° ${value < 0 ? negative : positive}`;
    return `${part(lat, 'N', 'S')}  ${part(lng, 'E', 'W')}`;
}

// The view of the map on the home page. The footer of every page shows its centre.
export const homeView = {center: [8.33, 47.03] as [number, number], zoom: 10.6};
export const useHomeView = () => useState('home-view', () => ({...homeView}));
