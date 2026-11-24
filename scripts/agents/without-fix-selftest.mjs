// Checks that a browser suite run through without-fix.mjs tests the build of the copy, not the dist/ of this
// checkout (#1294): node scripts/agents/without-fix-selftest.mjs
//
// It builds this checkout and writes a file dist/without-fix-selftest.js into it, which the copy does not have. It
// runs the tiny suite test/agents/served-dist.mjs here as a control, where the server serves the marker, and then
//   node scripts/agents/without-fix.mjs -- node scripts/agents/suite.mjs --no-build test/agents/served-dist.mjs
// where the copy builds its own dist/, and the suite checks that the demo server serves that dist/map-jr-gl.js and
// answers the marker with an error. It removes the marker in every case. It takes about two minutes (two builds).
// Before that, it stages a change of test/agents/served-dist.mjs and a new file, checks that the copy has both
// (#1592), and restores them. The exit code is 0 when every run passes.
import {spawnSync} from 'node:child_process';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const node = (...args) => spawnSync(process.execPath, args, {cwd: root, stdio: 'inherit'}).status;
const git = (...args) => spawnSync('git', args, {cwd: root, encoding: 'utf8'});

// First, the copy has the changes that are staged and not committed: a changed file and a new file (#1592).
// The changed file must have no change of its own, because the check stages and then restores it.
const tracked = 'test/agents/served-dist.mjs', added = 'test/agents/without-fix-staged-new.txt';
let staged;
if (git('diff', '--quiet', 'HEAD', '--', tracked).status !== 0) {
    console.log(`without-fix-selftest.mjs: ${tracked} has changes, so the check of staged changes is skipped.`);
} else {
    const before = readFileSync(path.join(root, tracked), 'utf8');
    try {
        writeFileSync(path.join(root, tracked), before + '// staged change of without-fix-selftest.mjs\n');
        writeFileSync(path.join(root, added), 'staged new file\n');
        git('add', '--', tracked, added);
        staged = node('scripts/agents/without-fix.mjs', '--no-build', '--', process.execPath, '-e',
            `const fs = require('node:fs');
             if (!fs.readFileSync(${JSON.stringify(tracked)}, 'utf8').includes('staged change of without-fix-selftest')) { console.error('the staged change of ${tracked} is missing in the copy'); process.exit(1); }
             if (!fs.existsSync(${JSON.stringify(added)})) { console.error('the staged new file ${added} is missing in the copy'); process.exit(1); }`);
    } finally {
        git('reset', '-q', '--', tracked, added);
        writeFileSync(path.join(root, tracked), before);
        rmSync(path.join(root, added), {force: true});
    }
}

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
console.log(`without-fix-selftest.mjs: staged changes ${staged === undefined ? 'SKIPPED' : staged ? 'FAIL' : 'PASS'}; in this checkout ${here ? 'FAIL' : 'PASS'}; through without-fix.mjs ${copy ? 'FAIL' : 'PASS'}.`);
process.exit(here || copy || staged ? 1 : 0);
