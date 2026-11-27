// The build renames each `.name` of an internal name (scripts/private-names.mjs), so it must stop when an export of a
// module has that name: a call `module.name()` would be renamed to a function that does not exist (#475).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {privateNames, shortenShaderLocals} from '../../scripts/private-names.mjs';

const fixtures = path.join(import.meta.dirname, 'fixtures/private-names-export');

test('private-names: an internal name that is also an export stops the build and names both', () => {
    assert.throws(() => privateNames(fixtures, ['setLocationAt']), /internal member "setLocationAt" has the name of the export "setLocationAt" of src\/b\.ts/);
});

test('private-names: an internal name that src/ also reads from the WebGL context stops the build (#1948)', () => {
    // (The name `depthRange` of the transform would be renamed in `gl.depthRange(0, 1)` of the custom layers too.)
    assert.throws(() => privateNames(fixtures, ['depthRange']), /internal member "depthRange" is also read from the WebGL context/);
});

test('private-names: the names of src/ pass the check', () => {
    assert.ok(privateNames().size > 0);
});

test('private-names: a protected method that another file overrides gets the same name in each file (#2049)', async () => {
    // (The engine has a private member with the same name. Each file is renamed on its own, by one table of names.)
    const {shortenPrivateNames} = await import('../../scripts/private-names.mjs');
    const dir = path.join(import.meta.dirname, 'fixtures/private-names-protected'), [plugin] = shortenPrivateNames(dir, []);
    const built = Object.fromEntries(['map.ts', 'compat-map.ts', 'engine.ts'].map(f => [f, plugin.transform(readFileSync(path.join(dir, f), 'utf8'), path.join(dir, f)).code]));
    const base = /protected (\w+)\(id: string\) \{ return id; \}/.exec(built['map.ts'])?.[1];
    assert.ok(base, built['map.ts']);
    assert.match(built['map.ts'], new RegExp(`this\\.${base}\\(id\\)`));
    assert.match(built['compat-map.ts'], new RegExp(`protected override ${base}\\(id: string\\)`));
});

test('private-names: the later names of a declaration of several variables in a shader get short names, and a name that is called does not (#2342)', () => {
    const code = 'const fs = `uniform float u_k; float edge(float x) { return x; }\nvoid main() { float far = 1.0, side = sign(far), near = edge(side) * ${N}.0, inner[2], edge2 = max(side, near); vec2 q = vec2(side, near), mix = q; float k = mix(q.x, q.y, u_k); }`;';
    const out: string = shortenShaderLocals(code);
    for (const name of ['far', 'side', 'near', 'inner', 'edge2', 'edge']) assert.doesNotMatch(out, new RegExp(`\\b${name}\\b`), out);
    // (`mix` is a function of GLSL: a name that the shaders call keeps its name.)
    assert.match(out, /, mix = q; float \w+ = mix\(/, out);
    assert.match(out, /uniform float u_k;/);
    assert.match(out, /\$\{N\}\.0/);
});
