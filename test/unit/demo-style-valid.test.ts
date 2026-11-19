// The demo style must pass MapLibre GL JS validation, or the /ml/ pages draw an empty map and every comparison with
// them compares with nothing (#1056). The validator is the style spec that the installed maplibre-gl uses.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import demoStyle from '../../demo/style.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const specDir = path.join(realpathSync(path.join(root, 'node_modules/maplibre-gl')), '../@maplibre/maplibre-gl-style-spec');
const {validateStyleMin} = await import(pathToFileURL(path.join(specDir, 'dist/index.mjs')).href);

for (const tiles of ['https://example.com/tiles/{z}/{x}/{y}.pbf', 'https://example.com/tiles.json']) {
    test(`the demo style is valid for MapLibre GL JS (${tiles.includes('{z}') ? 'tile URL' : 'TileJSON'})`, () => {
        const errors = validateStyleMin(demoStyle(tiles, 'attribution')).map((e: {message: string}) => e.message);
        assert.deepEqual(errors, []);
    });
}
