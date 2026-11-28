// test/launch.mjs reads BROWSER. A value that is not a browser of Playwright (macOS sets BROWSER=open) falls back to
// chromium with one line on stderr, instead of stopping the run (#1025).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function run(browser: string) {
    const code = "const {browserName} = await import('./test/launch.mjs'); console.log(browserName);";
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], {env: {...process.env, BROWSER: browser}, encoding: 'utf8'});
    return {status: r.status, name: r.stdout.trim(), stderr: r.stderr};
}

test('BROWSER=open falls back to chromium and says why', () => {
    const r = run('open');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.name, 'chromium');
    assert.match(r.stderr, /using chromium, because BROWSER="open"/);
});

test('BROWSER=webkit and BROWSER=firefox are kept', () => {
    for (const b of ['webkit', 'firefox']) {
        const r = run(b);
        assert.equal(r.name, b);
        assert.equal(r.stderr, '');
    }
});

test('the pinned browsers folder: the first folder with the pinned build, else none', async () => {
    const {pinnedBrowsersPath} = await import('../launch.mjs');
    const has = (d: string, rev: string) => d === '/b' && rev === '1255';
    assert.equal(pinnedBrowsersPath({PLAYWRIGHT_BROWSERS_PATH: '/image'}, ['/a', '/b'], '1255', has), '/b');
    assert.equal(pinnedBrowsersPath({PLAYWRIGHT_BROWSERS_PATH: '/b'}, ['/a'], '1255', has), '/b');
    assert.equal(pinnedBrowsersPath({}, ['/a'], '1255', has), undefined);
    assert.equal(pinnedBrowsersPath({}, ['/b'], '1243', has), undefined);
});
