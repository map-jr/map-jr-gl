// Checks the output of `pnpm generate` in Chromium, the table of contents on a phone also in WebKit, and the editor in
// the browsers of --browsers, behind the plain static server of scripts/serve.mjs.
//
// Usage: node scripts/check.mjs [--no-map] [--screenshots=<path and start of the file names>] [--browsers=<list>]
//   --no-map       does not wait for the map of the home page. The map needs the style and the tiles of other hosts.
//   --screenshots  also saves pictures of the home page and of one docs page (light and dark), of the install block
//                  and of the code of /reference/server, each 1440 and 390 wide.
//   --browsers     the browsers of Playwright for the checks of the editor and of /play, separated by commas
//                  (chromium, firefox, webkit). The default is chromium.
import {readFileSync} from 'node:fs';
import * as playwright from 'playwright';
import {serve} from './serve.mjs';
import {chromiumOptions} from '../../test/launch.mjs';

const {chromium, devices, webkit} = playwright;
const withMap = !process.argv.includes('--no-map');
const screenshots = process.argv.find(argument => argument.startsWith('--screenshots='))?.slice('--screenshots='.length);
const editorBrowsers = process.argv.find(argument => argument.startsWith('--browsers='))?.slice('--browsers='.length).split(',') ?? ['chromium'];
const docsPage = '/reference/vue';
// A page with several groups of code variants and without Nuxt.
const variantsPage = '/guide/markers-and-popups';
// A page with a group of package managers first and then groups of code variants.
const installPage = '/guide/getting-started';

const server = await serve(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({...chromiumOptions(chromium), args: ['--enable-unsafe-swiftshader']});
let failures = 0;
function check(name, ok, detail = '') {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
}

// Launches a browser other than Chromium. Where it is not installed, the checks that need it print one `skip` line each
// and the others run (#1389). In CI (the variable CI is set) a launch that fails is an error, so that a broken install
// of the browser is not hidden.
async function launchOther(type, what) {
    try {
        return await type.launch();
    } catch (error) {
        if (process.env.CI) throw error;
        console.log(`skip ${what}: ${type.name()} cannot be launched (${error.message.split('\n')[0].slice(0, 120)}). Run "pnpm exec playwright install ${type.name()}".`);
        return null;
    }
}

async function open(path, {width = 1440, height = 900, scheme = 'light', reducedMotion = 'no-preference', init = ''} = {}) {
    const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion});
    const page = await context.newPage();
    if (init) await page.addInitScript(init);
    const problems = [];
    page.on('pageerror', error => problems.push('error: ' + error.message.slice(0, 200)));
    page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text().slice(0, 200)); });
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) problems.push(response.status() + ' ' + response.url().slice(base.length)); });
    // The map of the home page can load tiles for a long time, so that page does not wait for a quiet network.
    await page.goto(base + path, {waitUntil: path === '/' ? 'load' : 'networkidle'});
    return {page, problems, close: () => context.close()};
}
// The contrast ratio of WCAG 2 between two colours written as #RRGGBB.
function contrast(a, b) {
    const luminance = hex => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

try {
    // A docs page: the title, the navigation at the left, the contents at the right, and the links to GitHub.
    {
        const {page, problems, close} = await open(docsPage);
        check('docs page: the title is the first heading of the file', await page.locator('h1').first().textContent() === 'Vue', await page.locator('h1').first().textContent());
        check('docs page: one h1', await page.locator('h1').count() === 1);
        check('docs page: the navigation has the section "Reference"', await page.locator('aside').getByText('Reference').count() > 0);
        check('docs page: the contents list names a heading', await page.getByRole('link', {name: 'MapJr', exact: true}).count() > 0);
        const edit = await page.getByRole('link', {name: 'Edit this page'}).first().getAttribute('href');
        check('docs page: "Edit this page" names the file', edit === 'https://github.com/map-jr/map-jr-gl/edit/main/docs/reference/vue.md', edit);
        const report = await page.getByRole('link', {name: 'Report a problem with this page'}).first().getAttribute('href');
        check('docs page: "Report a problem with this page" opens a new issue', !!report?.startsWith('https://github.com/map-jr/map-jr-gl/issues/new?title=Docs'), report);
        const hrefs = await page.locator('main a').evaluateAll(links => links.map(link => link.getAttribute('href')));
        check('docs page: a link to description.md is the route /reference/description', hrefs.some(href => href?.startsWith('/reference/description#')));
        check('docs page: no link names a .md file of the site', !hrefs.some(href => href && !href.startsWith('http') && /\.md(#|$)/.test(href)), hrefs.filter(href => href && !href.startsWith('http') && /\.md(#|$)/.test(href)).join(' '));
        check('docs page: no horizontal scroll at 1440', await overflow(page) <= 0);

        // Navigation: a click changes the page with no load of a document, and previous and next follow the manifest.
        await page.evaluate(() => { window.__sameDocument = true; });
        await page.locator('aside a[href="/reference/react"]').click();
        await page.waitForURL('**/reference/react');
        await page.locator('h1', {hasText: 'React'}).waitFor();
        check('navigation: a click leads to /reference/react in the same document', await page.evaluate(() => window.__sameDocument === true));
        const surround = await page.locator('main a[href="/reference/server"], main a[href="/reference/svelte"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
        check('navigation: previous is /reference/server and next is /reference/svelte', surround.includes('/reference/server') && surround.includes('/reference/svelte'), surround.join(' '));

        // Search.
        await page.keyboard.press('ControlOrMeta+k');
        await page.getByPlaceholder(/search/i).fill('cooperative gestures');
        await page.getByRole('option').first().waitFor({timeout: 15000}).catch(() => {});
        const options = await page.getByRole('option').count();
        check('search: "cooperative gestures" has results', options > 0, options + ' results');
        if (options) {
            await page.getByRole('option').first().click();
            await page.waitForTimeout(800);
            check('search: a result leads to a page', new URL(page.url()).pathname !== '/reference/react' || !!new URL(page.url()).hash, page.url().slice(base.length));
        }

        // Colour mode.
        await page.goto(base + docsPage, {waitUntil: 'networkidle'});
        const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const light = await background();
        await page.getByRole('button', {name: /switch to dark mode/i}).first().click();
        await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
        const dark = await background();
        check('colour mode: the light page is #ffffff and the night is #17181a', light === 'rgb(255, 255, 255)' && dark === 'rgb(23, 24, 26)', `${light} / ${dark}`);
        await page.reload({waitUntil: 'networkidle'});
        check('colour mode: the choice stays after a load', await page.evaluate(() => document.documentElement.classList.contains('dark')));
        check('docs page: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }

    // The colours of the code (#1209): the tokens have the colours of the theme of the scheme, the block has the
    // sheet of the code, and each token has 4.5:1 or more against it. The lists are the foreground colours of the
    // themes github-light-default and github-dark-default of Shiki 4.6.0. The block has its own background (#1331), and
    // the light tokens are darkened by 15% (color-mix in main.css), so that the comment colour keeps 4.5:1 on it.
    {
        const darken = colour => '#' + [1, 3, 5].map(i => Math.round(parseInt(colour.slice(i, i + 2), 16) * 0.85).toString(16).padStart(2, '0')).join('').toUpperCase();
        const themes = {
            light: {sheet: '#FCFCFA', colours: ['#1F2328', '#6E7781', '#CF222E', '#0550AE', '#953800', '#8250DF', '#116329', '#0A3069', '#82071E', '#57606A'].map(darken)},
            dark: {sheet: '#1B1C1E', colours: ['#E6EDF3', '#8B949E', '#FF7B72', '#79C0FF', '#FFA657', '#D2A8FF', '#7EE787', '#A5D6FF', '#FFA198', '#F0F6FC']},
        };
        for (const scheme of ['light', 'dark']) {
            const {page, problems, close} = await open('/guide/getting-started', {scheme});
            await page.waitForFunction(scheme => document.documentElement.classList.contains(scheme), scheme);
            const blocks = await page.locator('main pre.shiki').evaluateAll(blocks => {
                // The computed colour is rgb(r, g, b), or color(srgb r g b) with fractions from color-mix.
                const hex = colour => '#' + (colour.startsWith('color(') ? colour.match(/[\d.]+/g).slice(-3).map(n => Math.round(Number(n) * 255)) : colour.match(/\d+/g).slice(0, 3).map(Number)).map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
                return blocks.map(block => ({
                    sheet: hex(getComputedStyle(block).backgroundColor),
                    // A block in a language that Shiki did not load has no token colours and takes the text colour.
                    highlighted: !!block.querySelector('code span[style*="--shiki"], code span[class^="s"]'),
                    colours: [...block.querySelectorAll('code span')].filter(span => !span.children.length && span.textContent.trim()).map(span => hex(getComputedStyle(span).color)),
                }));
            });
            const {sheet, colours} = themes[scheme];
            const used = [...new Set(blocks.flatMap(block => block.colours))];
            check(`code in ${scheme}: every code block is highlighted`, blocks.length > 0 && blocks.every(block => block.highlighted), `${blocks.filter(block => block.highlighted).length} of ${blocks.length} blocks`);
            check(`code in ${scheme}: each block has the sheet ${sheet}`, blocks.every(block => block.sheet === sheet), [...new Set(blocks.map(block => block.sheet))].join(' '));
            // The browser and darken() can round a half differently, so a channel may differ by 1.
            const near = (a, b) => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);
            const foreign = used.filter(colour => !colours.some(expected => near(colour, expected)));
            check(`code in ${scheme}: the tokens have the colours of the theme`, foreign.length === 0, foreign.join(' '));
            const low = used.map(colour => [colour, contrast(colour, sheet)]).filter(([, ratio]) => ratio < 4.5);
            check(`code in ${scheme}: every token has 4.5:1 or more on the sheet`, low.length === 0, low.map(([colour, ratio]) => `${colour} ${ratio.toFixed(2)}`).join(' ') || 'lowest ' + Math.min(...used.map(colour => contrast(colour, sheet))).toFixed(2));
            check(`code in ${scheme}: no failed request and no error`, problems.length === 0, problems.join(' | '));
            await close();
        }
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

    // The package managers (build/variants.ts): a second set with its own choice, not in the header.
    {
        const {page, problems, close} = await open(installPage);
        const group = page.locator('.code-variants').first();
        const shownPm = () => group.locator('.code-variant:visible').evaluateAll(panels => panels.map(panel => panel.dataset.variant).join(' '));
        const tabNames = await group.getByRole('tab').allTextContents();
        check('package managers: the install block has the tabs npm, pnpm, yarn, bun', tabNames.map(name => name.trim()).join(' ') === 'npm pnpm yarn bun', tabNames.join(' '));
        check('package managers: with no choice, the block shows npm', await shownPm() === 'npm', await shownPm());
        const menuLabels = await page.locator('.variant-menu .variant-label').allTextContents();
        check('package managers: the menu in the header does not list them', !menuLabels.some(label => ['npm', 'pnpm', 'yarn', 'bun'].includes(label.trim())), menuLabels.join(' '));
        await group.getByRole('tab', {name: 'pnpm', exact: true}).click();
        check('package managers: a tab switches the block', await shownPm() === 'pnpm' && await group.getByRole('tab', {name: 'pnpm', exact: true}).getAttribute('aria-selected') === 'true', await shownPm());
        const variantAttribute = () => page.evaluate(() => document.documentElement.getAttribute('data-variant'));
        check('package managers: the choice does not change the code variant', await variantAttribute() === 'none',await variantAttribute());
        await page.locator('.code-variants').nth(1).getByRole('tab', {name: 'React', exact: true}).click();
        check('package managers: a choice of a code variant does not change the package manager', await shownPm() === 'pnpm', await shownPm());
        await page.locator('aside').getByRole('link', {name: 'Markers and popups', exact: true}).click();
        await page.waitForURL('**' + variantsPage);
        await page.locator('aside').getByRole('link', {name: 'Getting started', exact: true}).click();
        await page.waitForURL('**' + installPage);
        await group.waitFor();
        check('package managers: the choice stays after a navigation', await shownPm() === 'pnpm', await shownPm());
        await page.reload({waitUntil: 'networkidle'});
        check('package managers: the choice stays after a reload', await shownPm() === 'pnpm' && await variantAttribute() === 'react', `${await shownPm()} / ${await variantAttribute()}`);
        const shift = await page.evaluate(() => new Promise(done => {
            new PerformanceObserver(list => done(list.getEntries().reduce((sum, entry) => sum + entry.value, 0))).observe({type: 'layout-shift', buffered: true});
            setTimeout(() => done(0), 500);
        }));
        check('package managers: a reload with a stored choice has no layout shift', shift < 0.01, `CLS ${shift}`);
        check('package managers page: no failed request and no error', problems.length === 0, problems.join(' | '));
        // Each example of /play runs without an error (#1339): the map reaches idle and the frame shows no error. The
    // examples load the style and tiles of other hosts, so this runs with the map only.
    if (withMap) {
        const {page, problems, close} = await open('/play');
        const examplesButton = page.getByRole('button', {name: 'Examples', exact: true});
        await examplesButton.click();
        const labels = (await page.getByRole('menuitem').allTextContents()).map(label => label.trim());
        await page.keyboard.press('Escape');
        for (const label of labels) {
            await examplesButton.click();
            await page.getByRole('menuitem', {name: label, exact: true}).click();
            const idle = await page.locator('[data-map-state="idle"]').waitFor({timeout: 90000}).then(() => true, () => false);
            await page.waitForTimeout(1500);
            const log = page.locator('.map-frame [role="log"]');
            const logged = await log.count() ? await log.textContent() : '';
            check(`/play example "${label}": the map reaches idle with no error`, idle && !logged.trim(), logged.trim().slice(0, 200) || (idle ? '' : 'no idle'));
        }
        check('/play examples: no error of the page', problems.length === 0, problems.join(' | '));
        await close();
    }

    if (screenshots) {
            for (const width of [1440, 390]) {
                await page.setViewportSize({width, height: width === 390 ? 844 : 900});
                await group.scrollIntoViewIfNeeded();
                const file = `${screenshots}-install-${width}.png`;
                await page.screenshot({path: file});
                console.log('screenshot', file);
            }
        }
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

    // A table without a Default column (Name, Type, Description) and the tables of /reference/server are reference
    // tables too: a row has an anchor, the rows stack on a phone, and the page does not scroll sideways (#1221).
    {
        const {page, problems, close} = await open('/reference/map', {width: 390, height: 844});
        const table = page.locator('.reference-table').filter({has: page.locator('thead th:nth-child(3)')}).filter({hasNot: page.locator('thead th:nth-child(4)')}).first();
        const href = await table.locator('.reference-anchor').first().getAttribute('href').catch(() => null);
        check('three-column reference table at 390 on /reference/map: a row has an anchor', !!href && await page.locator(`tr[id="${href.slice(1)}"]`).count() === 1, href ?? 'no table');
        const display = await table.locator('tbody tr').first().evaluate(row => getComputedStyle(row).display).catch(() => 'none found');
        check('three-column reference table at 390 on /reference/map: the rows stack', display === 'block', display);
        check('reference tables at 390 on /reference/map: no horizontal scroll', await overflow(page) <= 0, (await overflow(page)) + ' px');
        check('reference tables at 390 on /reference/map: no failed request and no error', problems.length === 0, problems.join(' | '));
        if (screenshots) { const file = `${screenshots}-reference-map-390.png`; await table.scrollIntoViewIfNeeded(); await page.screenshot({path: file}); console.log('screenshot', file); }
        await close();
    }
    {
        const {page, problems, close} = await open('/reference/server', {width: 390, height: 844});
        check('/reference/server at 390: no horizontal scroll of the page', await overflow(page) <= 0, (await overflow(page)) + ' px');
        const plain = await page.locator('main table').evaluateAll(tables => tables.filter(table => !table.closest('.reference-table')).map(table => [...table.querySelectorAll('th')].map(th => th.textContent.trim()).join('|')));
        check('/reference/server at 390: every table of members is a reference table', !plain.some(head => /^(Name|Option)\|Type\|/.test(head)), plain.join(', '));
        check('/reference/server at 390: no failed request and no error', problems.length === 0, problems.join(' | '));
        if (screenshots) { const file = `${screenshots}-reference-server-390.png`; await page.locator('.reference-table').nth(2).scrollIntoViewIfNeeded(); await page.screenshot({path: file}); console.log('screenshot', file); }
        await close();
    }

    // The forms of the code (#1250): a code line never wraps, the phone form shows below 48rem and the desktop form
    // from it, and no code block or its code is wider than its column (scrollWidth <= clientWidth).
    for (const path of [installPage, '/reference/server']) {
        for (const width of [1440, 390]) {
            const {page, problems, close} = await open(path, {width, height: width === 390 ? 844 : 900});
            // At 390 a block may scroll only for a line that one string, URL or regular expression makes long
            // (build/format.mjs, overflowOf); at 1440 no block scrolls.
            const found = await page.locator('main pre').evaluateAll((blocks, [phone, tokens]) => {
                const shown = blocks.filter(block => block.checkVisibility());
                const wrapped = [], wide = [];
                let lines = 0, scrolling = 0;
                const unbreakable = text => {
                    const longest = Math.max(0, ...[...text.matchAll(new RegExp(tokens, 'g'))].map(match => match[0].length));
                    return longest > 0 && text.length - longest <= 38;
                };
                for (const block of shown) {
                    if (block.offsetWidth > block.parentElement.clientWidth || block.getBoundingClientRect().right > document.documentElement.clientWidth) wide.push('block: ' + block.textContent.slice(0, 30));
                    const blockLines = [...block.querySelectorAll('.line')];
                    if (block.scrollWidth > block.clientWidth) {
                        scrolling++;
                        const widest = blockLines.reduce((a, b) => b.textContent.length > a.textContent.length ? b : a, blockLines[0]);
                        const text = widest?.textContent ?? '';
                        if (!phone || !unbreakable(text)) wide.push(`code ${block.scrollWidth - block.clientWidth} px: ${text.trim().slice(0, 50)}`);
                    }
                    for (const line of blockLines) {
                        lines++;
                        const range = document.createRange();
                        range.selectNodeContents(line);
                        if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1) wrapped.push(line.textContent.slice(0, 30));
                    }
                }
                const forms = {phone: shown.filter(block => block.closest('.code-phone')).length, desktop: shown.filter(block => block.closest('.code-desktop')).length};
                return {blocks: shown.length, lines, scrolling, wrapped, wide, forms};
            }, [width === 390, String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\x60[^\x60]*\x60|https?:\/\/\S+|\/(?:[^/\\\n]|\\.)+\/[dgimsuy]*`]);
            check(`code at ${width} on ${path}: no code line wraps`, found.lines > 0 && found.wrapped.length === 0, `${found.wrapped.length} of ${found.lines} lines wrap ${found.wrapped.join(' | ')}`);
            check(`code at ${width} on ${path}: no code block scrolls${width === 390 ? ' except for a string or URL' : ''}`, found.wide.length === 0, `${found.blocks} blocks, ${found.scrolling} scroll sideways; ${found.wide.join(' | ')}`);
            check(`code at ${width} on ${path}: the ${width === 390 ? 'phone' : 'desktop'} form shows`, width === 390 ? found.forms.phone > 0 && found.forms.desktop === 0 : found.forms.desktop > 0 && found.forms.phone === 0, JSON.stringify(found.forms));
            check(`code at ${width} on ${path}: no horizontal scroll of the page`, await overflow(page) <= 0, (await overflow(page)) + ' px');
            check(`code at ${width} on ${path}: no failed request and no error`, problems.length === 0, problems.join(' | '));
            if (screenshots && path === '/reference/server') {
                await page.locator('main pre:visible').filter({hasText: 'ImageDecoder'}).first().scrollIntoViewIfNeeded();
                const file = `${screenshots}-server-code-${width}.png`;
                await page.screenshot({path: file});
                console.log('screenshot', file);
            }
            await close();
        }
    }

    // A long table of contents on a phone, in Chromium and in WebKit with touch, scrolls to its last entry, which is
    // in the window and takes the reader to its heading (#1312). The list is as high as the window without the
    // toolbars of the browser (`dvh`); Playwright has no toolbars, so Safari on iOS needs a check on the device.
    // Chromium scrolls the list with the wheel: a synthesized touch swipe scrolls nothing in headless Chromium on Linux,
    // not even the page. Playwright cannot swipe or turn the wheel in WebKit with touch, so there the list is scrolled
    // by its `scrollTop`.
    for (const type of [chromium, webkit]) {
        const engine = type === chromium ? browser : await launchOther(type, 'table of contents on a phone');
        if (!engine) continue;
        for (const path of ['/reference/map', '/reference/description']) {
            const name = `table of contents of ${path} on a phone in ${type.name()}`;
            const context = await engine.newContext(devices['iPhone 13']);
            const page = await context.newPage();
            await page.goto(base + path, {waitUntil: 'networkidle'});
            const trigger = page.getByRole('button', {name: 'On this page'});
            const list = page.locator('nav').filter({has: trigger});
            const entries = list.locator('[data-slot="content"][data-state="open"] a');
            await trigger.tap();
            await entries.first().waitFor();
            await page.waitForTimeout(300);
            const box = await list.boundingBox();
            if (type === chromium) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            for (let last = -1; ;) {
                if (type === chromium) await page.mouse.wheel(0, 400);
                else await list.evaluate(element => element.scrollBy(0, 400));
                await page.waitForTimeout(100);
                const top = await list.evaluate(element => element.scrollTop);
                if (top === last) break;
                last = top;
            }
            const place = await list.evaluate(element => {
                const links = element.querySelectorAll('[data-slot="content"][data-state="open"] a');
                return {
                    entries: links.length,
                    list: Math.round(element.getBoundingClientRect().bottom),
                    last: Math.round(links[links.length - 1].getBoundingClientRect().bottom),
                    window: innerHeight,
                    page: scrollY,
                    scrolled: element.scrollTop > 0 && element.scrollTop >= element.scrollHeight - element.clientHeight - 1,
                };
            });
            check(`${name}: the list is longer than the window and scrolls to its end`, place.scrolled, JSON.stringify(place));
            check(`${name}: the last entry is in the window`, place.last <= place.list && place.list <= place.window, JSON.stringify(place));
            // The last turn of the wheel in the loop is past the end of the list.
            if (type === chromium) check(`${name}: the wheel past the end of the list does not scroll the page`, place.page === 0, JSON.stringify(place));
            const lastEntry = entries.last();
            const id = decodeURIComponent((await lastEntry.getAttribute('href')).slice(1));
            await lastEntry.tap();
            await page.waitForTimeout(1000);
            check(`${name}: a tap on the last entry goes to "${id}"`, decodeURIComponent(new URL(page.url()).hash.slice(1)) === id, page.url());
            await context.close();
        }
        if (engine !== browser) await engine.close();
    }

    // The table of contents (useTocActive) marks exactly one entry: the section that the reader is in (#1251).
    {
        const tocPage = '/guide/view-and-camera';
        const {page, problems, close} = await open(tocPage);
        const entries = page.locator('a.legend-link:visible');
        const ids = (await entries.evaluateAll(links => links.map(link => decodeURIComponent(link.getAttribute('href').slice(1)))));
        const activeIds = () => entries.evaluateAll(links => links.filter(link => link.classList.contains('toc-active')).map(link => decodeURIComponent(link.getAttribute('href').slice(1))));
        const settle = () => page.waitForTimeout(300);
        const expectOne = async (where, id) => {
            const found = await activeIds();
            check(`table of contents ${where}: one entry is active, "${id}"`, found.length === 1 && found[0] === id, JSON.stringify(found));
        };
        check('table of contents: the page has at least four entries', ids.length >= 4, String(ids.length));
        await settle();
        await expectOne('at the top', ids[0]);
        const middle = ids[Math.floor(ids.length / 2)];
        // The heading a little below the place where a link puts it is still the active one.
        await page.evaluate(id => {
            const heading = document.getElementById(id);
            window.scrollTo(0, window.scrollY + heading.getBoundingClientRect().top - parseFloat(getComputedStyle(heading).scrollMarginTop) + 2);
        }, middle);
        await settle();
        await expectOne('in the middle', middle);
        if (screenshots) { const file = `${screenshots}-toc-middle-1440.png`; await page.screenshot({path: file}); console.log('screenshot', file); }
        await page.mouse.wheel(0, -60);
        await settle();
        await expectOne('a little above a heading', ids[ids.indexOf(middle) - 1]);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await settle();
        await expectOne('at the bottom', ids.at(-1));
        if (screenshots) { const file = `${screenshots}-toc-bottom-1440.png`; await page.screenshot({path: file}); console.log('screenshot', file); }
        await entries.nth(1).click();
        await page.waitForTimeout(1000);
        await expectOne('after a click on the second entry', ids[1]);
        check('table of contents: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();

        const context = await browser.newContext({viewport: {width: 1440, height: 900}, javaScriptEnabled: false});
        const plain = await context.newPage();
        await plain.goto(base + tocPage);
        const plainEntries = plain.locator('a.legend-link:visible');
        check('table of contents without JavaScript: no entry is active', await plain.locator('a.toc-active').count() === 0);
        check('table of contents without JavaScript: the entries link to the headings', (await plainEntries.count()) === ids.length && (await plainEntries.first().getAttribute('href')) === '#' + encodeURIComponent(ids[0]));
        await context.close();
    }

    // The map of a recipe and its editor (#1121), and /play, in each browser of --browsers. The map runs in a sandboxed
    // frame (app/utils/map-frame.ts); the checks look for its canvas, which the map makes before the style loads, so
    // they do not need other hosts.
    for (const engine of editorBrowsers) {
        const own = engine === 'chromium' ? browser : await launchOther(playwright[engine], `editor and /play in ${engine}`);
        if (!own) continue;
        const context = await own.newContext({viewport: {width: 1440, height: 900}});
        const page = await context.newPage();
        // (Playwright reports the errors of the frames here too, so the check runs before the code with an error.)
        const problems = [];
        page.on('pageerror', error => problems.push('error: ' + error.message.slice(0, 200)));
        // The scripts of the site that the page loads (the library of the frame in /lib/ is not counted).
        const scripts = [];
        page.on('response', response => {
            if (response.request().resourceType() === 'script' && response.url().startsWith(base) && !response.url().startsWith(base + '/lib/')) scripts.push(response.body().then(body => body.toString(), () => ''));
        });
        const loaded = async () => { const bodies = await Promise.all(scripts); return {bytes: bodies.reduce((sum, body) => sum + body.length, 0), editor: bodies.some(body => body.includes('cm-content'))}; };
        const replace = async (editor, text) => {
            await editor.click();
            await page.keyboard.press('ControlOrMeta+a');
            await page.keyboard.insertText(text);
        };
        const shown = (locator, state = 'visible') => locator.waitFor({state, timeout: 30000}).then(() => true, () => false);
        // The text of a CodeMirror editor that shows all of its lines.
        const textOf = editor => editor.evaluate(content => [...content.querySelectorAll('.cm-line')].map(line => line.textContent).join('\n'));

        await page.goto(base + '/recipes/basic', {waitUntil: 'load'});
        const frame = page.frameLocator('.live-example iframe');
        check(`${engine}: recipe: the map of the Main API code starts`, await shown(frame.locator('#map canvas').first()));
        // The stylesheet of the frame styles the buttons of the example code and not the buttons of the map controls (#1355).
        const controlButton = frame.locator('.map-jr-ctrl-group button').first();
        check(`${engine}: recipe: a button of a map control has no margin, padding or border from the frame`, await shown(controlButton) && await controlButton.evaluate(button => {
            const style = getComputedStyle(button);
            return [style.marginLeft, style.marginBottom, style.paddingTop, style.paddingLeft, style.borderTopWidth].every(value => value === '0px');
        }));
        const before = await loaded();
        check(`${engine}: recipe: the page loads no code of the editor before "Edit"`, !before.editor, `${(before.bytes / 1024).toFixed(1)} KB of scripts`);
        await page.getByRole('button', {name: 'Edit the Main API code'}).click();
        const editor = page.locator('.live-example .cm-content');
        await shown(editor);
        const after = await loaded();
        check(`${engine}: recipe: "Edit" loads the editor`, after.editor, `${((after.bytes - before.bytes) / 1024).toFixed(1)} KB more`);

        const code = await page.locator('.live-example .code-variant[data-variant="main"] pre').first().textContent();
        await replace(editor, code + "\ndocument.body.append(Object.assign(document.createElement('output'), {id: 'edited'}));\n");
        await page.getByRole('button', {name: 'Run', exact: true}).click();
        check(`${engine}: recipe: a changed example runs`, await shown(frame.locator('#edited'), 'attached') && await frame.locator('#map canvas').count() > 0);
        // On a page of its own, so that the later checks keep the page and the editor of the recipe "basic".
        const fitPage = await context.newPage();
        await fitPage.goto(base + '/recipes/fit', {waitUntil: 'load'});
        const ownButton = fitPage.frameLocator('.live-example iframe').getByRole('button', {name: 'Show all landings'});
        check(`${engine}: recipe: a button of the example code keeps the style of the frame`, await shown(ownButton) && await ownButton.evaluate(button => {
            const style = getComputedStyle(button);
            return style.marginLeft === '12px' && style.paddingLeft === '10px' && style.borderTopWidth === '1px';
        }));
        await fitPage.close();
        check(`${engine}: recipe: no error of the page`, problems.length === 0, problems.join(' | '));
        await replace(editor, "import {createMap} from '@map-jr/map-jr-gl';\nconst map = createMap(;\n");
        await page.keyboard.press('ControlOrMeta+Enter');
        const log = page.locator('.live-example [role="log"]');
        const logged = await shown(log) ? await log.textContent() : '';
        check(`${engine}: recipe: an error of the code shows as text below the map, with its line`, /SyntaxError/.test(logged) && /line 2/.test(logged), logged.trim());
        problems.length = 0;

        // /play keeps the code and the view in the address, and a copied address shows both again.
        await page.goto(base + '/play', {waitUntil: 'load'});
        const playFrame = page.frameLocator('.map-frame iframe');
        const playEditor = page.locator('.cm-content');
        check(`${engine}: /play: the editor and the map start`, await shown(playEditor) && await shown(playFrame.locator('#map canvas').first()));
        check(`${engine}: /play: has no section "The code"`, await page.getByText('The code is a module').count() === 0 && await page.locator('main p').filter({hasText: 'default export'}).count() === 0);
        const changed = "import {navigation} from '@map-jr/map-jr-gl/controls';\n\nexport default {\n  style: 'https://styles.map-jr.org/1/elevation-zero.json',\n  initialView: {center: [2.35, 48.86], zoom: 5},\n  controls: [navigation()],\n};";
        await replace(playEditor, changed);
        const written = await page.waitForFunction(() => location.hash.includes('code=') && location.hash.includes('view=5/48.86/2.35'), null, {timeout: 30000}).then(() => true, () => false);
        check(`${engine}: /play: the address follows the code and the map`, written, new URL(page.url()).hash.slice(0, 80));
        const copied = new URL(page.url());
        copied.hash = copied.hash.replace(/view=[^&]*/, 'view=7/48.9/2.4/20/30');
        const second = await context.newPage();
        await second.goto(copied.href, {waitUntil: 'load'});
        await shown(second.locator('.cm-content'));
        await shown(second.frameLocator('.map-frame iframe').locator('#map canvas').first());
        await second.waitForTimeout(2000);
        const text = await textOf(second.locator('.cm-content'));
        check(`${engine}: /play: a copied address shows the same code`, text.trim() === changed, text.slice(0, 80));
        const view = new URLSearchParams(new URL(second.url()).hash.slice(1)).get('view');
        check(`${engine}: /play: a copied address shows the same view`, view === '7/48.9/2.4/20/30', view);
        // The examples are one menu, and it fits a phone (#1339). Each item puts its code into the editor.
        const examplesButton = page.getByRole('button', {name: 'Examples', exact: true});
        const menuItems = page.getByRole('menuitem');
        const chosen = [];
        await examplesButton.click();
        const labels = (await shown(menuItems.first()) ? await menuItems.allTextContents() : []).map(label => label.trim());
        await page.keyboard.press('Escape');
        check(`${engine}: /play: the examples menu has 10 or more examples`, labels.length >= 10, labels.join(', '));
        for (const label of labels) {
            await examplesButton.click();
            await page.getByRole('menuitem', {name: label, exact: true}).click();
            await page.waitForTimeout(300);
            const code = await textOf(playEditor);
            const duplicate = chosen.includes(code);
            chosen.push(code);
            check(`${engine}: /play: the example "${label}" puts a description into the editor`, /export default \{/.test(code) && !duplicate, code.split('\n').slice(0, 3).join(' ').slice(0, 80));
        }
        {
            const phone = await own.newContext({viewport: {width: 390, height: 700}});
            const small = await phone.newPage();
            await small.goto(base + '/play', {waitUntil: 'load'});
            await small.getByRole('button', {name: 'Examples', exact: true}).click();
            await small.getByRole('menuitem').first().waitFor();
            const box = await small.locator('[role="menu"]').evaluate(menu => { const {left, right, top, bottom} = menu.getBoundingClientRect(); return {left, right, top, bottom, width: innerWidth, height: innerHeight}; });
            check(`${engine}: /play: at 390 the examples menu is inside the window`, box.left >= 0 && box.right <= box.width && box.top >= 0 && box.bottom <= box.height, JSON.stringify(box));
            await small.getByRole('menuitem').last().scrollIntoViewIfNeeded();
            check(`${engine}: /play: at 390 the last example can be reached`, await small.getByRole('menuitem').last().isVisible());
            await phone.close();
        }

        // The grabber between the editor and the map (#1337): a pointer and the keys change the split, the map follows,
        // and the page below the width "lg" has no grabber.
        await page.goto(base + '/play', {waitUntil: 'load'});
        await shown(playFrame.locator('#map canvas').first());
        const grabber = page.getByRole('separator', {name: 'Width of the editor and the map'});
        const sizes = async () => {
            const editorBox = await page.locator('.code-editor').boundingBox();
            const frameBox = await page.locator('.map-frame iframe').boundingBox();
            await page.waitForTimeout(300);
            const canvas = await playFrame.locator('#map canvas').first().evaluate(element => element.getBoundingClientRect().width);
            return {editor: Math.round(editorBox.width), map: Math.round(frameBox.width), canvas: Math.round(canvas)};
        };
        check(`${engine}: /play: the grabber has a name, a value and the keyboard focus`, await grabber.getAttribute('aria-valuenow') === '50' && await grabber.getAttribute('tabindex') === '0' && await grabber.getAttribute('aria-orientation') === 'vertical');
        const first = await sizes();
        check(`${engine}: /play: the split starts at half`, Math.abs(first.editor - first.map) <= 2, JSON.stringify(first));
        const spot = await grabber.boundingBox();
        await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2);
        await page.mouse.down();
        await page.mouse.move(spot.x + spot.width / 2 + 100, spot.y + spot.height / 2, {steps: 5});
        // Over the frame of the map, the drag goes on.
        await page.mouse.move(spot.x + spot.width / 2 + 200, spot.y + spot.height / 2, {steps: 5});
        await page.mouse.up();
        const dragged = await sizes();
        check(`${engine}: /play: a drag of 200 px makes the editor 200 px wider and the map narrower`, Math.abs(dragged.editor - first.editor - 200) <= 3 && Math.abs(first.map - dragged.map - 200) <= 3, JSON.stringify({first, dragged}));
        check(`${engine}: /play: the canvas of the map follows the split`, Math.abs(dragged.canvas - dragged.map) <= 2 && dragged.canvas < first.canvas - 150, `${first.canvas} -> ${dragged.canvas}`);
        await page.mouse.move(0, spot.y + 100);
        await page.mouse.down();
        await page.mouse.move(2, spot.y + 100);
        await page.mouse.up();
        // (A drag that starts away from the grabber does not move it.)
        check(`${engine}: /play: a press away from the grabber does not move the split`, (await sizes()).editor === dragged.editor);
        await grabber.focus();
        await page.keyboard.press('ArrowLeft');
        const left = await sizes();
        check(`${engine}: /play: ArrowLeft makes the editor narrower by 2% and ArrowRight wider`, left.editor < dragged.editor && Math.abs(dragged.editor - left.editor - 0.02 * 1440) <= 3, `${dragged.editor} -> ${left.editor}`);
        await page.keyboard.press('ArrowRight');
        check(`${engine}: /play: ArrowRight undoes ArrowLeft`, Math.abs((await sizes()).editor - dragged.editor) <= 2);
        await page.keyboard.press('Home');
        const least = await sizes();
        check(`${engine}: /play: Home gives the editor 20% of the width`, await grabber.getAttribute('aria-valuenow') === '20' && Math.abs(least.editor - 0.2 * 1440) <= 3, JSON.stringify(least));
        await page.keyboard.press('ArrowLeft');
        check(`${engine}: /play: the split stops at 20%`, (await sizes()).editor === least.editor);
        await page.keyboard.press('End');
        check(`${engine}: /play: End gives the editor 80% of the width`, await grabber.getAttribute('aria-valuenow') === '80' && Math.abs((await sizes()).editor - 0.8 * 1440) <= 3);
        // The split stays while the visitor moves around the site.
        await page.locator('header a[href="/recipes"]').first().click();
        await page.waitForURL('**/recipes');
        await page.goBack();
        await page.locator('.code-editor').waitFor({timeout: 30000});
        check(`${engine}: /play: the split stays after a visit to another page`, await grabber.getAttribute('aria-valuenow') === '80');
        await page.setViewportSize({width: 390, height: 844});
        check(`${engine}: /play: below the width "lg" there is no grabber`, !(await grabber.isVisible()));
        check(`${engine}: /play: no error of the page`, problems.length === 0, problems.join(' | '));
        // The button reads "Copy link", and a popover says what the link keeps.
        check(`${engine}: /play: the button reads "Copy link"`, await page.getByRole('button', {name: 'Copy link', exact: true}).count() === 1);
        await page.getByRole('button', {name: 'What the link keeps'}).click();
        check(`${engine}: /play: a popover says that the link keeps the code and the view`, await shown(page.getByText('The link keeps the code and the view of the map')));

        // The steps of the history (#1338): Run, a choice of an example and Copy link make a step, a key stroke does not.
        // Each code sets `data-step` on the body of the frame, so the checks see which code the map got.
        await page.goto(base + '/play', {waitUntil: 'load'});
        await shown(playEditor);
        const step = name => `document.body.dataset.step = '${name}';\nexport default {\n  style: 'https://styles.map-jr.org/1/elevation-zero.json',\n  initialView: {center: [2.35, 48.86], zoom: 5},\n};`;
        const editorIs = async expected => {
            for (let tries = 0; tries < 80; tries++) {
                if ((await textOf(playEditor)).trim() === expected.trim()) return true;
                await page.waitForTimeout(100);
            }
            return false;
        };
        const editorStarts = async start => {
            for (let tries = 0; tries < 80; tries++) {
                if ((await textOf(playEditor)).startsWith(start)) return true;
                await page.waitForTimeout(100);
            }
            return false;
        };
        const mapHas = name => shown(playFrame.locator(`body[data-step="${name}"]`), 'attached');
        const undoButton = page.getByRole('button', {name: 'Undo', exact: true});
        const redoButton = page.getByRole('button', {name: 'Redo', exact: true});
        const firstExample = "import {navigation, scale}";
        check(`${engine}: /play history: Undo and Redo are disabled at the start`, await undoButton.isDisabled() && await redoButton.isDisabled());
        const entries = () => page.evaluate(() => history.length);
        const length = await entries();
        await replace(playEditor, step('a'));
        check(`${engine}: /play history: a key stroke is no step`, await entries() === length, `${length} entries before, ${await entries()} after`);
        await page.getByRole('button', {name: 'Run', exact: true}).click();
        await replace(playEditor, step('b'));
        await page.keyboard.press('ControlOrMeta+Enter');
        check(`${engine}: /play history: Run makes a step, and the map follows`, await mapHas('b') && await undoButton.isEnabled() && await redoButton.isDisabled());
        await undoButton.click();
        check(`${engine}: /play history: Undo restores the code of the first Run, and the map follows`, await editorIs(step('a')) && await mapHas('a') && await redoButton.isEnabled());
        await undoButton.click();
        check(`${engine}: /play history: Undo again restores the first example`, await editorStarts(firstExample) && await undoButton.isDisabled());
        await redoButton.click();
        check(`${engine}: /play history: Redo restores the first Run`, await editorIs(step('a')) && await mapHas('a'));
        await redoButton.click();
        check(`${engine}: /play history: Redo restores the second Run`, await editorIs(step('b')) && await mapHas('b') && await redoButton.isDisabled());
        await page.goBack();
        check(`${engine}: /play history: Back restores the first Run, and the map follows`, await editorIs(step('a')) && await mapHas('a') && await redoButton.isEnabled());
        await page.goForward();
        check(`${engine}: /play history: Forward restores the second Run`, await editorIs(step('b')) && await mapHas('b'));
        await replace(playEditor, step('c'));
        await undoButton.click();
        check(`${engine}: /play history: Undo keeps the work that no Run has saved as a step`, await editorIs(step('b')) && await mapHas('b'));
        await redoButton.click();
        check(`${engine}: /play history: Redo returns to that work`, await editorIs(step('c')) && await mapHas('c'));
        await page.getByRole('button', {name: 'Examples', exact: true}).click();
        await page.getByRole('menuitem', {name: 'Globe', exact: true}).click();
        check(`${engine}: /play history: choosing an example makes a step`, await editorStarts("import {navigation, globe}"));
        await undoButton.click();
        check(`${engine}: /play history: Undo returns from an example`, await editorIs(step('c')));
        await replace(playEditor, step('d'));
        await page.getByRole('button', {name: 'Copy link', exact: true}).click();
        await undoButton.click();
        check(`${engine}: /play history: Copy link makes a step`, await editorIs(step('c')));
        await redoButton.click();
        check(`${engine}: /play history: the step of Copy link has the code of the link`, await editorIs(step('d')) && decodeURIComponent(page.url()).includes('code='));
        check(`${engine}: /play history: no error of the page`, problems.length === 0, problems.join(' | '));
        await context.close();
        if (own !== browser) await own.close();
    }

    // The table of contents on a phone, in Chromium and in WebKit with touch: a tap on an entry closes the list and
    // shows the heading below the bar of the list (#1311). The page has no scroll anchoring, as in Safari before 27.
    for (const type of [chromium, webkit]) {
        const name = `table of contents on a phone in ${type.name()}`;
        const engine = type === chromium ? browser : await launchOther(type, `${name.replace(/ in \w+$/, '')}`);
        if (!engine) continue;
        const context = await engine.newContext(devices['iPhone 13']);
        const page = await context.newPage();
        const problems = [];
        page.on('pageerror', error => problems.push('error: ' + error.message.slice(0, 200)));
        await page.goto(base + '/reference/map', {waitUntil: 'networkidle'});
        await page.addStyleTag({content: '* {overflow-anchor: none}'});
        const trigger = page.getByRole('button', {name: 'On this page'});
        const entries = page.locator('nav').filter({has: trigger}).locator('[data-slot="content"][data-state="open"] a');
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
        await trigger.tap();
        await entries.first().waitFor();
        const entry = entries.nth(Math.floor((await entries.count()) / 2));
        const id = decodeURIComponent((await entry.getAttribute('href')).slice(1));
        await entry.tap();
        await page.waitForTimeout(1000);
        const state = await trigger.getAttribute('data-state');
        const place = await page.evaluate(id => ({
            heading: Math.round(document.getElementById(id).getBoundingClientRect().top),
            bar: Math.round(document.querySelector('nav:has(button[data-slot="trigger"])').getBoundingClientRect().bottom),
            window: innerHeight,
        }), id);
        check(`${name}: a tap on an entry closes the list`, state === 'closed', state);
        check(`${name}: the heading "${id}" is in view below the bar`, place.heading >= place.bar && place.heading < place.window / 2, JSON.stringify(place));
        check(`${name}: no error`, problems.length === 0, problems.join(' | '));
        await context.close();
        if (engine !== browser) await engine.close();
    }

    // /play on a phone, in Chromium and in WebKit with touch: the page has the width of the window, and no element is wider
    // than it, apart from the lines of the editor, which scroll inside it (#1336). The editor is above the map.
    for (const type of [chromium, webkit]) {
        const name = `/play on a phone in ${type.name()}`;
        const engine = type === chromium ? browser : await launchOther(type, `${name.replace(/ in \w+$/, '')}`);
        if (!engine) continue;
        const context = await engine.newContext(devices['iPhone 13']);
        const page = await context.newPage();
        const problems = [];
        page.on('pageerror', error => problems.push('error: ' + error.message.slice(0, 200)));
        await page.goto(base + '/play', {waitUntil: 'load'});
        await page.locator('.cm-content').waitFor({timeout: 30000});
        await page.locator('.map-frame iframe').waitFor({timeout: 30000});
        const place = await page.evaluate(() => {
            const width = innerWidth;
            const wide = [...document.querySelectorAll('body *')]
                .filter(element => !element.closest('.cm-scroller') && element.getBoundingClientRect().right > width + 1 && element.getBoundingClientRect().width > 0)
                .map(element => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`);
            const top = selector => Math.round(document.querySelector(selector).getBoundingClientRect().top);
            return {
                width, scroll: document.documentElement.scrollWidth, wide: wide.slice(0, 5),
                header: Math.round(document.querySelector('header').getBoundingClientRect().width),
                editor: top('.code-editor'), map: top('.map-frame'),
            };
        });
        check(`${name}: the layout width is that of the screen (390)`, place.width === 390 && place.scroll <= 390, `${place.width}, scroll ${place.scroll}`);
        check(`${name}: the header has the width of the window`, place.header === place.width, String(place.header));
        check(`${name}: no element is wider than the window`, place.wide.length === 0, place.wide.join(' | '));
        check(`${name}: the editor is above the map`, place.editor < place.map, `${place.editor} < ${place.map}`);
        check(`${name}: no error`, problems.length === 0, problems.join(' | '));
        await context.close();
        if (engine !== browser) await engine.close();
    }

    // The raw Markdown of a page is the file of docs/.
    {
        const raw = await fetch(base + '/raw/recipes/query.md').then(response => response.text());
        check('/raw/recipes/query.md: equals docs/recipes/query.md', raw === readFileSync(new URL('../../docs/recipes/query.md', import.meta.url), 'utf8'));
    }

    // For agents: llms.txt, llms-full.txt, the prompt of the migration and the buttons that copy markdown.
    {
        const text = async path => { const response = await fetch(base + path); return {status: response.status, body: await response.text()}; };
        const llms = await text('/llms.txt');
        check('/llms.txt: answers with the title and a link to the raw prompt', llms.status === 200 && llms.body.startsWith('# Map Jr. GL') && llms.body.includes('/raw/migrate/prompt.md'), String(llms.status));
        const full = await text('/llms-full.txt');
        check('/llms-full.txt: answers with the text of the pages', full.status === 200 && full.body.length > 100000 && full.body.includes('Migration prompt'), `${full.status}, ${full.body.length} characters`);
        const prompt = await text('/raw/migrate/prompt.md');
        const source = readFileSync(new URL('../../docs/migrate/prompt.md', import.meta.url), 'utf8');
        check('/raw/migrate/prompt.md: equals docs/migrate/prompt.md', prompt.body === source);
        const block = /^```[^\n]*\n([\s\S]*?)\n```$/m.exec(source)?.[1] ?? '';
        check('docs/migrate/prompt.md: the prompt is between 2,000 and 8,000 characters (about 2,000 tokens at most)', block.length >= 2000 && block.length <= 8000, `${block.length} characters`);

        // The clipboard needs its own context with the permission, and a page of its own.
        const context = await browser.newContext({viewport: {width: 1440, height: 900}});
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: base});
        const page = await context.newPage();
        await page.goto(base + '/recipes/query', {waitUntil: 'networkidle'});
        // What the button did: a tab that it opened (its fallback when the copy fails) and the warning that it wrote.
        const events = [];
        context.on('page', opened => events.push('opened a tab: ' + opened.url()));
        page.on('console', message => { if (message.text().includes('[map-jr site]')) events.push(message.text().slice(0, 200)); });
        // The check waits until the clipboard holds the expected text, and does not rely on the clipboard having been
        // emptied: a write with a promise of the text can leave the clipboard empty until the promise resolves. On a
        // timeout it reports the length of the last text that it read, and the events.
        const copy = async (name, expected) => {
            const started = Date.now();
            await page.getByRole('button', {name}).first().click();
            const arrived = await page.waitForFunction(async expected => {
                window.__lastClipboard = await navigator.clipboard.readText();
                return window.__lastClipboard === expected;
            }, expected, {timeout: 5000, polling: 100}).then(() => true, () => false);
            const last = await page.evaluate(() => window.__lastClipboard ?? null);
            return {ok: arrived, detail: arrived ? `${expected.length} characters in ${Date.now() - started} ms` : `the clipboard has ${last === null ? 'no read' : last.length + ' characters'} after ${Date.now() - started} ms; ${events.join(' | ') || 'the button did nothing visible'}`};
        };
        const first = await copy('Copy page as markdown', readFileSync(new URL('../../docs/recipes/query.md', import.meta.url), 'utf8'));
        check('"Copy page as markdown" copies the file of docs/', first.ok, first.detail);
        // The labels change back after two seconds. The second click waits for that, so that a render of the buttons
        // cannot fall between its press and its release.
        const reverted = await page.getByRole('button', {name: 'Copy page as markdown'}).waitFor({timeout: 5000}).then(() => true, () => false);
        check('"Copied" changes back to "Copy page as markdown"', reverted);
        const second = await copy('Copy migration prompt', block);
        check('"Copy migration prompt" copies the block of the prompt', second.ok, second.detail);
        await context.close();
    }

    // The home page (#1120).
    {
        const html = await (await fetch(base + '/')).text();
        check('home page: the first paint is the SVG of the server renderer', /<svg[^>]*data-map-jr-ssr/.test(html));
        // The page has the committed file whole (app/assets/home-first-paint.html, written by `pnpm first-paint`): the build needs no network.
        const committed = readFileSync(new URL('../app/assets/home-first-paint.html', import.meta.url), 'utf8');
        check('home page: the first paint is the committed file of app/assets', html.includes(committed), `${committed.length} bytes`);
    }
    if (withMap) {
        const {page, problems, close} = await open('/');
        const started = Date.now();
        const idle = await page.locator('[data-home-map][data-map-state="idle"]').waitFor({timeout: 90000}).then(() => true, () => false);
        check('home page: the map reaches idle', idle, idle ? `${Date.now() - started} ms after the load event` : await page.locator('[data-home-map]').getAttribute('data-map-state'));
        check('home page: the map has a canvas', await page.locator('[data-home-map] canvas').count() > 0);
        // The scale bar shows what the browser measured: the check waits for the value.
        await page.locator('[data-home-measure][data-state="measured"]').waitFor({timeout: 30000}).catch(() => {});
        const bytes = await page.locator('[data-home-bytes]').textContent();
        check('home page: the scale bar shows the bytes of the map in KB', /^\d[\d,]* KB$/.test(bytes ?? ''), bytes ?? '');
        // The number counts the library files (gzip, as the server sent them). `pnpm status` measures the same files in dist/: the
        // page script and the worker file of the main entry are in docs/status.json. The home page also loads the controls and
        // the adapter, so the number is allowed to differ by 10%.
        const measured = Number(await page.locator('[data-home-bytes]').getAttribute('data-bytes'));
        const status = JSON.parse(readFileSync(new URL('../../docs/status.json', import.meta.url), 'utf8'));
        const expected = status.sizes.find(row => row.file.startsWith('Page script and worker file of `@map-jr/map-jr-gl`')).bytes;
        check('home page: the bytes of the map are within 10% of the page script and the worker file of docs/status.json', Math.abs(measured - expected) <= expected * 0.1, `${measured} B measured, ${expected} B in docs/status.json`);
        const fetched = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname));
        check('home page: no development file of the library is fetched', !fetched.some(path => /\.dev\.js$|mistakes/.test(path)), fetched.filter(path => /\.dev\.js$|mistakes/.test(path)).join(' '));

        // The map does not take the wheel before "Explore the map": the wheel scrolls the page, and the map is inert.
        check('home page: the map is inert before the button', await page.locator('[data-home-map]').evaluate(element => element.inert));
        await page.mouse.move(720, 450);
        await page.mouse.wheel(0, 600);
        const scrolled = await page.waitForFunction(() => scrollY > 100, null, {timeout: 5000}).then(() => true, () => false);
        check('home page: the wheel over the map scrolls the page before the button', scrolled);
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForFunction(() => scrollY === 0);
        await page.locator('[data-explore]').click();
        check('home page: after the button the map takes the pointer and the page does not scroll', await page.locator('[data-home-map]').evaluate(element => !element.inert) && await page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'));
        await page.getByRole('button', {name: 'Back to the page'}).click();
        check('home page: "Back to the page" gives the scroll back', await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'));

        // The camera flies to a stop.
        await page.evaluate(() => document.querySelector('[data-stop="compat"]').scrollIntoView({block: 'center'}));
        const flight = await page.waitForFunction(() => document.querySelector('[data-home-map]').dataset.camera || false, null, {timeout: 15000}).then(handle => handle.jsonValue(), () => '');
        check('home page: the camera flies to the next stop', flight === 'fly', flight);
        check('home page: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }
    if (withMap) {
        // The first paint has the scale and the centre of the live map at every size of the window (#1393). The labels of places in
        // the SVG (the page without JavaScript) are where the places of the idle map are: every label has the same horizontal
        // distance (within 3 px) to its place, so the scale and the centre agree, and most labels have the same vertical
        // distance to their place, which is the offset of the label from the dot. (A label of two lines has another offset.)
        // Windows up to 1000 by 1060 px have the inline SVG of 1000 by 1000. The others have the SVG of 2560 by 1600 from /home-first-paint-wide.svg
        // as the background of the stage; the check puts that file where the style puts it (centred on the stage, 1:1) and measures it.
        const wideSvg = await (await fetch(base + '/home-first-paint-wide.svg')).text();
        for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
            const plain = await browser.newContext({viewport: {width, height}, javaScriptEnabled: false});
            const first = await plain.newPage();
            await first.goto(base + '/');
            const painted = await first.evaluate(wideSvg => {
                const background = getComputedStyle(document.querySelector('.home-first-wide'));
                const stage = document.querySelector('[data-home-map]').getBoundingClientRect();
                if (background.display !== 'none') {
                    // The style of the wide picture: centred, 2560 by 1600, no repeat.
                    if (background.backgroundSize !== '2560px 1600px' || background.backgroundRepeat !== 'no-repeat' || background.backgroundPositionX !== '50%' || background.backgroundPositionY !== '50%') return {wrong: `${background.backgroundSize} ${background.backgroundRepeat} ${background.backgroundPosition}`};
                    const holder = document.createElement('div');
                    holder.style.cssText = `position:absolute;left:${stage.x + stage.width / 2 - 1280}px;top:${stage.y + stage.height / 2 - 800}px;width:2560px;height:1600px`;
                    holder.innerHTML = wideSvg;
                    document.body.append(holder);
                }
                return {wide: background.display !== 'none', stage: [stage.width, stage.height], labels: Object.fromEntries([...document.querySelectorAll('svg text')].map(label => {
                    const box = label.getBoundingClientRect();
                    return [label.textContent.trim(), [box.x + box.width / 2, box.y + box.height / 2]];
                }))};
            }, wideSvg);
            check(`home page at ${width} px: the first paint is the ${painted.wide ? 'wide' : 'inline'} picture, centred at 1:1 and larger than the stage`, !painted.wrong && (painted.wide ? 2560 >= painted.stage[0] && 1600 >= painted.stage[1] : 1000 >= painted.stage[0] && 1000 >= painted.stage[1]), painted.wrong ?? `stage ${painted.stage?.map(Math.round).join(' x ')}`);
            await plain.close();
            const {page, close} = await open('/', {width, height});
            await page.locator('[data-home-map][data-map-state="idle"]').waitFor({timeout: 90000}).catch(() => {});
            const live = await page.evaluate(async () => {
                const map = document.querySelector('[data-home-map]').__homeMap;
                const places = {};
                for (const feature of await map.queryFeatures()) {
                    const name = feature.properties?.['name:en'] ?? feature.properties?.name;
                    if (name && feature.geometry.type === 'Point' && String(feature.layer?.id ?? feature.layer).startsWith('place_') && !places[name]) places[name] = map.project(feature.geometry.coordinates);
                }
                return places;
            });
            const fetchedWide = await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.endsWith('/home-first-paint-wide.svg')));
            check(`home page at ${width} px: the wide first paint is ${painted.wide ? '' : 'not '}fetched`, fetchedWide === painted.wide);
            const matches = Object.keys(live).filter(name => painted.labels?.[name]).map(name => ({name, dx: painted.labels[name][0] - live[name].x, dy: painted.labels[name][1] - live[name].y}));
            const dys = matches.map(match => match.dy).sort((x, y) => x - y);
            const median = dys[Math.floor(dys.length / 2)];
            const wide = matches.filter(match => Math.abs(match.dx) > 3);
            const same = matches.filter(match => Math.abs(match.dy - median) <= 3).length;
            check(`home page at ${width} px: the places of the first paint are where the idle map has them`, matches.length >= 6 && wide.length === 0 && same >= matches.length * 0.7,
                `${matches.length} places, ${wide.length} off by more than 3 px across (${wide.map(match => `${match.name} ${match.dx.toFixed(1)}`).join(', ')}), ${same} with the usual offset of ${median?.toFixed(1)} px down`);
            await close();
        }
    }
    if (withMap) {
        // The swap from the first paint to the map (#1416): a log of every animation frame from the start of the page to idle. The first
        // paint covers the live canvas and the live controls while it shows (it is later in the document and has a higher z-index
        // than the child of the stage that holds them), and when it is gone the map has drawn its first view (`idle`).
        const log = `(() => {
            window.__frames = [];
            const tick = () => {
                const stage = document.querySelector('[data-home-map]');
                if (stage) {
                    const child = element => { let node = element; while (node && node.parentElement !== stage) node = node.parentElement; return node; };
                    const first = stage.querySelector('[data-home-first]');
                    const live = [...stage.querySelectorAll('canvas, .map-jr-ctrl, .maplibregl-ctrl')].map(element => child(element)).filter(Boolean);
                    const z = element => Number.parseInt(getComputedStyle(element).zIndex) || 0;
                    const order = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING;
                    // The place of each control: in the first paint while it shows, and in the live map after it.
                    const rects = {};
                    for (const name of ['zoom-in', 'zoom-out', 'compass', 'scale', 'attrib']) {
                        const within = first ?? stage;
                        const found = [...within.querySelectorAll('.map-jr-ctrl-' + name)].find(element => element.getClientRects().length > 0 && (first || !element.closest('[data-home-first]')));
                        const box = found?.getBoundingClientRect();
                        if (box) rects[name] = [box.x, box.y, box.width, box.height];
                    }
                    // The scheme of the page and of the first paint (the controls layer that shows has the class of its scheme).
                    const shown = first && [...first.querySelectorAll('.map-jr-ssr-layer')].find(element => element.getClientRects().length > 0);
                    window.__frames.push({first: !!first, state: stage.dataset.mapState, live: live.length, rects, page: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                        paint: first ? (shown ? (shown.classList.contains('map-jr-dark') ? 'dark' : 'light') : 'none') : '',
                        uncovered: first ? live.filter(element => element !== first && !(z(first) > z(element) || (z(first) === z(element) && order(first, element)))).length : 0});
                    if (stage.dataset.mapState === 'idle' && window.__frames.length > 5 && !first) { window.__frames.done = true; return; }
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        })()`;
        // The first paint has the scheme of the page (#1422): the colour mode of the site sets the class `dark` on <html> in the head, from
        // the stored choice or else from `prefers-color-scheme`. `stored` is the choice in localStorage, and `system` the media query.
        const stores = value => `try { localStorage.setItem('nuxt-color-mode', '${value}'); } catch {}`;
        const cases = [
            ...['light', 'dark'].flatMap(scheme => [[390, 844], [1024, 768], [1440, 900]].map(([width, height]) => ({scheme, width, height, system: scheme, expect: scheme}))),
            {scheme: 'dark', width: 1024, height: 768, system: 'light', stored: 'dark', expect: 'dark'},
            {scheme: 'light', width: 1024, height: 768, system: 'dark', stored: 'light', expect: 'light'},
        ];
        for (const {width, height, system, stored, expect} of cases) {
            const {page, close} = await open('/', {width, height, scheme: system, init: (stored ? stores(stored) + ';' : '') + log});
            await page.waitForFunction(() => window.__frames?.done, null, {timeout: 90000}).catch(() => {});
            const frames = await page.evaluate(() => window.__frames ?? []);
            const label = `home page at ${width} px in ${expect}${stored ? ` (stored, system ${system})` : ''}`;
            // Every frame with the first paint has the scheme of the page, and the page has the expected scheme from the first frame.
            const wrongScheme = frames.filter(frame => frame.page !== expect || (frame.first && frame.paint !== expect));
            check(`${label}: the first paint has the colours of the page in every frame`, frames.length > 5 && wrongScheme.length === 0,
                `${frames.length} frames, ${wrongScheme.length} wrong (${[...new Set(wrongScheme.map(frame => `page ${frame.page}, paint ${frame.paint}`))].join('; ')})`);
            // The page fetches the pictures of its scheme only. The inline picture of the light scheme is part of the HTML.
            const fetchedPictures = (await page.evaluate(() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname))).filter(path => path.startsWith('/home-first-paint'));
            const small = width <= 1000 && height <= 1060;
            const picture = scheme => scheme === 'dark' ? [small ? '/home-first-paint-dark.svg' : '/home-first-paint-wide-dark.svg'] : small ? [] : ['/home-first-paint-wide.svg'];
            // A stored choice that differs from the system has the preload of the system's picture too: the preload reads the media query and not the class.
            const wanted = [...new Set([...picture(expect), ...picture(system)])].sort();
            check(`${label}: it fetches ${wanted.join(' ') || 'no picture file'}`, [...new Set(fetchedPictures)].sort().join(' ') === wanted.join(' '), [...new Set(fetchedPictures)].join(' ') || 'none');
            const live = frames.filter(frame => frame.live > 0).length;
            const uncovered = frames.filter(frame => frame.first && frame.uncovered > 0).length;
            const bare = frames.filter(frame => !frame.first && frame.state !== 'idle').length;
            const swap = frames.findIndex(frame => !frame.first);
            // The controls are at the same places before and after the swap (the last frame with the first paint, and the first without it).
            const before = frames[swap - 1]?.rects ?? {}, after = frames[swap]?.rects ?? {};
            const names = ['zoom-in', 'zoom-out', 'compass', 'scale', 'attrib'];
            const moved = names.filter(name => !before[name] || !after[name] || before[name].some((value, index) => Math.abs(value - after[name][index]) > 2));
            check(`${label}: the controls of the first paint are where the live controls are after the swap`, swap > 0 && moved.length === 0,
                moved.length ? moved.map(name => `${name} ${JSON.stringify(before[name]?.map(Math.round))} -> ${JSON.stringify(after[name]?.map(Math.round))}`).join('; ') : `${names.length} controls within 2 px`);
            check(`${label}: the first paint covers the live map and its controls in every frame, and the map is idle when it goes`, frames.length > 5 && live > 0 && swap > 0 && uncovered === 0 && bare === 0,
                `${frames.length} frames, ${live} with the live map, ${uncovered} where it shows through the first paint, ${bare} without the first paint and not idle, swap in frame ${swap}`);
            await close();
        }
    }
    if (withMap) {
        // A reader who prefers reduced motion gets a cut.
        const {page, close} = await open('/', {reducedMotion: 'reduce'});
        await page.locator('[data-home-map][data-map-state="idle"]').waitFor({timeout: 90000}).catch(() => {});
        await page.evaluate(() => document.querySelector('[data-stop="compat"]').scrollIntoView({block: 'center'}));
        const flight = await page.waitForFunction(() => document.querySelector('[data-home-map]').dataset.camera || false, null, {timeout: 15000}).then(handle => handle.jsonValue(), () => '');
        check('home page: reduced motion makes a cut and no flight', flight === 'cut', flight);
        await close();
    }
    {
        // Without WebGL 2 the SVG stays, and the text and the stops of the page work.
        const init = `const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : get.call(this, type, ...rest); };`;
        const {page, close} = await open('/', {init});
        await page.waitForFunction(() => document.querySelector('[data-home-map]')?.dataset.mapState === 'error' || document.querySelector('.map-jr-unavailable'), null, {timeout: 30000}).catch(() => {});
        check('home page without WebGL 2: the SVG of the first paint stays', await page.locator('svg[data-map-jr-ssr]').count() > 0);
        check('home page without WebGL 2: the page still shows its text', await page.locator('h1').first().isVisible() && await page.getByRole('link', {name: 'Read the docs'}).first().isVisible());
        await page.evaluate(() => document.querySelector('[data-stop="limits"]').scrollIntoView({block: 'center'}));
        check('home page without WebGL 2: a stop still scrolls into view', await page.getByRole('heading', {name: 'What it does not do'}).isVisible());
        await close();
    }
    if (withMap) {
        const {page, problems, close} = await open('/', {width: 390, height: 844});
        const idle = await page.locator('[data-home-map][data-map-state="idle"]').waitFor({timeout: 90000}).then(() => true, () => false);
        check('home page at 390 px: the map reaches idle', idle);
        const unreachable = [];
        for (const name of ['scale', 'compat', 'play', 'showcase', 'limits', 'install']) {
            await page.evaluate(name => document.querySelector(`[data-stop="${name}"]`).scrollIntoView({block: 'center'}), name);
            await page.waitForTimeout(300);
            const reachable = await page.evaluate(() => {
                const box = document.querySelector('[data-explore]').getBoundingClientRect();
                return !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('[data-explore]') && box.top >= 0 && box.bottom <= innerHeight;
            });
            if (!reachable) unreachable.push(name);
        }
        check('home page at 390 px: the button "Explore the map" is in the window and nothing covers it at each stop', unreachable.length === 0, unreachable.join(' '));
        const wide = await overflow(page);
        check('home page at 390 px: no horizontal scroll', wide <= 0, String(wide));
        check('home page at 390 px: no failed request and no error', problems.length === 0, problems.join(' | '));
        await close();
    }

    if (screenshots) {
        for (const [name, path] of [['home', '/'], ['docs', docsPage]]) {
            for (const scheme of ['light', 'dark']) {
                for (const width of [1440, 390]) {
                    const {page, close} = await open(path, {width, height: width === 390 ? 844 : 900, scheme});
                    if (path === '/') await page.locator('[data-home-map][data-map-state="idle"]').waitFor({timeout: 90000}).catch(() => {});
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
