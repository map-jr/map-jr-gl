// Runs one browser suite for an agent: node scripts/agents/suite.mjs <suite> [arguments of the suite]
// For example: node scripts/agents/suite.mjs test/host.mjs, or node scripts/agents/suite.mjs test/interact.mjs .cache/shots
//
// 1. It builds what is older than its sources: `dist/` (node build.mjs) and, for a suite that uses the demo server,
//    the pages in `site-dist/` (node scripts/site.mjs).
// 2. It waits for a free slot: at most SUITE_SLOTS suites (default 2) run at once on one machine, over all worktrees.
//    A slot is a file map-jr-suite-slot-<n> in the system temp folder with the PID of its holder. A slot whose process
//    has ended (killed included) is free again. A suite that waits prints one line that says so.
// 3. For a suite that reads PORT (host.mjs, interact.mjs, loading.mjs), it starts the demo server on a free port and
//    waits until the server answers. Several agents can run suites at the same time, each with its own server.
// 4. It runs the suite with BROWSER=chromium when BROWSER is not a browser of Playwright (the Mac sets BROWSER=open).
//    For Chromium it uses the pinned build in .cache-pw when installed, and prints one line that names the build.
// 5. It prints the PASS, FAIL and SKIP counts and each FAIL line, and keeps the complete output in .cache/agents/.
// 6. It stops the server in every case. The server and the suite also end by themselves when this script ends,
//    even when it is killed, because each of them exits when its standard input closes.
//
// The exit code is 0 when the suite exited with 0 and printed no FAIL line, and 1 otherwise.
// --no-build skips step 1. node scripts/agents/suite.mjs --help prints this text.
import {spawn, spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), noBuild = args[0] === '--no-build';
if (noBuild) args.shift();
if (!args.length || args[0] === '--help') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
    process.exit(args.length ? 0 : 2);
}
const [suite, ...suiteArgs] = args;
if (!existsSync(path.join(root, suite))) { console.error(`suite.mjs: there is no file ${suite}. Give a path such as test/host.mjs.`); process.exit(2); }
const usesServer = readFileSync(path.join(root, suite), 'utf8').includes('process.env.PORT');

/** The newest modification time of the files under `dirs` (files or folders), in milliseconds. */
function newest(dirs) {
    let t = 0;
    const walk = p => {
        if (!existsSync(p)) return;
        const s = statSync(p);
        if (s.isDirectory()) { for (const f of readdirSync(p)) if (f !== 'node_modules' && f !== 'public') walk(path.join(p, f)); }
        else t = Math.max(t, s.mtimeMs);
    };
    for (const d of dirs) walk(path.join(root, d));
    return t;
}
const age = f => existsSync(path.join(root, f)) ? statSync(path.join(root, f)).mtimeMs : 0;
function run(what, cmd, cmdArgs) {
    console.log(`suite.mjs: ${what}`);
    const r = spawnSync(cmd, cmdArgs, {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8'});
    if (r.status !== 0) { console.error(r.stdout.slice(-3000) + r.stderr.slice(-3000)); console.error(`suite.mjs: ${what} failed.`); process.exit(1); }
}

// Playwright is not in the lockfile: CI and the development machines add it (the version that CI uses).
try { createRequire(path.join(root, 'package.json')).resolve('playwright'); } catch {
    const version = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8').match(/playwright@([\d.]+)/)?.[1];
    console.error(`suite.mjs: Playwright is not installed. Run:\n  pnpm add -D playwright@${version} && git checkout package.json pnpm-lock.yaml`);
    process.exit(2);
}

if (!noBuild) {
    if (newest(['src', 'build.mjs', 'scripts/private-names.mjs', 'package.json']) > age('dist/map-jr-gl.js')) run('building dist/ (node build.mjs)', process.execPath, ['build.mjs']);
    if (usesServer && newest(['examples', 'dist', 'demo', 'scripts/site.mjs', 'scripts/examples-plugins.mjs']) > age('site-dist/examples/run.html')) run('building site-dist (node scripts/site.mjs)', process.execPath, ['scripts/site.mjs']);
}

// A slot of the machine (step 2). The slot is checked again after a moment, because two suites that free the same
// stale slot at once can both write it; the one whose PID is not in it goes on waiting.
const slots = Math.max(1, Number(process.env.SUITE_SLOTS) || 2), slotFile = n => path.join(tmpdir(), `map-jr-suite-slot-${n}`);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const read = f => { try { return Number(readFileSync(f, 'utf8')); } catch { return 0; } };
let slot = '';
async function takeSlot() {
    for (let n = 1; n <= slots; n++) {
        const f = slotFile(n), holder = read(f);
        if (holder && alive(holder)) continue;
        if (existsSync(f)) try { unlinkSync(f); } catch { /* another suite freed it */ }
        try { writeFileSync(f, String(process.pid), {flag: 'wx'}); } catch { continue; }
        await new Promise(r => setTimeout(r, 100));
        if (read(f) === process.pid) return f;
    }
    return '';
}
process.on('exit', () => { if (slot && read(slot) === process.pid) try { unlinkSync(slot); } catch { /* gone */ } });
for (let said = false; !(slot = await takeSlot());) {
    if (!said) { said = true; console.log(`suite.mjs: waiting for a free slot; ${slots} suites run on this machine (SUITE_SLOTS).`); }
    await new Promise(r => setTimeout(r, 2000));
}

/** A port that no process listens on now. */
const freePort = () => new Promise((resolve, reject) => {
    const s = createServer().once('error', reject).listen(0, () => { const {port} = s.address(); s.close(() => resolve(port)); });
});
// Each child exits when its standard input closes, that is when this script ends in any way. (`unref`: the open
// input does not keep a suite running after its last test.)
const tied = ['--import', 'data:text/javascript,process.stdin.on("data",()=>{}).on("end",()=>process.exit(1)).unref()'];
const children = new Set();
const start = (cmdArgs, env, out) => {
    const child = spawn(process.execPath, [...tied, ...cmdArgs], {cwd: root, env: {...process.env, ...env}, stdio: ['pipe', 'pipe', 'pipe']});
    children.add(child);
    child.on('exit', () => children.delete(child));
    child.stdout.on('data', out); child.stderr.on('data', out);
    return child;
};
const stop = () => { for (const c of children) c.kill('SIGTERM'); };
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); console.error(`suite.mjs: stopped by ${sig}; the server is stopped.`); process.exit(130); });
process.on('exit', stop);

const env = {};
if (!['chromium', 'firefox', 'webkit'].includes(process.env.BROWSER ?? 'chromium')) env.BROWSER = 'chromium';
// The Chromium build (step 4): test/launch.mjs picks the pinned one under .cache-pw when installed, as CI uses.
// Nothing is downloaded here.
if ((env.BROWSER ?? process.env.BROWSER ?? 'chromium') === 'chromium') {
    const {chromiumNote} = await import(path.join(root, 'test/launch.mjs'));
    console.log(`suite.mjs: ${chromiumNote(createRequire(path.join(root, 'package.json'))('playwright').chromium)}`);
}
let serverLog = '';
if (usesServer) {
    env.PORT = String(await freePort());
    const server = start(['demo/serve.mjs'], {PORT: env.PORT}, d => { serverLog += d; });
    let up = false;
    for (let i = 0; i < 60 && !up && server.exitCode === null; i++) {
        try { up = (await fetch(`http://localhost:${env.PORT}/`)).ok; } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    if (!up) { console.error(serverLog.slice(-2000)); console.error(`suite.mjs: the demo server did not answer on port ${env.PORT}.`); process.exit(1); }
    console.log(`suite.mjs: demo server on http://localhost:${env.PORT}`);
}

const name = path.basename(suite, '.mjs'), outDir = path.join(root, '.cache/agents');
mkdirSync(outDir, {recursive: true});
const outFile = path.join(outDir, `${name}-${env.PORT ?? process.pid}.txt`);
let output = '';
console.log(`suite.mjs: running ${[suite, ...suiteArgs].join(' ')}${env.BROWSER ? ' with BROWSER=chromium' : ''}`);
const code = await new Promise(resolve => start([suite, ...suiteArgs], env, d => { output += d; }).on('exit', c => resolve(c ?? 1)));
stop();
writeFileSync(outFile, output);
const lines = output.split('\n'), fails = lines.filter(l => l.startsWith('FAIL'));
console.log(`${suite}: ${lines.filter(l => l.startsWith('PASS')).length} passed, ${fails.length} failed, ${lines.filter(l => l.startsWith('SKIP')).length} skipped, exit code ${code}`);
for (const l of fails) console.log(l);
if (code !== 0 && !fails.length) console.log(lines.slice(-15).join('\n'));
console.log(`suite.mjs: the complete output is in ${path.relative(root, outFile)}`);
process.exit(code === 0 && !fails.length ? 0 : 1);
