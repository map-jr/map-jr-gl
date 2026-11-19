// The variants of the code on the docs pages (docs/style-guide.md, "Variants"). A fence names its variant by its
// label (```vue [Vue]). The site joins adjacent fences with labels of one set into one group, and the reader's choice
// holds for every group of that set on the site.
//
// There are two sets, each with its own choice:
// - the code variants: the seven ways to write the same map;
// - the package managers: the install command for npm, pnpm, yarn and bun.
//
// The build, the components of the site and the script in the head of each page use this file. It has no imports,
// so that it runs in each of them.

export interface Variant {
    // The label of the fence, without the brackets.
    label: string;
    // The value of the attribute of <html> and of `localStorage`.
    slug: string;
}

export interface VariantSet {
    id: 'code' | 'pm';
    variants: Variant[];
    // The key of `localStorage`.
    key: string;
    // The attribute of <html> that the script in the head sets, and the attribute of a panel that lists the choices
    // that show it.
    attribute: string;
    showsAttribute: string;
    // The variant that a group shows when it lacks the choice, by choice. Without an entry, `fallback` when the group
    // has it, and otherwise the first variant of the group.
    nearest: Record<string, string>;
    fallback?: string;
    // The name of the tab list, for a screen reader.
    name: string;
    // Whether the menu in the header lists the variants of this set.
    menu: boolean;
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

export const packageManagers: Variant[] = [
    {label: 'npm', slug: 'npm'},
    {label: 'pnpm', slug: 'pnpm'},
    {label: 'yarn', slug: 'yarn'},
    {label: 'bun', slug: 'bun'},
];

export const codeSet: VariantSet = {
    id: 'code', variants, key: 'map-jr-docs-variant', attribute: 'data-variant', showsAttribute: 'data-shows',
    // Vue for Nuxt and Nuxt for Vue, because the code of the two is almost the same.
    nearest: {nuxt: 'vue', vue: 'nuxt'}, name: 'Variant of the code', menu: true,
};

export const packageManagerSet: VariantSet = {
    id: 'pm', variants: packageManagers, key: 'map-jr-docs-package-manager', attribute: 'data-package-manager',
    showsAttribute: 'data-shows-pm', nearest: {}, fallback: 'npm', name: 'Package manager', menu: false,
};

export const variantSets: VariantSet[] = [codeSet, packageManagerSet];
export const variantKey = codeSet.key;

export const setOfId = (id: unknown) => variantSets.find(set => set.id === id) ?? codeSet;
// The set and the variant of a label of a fence.
export function variantOfLabel(label: unknown): (Variant & {set: VariantSet}) | undefined {
    for (const set of variantSets) {
        const variant = set.variants.find(variant => variant.label === label);
        if (variant) return {...variant, set};
    }
}
export const variantOfSlug = (slug: unknown, set: VariantSet = codeSet) => set.variants.find(variant => variant.slug === slug);

// The variant that a group with the variants `available` (slugs, in the order of the page) shows when the reader
// chose `choice`. A group that lacks the choice shows the nearest variant of the set, then its fallback, and
// otherwise its first variant. The choice stays as it is.
export function shownVariant(available: string[], choice: string | null | undefined, set: VariantSet = codeSet): string | undefined {
    if (choice && available.includes(choice)) return choice;
    const near = choice ? set.nearest[choice] : undefined;
    if (near && available.includes(near)) return near;
    if (set.fallback && available.includes(set.fallback)) return set.fallback;
    return available[0];
}

// For each variant of a group, the choices that show it, separated by spaces. The variant that shows with no choice
// also has "none", for a reader who has not chosen. CSS shows an element whose attribute `showsAttribute` contains
// the value of `attribute` of <html>, so that the first paint shows the reader's variant with no script of the page.
export function showsOf(available: string[], set: VariantSet = codeSet): Record<string, string> {
    const shows: Record<string, string[]> = Object.fromEntries(available.map(slug => [slug, []]));
    for (const choice of set.variants) {
        const shown = shownVariant(available, choice.slug, set);
        if (shown) shows[shown]!.push(choice.slug);
    }
    const none = shownVariant(available, null, set);
    if (none) shows[none]!.push('none');
    return Object.fromEntries(Object.entries(shows).map(([slug, list]) => [slug, list.join(' ')]));
}

// The script in the head of each page. It runs before the first paint and sets the attribute of each set on <html>
// from `localStorage`, or "none" when the reader has not chosen or the storage is blocked.
export const variantHeadScript = `(function(){var s=${JSON.stringify(variantSets.map(set => [set.key, set.attribute, set.variants.map(variant => variant.slug)]))};for(var i=0;i<s.length;i++){var v='none';try{v=localStorage.getItem(s[i][0])||v}catch(e){}if(s[i][2].indexOf(v)<0)v='none';document.documentElement.setAttribute(s[i][1],v)}})()`;
