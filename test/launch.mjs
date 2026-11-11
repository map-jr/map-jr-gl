// Starts the browser for the tests and benchmarks. The BROWSER variable selects it: chromium (the default), firefox
// or webkit. WebKit is the engine of Safari, so it is the nearest thing to Safari that runs on Linux and Windows.
import {createRequire} from 'node:module';
import os from 'node:os';

const playwright = createRequire(import.meta.url)('playwright');
export const browserName = process.env.BROWSER ?? 'chromium';

export function launch() {
    const type = playwright[browserName];
    if (!type) throw new Error(`Unknown browser "${browserName}": use chromium, firefox or webkit`);
    // A Linux machine without a GPU needs Chromium's software renderer for WebGL. On macOS and Windows the browser
    // uses the GPU of the machine, if there is one.
    const args = browserName !== 'chromium' ? [] : os.platform() === 'linux'
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
    // Firefox without a GPU refuses WebGL unless it is told to use its software renderer.
    const firefoxUserPrefs = {'webgl.force-enabled': true, 'webgl.disable-fail-if-major-performance-caveat': true, 'webgl.enable-webgl2': true, 'gfx.webrender.software': true};
    return type.launch(browserName === 'firefox' ? {firefoxUserPrefs} : {args});
}
