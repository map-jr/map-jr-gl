// Checks the output of `pnpm generate` in Chromium, behind the plain static server of scripts/serve.mjs.
//
// Usage: node scripts/check.mjs [--no-map] [--screenshots=<path and start of the file names>]
//   --no-map       does not wait for the map of the home page. The map needs the style and the tiles of other hosts.
//   --screenshots  also saves pictures of the home page and of one docs page: light and dark, 1440 and 390 wide.
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const withMap = !process.argv.includes('--no-map');
const screenshots = process.argv.find(argument => argument.startsWith('--screenshots='))?.slice('--screenshots='.length);
const docsPage = '/vue';
// A page with several groups of code variants and without Nuxt.
const variantsPage = '/guide/markers-and-popups';

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

    // The code variants (build/variants.ts): one choice for every group of the site and for the menu in the header.
    {
        const {page, problems, close} = await open(variantsPage);
        const shownPanels = () => page.locator('.code-variant:visible').evaluateAll(panels => panels.map(panel => panel.id.split('-').pop()));
        // Each group that has the variant shows it, and a group without it shows its first variant.
        const showsEverywhere = slug => page.locator('.code-variants').evaluateAll((groups, slug) => groups.every(group => {
            const available = [...group.querySelectorAll('.code-variant')].map(panel => panel.dataset.variant);
            const visible = [...group.querySelectorAll('.code-variant')].filter(panel => panel.checkVisibility()).map(panel => panel.dataset.variant);
            return visible.length === 1 && visible[0] === (available.includes(slug) ? slug : available[0]);
        }), slug);
        const headerLabel = () => page.locator('.variant-menu .variant-label:visible').textContent();
        const groups = await page.locator('.code-variants').count();
        check('variants: the page has groups, each with one visible panel', groups > 1 && (await shownPanels()).length === groups, `${groups} groups`);
        check('variants: with no choice, the groups show the main API', await showsEverywhere('main') && await headerLabel() === 'Main API', (await shownPanels()).join(' '));
        await page.locator('.code-variants').first().getByRole('tab', {name: 'Vue', exact: true}).click();
        check('variants: a tab of one group switches every group and the header', await showsEverywhere('vue') && await headerLabel() === 'Vue', (await shownPanels()).join(' '));
        check('variants: the chosen tab is selected', await page.locator('.code-variants').last().getByRole('tab', {name: 'Vue', exact: true}).getAttribute('aria-selected') === 'true');
        await page.locator('.variant-menu').click();
        await page.getByRole('menuitemcheckbox', {name: 'React'}).click();
        check('variants: the menu in the header switches every group', await showsEverywhere('react') && await headerLabel() === 'React', (await shownPanels()).join(' '));
        await page.locator('aside').getByRole('link', {name: 'The description', exact: true}).click();
        await page.waitForURL('**/reference/description');
        await page.locator('aside').getByRole('link', {name: 'Markers and popups', exact: true}).click();
        await page.waitForURL('**' + variantsPage);
        await page.locator('.code-variants').first().waitFor();
        check('variants: the choice stays after a navigation', await showsEverywhere('react'), (await shownPanels()).join(' '));
        await page.reload({waitUntil: 'networkidle'});
        check('variants: the choice stays after a reload', await showsEverywhere('react') && await headerLabel() === 'React', (await shownPanels()).join(' '));
        const shift = await page.evaluate(() => new Promise(done => {
            new PerformanceObserver(list => done(list.getEntries().reduce((sum, entry) => sum + entry.value, 0))).observe({type: 'layout-shift', buffered: true});
            setTimeout(() => done(0), 500);
        }));
        check('variants: a reload with a stored choice has no layout shift', shift < 0.01, `CLS ${shift}`);
        await page.evaluate(key => localStorage.setItem(key, 'nuxt'), 'map-jr-docs-variant');
        await page.reload({waitUntil: 'networkidle'});
        check('variants: a choice of Nuxt shows Vue where a group has no Nuxt', await showsEverywhere('vue') && await headerLabel() === 'Vue', (await shownPanels()).join(' '));
        const hrefs = await page.locator('main a').evaluateAll(links => links.map(link => link.getAttribute('href')));
        check('variants page: no link names a .md file of the site', !hrefs.some(href => href && !href.startsWith('http') && /\.md(#|$)/.test(href)), hrefs.filter(href => href && /\.md(#|$)/.test(href)).join(' '));
        check('variants page: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }

    // A reference table (build/markdown.ts): a row has an id and an anchor, and the stacked layout fits a phone.
    for (const width of [1440, 390]) {
        const {page, problems, close} = await open('/reference/description', {width, height: width === 390 ? 844 : 900});
        const href = await page.locator('.reference-table .reference-anchor').first().getAttribute('href');
        check(`reference table at ${width}: the anchor of a row names the row`, !!href && await page.locator(`tr[id="${href.slice(1)}"]`).count() === 1, href);
        check(`reference table at ${width}: no horizontal scroll`, await overflow(page) <= 0, (await overflow(page)) + ' px');
        if (width === 390) check('reference table at 390: the head of the table is hidden', !await page.locator('.reference-table thead').first().isVisible());
        await page.goto(base + '/reference/description' + href, {waitUntil: 'networkidle'});
        const top = await page.locator(`tr[id="${href.slice(1)}"]`).evaluate(row => row.getBoundingClientRect().top);
        check(`reference table at ${width}: a link to a row shows it below the header`, top > 0 && top < 300, `${Math.round(top)} px`);
        check(`reference table at ${width}: no failed request and no error`, problems.length === 0, problems.join(' | '));
        await close();
    }

    // The raw Markdown of a page is the file of docs/.
    {
        const raw = await fetch(base + '/raw/recipes/query.md').then(response => response.text());
        check('/raw/recipes/query.md: equals docs/recipes/query.md', raw === readFileSync(new URL('../../docs/recipes/query.md', import.meta.url), 'utf8'));
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
