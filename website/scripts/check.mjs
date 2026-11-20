// Checks the output of `pnpm generate` in Chromium, behind the plain static server of scripts/serve.mjs.
//
// Usage: node scripts/check.mjs [--no-map] [--screenshots=<path and start of the file names>]
//   --no-map       does not wait for the map of the home page. The map needs the style and the tiles of other hosts.
//   --screenshots  also saves pictures of the home page and of one docs page (light and dark), of the install block
//                  and of the code of /reference/server, each 1440 and 390 wide.
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const withMap = !process.argv.includes('--no-map');
const screenshots = process.argv.find(argument => argument.startsWith('--screenshots='))?.slice('--screenshots='.length);
const docsPage = '/vue';
// A page with several groups of code variants and without Nuxt.
const variantsPage = '/guide/markers-and-popups';
// A page with a group of package managers first and then groups of code variants.
const installPage = '/guide/getting-started';

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

    // The colours of the code (#1209): the tokens have the colours of the theme of the scheme, the block has the
    // sheet of the site, and each token has 4.5:1 or more against it. The lists are the foreground colours of the
    // themes github-light-default and github-dark-default of Shiki 4.6.0.
    {
        const themes = {
            light: {sheet: '#FFFFFF', colours: ['#1F2328', '#6E7781', '#CF222E', '#0550AE', '#953800', '#8250DF', '#116329', '#0A3069', '#82071E', '#57606A']},
            dark: {sheet: '#1C1D20', colours: ['#E6EDF3', '#8B949E', '#FF7B72', '#79C0FF', '#FFA657', '#D2A8FF', '#7EE787', '#A5D6FF', '#FFA198', '#F0F6FC']},
        };
        for (const scheme of ['light', 'dark']) {
            const {page, problems, close} = await open('/guide/getting-started', {scheme});
            await page.waitForFunction(scheme => document.documentElement.classList.contains(scheme), scheme);
            const blocks = await page.locator('main pre.shiki').evaluateAll(blocks => {
                const hex = colour => '#' + colour.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
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
            const foreign = used.filter(colour => !colours.includes(colour));
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
            // The table of options of /reference/server is wider than a phone (#1221).
            if (path === installPage || width === 1440) check(`code at ${width} on ${path}: no horizontal scroll of the page`, await overflow(page) <= 0, (await overflow(page)) + ' px');
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
