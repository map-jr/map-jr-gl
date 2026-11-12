// Checks the package as npm would publish it. Run after a build (`pnpm build` or `node build.mjs`): pnpm test:package
//
//   1. Packs the tarball with `pnpm pack` and runs `publint` on it. A warning of publint is a failure.
//   2. Each file that `exports`, `module` and `types` of package.json name is in the tarball.
//   3. No image of docs/images is in the tarball, and each image of the README has an absolute URL: npm shows the
//      README without the images of the repository.
//   4. Each built file that names a source map has that map in the tarball, and the map points at the right lines of
//      src/: each string of ten or more plain characters in a built file is looked up through the map, and the text
//      must be on that line of the source file.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {SourceMap} from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, '.cache/package'), failures = [];
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
// (On Windows, pnpm is a script that only a shell can start.)
const run = (command, args) => execFileSync(command, args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32'});

rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
const tarball = path.join(out, 'package.tgz');
run('pnpm', ['pack', '--out', tarball]);
// (Each path in the tarball starts with `package/`.)
const packed = new Set(run('tar', ['-tzf', tarball]).split('\n').filter(Boolean).map(f => f.replace(/^package\//, '')));

try { console.log(run('pnpm', ['exec', 'publint', 'run', tarball, '--strict']).trim()); } catch { failures.push('publint reports a fault in the tarball (see its output above)'); }

const named = new Map();
const collect = (value, where) => { if (typeof value === 'string') named.set(value.replace(/^\.\//, ''), where); else for (const [k, v] of Object.entries(value ?? {})) collect(v, `${where} > ${k}`); };
collect(pkg.exports, 'exports'); collect(pkg.module, 'module'); collect(pkg.types, 'types');
for (const [file, where] of named) if (!packed.has(file)) failures.push(`${where} names ${file}, which is not in the tarball`);
for (const [key, value] of Object.entries(pkg.exports)) if (key !== './package.json' && !value?.types) failures.push(`exports > ${key} has no "types"`);

const images = [...packed].filter(f => f.startsWith('docs/images/') || /\.(jpe?g|png|gif|webp|avif)$/i.test(f));
if (images.length) failures.push(`the tarball has ${images.length} images (${images[0]}): leave them out with "files" in package.json`);
for (const m of readFileSync(path.join(root, 'README.md'), 'utf8').matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)|<img\b[^>]*?\bsrc=["']?([^"'\s>]+)/g)) {
    const url = m[1] ?? m[2];
    if (!/^https:\/\//.test(url)) failures.push(`README.md shows the image ${url} by a relative path, which npm cannot show: write https://raw.githubusercontent.com/map-jr/map-jr-gl/main/${url.replace(/^\.\//, '')}`);
}

let messages = 0, maps = 0;
for (const file of [...packed].filter(f => /^dist\/[^/]+\.js$/.test(f))) {
    const code = readFileSync(path.join(root, file), 'utf8'), url = /\n\/\/# sourceMappingURL=(\S+)\s*$/.exec(code)?.[1];
    // (A built file that only passes the exports of other files on has no map.)
    if (!url) { if (code.length > 2000) failures.push(`${file} names no source map`); continue; }
    const mapFile = path.posix.join(path.posix.dirname(file), url);
    if (!packed.has(mapFile)) { failures.push(`${file} names ${url}, which is not in the tarball`); continue; }
    const map = new SourceMap(JSON.parse(readFileSync(path.join(root, mapFile), 'utf8'))), lines = code.split('\n'), sources = new Map();
    maps++;
    lines.forEach((line, i) => {
        for (const m of line.matchAll(/(?<!\\)(["`])([A-Za-z][\w -]{9,})\1/g)) {
            const entry = map.findEntry(i, m.index);
            if (!entry.originalSource) { failures.push(`${mapFile} has no entry for the string "${m[2]}" of ${file}`); continue; }
            const source = path.resolve(root, path.dirname(mapFile), entry.originalSource.replace(/^file:\/\//, ''));
            // (Only the files of the library: the build changes nothing in the files of a dependency.)
            if (path.dirname(source) !== path.join(root, 'src')) continue;
            if (!sources.has(source)) sources.set(source, readFileSync(source, 'utf8').split('\n'));
            // (The minifier copies the value of a constant to where another file uses it. Such a string is not in the file.)
            if (!sources.get(source).some(l => l.includes(m[2]))) continue;
            messages++;
            if (!sources.get(source)[entry.originalLine]?.includes(m[2])) failures.push(`${mapFile} puts the string "${m[2]}" of ${file} at ${path.relative(root, source)}:${entry.originalLine + 1}, and it is not there`);
        }
    });
}
if (!messages) failures.push('no string was found in the built files, so the source maps were not checked');

if (failures.length) { console.error('FAIL  the package is not ready to publish:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log(`ok    the tarball has ${packed.size} files in ${(statSync(tarball).size / 1024).toFixed(0)} KB: ${named.size} files that package.json names, and ${maps} source maps, which place ${messages} strings on their lines of src/`);
