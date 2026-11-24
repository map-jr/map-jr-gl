// The check of consistency finds the props of the component MapJr, and not those of MapOverlay, which come first in
// src/vue.ts (#716). The test runs the check on a copy where a field of the description is a prop of MapOverlay only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

test('a field of the description that is a prop of MapOverlay only is reported as missing from MapJr', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'consistency-'));
    try {
        for (const entry of readdirSync(root)) if (entry !== 'src' && entry !== 'scripts') symlinkSync(path.join(root, entry), path.join(dir, entry));
        mkdirSync(path.join(dir, 'scripts'));
        copyFileSync(path.join(root, 'scripts/check-consistency.mjs'), path.join(dir, 'scripts/check-consistency.mjs'));
        mkdirSync(path.join(dir, 'src'));
        for (const entry of readdirSync(path.join(root, 'src'))) if (entry !== 'vue.ts') symlinkSync(path.join(root, 'src', entry), path.join(dir, 'src', entry));
        let vue = readFileSync(path.join(root, 'src/vue.ts'), 'utf8');
        const mapJr = vue.indexOf("name: 'MapJr'");
        const prop = "        images: Object as PropType<MapDescription['images']>,\n";
        assert.ok(vue.indexOf(prop, mapJr) > mapJr, 'the prop images of MapJr is in src/vue.ts');
        vue = vue.slice(0, mapJr) + vue.slice(mapJr).replace(prop, '');
        const overlay = "    name: 'MapOverlay',\n    props: {\n";
        assert.ok(vue.includes(overlay), 'the props of MapOverlay are in src/vue.ts');
        vue = vue.replace(overlay, overlay + '        images: Object,\n');
        writeFileSync(path.join(dir, 'src/vue.ts'), vue);
        const run = spawnSync(process.execPath, [path.join(dir, 'scripts/check-consistency.mjs')], {encoding: 'utf8'});
        assert.match(run.stdout + run.stderr, /the component MapJr has no prop for the field `images`/);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});
