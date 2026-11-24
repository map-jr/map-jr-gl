// The names that each entry of the library exports, read from the built files in dist/. test/examples.mjs and
// test/doc-snippets.mjs use them to find an import of a name that the package does not have.
import {readFileSync} from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '../dist');
// The names that each entry of the library has, from its built file.
const exportsOf = file => { const code = readFileSync(path.join(dist, file), 'utf8'), last = [...code.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(p => p.trim().split(/\s+as\s+/).pop())); return new Set(last.filter(Boolean)); };
const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8'));
export const entries = Object.fromEntries(Object.entries(pkg.exports).filter(([k, v]) => !k.includes('*') && v.default?.endsWith('.js')).map(([key, v]) => ['@map-jr/map-jr-gl' + key.slice(1), exportsOf(v.default.replace('./dist/', ''))]));
export const unknownImports = code => [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](@map-jr\/map-jr-gl[^'"]*)['"]/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(n => !/^type\s/.test(n)).filter(n => n && !entries[m[2]]?.has(n)).map(n => `${n} from ${m[2]}`));

