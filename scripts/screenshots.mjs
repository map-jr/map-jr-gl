// Takes the pictures the README shows, from the harness page of the examples (examples/run.html, built by `pnpm site`).
// Run with the demo server up: pnpm screenshots
// (The server is started by `pnpm demo`; set GALLERY to use another address of the built site.)
import {chromiumOptions} from '../test/launch.mjs';
import {createRequire} from 'node:module';
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';

const {chromium} = createRequire(import.meta.url)('playwright');
const gallery = process.env.GALLERY ?? 'http://localhost:8080/gallery/';
const out = new URL('../docs/images/', import.meta.url).pathname;
mkdirSync(out, {recursive: true});

// Each picture is the map of one example, in its main API form. An example with slower data (elevation) gets longer to settle.
const shots = [['basic', 6], ['markers', 7], ['terrain', 14], ['query', 6], ['pmtiles', 8]];
const browser = await chromium.launch({...chromiumOptions(chromium), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 633, height: 700}, deviceScaleFactor: 2});
for (const [id, seconds] of shots) {
    await page.goto(new URL(`examples/run.html?id=${id}&form=core`, gallery).href);
    await page.waitForFunction(id => window.maps?.[id] || window.exampleError, id, {timeout: 60000});
    const error = await page.evaluate(() => window.exampleError);
    if (error) throw new Error(error);
    await page.waitForTimeout(seconds * 1000);
    // JPEG keeps the repository small: these are photographs of maps, not diagrams.
    await page.locator('.map').screenshot({path: `${out}${id}.jpg`, type: 'jpeg', quality: 82});
    console.log(`docs/images/${id}.jpg`);
}
await browser.close();
// The server-rendered picture is made by the site build, with no browser at all.
const server = new URL('../site/public/ssr.jpg', import.meta.url).pathname;
if (existsSync(server)) { copyFileSync(server, out + 'server.jpg'); console.log('docs/images/server.jpg'); }
