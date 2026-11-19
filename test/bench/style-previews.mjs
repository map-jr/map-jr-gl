// From the repository root, run pnpm build, serve it with python3 -m http.server 8041,
// then run node test/bench/style-previews.mjs. REPEATS defaults to 3. Each trial uses a fresh browser context.
// The first capture supplies the hosted WebP fixtures. Open /test/bench/style-previews.html?mode=hosted
// from a phone on the same network to measure that device. The other modes are open, idle and none.
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base = process.env.BENCH_URL || 'http://127.0.0.1:8041';
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    ...(process.env.BENCH_PROXY ? {proxy: {server: process.env.BENCH_PROXY, bypass: 'localhost,127.0.0.1'}} : {}),
});
const fixtureDir = new URL('../../.cache/style-previews/', import.meta.url);
async function run(mode, timing, seed = false) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    const deadline = setTimeout(() => context.close().catch(() => {}), 180000);
    page.setDefaultTimeout(90000);
    const requests = [], failures = [];
    context.on('requestfinished', req => {
        if (/^https?:/.test(req.url())) requests.push(req.sizes().catch(() => null));
    });
    context.on('requestfailed', req => failures.push([req.url(), req.failure()?.errorText]));
    context.on('response', res => { if (res.status() >= 400) failures.push([res.url(), res.status()]); });
    page.on('pageerror', err => failures.push([page.url(), err.message]));
    const follow = timing === 'move' && mode !== 'hosted';
    try {
        await page.goto(base + '/test/bench/style-previews.html?mode=' + mode + (follow ? '&follow' : ''), {waitUntil: 'commit'});
        await page.waitForFunction(() => window.benchmark);
        if (mode !== 'none') {
            if (timing !== 'early') {
                await page.waitForFunction(() => benchmark.results.idle !== null);
                if (mode !== 'open') await page.evaluate(() => benchmark.prepared);
            }
            if (timing === 'move') await page.evaluate(() => benchmark.move());
            // Dispatch immediately at the first opportunity. Locator actionability waits would hide cold-open latency.
            await page.evaluate(() => document.querySelector('#toggle').click());
            await page.waitForFunction(() => benchmark.results.opens[0]?.all != null);
            if (seed) {
                await mkdir(fixtureDir, {recursive: true});
                const images = await page.locator('#panel img').evaluateAll(imgs => Promise.all(imgs.map(async img =>
                    Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())))));
                const hashes = images.map(bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
                if (new Set(hashes).size !== images.length) throw new Error('Two preview fixtures are identical. Check the captured styles.');
                for (const [i, bytes] of images.entries()) await writeFile(new URL(i + '.webp', fixtureDir), Buffer.from(bytes));
            }
            await page.evaluate(() => { const b = document.querySelector('#toggle'); b.click(); b.click(); });
            await page.waitForFunction(() => benchmark.results.opens[1]?.all != null);
        }
        await page.waitForFunction(() => benchmark.results.idle !== null);
        const result = await page.evaluate(() => benchmark.results);
        const sizes = await Promise.all(requests);
        const bytes = sizes.reduce((n, s) => n + Math.max(0, s?.responseBodySize || 0), 0);
        console.log(JSON.stringify({mode, timing, seed, ...result, requests: sizes.length, sized: sizes.filter(Boolean).length, bytes, failures}));
        if (result.errors.length || failures.some(([, e]) => e !== 'net::ERR_ABORTED')) process.exitCode = 1;
    } catch (error) {
        console.log(JSON.stringify({mode, timing, error: error.message, failures, result: await page.evaluate(() => window.benchmark?.results).catch(() => null)}));
        process.exitCode = 1;
    } finally { clearTimeout(deadline); await context.close(); }
}
try {
    await run('open', 'early', true);
    if (!process.exitCode) for (let n = 0; n < Number(process.env.REPEATS || 3); n++) {
        const modes = ['open', 'idle', 'hosted'];
        await run('none', 'idle');
        for (const timing of ['early', 'prepared', 'move']) for (let i = 0; i < modes.length; i++)
            await run(modes[(n + i) % modes.length], timing);
    }
} finally { await browser.close(); }
