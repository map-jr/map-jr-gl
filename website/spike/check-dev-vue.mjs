// In `nuxt dev`: loads /map and prints the files of Vue that the page requests, to see whether the linked library
// (its real path is outside website/) brings a second copy of Vue.
// Usage: node spike/check-dev-vue.mjs http://localhost:4310
import {chromium} from 'playwright';

const base = process.argv[2];
const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader']});
const page = await browser.newPage();
const vueFiles = new Set(), libraryFiles = new Set(), messages = [];
page.on('request', request => {
    const url = request.url().replace(base, '').replace(/\?.*$/, '');
    if (/\/vue(\.|\/)|runtime-core|runtime-dom|reactivity/.test(url)) vueFiles.add(url);
    if (/map-jr-gl|\/dist\//.test(url)) libraryFiles.add(url);
});
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') messages.push(message.type() + ': ' + message.text().slice(0, 300)); });
page.on('pageerror', error => messages.push('pageerror: ' + error.message.slice(0, 300)));
await page.goto(base + '/map', {waitUntil: 'load'});
try {
    await page.waitForFunction(() => document.querySelector('#state')?.textContent === 'idle', null, {timeout: 90000});
} catch { /* the state is printed below */ }
console.log(JSON.stringify(await page.evaluate(() => {
    const app = document.querySelector('#__nuxt').__vue_app__;
    let node = document.querySelector('canvas');
    while (node && !node.__vueParentComponent) node = node.parentElement;
    return {
        state: document.querySelector('#state').textContent,
        mapComponentInSameApp: node ? node.__vueParentComponent.appContext.app === app : 'no component found',
        renderer: window.__map?.state?.get?.().renderer,
    };
})));
console.log('files of Vue:', [...vueFiles]);
console.log('files of the library:', [...libraryFiles]);
console.log('workers:', page.workers().length);
console.log('console errors and warnings:', messages);
await browser.close();
