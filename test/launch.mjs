// Starts the browser for the tests and benchmarks. The BROWSER variable selects it: chromium (the default), firefox
// or webkit. Any other value is ignored with one line on stderr, because shells set BROWSER for other uses (macOS
// sets BROWSER=open for the command that opens a URL). WebKit is the engine of Safari, so it is the nearest thing to Safari that runs on Linux and Windows.
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const require = createRequire(import.meta.url);
const browsers = ['chromium', 'firefox', 'webkit'];
export const browserName = browsers.includes(process.env.BROWSER) ? process.env.BROWSER : 'chromium';
if (process.env.BROWSER && browserName !== process.env.BROWSER) {
    console.error(`launch.mjs: using chromium, because BROWSER="${process.env.BROWSER}" is not chromium, firefox or webkit`);
}

// Where to find Chromium when Playwright's own build is missing (the image of the cloud VM has /opt/pw-browsers/chromium).
const imageChromium = '/opt/pw-browsers/chromium';

// The folder of the pinned Playwright browsers: the first of PLAYWRIGHT_BROWSERS_PATH and `candidates` that has the
// Chromium build `revision` (a folder chromium-<revision>), or none, so that Playwright uses what it finds. The
// cloud VM sets PLAYWRIGHT_BROWSERS_PATH to the image's folder, which has an older build, so the variable alone
// does not decide.
export function pinnedBrowsersPath(env, candidates, revision, has = (dir, rev) => existsSync(path.join(dir, `chromium-${rev}`))) {
    return [env.PLAYWRIGHT_BROWSERS_PATH, ...candidates].find(dir => dir && has(dir, revision));
}

// The revision of Chromium that the installed Playwright pins.
export const pinnedRevision = type => type.executablePath().match(/chromium-(\d+)/)?.[1];

// `.cache-pw` of this checkout, or of the main checkout when this one is a git worktree (brief of the workers, step 6).
export function cachePwCandidates() {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd: root, encoding: 'utf8'}).stdout?.trim();
    return [path.join(root, '.cache-pw'), ...(common ? [path.join(path.dirname(common), '.cache-pw')] : [])];
}

// One line that names the Chromium build in use, and says how to install the pinned one when the image's build is used.
export function chromiumNote(type, env = process.env) {
    const file = chromiumOptions(type).executablePath || type.executablePath();
    if (env.PW_CHROMIUM) return `chromium: ${file} (PW_CHROMIUM)`;
    if (existsSync(file) && file !== imageChromium) return `chromium: ${file} (pinned build, as CI uses)`;
    if (file === imageChromium) return `chromium: ${file} (the image's build, not the one CI uses; install the pinned build with: PLAYWRIGHT_BROWSERS_PATH=<checkout>/.cache-pw pnpm exec playwright install chromium)`;
    return 'chromium: none found; run pnpm exec playwright install chromium';
}

// The options that every launch of Chromium shares, so that no script has to know where the browser is. `type` is
// `chromium` of the Playwright that the script uses. The executable is, in this order: the file named by PW_CHROMIUM;
// the pinned build in PLAYWRIGHT_BROWSERS_PATH or in .cache-pw when it is installed there; none (Playwright's own folder) when the pinned build exists; the file of the cloud VM image when it
// exists. With none of these Playwright reports its own "Executable doesn't exist" error.
export function chromiumOptions(type) {
    const revision = pinnedRevision(type), dir = pinnedBrowsersPath(process.env, cachePwCandidates(), revision);
    const pinned = dir && type.executablePath().replace(/^.*?(?=chromium-\d+[\\/])/, dir + path.sep);
    const executablePath = process.env.PW_CHROMIUM || pinned
        || (existsSync(type.executablePath()) || !existsSync(imageChromium) ? undefined : imageChromium);
    return executablePath ? {executablePath} : {};
}

export function launch() {
    const type = require('playwright')[browserName];
    // A Linux machine without a GPU needs Chromium's software renderer for WebGL. On macOS and Windows the browser
    // uses the GPU of the machine, if there is one.
    const args = browserName !== 'chromium' ? [] : os.platform() === 'linux'
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
    // Firefox without a GPU refuses WebGL unless it is told to use its software renderer.
    const firefoxUserPrefs = {'webgl.force-enabled': true, 'webgl.disable-fail-if-major-performance-caveat': true, 'webgl.enable-webgl2': true, 'gfx.webrender.software': true};
    // Firefox without a window draws a few frames each second on the page's thread, which makes each test time out.
    // HEADED=1 opens a window (on Linux that needs a display, for example xvfb-run).
    const started = type.launch(browserName === 'firefox' ? {firefoxUserPrefs, headless: !process.env.HEADED} : {args, ...(browserName === 'chromium' && chromiumOptions(type))});
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
