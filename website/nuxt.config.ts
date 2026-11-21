import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {formatFences, liveExamples, transformPage, repositoryUrl} from './build/markdown';
import {libraryFolder} from './build/library';
import {docsDir, navFile, readNav, routeOf} from './build/nav';
import {variantHeadScript} from './build/variants';

const nav = readNav();
const library = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'));
// The download of MapLibre GL JS that the home page shows (docs/status.json, written by `pnpm status`): the page script
// with its CSS and the worker file, in bytes (gzip).
const status = JSON.parse(readFileSync(resolve(import.meta.dirname, '../docs/status.json'), 'utf8'));
const maplibreBytes = status.sizes.find((row: {file: string}) => row.file.startsWith('Page script and worker file of `@map-jr/map-jr-gl`')).maplibreBytes as number;

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
            maplibre: {version: status.maplibre as string, bytes: maplibreBytes},
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
        // /llms-full.txt has the text of every page. Each page is also at /raw/<page>.md.
        full: {title: 'Complete documentation', description: 'The text of every page of this site in one file.'},
        notes: [
            'To move a project from MapLibre GL JS, give an agent the prompt at https://map-jr.org/raw/migrate/prompt.md.',
            'The package has the same pages as markdown in node_modules/@map-jr/map-jr-gl/docs/, and AGENTS.md for agents.',
        ],
    },
    fonts: {
        families: [
            {name: 'Fraunces', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic']},
            {name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic']},
            {name: 'IBM Plex Mono', provider: 'google', weights: [400, 500], styles: ['normal']},
        ],
    },
    icon: {clientBundle: {scan: true}},
    // The library for the map frames of the recipes and of /play (app/utils/map-frame.ts). The frames have an opaque
    // origin, so the files need CORS: public/_headers sets the header on the published site, and the rule below in
    // `nuxt dev`.
    routeRules: {'/lib/**': {headers: {'access-control-allow-origin': '*'}}},
    nitro: {
        publicAssets: [{dir: libraryFolder(), baseURL: '/lib', maxAge: 0}],
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
        // The desktop and the phone form of the code (build/format.mjs), and the blocks of the examples.
        async 'content:file:beforeParse'(ctx) {
            if (ctx.file.extension === '.md' && typeof ctx.file.body === 'string') ctx.file.body = liveExamples(await formatFences(ctx.file.body));
        },
        'content:file:afterParse'(ctx) {
            transformPage(ctx as any, nav);
        },
        // A page does not prefetch the editor (CodeMirror) and the map frames: the editor loads when the reader asks for
        // it, and the frames only on a page that shows one (#1121).
        'build:manifest'(manifest) {
            for (const entry of Object.values(manifest)) if (['CodeEditor', 'MapFrame', 'LiveExample'].includes(entry.name ?? '')) entry.prefetch = false;
        },
    },
});
