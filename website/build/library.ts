// The files of the library that the map frames of the site load (app/utils/map-frame.ts): the development build of
// the four entries that the examples import, from dist/ of this commit, and every file that they load (their chunks and
// the worker file). nuxt.config.ts serves the folder that `libraryFolder` returns at /lib/.
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const dist = resolve(import.meta.dirname, '../../dist');
const entries = ['map-jr-gl.dev.js', 'map-jr-gl-maplibre-compat.dev.js', 'controls.dev.js', 'element.dev.js'];

/** Copies the files into a folder of node_modules/.cache and returns the folder. */
export function libraryFolder(): string {
    if (!existsSync(resolve(dist, entries[0]!))) throw new Error(`[map-jr-gl site] ${dist} has no ${entries[0]}. Run "pnpm build" in the root of the repository first.`);
    const folder = resolve(import.meta.dirname, '../node_modules/.cache/map-jr-gl-lib');
    rmSync(folder, {recursive: true, force: true});
    mkdirSync(folder, {recursive: true});
    // A file names each file that it loads as "./<name>.js": in an import, and in `new URL(…, import.meta.url)`.
    const files = new Set(entries);
    for (const file of files) {
        copyFileSync(resolve(dist, file), resolve(folder, file));
        for (const [, name] of readFileSync(resolve(dist, file), 'utf8').matchAll(/["'`]\.\/([\w.-]+\.js)(?:\?[\w=-]*)?["'`]/g)) if (existsSync(resolve(dist, name!))) files.add(name!);
    }
    return folder;
}
