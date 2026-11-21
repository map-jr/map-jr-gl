// Renders the first paint of the home page and writes four files, so that the build needs no network (#1391):
// - app/assets/home-first-paint.html: an SVG of 1000 by 1000 CSS pixels, and the controls of the map, which HomeMap.vue puts
//   into the page. The controls (and the credits) are not part of the picture: they sit at the corners of the stage, as in the live map,
//   so the file has them as a layer of their own, in two forms (the credits are folded up to 640 px wide, as the map folds them), each in the light and in the dark colours
//   (a few hundred bytes more after gzip, because the two layers differ in one class). It covers a window up to 1000 px wide and 1060 px high (phones and tablets), whose stage is at most 1000 by 1000.
// - public/home-first-paint-wide.svg: an SVG of 2560 by 1600, for wider or higher windows. The page loads it only there
//   (a preload and a background image, both with the media query of HomeMap.vue).
// - public/home-first-paint-dark.svg and public/home-first-paint-wide-dark.svg: the same two pictures in the dark colours. The live map
//   follows the colour mode of the site, and its style reads the global state `color-scheme`. The server renderer does not set that state,
//   so the script gives the style as an object with the default `dark`. Only a page with the class `dark` on <html> (the colour mode of the
//   site sets it in the head, before the first paint) shows and fetches them (HomeMap.vue).
// Both have the centre and the zoom of the live map's first view, and the page sets them at 1:1 CSS pixels, centred on the
// stage, which crops them, so the first paint has the scale and the centre of the live map at every size (#1393).
// Run it when the first scene of app/utils/home-scenes.ts or the renderer changes: `pnpm --dir website first-paint` (it needs
// `pnpm build` in the root of the repository, and the network). `--check` renders again and exits with 1 when a file differs.
import {readFileSync, writeFileSync} from 'node:fs';
import {renderFirstView} from '../../dist/server.js';
import {navigation, scale} from '../../dist/controls.js';

const small = {file: new URL('../app/assets/home-first-paint.html', import.meta.url), width: 1000, height: 1000};
const wide = {file: new URL('../public/home-first-paint-wide.svg', import.meta.url), width: 2560, height: 1600};
const smallDark = {file: new URL('../public/home-first-paint-dark.svg', import.meta.url), width: 1000, height: 1000};
const wideDark = {file: new URL('../public/home-first-paint-wide-dark.svg', import.meta.url), width: 2560, height: 1600};
const styleUrl = 'https://styles.map-jr.org/1/elevation-zero.json';
const darkStyle = await (await fetch(styleUrl)).json();
if (darkStyle.state?.['color-scheme']?.default !== 'light') throw new Error('[map-jr-gl site] first-paint: the style has no state "color-scheme" with the default "light".');
darkStyle.state['color-scheme'].default = 'dark';
const render = ({width, height}, controls, colorScheme = 'light') => renderFirstView({
    // The first scene (`stopScenes.hero` of app/utils/home-scenes.ts).
    style: colorScheme === 'dark' ? darkStyle : styleUrl, center: [8.33, 47.03], zoom: 10.6, width, height,
    colorScheme, timeout: 120000, requestTimeout: 30000, ...(controls && {controls: [navigation(), scale()]}),
});
// The SVG and the credits that come after it.
const split = html => {
    const end = html.indexOf('</svg>') + '</svg>'.length;
    if (!/^<svg[^>]*data-map-jr-ssr/.test(html) || end < 6) throw new Error('[map-jr-gl site] first-paint: the render has no SVG.');
    return {svg: html.slice(0, end), credits: html.slice(end)};
};
const place = 'position:absolute;inset:0;width:100%;height:100%';

const [a, narrow, b, aDark, narrowDark, bDark, smallPictureDark] = await Promise.all([
    render(small, true), render({width: 390, height: small.height}, true), render(wide),
    render(small, true, 'dark'), render({width: 390, height: small.height}, true, 'dark'), render(wide, false, 'dark'), render(smallDark, false, 'dark'),
]);
const inline = split(a);
if (!inline.svg.includes(`style="${place}"`)) throw new Error('[map-jr-gl site] first-paint: the style of the SVG root is not the one that this script replaces.');
// The controls markup of a render: its style sheet and its layer. The compact form has a few more rules (the width of the credits).
const layer = html => { const rest = split(html).credits, style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(rest); return {css: style?.[1].split('\n') ?? [], html: rest.replace(/<style[\s\S]*?<\/style>/, '')}; };
const regular = layer(a), compact = layer(narrow), regularDark = layer(aDark), compactDark = layer(narrowDark);
// The style sheet has the dark rules already (under `.map-jr-dark`), so the dark layers need no more rules than the light ones.
const css = [...regular.css, ...compact.css.filter(line => !regular.css.includes(line))].join('\n');
const sheetOf = layers => layers.flatMap(one => one.css).join('\n');
if (sheetOf([regularDark, compactDark]) !== sheetOf([regular, compact])) throw new Error('[map-jr-gl site] first-paint: the style sheet of the dark controls differs from the light one.');
// A picture without the root style and without the marker of the server renderer, for a background image.
const file = html => split(html).svg.replace(`style="${place}"`, '').replace(' data-map-jr-ssr=""', '');
const centred = `position:absolute;left:50%;top:50%;width:${small.width}px;height:${small.height}px;margin:-${small.height / 2}px 0 0 -${small.width / 2}px;max-width:none`;
const files = new Map([
    [small.file, `<div class="home-first-small">${inline.svg.replace(`style="${place}"`, `style="${centred}"`)}</div><style>${css}</style><div class="home-first-small-dark" role="img" aria-label="Map"></div>`
        + `<div class="home-first-compact home-first-light">${compact.html}</div><div class="home-first-compact home-first-dark">${compactDark.html}</div>`
        + `<div class="home-first-regular home-first-light">${regular.html}</div><div class="home-first-regular home-first-dark">${regularDark.html}</div>`],
    [wide.file, file(b)],
    [smallDark.file, file(smallPictureDark)],
    [wideDark.file, file(bDark)],
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
