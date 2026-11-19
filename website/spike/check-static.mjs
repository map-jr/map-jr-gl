// Checks the output of `nuxt generate` behind a plain static server.
// Usage: node spike/check-static.mjs http://localhost:4311
import {chromium} from 'playwright';

const base = process.argv[2];
for (const path of ['/llms.txt', '/raw/index.md', '/raw/guide/second.md', '/guide/second.md', '/guide/second', '/guide/second/']) {
    const response = await fetch(base + path, {redirect: 'manual'});
    console.log('GET', path.padEnd(22), response.status, response.headers.get('content-type'), (await response.text()).slice(0, 40).replace(/\n/g, '\\n'));
}

const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader']});
const page = await browser.newPage();
const messages = [], failed = [];
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') messages.push(message.type() + ': ' + message.text().slice(0, 200)); });
page.on('pageerror', error => messages.push('pageerror: ' + error.message.slice(0, 200)));
page.on('requestfailed', request => failed.push(request.url()));
page.on('response', response => { if (response.status() >= 400) failed.push(response.status() + ' ' + response.url()); });

// Navigation: a click in the navigation changes the page without a load of a document.
await page.goto(base + '/', {waitUntil: 'networkidle'});
await page.evaluate(() => { window.__sameDocument = true; });
await page.getByRole('link', {name: 'Second page'}).first().click();
await page.waitForURL('**/guide/second');
await page.waitForSelector('text=zebrafinch');
console.log('navigation: /guide/second by a click, same document:', await page.evaluate(() => window.__sameDocument === true));
// A link of the markdown that is written as a relative path of a .md file.
await page.goto(base + '/', {waitUntil: 'networkidle'});
console.log('markdown link guide/second.md has href:', await page.getByRole('link', {name: 'the second page'}).getAttribute('href'));
// A direct load of a page that is not the root.
await page.goto(base + '/guide/third', {waitUntil: 'networkidle'});
console.log('direct load of /guide/third:', await page.locator('h1').first().textContent());

// Search.
await page.goto(base + '/', {waitUntil: 'networkidle'});
await page.keyboard.press('ControlOrMeta+k');
await page.getByPlaceholder(/search/i).fill('zebrafinch');
await page.waitForTimeout(1500);
const options = await page.getByRole('option').allTextContents();
console.log('search "zebrafinch":', options.map(text => text.trim().slice(0, 80)));
if (options.length) {
    await page.getByRole('option').first().click();
    await page.waitForTimeout(800);
    console.log('search result leads to:', new URL(page.url()).pathname + new URL(page.url()).hash);
}

// The map: a direct load, then a client-side navigation.
for (const how of ['direct', 'client']) {
    if (how === 'direct') await page.goto(base + '/map', {waitUntil: 'load'});
    else {
        await page.goto(base + '/', {waitUntil: 'networkidle'});
        await page.locator('#to-map').click();
    }
    try {
        await page.waitForFunction(() => document.querySelector('#state')?.textContent === 'idle', null, {timeout: 60000});
    } catch { /* the state is printed below */ }
    const info = await page.evaluate(() => {
        const app = document.querySelector('#__nuxt').__vue_app__;
        const canvas = document.querySelector('canvas');
        let node = canvas;
        while (node && !node.__vueParentComponent) node = node.parentElement;
        return {
            state: document.querySelector('#state').textContent,
            canvas: canvas ? canvas.width + 'x' + canvas.height : 'none',
            appVue: app.version,
            mapComponentInSameApp: node ? node.__vueParentComponent.appContext.app === app : 'no component found',
            renderer: window.__map?.state?.get?.().renderer,
        };
    });
    console.log('map (' + how + '):', JSON.stringify(info));
    console.log('  workers:', page.workers().map(worker => worker.url().replace(base, '').slice(0, 70)));
}
console.log('console errors and warnings:', messages);
console.log('failed requests:', failed);
await browser.close();
