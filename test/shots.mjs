// Loads each demo page in Chromium and saves screenshots: node test/shots.mjs <outDir> [names...]
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const out = process.argv[2], only = process.argv.slice(3);
const pages = {
    main: '/?renderer=main', worker: '/?renderer=worker', static: '/static', ssr: '/ssr',
    tokyo: '/?local&nomarkers&center=139.7671,35.6812&zoom=12.2', cairo: '/?local&nomarkers&center=31.2357,30.0444&zoom=11.5',
    delhi: '/?local&nomarkers&center=77.2090,28.6139&zoom=11.2', bangkok: '/?local&nomarkers&center=100.5018,13.7563&zoom=11.5',
    positron: '/?nomarkers&style=https://tiles.openfreemap.org/styles/positron', liberty: '/?nomarkers&style=https://tiles.openfreemap.org/styles/liberty',
    elev: '/?nomarkers&style=https://whatismyelevation.com/styles/elevation-color.json',
    elevalps: '/?nomarkers&style=https://whatismyelevation.com/styles/elevation-color.json&center=7.6586,45.9763&zoom=11.3',
    elevlow: '/?nomarkers&style=https://whatismyelevation.com/styles/elevation-color.json&center=-105.2,39.8&zoom=6.2',
    shields: '/?nomarkers&zoom=11.3&center=-74.05,40.74', shieldsstatic: '/static?nomarkers&zoom=11.3',
    rotated: '/?renderer=worker&bearing=35&zoom=15.4', low: '/?renderer=worker&zoom=10.5&nomarkers',
};
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
for (const [name, url] of Object.entries(pages)) {
    if (only.length && !only.includes(name)) continue;
    const page = await browser.newPage({viewport: {width: 1000, height: 700}, deviceScaleFactor: 1});
    const logs = [];
    page.on('console', m => { if (m.type() !== 'log') logs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    const t0 = Date.now();
    await page.goto('http://localhost:8080' + url);
    if (name !== 'static') await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000}).catch(() => logs.push('TIMEOUT waiting for load'));
    await page.waitForTimeout(400);
    const info = name === 'static' ? {} : await page.evaluate(() => ({renderer: window.map?.renderer, errors: window.mapErrors, ssrLeft: !!document.querySelector('[data-tessera-ssr]')}));
    await page.screenshot({path: `${out}/${name}.png`});
    console.log(name, `${Date.now() - t0}ms`, JSON.stringify(info), logs.slice(0, 8).join(' | '));
    await page.close();
}
await browser.close();
