import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {transformPage, repositoryUrl} from './build/markdown';
import {docsDir, navFile, readNav, routeOf} from './build/nav';
import {variantHeadScript} from './build/variants';

const nav = readNav();
const library = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'));

export default defineNuxtConfig({
    compatibilityDate: '2026-11-01',
    // @nuxt/content comes after @nuxt/ui, so that the markdown uses the prose components of Nuxt UI.
    modules: ['@nuxt/ui', '@nuxt/content', 'nuxt-llms', '@map-jr/map-jr-gl/nuxt'],
    css: ['~/assets/css/main.css'],
    app: {
        head: {
            htmlAttrs: {lang: 'en'},
            link: [{rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg'}],
            meta: [{name: 'color-scheme', content: 'light dark'}],
            // Sets the reader's variant of the code on <html> before the first paint (build/variants.ts).
            script: [{innerHTML: variantHeadScript, tagPosition: 'head'}],
        },
    },
    // What the application reads at run time: the navigation of docs/nav.yml and the version of the library.
    appConfig: {
        site: {
            name: 'Map Jr. GL',
            url: 'https://map-jr.org',
            description: 'A small, fast map library for the web. It reads MapLibre styles.',
            repository: repositoryUrl,
            version: library.version as string,
            sections: nav,
        },
    },
    // A change of the manifest starts the development server again, because the collection is made from it.
    watch: [navFile],
    // The native connector needs no build of better-sqlite3.
    // The themes of the code keep every token at 4.5:1 or more on the sheets (#1209). The colour mode sets the class
    // `light` or `dark` on <html>, and each key names the theme for that class (`default` is for neither). All three
    // keys are set because Nuxt UI gives its own theme to each of them.
    content: {
        experimental: {sqliteConnector: 'native'},
        build: {markdown: {highlight: {theme: {light: 'github-light-default', default: 'github-light-default', dark: 'github-dark-default'},
            // The languages of the fences of docs/. The default list of Nuxt Content has no shell and no Svelte.
            langs: ['bash', 'css', 'html', 'js', 'json', 'jsx', 'markdown', 'sh', 'shellscript', 'svelte', 'ts', 'vue']}}},
    },
    llms: {
        domain: 'https://map-jr.org',
        title: 'Map Jr. GL',
        description: 'A small, fast map library for the web. It reads MapLibre styles.',
    },
    fonts: {
        families: [
            {name: 'Fraunces', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic']},
            {name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic']},
            {name: 'IBM Plex Mono', provider: 'google', weights: [400, 500], styles: ['normal']},
        ],
    },
    icon: {clientBundle: {scan: true}},
    nitro: {
        hooks: {
            // /raw/<page>.md serves the markdown of the page for agents (Nuxt Content writes it from the parsed page,
            // with the changes of build/markdown.ts). The site writes the source file in its place, unchanged.
            'prerender:generate'(route) {
                const match = /^\/raw\/(.+)\.md$/.exec(route.route);
                if (!match || route.error) return;
                const file = [match[1] + '.md', match[1] + '/index.md'].find(candidate => routeOf(candidate, nav) && existsSync(resolve(docsDir, candidate)));
                if (file) route.contents = readFileSync(resolve(docsDir, file), 'utf8');
            },
        },
        prerender: {
            crawlLinks: true,
            failOnError: true,
            // The section pages exist also while their folders of docs/ are empty and nothing links to a page in them.
            routes: ['/', '/styles', '/play', ...nav.filter(section => section.folder).map(section => '/' + section.folder)],
        },
    },
    hooks: {
        'content:file:afterParse'(ctx) {
            transformPage(ctx as any, nav);
        },
    },
});
