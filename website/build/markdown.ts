// Changes a parsed page of docs/ for the site. The markdown is written to read well on GitHub, so these things differ:
//
// - The first heading is the title of the page, which the site draws in the page header.
// - A relative link names a file of the repository. It becomes the route of a page, or the file on GitHub.
// - Adjacent fences with the label of a variant (```vue [Vue]) become one group (`code-variants`,
//   app/components/content/CodeVariants.vue). The bold line with the label before each fence, which GitHub needs, is
//   removed. A single fence with such a label keeps the label as its caption. `variants` of the page lists the
//   variants of its groups, for the control in the header. Fences with the label of a package manager (```sh [npm])
//   become a group of their own set, which has its own choice and is not in the header.
// - A table with the columns Name, Type, Default and Description is a reference table: each row has an id and a link
//   to itself, and "**required**" is a mark.
//
// Nuxt Content keeps the parsed pages in website/.data/content. A change of this file does not parse them again:
// delete that folder.
import {existsSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {docsDir, routeOf, type NavSection} from './nav';
import {showsOf, variantOfLabel, type VariantSet} from './variants';

const repository = resolve(docsDir, '..');
export const repositoryUrl = 'https://github.com/map-jr/map-jr-gl';

// A node of the body is a string or [tag, props, ...children].
type Node = string | [string, Record<string, any>, ...Node[]];

// Where a relative link of a page leads on the site: the route of a page, or the file on GitHub when the site does
// not show it. Nuxt Content has removed ".md" from the link before this runs.
export function linkTarget(href: string, file: string, nav: NavSection[]): string | undefined {
    if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return undefined;
    const [path = '', hash = ''] = href.split(/(?=#)/);
    const target = resolve(dirname(file), path);
    const found = [target + '.md', target].find(candidate => existsSync(candidate));
    if (!found) return undefined;
    const route = routeOf(relative(docsDir, found), nav);
    if (route) return route + hash;
    return `${repositoryUrl}/blob/main/${relative(repository, found)}${hash}`;
}

const textOf = (node: Node): string => typeof node === 'string' ? node : node.slice(2).map(child => textOf(child as Node)).join('');

// The variant of a fence, from its label.
const variantOfFence = (node: Node | undefined) => Array.isArray(node) && node[0] === 'pre' ? variantOfLabel(node[1]?.filename) : undefined;

// Whether a node is the bold line that names `label`: **Vue**, or **`<map-jr>`** for the element.
function isLabelLine(node: Node | undefined, label: string): boolean {
    if (!Array.isArray(node) || node[0] !== 'p' || node.length !== 3) return false;
    const strong = node[2];
    if (!Array.isArray(strong) || strong[0] !== 'strong' || strong.length !== 3) return false;
    const inner = strong[2]!;
    if (typeof inner === 'string') return inner.trim() === label;
    return inner[0] === 'code' && inner.length === 3 && inner[2] === label;
}

// Joins the fences of each run of `nodes` into groups, also inside lists and quotes. A run is a list of fences with
// a variant label, each with or without its bold line directly before it. A label that comes again starts a new run.
function groupFences(nodes: Node[], state: {groups: number; variants: string[]}): Node[] {
    const out: Node[] = [];
    for (let i = 0; i < nodes.length;) {
        const run: Node[] = [];
        const slugs: string[] = [];
        let set: VariantSet | undefined;
        while (i < nodes.length) {
            const lined = !variantOfFence(nodes[i]) && variantOfFence(nodes[i + 1]) && isLabelLine(nodes[i], variantOfFence(nodes[i + 1])!.label);
            const fence = lined ? nodes[i + 1]! : nodes[i]!;
            const variant = variantOfFence(fence);
            if (!variant || slugs.includes(variant.slug) || (set && variant.set !== set)) break;
            set = variant.set;
            run.push(fence);
            slugs.push(variant.slug);
            i += lined ? 2 : 1;
        }
        if (run.length === 1) out.push(run[0]!);
        if (run.length > 1) {
            const id = `variants-${++state.groups}`;
            const shows = showsOf(slugs, set);
            out.push(['code-variants', {id, variants: slugs.join(' '), ...(set!.id === 'code' ? {} : {set: set!.id})}, ...run.map((fence, index): Node => {
                const [, {filename, ...props}, ...children] = fence as [string, Record<string, any>, ...Node[]];
                const slug = slugs[index]!;
                return ['div', {class: 'code-variant', id: `${id}-${slug}`, role: 'tabpanel', 'aria-labelledby': `${id}-tab-${slug}`, 'data-variant': slug, [set!.showsAttribute]: shows[slug]}, ['pre', props, ...children]];
            })]);
            if (set!.menu) for (const slug of slugs) if (!state.variants.includes(slug)) state.variants.push(slug);
        }
        if (run.length) continue;
        const node = nodes[i++]!;
        out.push(Array.isArray(node) && node[0] !== 'pre' ? [node[0], node[1], ...groupFences(node.slice(2) as Node[], state)] : node);
    }
    return out;
}

const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const referenceColumns = ['Name', 'Type', 'Default', 'Description'];

// Marks the reference tables of a page. A row gets the id "<heading>-<name>": the id of the heading above the table
// and the name of the row, for example "mapdescription-style".
function markReferenceTables(nodes: Node[]) {
    let heading = '';
    const used = new Set<string>();
    for (const node of nodes) {
        if (!Array.isArray(node)) continue;
        if (/^h[1-6]$/.test(node[0]) && typeof node[1]?.id === 'string') heading = node[1].id;
        if (node[0] !== 'table') continue;
        const [, props, ...parts] = node;
        const head = parts.find(part => Array.isArray(part) && part[0] === 'thead') as Node[] | undefined;
        const columns = (head?.[2] as Node[] | undefined)?.slice(2).map(cell => textOf(cell).trim()) ?? [];
        if (columns.join('|') !== referenceColumns.join('|')) continue;
        props.class = 'reference-table';
        const body = parts.find(part => Array.isArray(part) && part[0] === 'tbody') as Node[] | undefined;
        for (const row of (body?.slice(2) ?? []) as [string, Record<string, any>, ...Node[]][]) {
            const cells = row.slice(2) as [string, Record<string, any>, ...Node[]][];
            cells.forEach((cell, index) => { cell[1]['data-label'] = columns[index]; });
            const name = cells[0];
            if (!name) continue;
            const code = (function find(list: Node[]): Node | undefined {
                for (const child of list) {
                    if (!Array.isArray(child)) continue;
                    if (child[0] === 'code') return child;
                    const found = find(child.slice(2) as Node[]);
                    if (found) return found;
                }
            })(name.slice(2) as Node[]);
            const base = [heading, slugOf(textOf(code ?? name))].filter(Boolean).join('-') || 'row';
            let id = base;
            for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
            used.add(id);
            row[1].id = id;
            const marked = (name.slice(2) as Node[]).map(child => Array.isArray(child) && child[0] === 'strong' && textOf(child).trim() === 'required'
                ? ['span', {class: 'reference-required'}, 'required'] as Node : child);
            name.splice(2, name.length, ['a', {href: '#' + id, class: 'reference-anchor', 'aria-label': `Link to the row ${textOf(code ?? name).trim()}`}, '#'], ...marked);
        }
    }
}

export function transformPage(ctx: {file: {path: string}; content: Record<string, any>}, nav: NavSection[]) {
    const body = ctx.content.body;
    if (!body || !Array.isArray(body.value)) return;
    const first = body.value[0];
    if (Array.isArray(first) && first[0] === 'h1') body.value.shift();
    const state = {groups: 0, variants: [] as string[]};
    body.value = groupFences(body.value, state);
    ctx.content.variants = state.variants;
    markReferenceTables(body.value);
    const missing: string[] = [];
    const walk = (node: Node) => {
        if (typeof node === 'string') return;
        const [tag, props, ...children] = node;
        if (tag === 'a' && typeof props?.href === 'string') {
            const target = linkTarget(props.href, ctx.file.path, nav);
            if (target) props.href = target;
            else if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(props.href)) missing.push(props.href);
        }
        children.forEach(walk);
    };
    body.value.forEach(walk);
    if (missing.length) console.warn(`[map-jr-gl site] ${relative(repository, ctx.file.path)}: no file for the link${missing.length > 1 ? 's' : ''} ${missing.map(href => `"${href}"`).join(', ')}.`);
}
