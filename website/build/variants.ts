// The variants of the code on the docs pages: the seven ways to write the same map (docs/style-guide.md,
// "Variants"). A fence names its variant by its label (```vue [Vue]). The site joins adjacent fences with a label
// into one group, and the reader's choice holds for every group of the site.
//
// The build, the components of the site and the script in the head of each page use this file. It has no imports,
// so that it runs in each of them.

export interface Variant {
    // The label of the fence, without the brackets.
    label: string;
    // The value of the attribute `data-variant` of <html> and of `localStorage`.
    slug: string;
}

export const variants: Variant[] = [
    {label: 'Main API', slug: 'main'},
    {label: 'MapLibre compat', slug: 'compat'},
    {label: 'Vue', slug: 'vue'},
    {label: 'Nuxt', slug: 'nuxt'},
    {label: 'React', slug: 'react'},
    {label: 'Svelte', slug: 'svelte'},
    {label: '<map-jr>', slug: 'element'},
];

export const variantKey = 'map-jr-docs-variant';

export const variantOfLabel = (label: unknown) => variants.find(variant => variant.label === label);
export const variantOfSlug = (slug: unknown) => variants.find(variant => variant.slug === slug);

// The variant that a group with the variants `available` (slugs, in the order of the page) shows when the reader
// chose `choice`. A group that lacks the choice shows the nearest variant: Vue for Nuxt and Nuxt for Vue, because
// the code of the two is almost the same, and otherwise the first variant of the group. The choice stays as it is.
const nearest: Record<string, string> = {nuxt: 'vue', vue: 'nuxt'};
export function shownVariant(available: string[], choice: string | null | undefined): string | undefined {
    if (choice && available.includes(choice)) return choice;
    const near = choice ? nearest[choice] : undefined;
    if (near && available.includes(near)) return near;
    return available[0];
}

// For each variant of a group, the choices that show it, separated by spaces. The first variant also has "none",
// for a reader who has not chosen. CSS shows an element whose attribute `data-shows` contains the value of
// `data-variant` of <html>, so that the first paint shows the reader's variant with no script of the page.
export function showsOf(available: string[]): Record<string, string> {
    const shows: Record<string, string[]> = Object.fromEntries(available.map(slug => [slug, []]));
    for (const choice of variants) {
        const shown = shownVariant(available, choice.slug);
        if (shown) shows[shown]!.push(choice.slug);
    }
    if (available[0]) shows[available[0]]!.push('none');
    return Object.fromEntries(Object.entries(shows).map(([slug, list]) => [slug, list.join(' ')]));
}

// The script in the head of each page. It runs before the first paint and sets `data-variant` on <html> from
// `localStorage`, or "none" when the reader has not chosen or the storage is blocked.
export const variantHeadScript = `(function(){var v='none';try{v=localStorage.getItem(${JSON.stringify(variantKey)})||v}catch(e){}if(!/^(${variants.map(variant => variant.slug).join('|')})$/.test(v))v='none';document.documentElement.setAttribute('data-variant',v)})()`;
