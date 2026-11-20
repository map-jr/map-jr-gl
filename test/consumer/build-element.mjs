// Builds test/consumer/element.html, a page that only imports `@map-jr/map-jr-gl/element`, with esbuild and with Vite
// (#1256). `packageDir` is the package that `@map-jr/map-jr-gl` resolves to: the unpacked tarball or the repository.
// The bundlers follow the link to it, so its package.json ("sideEffects" included) applies. Returns {esbuild, Vite}:
// the folder of each build, each with an element.html.
import {cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';

export async function buildElementPages(packageDir, out) {
    rmSync(out, {recursive: true, force: true});
    const app = path.join(out, 'app'), scope = path.join(app, 'node_modules', '@map-jr');
    mkdirSync(scope, {recursive: true});
    for (const f of ['package.json', 'element.html', 'element.js']) cpSync(path.join(import.meta.dirname, f), path.join(app, f));
    symlinkSync(path.resolve(packageDir), path.join(scope, 'map-jr-gl'), 'dir');
    const dirs = {esbuild: path.join(out, 'esbuild'), Vite: path.join(out, 'vite')};
    const esbuild = await import('esbuild');
    await esbuild.build({absWorkingDir: app, entryPoints: ['element.js'], bundle: true, format: 'esm', splitting: true, minify: true, outdir: dirs.esbuild, logLevel: 'error'});
    writeFileSync(path.join(dirs.esbuild, 'element.html'), readFileSync(path.join(app, 'element.html'), 'utf8'));
    const {build} = await import('vite');
    await build({root: app, configFile: false, logLevel: 'error', mode: 'production', base: './', build: {outDir: dirs.Vite, emptyOutDir: true, modulePreload: {polyfill: false}, rollupOptions: {input: path.join(app, 'element.html')}}});
    return dirs;
}
