// Chooses "React" on the page with seven labels and prints what each group shows afterwards.
// Usage: node spike/check-sync.mjs http://localhost:4310
import {chromium} from 'playwright';

const base = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
const groups = () => page.evaluate(() => [...document.querySelectorAll('[role="tablist"]')].map(list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    const panels = [...list.parentElement.querySelectorAll('pre')].filter(pre => pre.offsetParent !== null).length;
    return `${tabs.length} tabs, selected: ${active ? active.textContent.trim() : 'NONE'}, visible code blocks: ${panels}`;
}));
await page.goto(base + '/', {waitUntil: 'networkidle'});
console.log('/ at the start     ', await groups());
await page.getByRole('tab', {name: 'React'}).first().click();
await page.waitForTimeout(300);
console.log('/ after "React"    ', await groups());
for (const path of ['/guide/second', '/guide/third', '/']) {
    await page.goto(base + path, {waitUntil: 'networkidle'});
    await page.waitForTimeout(300);
    console.log(path.padEnd(19), await groups());
}
await page.goto(base + '/guide/second', {waitUntil: 'networkidle'});
await page.getByRole('tab', {name: 'Vue'}).first().click();
await page.waitForTimeout(300);
await page.goto(base + '/', {waitUntil: 'networkidle'});
await page.waitForTimeout(300);
console.log('/ after "Vue" on /guide/second', await groups());
console.log('single fences outside a group:', await page.evaluate(() => [...document.querySelectorAll('pre')].filter(pre => !pre.closest('[role="tabpanel"]') && !pre.parentElement.closest('[data-reka-collection-item], [role="tablist"]')).length));
await browser.close();
