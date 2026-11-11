// Fails when a built file is larger than its budget. Run after `pnpm build`. Raise a budget only on purpose:
// the size of the library is one of its main advantages.
import {gzipSync} from 'node:zlib';
import {readFileSync, readdirSync} from 'node:fs';

const BUDGET_KB = {'map-jr-gl-worker.js': 58, 'map-jr-gl.js': 20, 'engine (main thread)': 41};
const gz = file => gzipSync(readFileSync('dist/' + file)).length / 1024;
const engine = readdirSync('dist').find(f => f.startsWith('map-jr-gl-engine-entry'));
const sizes = {'map-jr-gl-worker.js': gz('map-jr-gl-worker.js'), 'map-jr-gl.js': gz('map-jr-gl.js'), 'engine (main thread)': gz(engine)};
let ok = true;
for (const [name, kb] of Object.entries(sizes)) {
    const over = kb > BUDGET_KB[name];
    if (over) ok = false;
    console.log(`${over ? 'OVER ' : 'ok   '} ${name}: ${kb.toFixed(1)} KB gzip (budget ${BUDGET_KB[name]} KB)`);
}
if (!ok) { console.error('A built file is larger than its budget. Make it smaller, or change the budget in scripts/size-check.mjs on purpose.'); process.exit(1); }
