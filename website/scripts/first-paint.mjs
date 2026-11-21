// Renders the first paint of the home page (an SVG with the credits over it) and writes it to app/assets/home-first-paint.html,
// which HomeMap.vue puts into the page. The site build does not render it, so the build needs no network (#1391).
// Run it when the first scene of app/utils/home-scenes.ts or the renderer changes: `pnpm --dir website first-paint`
// (it needs `pnpm build` in the root of the repository, and the network). `--check` renders again and exits with 1 when
// the file differs.
import {readFileSync, writeFileSync} from 'node:fs';
import {renderFirstView} from '../../dist/server.js';

const file = new URL('../app/assets/home-first-paint.html', import.meta.url);
// The first scene (`stopScenes.hero` of app/utils/home-scenes.ts).
const html = await renderFirstView({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    center: [8.33, 47.03], zoom: 10.6, width: 1280, height: 800,
    colorScheme: 'light', timeout: 120000, requestTimeout: 30000,
});
if (!/^<svg[^>]*data-map-jr-ssr/.test(html)) throw new Error('[map-jr-gl site] first-paint: the render has no SVG.');
if (process.argv.includes('--check')) {
    const same = readFileSync(file, 'utf8') === html;
    console.log(same ? 'The first paint is current.' : 'The first paint differs from a new render. Run "pnpm --dir website first-paint".');
    process.exit(same ? 0 : 1);
}
writeFileSync(file, html);
console.log(`Wrote ${file.pathname}: ${html.length} bytes`);
