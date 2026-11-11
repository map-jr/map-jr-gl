// Draws popular public styles at several places and zooms with MapLibre GL JS and with this library, and compares
// the two images. A large difference shows something that the library draws wrongly or not at all.
//   node test/conformance/styles.mjs [out-dir] [--write]      (needs the demo server: pnpm demo; and python3 with Pillow for the comparison)
// --write puts the results in docs/ecosystem.md.
// The two libraries draw text in different ways (glyph files and web fonts), so labels always differ a little.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {launch} from '../launch.mjs';

const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? '.cache/styles', base = process.env.BENCH_BASE ?? 'http://localhost:8080';
const STYLES = {
    liberty: 'https://tiles.openfreemap.org/styles/liberty', bright: 'https://tiles.openfreemap.org/styles/bright', positron: 'https://tiles.openfreemap.org/styles/positron',
    versatiles: 'https://tiles.versatiles.org/assets/styles/colorful/style.json', demotiles: 'https://demotiles.maplibre.org/style.json',
    voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', darkmatter: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    dark: 'https://tiles.openfreemap.org/styles/dark', shortbread: 'https://vector.openstreetmap.org/styles/shortbread/colorful.json',
};
const VIEWS = [
    {name: 'world', center: [10, 30], zoom: 1.6}, {name: 'country', center: [10.4, 51.2], zoom: 5.3}, {name: 'city', center: [13.4, 52.52], zoom: 11.2},
    {name: 'streets', center: [-74.0065, 40.7085], zoom: 14.6}, {name: 'close', center: [13.4, 52.52], zoom: 17.4}, {name: 'tilted', center: [-74.0065, 40.7085], zoom: 15.7, pitch: 55, bearing: 30},
];
mkdirSync(out, {recursive: true});
const browser = await launch(), rows = [];
for (const [styleName, style] of Object.entries(STYLES)) {
    const page = await browser.newPage({viewport: {width: 1300, height: 460}});
    await page.goto(`${base}/bench?seconds=1`); // a page of the demo server that can import both libraries
    await page.evaluate(async style => {
        document.body.innerHTML = '<div id="a" style="position:absolute;left:0;top:0;width:640px;height:440px"></div><div id="b" style="position:absolute;left:650px;top:0;width:640px;height:440px"></div>';
        const maplibre = await import('/ml/maplibre-gl.mjs'), mapjr = await import('/dist/map-jr-gl.js');
        maplibre.setWorkerUrl('/ml/maplibre-gl-worker.mjs');
        const json = await (await fetch(style)).json();
        // The parts that this library does not have are taken out for the two, so that the comparison is of the rest.
        delete json.projection; delete json.sky; delete json.terrain;
        window.a = new maplibre.Map({container: 'a', style: structuredClone(json), center: [0, 0], zoom: 1, attributionControl: false, fadeDuration: 0});
        window.b = new mapjr.Map({container: 'b', style: structuredClone(json), center: [0, 0], zoom: 1, attributionControl: false});
        await Promise.all([new Promise(r => window.a.once('load', r)), new Promise(r => window.b.once('load', r))]);
    }, style);
    for (const view of VIEWS) {
        await page.evaluate(async view => {
            const idle = m => new Promise(r => { m.once('idle', r); setTimeout(r, 20000); });
            window.a.jumpTo(view); window.b.jumpTo({pitch: 0, bearing: 0, ...view});
            await Promise.all([idle(window.a), idle(window.b)]);
            await new Promise(r => setTimeout(r, 1500)); // labels of this library fade in
        }, {pitch: 0, bearing: 0, ...view});
        const file = path.join(out, `${styleName}-${view.name}.png`);
        await page.screenshot({path: file, clip: {x: 0, y: 0, width: 1290, height: 440}});
        rows.push({style: styleName, view: view.name, file});
    }
    await page.close();
}
await browser.close();
// The share of pixels that differ clearly, for each image (left half against right half).
const py = `
import sys, json
from PIL import Image, ImageChops
out = []
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB'); a = im.crop((0, 0, 640, 440)); b = im.crop((650, 0, 1290, 440))
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 40 else 0)
    out.append(round(100 * sum(1 for v in d.getdata() if v) / (640 * 440), 1))
print(json.dumps(out))`;
const diffs = JSON.parse(execFileSync('python3', ['-W', 'ignore', '-c', py, ...rows.map(r => r.file)], {encoding: 'utf8'}));
rows.forEach((r, i) => { r.diff = diffs[i]; });
rows.sort((a, b) => b.diff - a.diff);
writeFileSync(path.join(out, 'result.json'), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${String(r.diff).padStart(5)}%  ${r.style} ${r.view}  ${r.file}`);

if (process.argv.includes('--write')) {
    // One row for each style, one column for each view.
    const lines = ['<!-- styles:start -->', '## Public styles that were drawn', '',
        'These styles were drawn with MapLibre GL JS and with this library by `node test/conformance/styles.mjs --write`, at',
        'the same places. Each number is the percentage of pixels that differ clearly between the two images. The two',
        'libraries draw text in different ways and can select different labels, so 2 to 7 percent is usual for a view with',
        'many labels. A larger number shows something that the library draws wrongly or not at all.', '',
        `| Style | ${VIEWS.map(v => v.name).join(' | ')} |`, `|---|${VIEWS.map(() => '---').join('|')}|`,
        ...Object.entries(STYLES).map(([name, url]) => `| [${name}](${url}) | ${VIEWS.map(v => rows.find(r => r.style === name && r.view === v.name)?.diff ?? '').join(' | ')} |`),
        '', `The views: ${VIEWS.map(v => `${v.name} (zoom ${v.zoom}${v.pitch ? ', tilted' : ''})`).join(', ')}.`, '<!-- styles:end -->'];
    const file = path.resolve(import.meta.dirname, '../../docs/ecosystem.md'), doc = readFileSync(file, 'utf8'), block = lines.join('\n');
    writeFileSync(file, doc.includes('<!-- styles:start -->') ? doc.replace(/<!-- styles:start -->[\s\S]*<!-- styles:end -->/, block) : doc.replace('## What is missing most often', block + '\n\n## What is missing most often'));
}
