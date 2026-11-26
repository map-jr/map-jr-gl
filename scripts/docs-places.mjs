// Fails when a markdown file of docs/ is outside the places that "Where a document goes" of docs/development.md
// names (#2252). A design, a triage table or a handoff note that an agent writes otherwise lands at the root of docs/,
// beside the folders of the user docs, and stays there after its work is done.
//
//   node scripts/docs-places.mjs
//
// It prints one line for each file that is out of place, with the place to move it to, and exits with 1 when there
// is one. `pnpm test:consistency` runs it.
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The markdown files at the root of docs/. A new one needs the owner, as a change of this list does. */
export const rootFiles = ['development.md', 'ecosystem.md', 'style-guide.md'];
/** The folders of the user docs: every markdown file below them is in its place. */
export const userFolders = ['guide', 'reference', 'recipes', 'migrate'];
/** The files of docs/agents/. A lesson goes into a section of one of them, not into a new file. */
export const agentFiles = ['coordinating.md', 'subagent-models.md', 'worker-brief.md'];

/**
 * What is wrong with the place of a markdown file, or undefined when the file is in its place.
 * @param {string} file the path of the file below docs/, with `/` between its parts
 */
export function misplaced(file) {
    const parts = file.split('/'), name = parts.at(-1);
    if (parts.length === 1) {
        return rootFiles.includes(name) ? undefined
            : 'is at the root of docs/. A note for contributors goes into docs/development/, a design into docs/development/design/, and a fault or a decision into its issue.';
    }
    if (userFolders.includes(parts[0])) return undefined;
    if (parts[0] === 'agents') {
        return parts.length === 2 && agentFiles.includes(name) ? undefined
            : 'is a new file of docs/agents/. Write the lesson into a section of coordinating.md or worker-brief.md.';
    }
    if (parts[0] === 'development' && parts.length === 2) return undefined;
    if (parts[0] === 'development' && parts[1] === 'design' && parts.length === 3) {
        return /^\d+-[a-z0-9-]+\.md$/.test(name) ? undefined
            : 'is a design without the number of its issue. Name it <issue>-<name>.md, for example 1740-globe-atmosphere.md.';
    }
    return 'is in a folder that "Where a document goes" of docs/development.md does not name.';
}

/** The markdown files below a folder, as paths relative to it with `/` between the parts. */
const walk = (dir, prefix = '') => readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name), `${prefix}${e.name}/`) : e.name.endsWith('.md') ? [prefix + e.name] : []);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const found = walk(path.join(root, 'docs')).sort().flatMap(file => {
        const why = misplaced(file);
        return why ? [`docs/${file}: this file ${why}`] : [];
    });
    for (const line of found) console.log(line);
    if (found.length) {
        console.log(`docs-places: ${found.length} markdown file(s) of docs/ are out of place. See "Where a document goes" in docs/development.md.`);
        process.exit(1);
    }
}
