// Builds the gallery as a static site (for GitHub Pages). The gallery imports the library by its package name, which
// points at the built files in dist/, exactly as an application that installed the package would get it.
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    root,
    base: './', // works from any path, e.g. https://<user>.github.io/<repository>/
    resolve: {alias: {'map-jr-gl': path.join(root, '../dist/map-jr-gl.js')}},
    build: {outDir: path.join(root, '../site-dist'), emptyOutDir: true, target: 'es2022'},
});
