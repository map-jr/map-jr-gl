import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {transformPage, repositoryUrl} from './build/markdown';
import {navFile, readNav} from './build/nav';
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
    content: {experimental: {sqliteConnector: 'native'}},
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
