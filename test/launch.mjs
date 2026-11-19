// Starts the browser for the tests and benchmarks. The BROWSER variable selects it: chromium (the default), firefox
// or webkit. Any other value is ignored with one line on stderr, because shells set BROWSER for other uses (macOS
// sets BROWSER=open for the command that opens a URL). WebKit is the engine of Safari, so it is the nearest thing to Safari that runs on Linux and Windows.
import {createRequire} from 'node:module';
import os from 'node:os';

const playwright = createRequire(import.meta.url)('playwright');
const browsers = ['chromium', 'firefox', 'webkit'];
export const browserName = browsers.includes(process.env.BROWSER) ? process.env.BROWSER : 'chromium';
if (process.env.BROWSER && browserName !== process.env.BROWSER) {
    console.error(`launch.mjs: using chromium, because BROWSER="${process.env.BROWSER}" is not chromium, firefox or webkit`);
}

export function launch() {
    const type = playwright[browserName];
    // A Linux machine without a GPU needs Chromium's software renderer for WebGL. On macOS and Windows the browser
    // uses the GPU of the machine, if there is one.
    const args = browserName !== 'chromium' ? [] : os.platform() === 'linux'
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
    // Firefox without a GPU refuses WebGL unless it is told to use its software renderer.
    const firefoxUserPrefs = {'webgl.force-enabled': true, 'webgl.disable-fail-if-major-performance-caveat': true, 'webgl.enable-webgl2': true, 'gfx.webrender.software': true};
    // Firefox without a window draws a few frames each second on the page's thread, which makes each test time out.
    // HEADED=1 opens a window (on Linux that needs a display, for example xvfb-run).
    const started = type.launch(browserName === 'firefox' ? {firefoxUserPrefs, headless: !process.env.HEADED} : {args});
    return process.env.NO_WORKER_WEBGL ? started.then(withoutWorkerWebGL) : started;
}

// Answers what the expression `test` gives in a classic worker of the page, or false when the worker does not load. The
// blob has the type text/javascript, as the blob workers of the library have (src/loader.ts): WebKit on macOS does not
// load a worker from a blob without a type on a page of the demo server ("Load failed", #936).
export const inWorker = (page, test) => page.evaluate(test => new Promise(resolve => {
    const w = new Worker(URL.createObjectURL(new Blob([`postMessage(${test})`], {type: 'text/javascript'})));
    w.onmessage = e => { resolve(e.data); w.terminate(); }; w.onerror = e => { e.preventDefault(); resolve(false); }; // (keeps the error of a worker that does not load from the page, #751)
}), test);

// Whether the browser of the page can make a WebGL2 context in a worker. WebKit on Linux and Windows and Safari before
// 16.4 cannot: the map then renders on the main thread, and a check of the worker renderer prints SKIP.
export const workerRenders = page => inWorker(page, 'typeof OffscreenCanvas !== "undefined" && !!new OffscreenCanvas(1, 1).getContext("webgl2")');
export const noWorkerRender = 'this browser cannot render in a worker';

// NO_WORKER_WEBGL=1 makes each classic worker of each page unable to get a WebGL context, as in WebKit on Linux and
// Windows, so that the SKIP of the checks of the worker renderer can be seen in Chromium (#772).
function withoutWorkerWebGL(browser) {
    const script = () => {
        const W = self.Worker, patch = 'const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };';
        self.Worker = class extends W {
            constructor(url, options) {
                if (options?.type === 'module') super(url, options);
                else super(URL.createObjectURL(new Blob([`${patch} importScripts(${JSON.stringify(new URL(url, location.href).href)});`], {type: 'text/javascript'})), options);
            }
        };
    };
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => { const context = await newContext(options); await context.addInitScript(script); return context; };
    browser.newPage = async options => { const context = await browser.newContext(options), page = await context.newPage(); page.once('close', () => context.close().catch(() => {})); return page; };
    return browser;
}
