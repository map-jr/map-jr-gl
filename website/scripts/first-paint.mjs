// Renders the first paint of the home page and writes two files, so that the build needs no network (#1391):
// - app/assets/home-first-paint.html: an SVG of 1000 by 1000 CSS pixels with the credits, which HomeMap.vue puts into the
//   page. It covers a window up to 1000 px wide and 1060 px high (phones and tablets), whose stage is at most 1000 by 1000.
// - public/home-first-paint-wide.svg: an SVG of 2560 by 1600, for wider or higher windows. The page loads it only there
//   (a preload and a background image, both with the media query of HomeMap.vue).
// Both have the centre and the zoom of the live map's first view, and the page sets them at 1:1 CSS pixels, centred on the
// stage, which crops them, so the first paint has the scale and the centre of the live map at every size (#1393).
// Run it when the first scene of app/utils/home-scenes.ts or the renderer changes: `pnpm --dir website first-paint` (it needs
// `pnpm build` in the root of the repository, and the network). `--check` renders again and exits with 1 when a file differs.
import {readFileSync, writeFileSync} from 'node:fs';
import {renderFirstView} from '../../dist/server.js';

const small = {file: new URL('../app/assets/home-first-paint.html', import.meta.url), width: 1000, height: 1000};
const wide = {file: new URL('../public/home-first-paint-wide.svg', import.meta.url), width: 2560, height: 1600};
const render = ({width, height}) => renderFirstView({
    // The first scene (`stopScenes.hero` of app/utils/home-scenes.ts).
    style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [8.33, 47.03], zoom: 10.6, width, height,
    colorScheme: 'light', timeout: 120000, requestTimeout: 30000,
});
// The SVG and the credits that come after it.
const split = html => {
    const end = html.indexOf('</svg>') + '</svg>'.length;
    if (!/^<svg[^>]*data-map-jr-ssr/.test(html) || end < 6) throw new Error('[map-jr-gl site] first-paint: the render has no SVG.');
    return {svg: html.slice(0, end), credits: html.slice(end)};
};
const place = 'position:absolute;inset:0;width:100%;height:100%';

const [a, b] = await Promise.all([render(small), render(wide)]);
const inline = split(a);
if (!inline.svg.includes(`style="${place}"`)) throw new Error('[map-jr-gl site] first-paint: the style of the SVG root is not the one that this script replaces.');
const centred = `position:absolute;left:50%;top:50%;width:${small.width}px;height:${small.height}px;margin:-${small.height / 2}px 0 0 -${small.width / 2}px;max-width:none`;
const files = new Map([
    [small.file, `<div class="home-first-small">${inline.svg.replace(`style="${place}"`, `style="${centred}"`)}</div>${inline.credits}`],
    [wide.file, split(b).svg.replace(`style="${place}"`, '').replace(' data-map-jr-ssr=""', '')],
]);
if (process.argv.includes('--check')) {
    const same = [...files].every(([file, text]) => readFileSync(file, 'utf8') === text);
    console.log(same ? 'The first paint is current.' : 'The first paint differs from a new render. Run "pnpm --dir website first-paint".');
    process.exit(same ? 0 : 1);
}
for (const [file, text] of files) {
    writeFileSync(file, text);
    console.log(`Wrote ${file.pathname}: ${Buffer.byteLength(text)} bytes`);
}
