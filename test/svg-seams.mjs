// Rasterizes the SVG of four neighboring raster tiles at fractional positions in Chromium and checks that the pixels
// on their shared edges are as dark as the tiles (#388). Run: node --experimental-transform-types --no-warnings test/svg-seams.mjs
import {launch} from './launch.mjs';
import {Transform, EXTENT} from '../src/geo.ts';
import {renderSVG} from '../src/svg.ts';

const W = 700, H = 400, S = 256;
const tr = new Transform(); tr.width = W; tr.height = H; tr.set([0, 0], 2, 0, 0);
const tile = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#000"/></svg>')}`;
const prop = v => ({dd: false, eval: () => v});
const layer = {id: 'r', type: 'raster', source: 's', visible: true, minzoom: 0, maxzoom: 25, p: {opacity: prop(1), resampling: prop(undefined), rasterResampling: prop('linear')}};
const k = S / EXTENT, items = [];
for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const matrix = [k, 0, 0, k, 298.19 + i * S, -32.65 + 256 + j * S];
    items.push({id: {z: 2, x: i, y: j}, matrix, scale: k, clip: [0, 0, EXTENT, EXTENT], tile: {href: tile}});
}
const svg = renderSVG({tr, layers: [layer], items: new Map([['s', items]]), labels: [], images: new Map(), fontFamily: 'sans-serif'});
if (process.argv.includes('--print')) console.log(svg);
const browser = await launch(), page = await browser.newPage({viewport: {width: W, height: H}});
await page.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
await page.waitForTimeout(300);
const shot = await page.screenshot();
const lum = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return [...g.getImageData(0, 0, c.width, c.height).data].filter((_, i) => i % 4 === 0);
}, shot.toString('base64'));
await browser.close();
// The tiles cover x 298.19..810.19 and y 223.35..735.35, so the block starts at pixel 299 and 224 once the outer
// anti-aliased edge is left out. Every pixel from there to the viewport edge must be black.
let worst = 0, bad = 0;
for (let y = 225; y < H; y++) for (let x = 300; x < W; x++) { const v = lum[y * W + x]; if (v > 0) { bad++; if (bad < 8) console.log(x, y, v); } worst = Math.max(worst, v); }
console.log(`pixels lighter than black inside the tiles: ${bad}, lightest ${worst}`);
if (bad) { console.error('FAIL: seams between raster tiles'); process.exit(1); }
console.log('ok');
