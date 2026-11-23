import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {callouts} from './build/callouts';
import {formatFences, liveExamples, transformPage, repositoryUrl} from './build/markdown';
import {libraryFolder} from './build/library';
import {navFile, readNav, routeOf, sourceDirOf} from './build/nav';
import {writeStylePages} from './build/styles';
import {variantHeadScript} from './build/variants';

const nav = readNav();
const library = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'));
// The figures of the home page (docs/status.json, written by `pnpm status`): the sizes in bytes (gzip), the checks against
// MapLibre GL JS, and the last run of the workflow Browsers. The page shows no number that this file does not have.
const status = JSON.parse(readFileSync(resolve(import.meta.dirname, '../docs/status.json'), 'utf8'));
const sizeRow = (start: string) => {
    const row = status.sizes.find((candidate: {file: string}) => candidate.file.startsWith(start));
    if (!row) throw new Error(`[map-jr-gl site] docs/status.json has no size row that starts with "${start}". Run \`pnpm status\`, or change website/nuxt.config.ts.`);
    return row as {bytes: number; maplibreBytes: number};
};
const worker = sizeRow('Worker file');
const entrySizes = (name: string) => ({page: sizeRow(`Page script of \`${name}\``).bytes, worker: worker.bytes, total: sizeRow(`Page script and worker file of \`${name}\``).bytes});
const range = (values: number[]) => [Math.min(...values), Math.max(...values)];
const speedRows = status.speed.rows as {system: string; browser: string; load: Record<string, number>; moving: Record<string, number>; markers: Record<string, number>}[];
const home = {
    sizes: {
        main: entrySizes('@map-jr/map-jr-gl'),
        compat: entrySizes('@map-jr/map-jr-gl/maplibre-compat'),
        maplibre: {page: sizeRow('Page script of `@map-jr/map-jr-gl`').maplibreBytes, worker: worker.maplibreBytes, total: sizeRow('Page script and worker file of `@map-jr/map-jr-gl`').maplibreBytes},
    },
    checks: (status.compatibility as {area: string; passing: number; total: number}[]).map(({area, passing, total}) => ({area, passing, total})),
    speed: {
        date: (status.speed.date as string).slice(0, 10),
        load: speedRows.map(row => ({name: `${row.system}, ${row.browser}`, maplibre: Math.round(row.load.maplibre!), mapJr: Math.round(row.load.mapJr!)})),
        // The ratio of Map Jr. GL to MapLibre GL JS, the smallest and the largest of the rows.
        loadRatio: range(speedRows.map(row => row.load.mapJr! / row.load.maplibre!)),
        movingRatio: range(speedRows.map(row => row.moving.mapJr! / row.moving.maplibre!)),
        markersRatio: range(speedRows.map(row => row.markers.mapJr! / row.markers.maplibre!)),
    },
};

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
            script: [
                {innerHTML: variantHeadScript, tagPosition: 'head'},
                // For the review of the heading font only (remove with the choice of the font): `?font=besley`, `?font=fraunces` or
                // `?font=orelega` sets the heading font of the site, and the tab keeps the choice.
                {innerHTML: "try{var f=new URLSearchParams(location.search).get('font');if(f)sessionStorage.setItem('font',f);f=f||sessionStorage.getItem('font');if(f)document.documentElement.dataset.font=f}catch(e){}", tagPosition: 'head'},
            ],
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
            maplibre: {version: status.maplibre as string},
            home,
            sections: nav,
            // The styles of the switch of /styles (build/styles.ts).
            styles: nav.some(section => section.generated) ? writeStylePages() : [],
        },
    },
    // Each file of dist/ is a chunk of its own with "map-jr-gl" in its name, so that the network panel of the browser shows
    // which files a page fetched for the map. The code of the site and of Vue stays in other chunks.
    vite: {
        build: {
            rollupOptions: {
                output: {
                    advancedChunks: {
                        groups: [
                            // Vue is its own chunk, so that the chunk of the adapter holds only the adapter.
                            {name: 'vue-runtime', test: /\/node_modules\/(@vue\/[\w-]+|vue)\//, priority: 20},
                            {
                                name: (id: string) => {
                                    const file = /\/dist\/([\w.-]+)\.js$/.exec(id.split('?')[0]!)?.[1];
                                    return file && (!id.includes('/node_modules/') || id.includes('/node_modules/@map-jr/map-jr-gl/dist/')) ? 'map-jr-gl-' + file.replace(/^map-jr-gl-?/, '') : null;
                                },
                                priority: 10,
                            },
                        ],
                    },
                    chunkFileNames: (chunk: {name: string}) => chunk.name.startsWith('map-jr-gl-') ? '_nuxt/[name]-[hash].js' : '_nuxt/[hash].js',
                },
            },
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
            {name: 'Orelega One', provider: 'google', weights: [400], styles: ['normal']},
            // The two other heading fonts of the review (`?font=`, see the script of the head above).
            {name: 'Besley', provider: 'google', weights: [500, 600, 700], styles: ['normal']},
            {name: 'Fraunces', provider: 'google', weights: [500], styles: ['normal']},
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
                const file = [match[1] + '.md', match[1] + '/index.md'].find(candidate => routeOf(candidate, nav) && existsSync(resolve(sourceDirOf(candidate, nav), candidate)));
                if (file) route.contents = readFileSync(resolve(sourceDirOf(file, nav), file), 'utf8');
            },
        },
        prerender: {
            crawlLinks: true,
            failOnError: true,
            // The section pages exist also while their folders of docs/ are empty and nothing links to a page in them.
            routes: ['/', '/play', ...nav.filter(section => section.folder).map(section => '/' + section.folder)],
        },
    },
    hooks: {
        // The desktop and the phone form of the code (build/format.mjs), and the blocks of the examples.
        async 'content:file:beforeParse'(ctx) {
            if (ctx.file.extension === '.md' && typeof ctx.file.body === 'string') ctx.file.body = callouts(liveExamples(await formatFences(ctx.file.body)));
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
