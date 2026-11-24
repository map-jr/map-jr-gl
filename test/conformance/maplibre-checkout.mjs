// The checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js that the render tests and the example pages read.
import {execSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
export const repo = path.join(root, '.cache/maplibre-gl-js');
// The tests of one commit, so that the counts change only with this library. To take newer tests, change the commit
// here, delete the folder in .cache, and set the floor (--min) of test:render in package.json again.
export const commit = 'a5b3ed02bf0a87fff45a82b665a9d8a6e502c164';
/** Clones the checkout at `commit` when it is missing, and returns its path. */
export function ensureCheckout() {
    if (!existsSync(repo)) execSync(`git init -q "${repo}" && git -C "${repo}" fetch -q --depth 1 https://github.com/maplibre/maplibre-gl-js.git ${commit} && git -C "${repo}" checkout -q FETCH_HEAD`, {stdio: 'inherit'});
    return repo;
}
