// Changes a parsed page of docs/ for the site. The markdown is written to read well on GitHub, so two things differ:
// the first heading is the title of the page, which the site draws in the page header, and a relative link names a
// file of the repository.
//
// Nuxt Content keeps the parsed pages in website/.data/content. A change of this file does not parse them again:
// delete that folder.
import {existsSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {docsDir, routeOf, type NavSection} from './nav';

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

export function transformPage(ctx: {file: {path: string}; content: Record<string, any>}, nav: NavSection[]) {
    const body = ctx.content.body;
    if (!body || !Array.isArray(body.value)) return;
    const first = body.value[0];
    if (Array.isArray(first) && first[0] === 'h1') body.value.shift();
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
