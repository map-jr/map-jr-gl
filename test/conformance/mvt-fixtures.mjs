// The tiles of the `real-world` render tests (#665). MapLibre's harness serves the folder `real-world` of the package
// @mapbox/mvt-fixtures on port 2901. This module downloads that package once into .cache/mvt-fixtures-<version> and
// checks it against the integrity of the npm registry; it is not a dependency of this repository. The code of the
// package is CC0-1.0 and its tiles hold OpenStreetMap data under the ODbL 1.0, so the tiles stay in the cache and are
// never committed or built into the library.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
export const version = '4.0.0';
const tarball = `https://registry.npmjs.org/@mapbox/mvt-fixtures/-/mvt-fixtures-${version}.tgz`;
const integrity = 'sha512-FWvskVvn8/lmKvpvYbOEEd6VSrsuxM4VQTxNzWvDpNNGkGGt1DfHc1I60YpDM/7zhljhcSDKh42qHolEWohErA==';
/** The folder that holds `bangkok/`, `chicago/` and the others. */
export const dir = path.join(root, `.cache/mvt-fixtures-${version}/real-world`);

/**
 * Downloads and unpacks the package when it is missing, and returns the folder of the real-world tiles, or null when
 * the download failed (then the six tests stay skipped). The package is unpacked beside the folder and renamed when it
 * is complete, so that a run that stops partway leaves nothing broken.
 */
export function ensureFixtures() {
    if (existsSync(path.join(dir, 'bangkok'))) return dir;
    const target = path.dirname(dir), partial = target + '.partial', file = partial + '.tgz';
    try {
        rmSync(partial, {recursive: true, force: true});
        mkdirSync(partial, {recursive: true});
        execFileSync('curl', ['-sfL', '--retry', '3', '-o', file, tarball]);
        const got = 'sha512-' + createHash('sha512').update(readFileSync(file)).digest('base64');
        if (got !== integrity) throw new Error(`the download has ${got}, not ${integrity}`);
        execFileSync('tar', ['xzf', file, '-C', partial, '--strip-components=1', 'package/real-world', 'package/LICENSE-ODbL-1.0.md', 'package/LICENSE-CC0-1.0.md']);
        writeFileSync(path.join(partial, 'SOURCE.txt'), `${tarball}\n${integrity}\n`);
        rmSync(target, {recursive: true, force: true});
        renameSync(partial, target);
        return dir;
    } catch (e) {
        console.warn(`[render] Could not get @mapbox/mvt-fixtures ${version} (${e.message}); the real-world tests are skipped.`);
        return null;
    } finally {
        rmSync(file, {force: true});
        rmSync(partial, {recursive: true, force: true});
    }
}
