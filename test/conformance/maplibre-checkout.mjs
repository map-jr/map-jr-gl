// The checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js that the render tests and the example pages read.
import {execFileSync} from 'node:child_process';
import {existsSync, renameSync, rmSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
export const repo = path.join(root, '.cache/maplibre-gl-js');
// The tests of one commit, so that the counts change only with this library. To take newer tests, change the commit
// here (the next run clones it again) and set the floor (--min) of test:render in package.json again.
export const commit = 'a5b3ed02bf0a87fff45a82b665a9d8a6e502c164';
const git = (args, cwd) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']}).trim();
/** Whether `dir` is a complete checkout of `commit`. */
function complete(dir) {
    if (!existsSync(path.join(dir, 'test/integration/render/tests'))) return false;
    try { return git(['rev-parse', 'HEAD'], dir) === commit; } catch { return false; }
}
/**
 * Clones the checkout at `commit` when it is missing, incomplete or of another commit, and returns its path. The clone
 * goes into a folder beside it and is renamed when it is complete, so that a run that is stopped partway leaves no
 * broken checkout (#1048).
 */
export function ensureCheckout() {
    if (complete(repo)) return repo;
    const partial = repo + '.partial';
    if (existsSync(repo)) console.warn(`[render] ${path.relative(root, repo)} is incomplete or not at ${commit.slice(0, 9)}; cloning it again.`);
    rmSync(partial, {recursive: true, force: true});
    git(['init', '-q', partial]);
    git(['fetch', '-q', '--depth', '1', 'https://github.com/maplibre/maplibre-gl-js.git', commit], partial);
    git(['checkout', '-q', 'FETCH_HEAD'], partial);
    rmSync(repo, {recursive: true, force: true});
    renameSync(partial, repo);
    return repo;
}
