// The memory of the benchmark page after each run of each scenario (#959), in Chromium or in Playwright's WebKit.
//
//   node test/bench/memory.mjs [chromium|webkit] [query of the page]
//   node test/bench/memory.mjs webkit 'auto&runs=3&only=terrain'
//
// It starts its own demo server on a free port, and prints one line of JSON for each run, once the maps of that run
// are removed. The page calls window.benchBetween after each run, and this script measures then:
//   heapMB    the JS heap after two forced collections (Chromium only)
//   rssMB     the resident memory of the page processes (Chromium renderers, or WebKit's WebContent processes)
//   gpuMB     the resident memory of the GPU process
//   live      WebGL contexts that the page made and that are not lost (the page itself keeps one, for the GPU name)
// The resident memory counts every process of that kind on the machine, so close other browsers of the same engine.
// WebKit collects when it chooses: its numbers can fall between runs, and only a steady rise means that memory is kept.
import {spawn, execSync} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium, webkit} from 'playwright';

const [kind = 'chromium', query = 'auto&runs=3&only=terrain'] = process.argv.slice(2);
const port = await new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn(process.execPath, ['demo/serve.mjs'], {env: {...process.env, PORT: String(port)}, stdio: 'ignore'});
process.on('exit', () => server.kill());
const resident = pattern => {
    try { return Math.round(+execSync(`ps -axo rss,command | grep -i -- "${pattern}" | grep -v grep | awk '{s+=$1} END {print s+0}'`).toString() / 1024); } catch { return null; }
};
try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    const browser = await (kind === 'webkit' ? webkit : chromium).launch();
    const page = await browser.newPage();
    await page.addInitScript(() => {
        const made = [];
        for (const C of [HTMLCanvasElement, globalThis.OffscreenCanvas].filter(Boolean)) {
            const get = C.prototype.getContext;
            C.prototype.getContext = function (type, ...rest) { const c = get.call(this, type, ...rest); if (c && /webgl/.test(type) && !made.includes(c)) made.push(c); return c; };
        }
        window.benchLiveContexts = () => made.filter(c => !c.isContextLost()).length;
        window.benchBetween = name => window.benchMeasure(name);
    });
    const cdp = kind === 'chromium' ? await page.context().newCDPSession(page) : null;
    await page.exposeFunction('benchMeasure', async name => {
        let heapMB = null;
        if (cdp) {
            await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
            heapMB = Math.round((await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576);
        }
        await new Promise(r => setTimeout(r, 500));
        const live = await page.evaluate(() => window.benchLiveContexts());
        console.log(JSON.stringify({name, heapMB, rssMB: resident(kind === 'webkit' ? 'WebContent' : 'type=renderer'), gpuMB: resident(kind === 'webkit' ? 'WebKit.GPU' : 'type=gpu-process'), live}));
    });
    await page.goto(`http://localhost:${port}/bench?${query}`);
    await page.waitForFunction(() => window.benchResults, null, {timeout: 60 * 60000, polling: 2000});
    const errors = await page.evaluate(() => window.benchResults.filter(r => r.error).map(r => `${r.name}: ${r.error}`));
    console.log(errors.length ? `errors: ${errors.join('; ')}` : 'no errors');
    await browser.close();
} finally { server.kill(); }
