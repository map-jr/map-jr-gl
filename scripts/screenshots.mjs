// Takes the pictures the README shows, from the built gallery. Run with the demo server up: pnpm screenshots
// (The server is started by `pnpm demo`; set GALLERY to use another address.)
import {createRequire} from 'node:module';
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';

const {chromium} = createRequire(import.meta.url)('playwright');
const gallery = process.env.GALLERY ?? 'http://localhost:8080/gallery/';
const out = new URL('../docs/images/', import.meta.url).pathname;
mkdirSync(out, {recursive: true});

// Each picture is one gallery row's map. Rows with slower data (elevation, shield definitions) get longer to settle.
const shots = [['basic', 6], ['markers', 7], ['terrain', 14], ['shields', 12], ['query', 6], ['pmtiles', 8]];
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 2});
await page.goto(gallery);
for (const [id, seconds] of shots) {
    const row = page.locator('#' + id);
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(seconds * 1000);
    // JPEG keeps the repository small: these are photographs of maps, not diagrams.
    await row.locator('.map').screenshot({path: `${out}${id}.jpg`, type: 'jpeg', quality: 82});
    console.log(`docs/images/${id}.jpg`);
}
await browser.close();
// The server-rendered picture is made by the site build, with no browser at all.
const server = new URL('../site/public/ssr.jpg', import.meta.url).pathname;
if (existsSync(server)) { copyFileSync(server, out + 'server.jpg'); console.log('docs/images/server.jpg'); }
