// Reads docs/nav.yml, the manifest of the navigation. The configuration of Nuxt and of Nuxt Content both use it, so
// that the pages of the site and the navigation come from one list.
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parse} from 'yaml';
import {generatedDir, stylesFolder, writeStylePages} from './styles';

export const docsDir = resolve(import.meta.dirname, '../../docs');
export const navFile = resolve(docsDir, 'nav.yml');

export interface NavSection {
    title: string;
    // A folder of docs/. Every markdown file in it is a page of the section.
    folder?: string;
    // Paths of markdown files, relative to the folder (or to docs/ for a section without a folder).
    pages: string[];
    // The folder is not in docs/: the build writes it from other repositories (build/styles.ts).
    generated?: boolean;
}

function fail(message: string): never {
    throw new Error('[map-jr-gl site] docs/nav.yml: ' + message);
}

export function readNav(): NavSection[] {
    const data = parse(readFileSync(navFile, 'utf8'));
    if (!data || !Array.isArray(data.sections)) fail('the file has no list "sections".');
    return data.sections.map((section: any, index: number) => {
        if (!section || typeof section.title !== 'string') fail(`section ${index + 1} has no "title".`);
        const folder = section.folder;
        if (folder !== undefined && !/^[a-z0-9-]+$/.test(folder)) fail(`the folder "${folder}" of "${section.title}" must be the name of one folder of docs/, in lower case.`);
        const generated = section.generated === true;
        if (generated && folder !== stylesFolder) fail(`"generated" of "${section.title}" needs "folder: ${stylesFolder}", the only folder that the build writes.`);
        if (generated) writeStylePages();
        const pages = section.pages ?? [];
        if (!Array.isArray(pages)) fail(`"pages" of "${section.title}" must be a list of file names.`);
        if (!folder && !pages.length) fail(`the section "${section.title}" has no "folder" and no "pages". Give it one of them.`);
        for (const page of pages) {
            if (typeof page !== 'string' || !/^[a-z0-9-/]+\.md$/.test(page)) fail(`the page "${page}" of "${section.title}" must be the path of a .md file, in lower case.`);
            if (!folder && page.includes('/')) fail(`the page "${page}" of "${section.title}" is in a folder. Give the section a "folder", or name a file of docs/.`);
            if (!existsSync(resolve(generated ? generatedDir : docsDir, folder ?? '.', page))) fail(`the page "${page}" of "${section.title}" does not exist.`);
        }
        return {title: section.title, folder, pages, generated};
    });
}

// The folder that holds a markdown file of the site: docs/, or the folder that the build writes.
export const sourceDirOf = (file: string, nav: NavSection[]) => nav.some(section => section.generated && file.startsWith(section.folder + '/')) ? generatedDir : docsDir;

// The route of a markdown file (a path relative to docs/ or to the folder that the build writes), or undefined when the site does not show the file.
export function routeOf(file: string, nav: NavSection[]): string | undefined {
    const shown = nav.some(section => section.folder ? file.startsWith(section.folder + '/') : section.pages.includes(file));
    if (!shown || !file.endsWith('.md')) return undefined;
    return '/' + file.slice(0, -3).replace(/\/index$/, '');
}
