import {resolve} from 'node:path';
import {defineCollection, defineContentConfig} from '@nuxt/content';

export default defineContentConfig({
    collections: {
        docs: defineCollection({
            type: 'page',
            // The markdown is outside the Nuxt root, in docs/ of the repository.
            source: {cwd: resolve(import.meta.dirname, '../docs'), include: 'spike/**/*.md', prefix: '/'},
        }),
    },
});
