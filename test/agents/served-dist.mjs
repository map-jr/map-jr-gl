// A tiny suite for scripts/agents/without-fix-selftest.mjs (#1294). Run it through scripts/agents/suite.mjs, which
// sets process.env.PORT and starts the demo server of the checkout that the command runs in.
// It prints PASS when the server serves the dist/ of the current folder: dist/map-jr-gl.js as it is on disk here, and
// dist/without-fix-selftest.js only when this folder has that file. It prints FAIL otherwise.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const origin = `http://localhost:${process.env.PORT}`;
const here = f => path.join(process.cwd(), 'dist', f);
const served = async f => { const r = await fetch(`${origin}/dist/${f}`); return r.ok ? r.text() : null; };

const lib = await served('map-jr-gl.js');
console.log(lib === readFileSync(here('map-jr-gl.js'), 'utf8') ? 'PASS' : 'FAIL',
    `the server serves the dist/map-jr-gl.js of ${process.cwd()}`);
const marker = await served('without-fix-selftest.js'), local = existsSync(here('without-fix-selftest.js'));
console.log(marker === (local ? readFileSync(here('without-fix-selftest.js'), 'utf8') : null) ? 'PASS' : 'FAIL',
    `dist/without-fix-selftest.js is ${local ? '' : 'not '}in this folder, and the server answers ${marker === null ? 'with an error' : JSON.stringify(marker.trim())}`);
