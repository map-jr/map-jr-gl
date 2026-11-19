import {defineCollection, defineContentConfig} from '@nuxt/content';
import {docsDir, readNav} from './build/nav';

// One collection reads the markdown of docs/ in the repository, which is outside the Nuxt root. docs/nav.yml says
// which files are pages: every file of a folder that a section names, and the single files that a section lists.
const nav = readNav();
const folders = nav.filter(section => section.folder).map(section => ({cwd: docsDir, include: section.folder + '/**/*.md', prefix: '/' + section.folder}));
const files = nav.filter(section => !section.folder).flatMap(section => section.pages);

export default defineContentConfig({
    collections: {
        docs: defineCollection({
            type: 'page',
            source: [...folders, ...files.map(file => ({cwd: docsDir, include: file, prefix: '/'}))],
        }),
    },
});
