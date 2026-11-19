import {wrapFences} from './spike/wrap-fences';

export default defineNuxtConfig({
    compatibilityDate: '2026-11-01',
    modules: ['@nuxt/ui', '@nuxt/content', 'nuxt-llms', '@map-jr/map-jr-gl/nuxt'],
    css: ['~/assets/css/main.css'],
    content: {experimental: {sqliteConnector: 'native'}},
    llms: {domain: 'https://map-jr.example', title: 'Map Jr. GL (spike)', description: 'Spike of the docs site.'},
    hooks: {
        'content:file:afterParse'(ctx) {
            wrapFences(ctx);
        },
    },
});
