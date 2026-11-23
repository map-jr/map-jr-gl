import {defineCollection, defineContentConfig, z} from '@nuxt/content';
import {docsDir, readNav} from './build/nav';
import {generatedDir} from './build/styles';

// One collection reads the markdown of docs/ in the repository, which is outside the Nuxt root. docs/nav.yml says
// which files are pages: every file of a folder that a section names, and the single files that a section lists. The
// folder of a section with "generated" is in website/.data/generated/ (build/styles.ts writes it).
const nav = readNav();
const folders = nav.filter(section => section.folder).map(section => ({cwd: section.generated ? generatedDir : docsDir, include: section.folder + '/**/*.md', prefix: '/' + section.folder}));
const files = nav.filter(section => !section.folder).flatMap(section => section.pages);

export default defineContentConfig({
    collections: {
        docs: defineCollection({
            type: 'page',
            source: [...folders, ...files.map(file => ({cwd: docsDir, include: file, prefix: '/'}))],
            // The variants of the code groups of the page, in the order of the page. website/build/markdown.ts sets it.
            // `editUrl` is where "Edit this page" leads for a page that another repository owns (build/styles.ts).
            schema: z.object({variants: z.array(z.string()).optional(), editUrl: z.string().optional()}),
        }),
    },
});
