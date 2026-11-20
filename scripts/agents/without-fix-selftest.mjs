// Checks that a browser suite run through without-fix.mjs tests the build of the copy, not the dist/ of this
// checkout (#1294): node scripts/agents/without-fix-selftest.mjs
//
// It builds this checkout and writes a file dist/without-fix-selftest.js into it, which the copy does not have. It
// runs the tiny suite test/agents/served-dist.mjs here as a control, where the server serves the marker, and then
//   node scripts/agents/without-fix.mjs -- node scripts/agents/suite.mjs --no-build test/agents/served-dist.mjs
// where the copy builds its own dist/, and the suite checks that the demo server serves that dist/map-jr-gl.js and
// answers the marker with an error. It removes the marker in every case. It takes about two minutes (two builds).
// The exit code is 0 when both runs pass.
import {spawnSync} from 'node:child_process';
import {rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const node = (...args) => spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'}).status;
if (node('build.mjs')) process.exit(1); // (first, so that no later build of this checkout removes the marker)
const marker = path.join(root, 'dist/without-fix-selftest.js');
writeFileSync(marker, '// the dist/ of the checkout, not of the copy\n');
let here, copy;
try {
    here = node('scripts/agents/suite.mjs', '--no-build', 'test/agents/served-dist.mjs');
    copy = node('scripts/agents/without-fix.mjs', '--', 'node', 'scripts/agents/suite.mjs', '--no-build', 'test/agents/served-dist.mjs');
} finally {
    rmSync(marker, {force: true});
}
console.log(`without-fix-selftest.mjs: in this checkout ${here ? 'FAIL' : 'PASS'}; through without-fix.mjs ${copy ? 'FAIL' : 'PASS'}.`);
process.exit(here || copy ? 1 : 0);
