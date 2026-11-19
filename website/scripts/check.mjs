// Checks the output of `pnpm generate` in Chromium, behind the plain static server of scripts/serve.mjs.
//
// Usage: node scripts/check.mjs [--no-map] [--screenshots=<path and start of the file names>]
//   --no-map       does not wait for the map of the home page. The map needs the style and the tiles of other hosts.
//   --screenshots  also saves pictures of the home page and of one docs page: light and dark, 1440 and 390 wide.
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const withMap = !process.argv.includes('--no-map');
const screenshots = process.argv.find(argument => argument.startsWith('--screenshots='))?.slice('--screenshots='.length);
const docsPage = '/vue';

const server = await serve(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader']});
let failures = 0;
function check(name, ok, detail = '') {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
}

async function open(path, {width = 1440, height = 900, scheme = 'light'} = {}) {
    const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2, colorScheme: scheme});
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push('error: ' + error.message.slice(0, 200)));
    page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text().slice(0, 200)); });
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) problems.push(response.status() + ' ' + response.url().slice(base.length)); });
    // The map of the home page can load tiles for a long time, so that page does not wait for a quiet network.
    await page.goto(base + path, {waitUntil: path === '/' ? 'load' : 'networkidle'});
    return {page, problems, close: () => context.close()};
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

try {
    // A docs page: the title, the navigation at the left, the contents at the right, and the links to GitHub.
    {
        const {page, problems, close} = await open(docsPage);
        check('docs page: the title is the first heading of the file', await page.locator('h1').first().textContent() === 'Vue and Nuxt', await page.locator('h1').first().textContent());
        check('docs page: one h1', await page.locator('h1').count() === 1);
        check('docs page: the navigation has the section "Current docs"', await page.locator('aside').getByText('Current docs').count() > 0);
        check('docs page: the contents list names a heading', await page.getByRole('link', {name: 'The component', exact: true}).count() > 0);
        const edit = await page.getByRole('link', {name: 'Edit this page'}).first().getAttribute('href');
        check('docs page: "Edit this page" names the file', edit === 'https://github.com/map-jr/map-jr-gl/edit/main/docs/vue.md', edit);
        const report = await page.getByRole('link', {name: 'Report a problem with this page'}).first().getAttribute('href');
        check('docs page: "Report a problem with this page" opens a new issue', !!report?.startsWith('https://github.com/map-jr/map-jr-gl/issues/new?title=Docs'), report);
        const hrefs = await page.locator('main a').evaluateAll(links => links.map(link => link.getAttribute('href')));
        check('docs page: a link to api.md is the route /api', hrefs.includes('/api') && hrefs.some(href => href?.startsWith('/api#')));
        check('docs page: no link names a .md file of the site', !hrefs.some(href => href && !href.startsWith('http') && /\.md(#|$)/.test(href)), hrefs.filter(href => href && !href.startsWith('http') && /\.md(#|$)/.test(href)).join(' '));
        check('docs page: no horizontal scroll at 1440', await overflow(page) <= 0);

        // Navigation: a click changes the page with no load of a document, and previous and next follow the manifest.
        await page.evaluate(() => { window.__sameDocument = true; });
        await page.locator('aside').getByRole('link', {name: 'React', exact: true}).click();
        await page.waitForURL('**/react');
        await page.locator('h1', {hasText: 'React'}).waitFor();
        check('navigation: a click leads to /react in the same document', await page.evaluate(() => window.__sameDocument === true));
        const surround = await page.locator('main a[href="/vue"], main a[href="/svelte"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
        check('navigation: previous is /vue and next is /svelte', surround.includes('/vue') && surround.includes('/svelte'), surround.join(' '));

        // Search.
        await page.keyboard.press('ControlOrMeta+k');
        await page.getByPlaceholder(/search/i).fill('cooperative gestures');
        await page.getByRole('option').first().waitFor({timeout: 15000}).catch(() => {});
        const options = await page.getByRole('option').count();
        check('search: "cooperative gestures" has results', options > 0, options + ' results');
        if (options) {
            await page.getByRole('option').first().click();
            await page.waitForTimeout(800);
            check('search: a result leads to a page', new URL(page.url()).pathname !== '/react' || !!new URL(page.url()).hash, page.url().slice(base.length));
        }

        // Colour mode.
        await page.goto(base + docsPage, {waitUntil: 'networkidle'});
        const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const light = await background();
        await page.getByRole('button', {name: /switch to dark mode/i}).first().click();
        await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
        const dark = await background();
        check('colour mode: the paper is #f6f5f2 and the night is #17181a', light === 'rgb(246, 245, 242)' && dark === 'rgb(23, 24, 26)', `${light} / ${dark}`);
        await page.reload({waitUntil: 'networkidle'});
        check('colour mode: the choice stays after a load', await page.evaluate(() => document.documentElement.classList.contains('dark')));
        check('docs page: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }

    // The pages of the header, and an address with no page.
    for (const path of ['/recipes', '/reference', '/guide', '/migrate', '/styles', '/play']) {
        const {page, problems, close} = await open(path);
        check(`${path}: the page has a heading and no error`, await page.locator('h1').count() === 1 && problems.length === 0, problems.join(' | '));
        await close();
    }
    {
        const response = await fetch(base + '/no-such-page');
        check('/no-such-page: the status is 404', response.status === 404, String(response.status));
        const internal = await Promise.all(['/development', '/style-guide', '/ecosystem', '/agents/worker-brief', '/sky-and-fog', '/similarity-scan'].map(path => fetch(base + path).then(response => response.status)));
        check('the files for people who work on the library are not on the site', internal.every(status => status === 404), internal.join(' '));
    }

    // A phone.
    {
        const {page, problems, close} = await open(docsPage, {width: 390, height: 844});
        check('phone: no horizontal scroll on a docs page', await overflow(page) <= 0, (await overflow(page)) + ' px');
        await page.getByRole('button', {name: 'Open the menu'}).click();
        const link = page.getByRole('dialog').getByRole('link', {name: 'Svelte', exact: true});
        await link.waitFor();
        await link.click();
        await page.waitForURL('**/svelte');
        check('phone: the menu leads to /svelte', true);
        check('phone: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
        const home = await open('/', {width: 390, height: 844});
        check('phone: no horizontal scroll on the home page', await overflow(home.page) <= 0, (await overflow(home.page)) + ' px');
        await home.close();
    }

    // The map of the home page.
    if (withMap) {
        const {page, problems, close} = await open('/');
        const started = Date.now();
        const idle = await page.locator('[data-map-state="idle"]').waitFor({timeout: 90000}).then(() => true, () => false);
        check('home page: the map reaches idle', idle, idle ? `${Date.now() - started} ms after the load event` : await page.locator('[data-map-state]').getAttribute('data-map-state'));
        check('home page: the map has a canvas', await page.locator('[data-map-state] canvas').count() > 0);
        check('home page: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }

    if (screenshots) {
        for (const [name, path] of [['home', '/'], ['docs', docsPage]]) {
            for (const scheme of ['light', 'dark']) {
                for (const width of [1440, 390]) {
                    const {page, close} = await open(path, {width, height: width === 390 ? 844 : 900, scheme});
                    if (path === '/') await page.locator('[data-map-state="idle"]').waitFor({timeout: 90000}).catch(() => {});
                    await page.waitForTimeout(500);
                    const file = `${screenshots}-${name}-${scheme}-${width}.png`;
                    await page.screenshot({path: file, fullPage: path === '/'});
                    console.log('screenshot', file);
                    await close();
                }
            }
        }
    }
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
