// Runs the example pages of MapLibre GL JS (the pages of its documentation) two times: with MapLibre GL JS, and with
// this library in its place. For each page it records the errors and how much the two images differ.
//   node test/conformance/examples.mjs [out-dir] [--filter=<regex>] [--write]      (--write puts the results in docs/ecosystem.md)
// The pages come from the checkout of maplibre/maplibre-gl-js at .cache/maplibre-gl-js (the render tests clone it).
// Needs python3 with Pillow for the comparison.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {launch} from '../launch.mjs';

const root = path.resolve(import.meta.dirname, '../..'), pages = path.join(root, '.cache/maplibre-gl-js/test/examples');
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(root, '.cache/examples');
const filter = new RegExp(process.argv.find(a => a.startsWith('--filter='))?.slice(9) ?? '');
if (!existsSync(pages)) { console.error('Run the render tests one time first: they clone maplibre-gl-js into .cache/.'); process.exit(1); }
mkdirSync(out, {recursive: true});

// One server for the two variants of each page. A page imports `../../dist/maplibre-gl-dev.mjs`; that import goes to
// MapLibre GL JS (with its worker) or to this library. The style sheet of MapLibre is left out for this library,
// which brings its own styles.
const types = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    const send = (body, type) => { res.writeHead(200, {'content-type': type, 'access-control-allow-origin': '*'}); res.end(body); };
    try {
        const page = /^\/(maplibre|mapjr)\/test\/examples\/([\w-]+\.html)$/.exec(p);
        if (page) {
            let html = readFileSync(path.join(pages, page[2]), 'utf8');
            if (page[1] === 'mapjr') html = html.replace(/<link[^>]*maplibre-gl\.css[^>]*>/g, '');
            return send(html, 'text/html');
        }
        if (p === '/maplibre/dist/maplibre-gl-dev.mjs') return send(`export * from '/ml/maplibre-gl.mjs';\nimport {setWorkerUrl} from '/ml/maplibre-gl.mjs';\nsetWorkerUrl('/ml/maplibre-gl-worker.mjs');`, 'text/javascript');
        if (p === '/mapjr/dist/maplibre-gl-dev.mjs') return send(`export * from '/dist/map-jr-gl.js';\nexport {default} from '/dist/map-jr-gl.js';`, 'text/javascript');
        const file = p.startsWith('/ml/') ? path.join(root, 'node_modules/maplibre-gl/dist', p.slice(4)) : p.startsWith('/dist/') ? path.join(root, p)
            : /^\/(maplibre|mapjr)\/dist\/maplibre-gl\.css$/.test(p) ? path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl.css')
            : path.join(root, '.cache/maplibre-gl-js', p.replace(/^\/(maplibre|mapjr)\//, '')); // other files of the repository that a page uses
        send(readFileSync(file), types[path.extname(file)] ?? 'application/octet-stream');
    } catch { res.writeHead(404, {'access-control-allow-origin': '*'}); res.end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

const names = readdirSync(pages).filter(f => f.endsWith('.html') && filter.test(f)).map(f => f.slice(0, -5));
const browser = await launch(), rows = [], queue = [...names];
/** Loads one variant of a page, waits until the network is quiet and the map has had time to draw, and takes an image. */
async function shoot(context, name, variant) {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(String(e.message).split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) errors.push(m.text().split('\n')[0]); });
    const file = path.join(out, `${name}-${variant}.png`);
    try {
        await page.goto(`${origin}/${variant}/test/examples/${name}.html`, {waitUntil: 'load', timeout: 30000});
        await page.waitForLoadState('networkidle', {timeout: 15000}).catch(() => {});
        await page.waitForTimeout(3500);
        await page.screenshot({path: file});
    } catch (e) { errors.push('the page did not load: ' + String(e.message).split('\n')[0]); }
    await page.close();
    return {file: existsSync(file) ? file : null, errors: [...new Set(errors)]};
}
await Promise.all(Array.from({length: 4}, async () => {
    const context = await browser.newContext({viewport: {width: 800, height: 500}});
    for (let name; (name = queue.shift());) {
        const theirs = await shoot(context, name, 'maplibre'), ours = await shoot(context, name, 'mapjr');
        rows.push({name, theirs, ours});
    }
    await context.close();
}));
await browser.close();
server.close();

// The share of pixels that differ clearly between the two images of a page.
const py = `
import sys, json
from PIL import Image, ImageChops
out = []
for i in range(1, len(sys.argv), 2):
    try:
        a = Image.open(sys.argv[i]).convert('RGB'); b = Image.open(sys.argv[i + 1]).convert('RGB')
        d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 40 else 0)
        out.append(round(100 * sum(1 for v in d.getdata() if v) / (a.size[0] * a.size[1]), 1))
    except Exception: out.append(None)
print(json.dumps(out))`;
const both = rows.filter(r => r.theirs.file && r.ours.file);
const diffs = JSON.parse(execFileSync('python3', ['-W', 'ignore', '-c', py, ...both.flatMap(r => [r.theirs.file, r.ours.file])], {encoding: 'utf8'}));
both.forEach((r, i) => { r.diff = diffs[i]; });
rows.sort((a, b) => a.name < b.name ? -1 : 1);
// A page works when this library gives no error that MapLibre does not give, and the images are near to each other.
const LIMIT = 12;
for (const r of rows) {
    r.newErrors = r.ours.errors.filter(e => !r.theirs.errors.includes(e));
    r.state = r.theirs.errors.length && !r.theirs.file ? 'not run' : r.newErrors.length ? 'error' : r.diff === undefined || r.diff === null ? 'no image' : r.diff > LIMIT ? 'differs' : 'works';
}
writeFileSync(path.join(out, 'result.json'), JSON.stringify(rows, null, 1));
const count = s => rows.filter(r => r.state === s).length;
console.log(`${rows.length} example pages: ${count('works')} work, ${count('differs')} draw a different image, ${count('error')} give an error, ${count('no image') + count('not run')} were not compared`);
for (const r of rows.filter(r => r.state !== 'works')) console.log(`${r.state.padEnd(8)} ${r.name} ${r.diff ?? ''}${r.diff !== undefined ? '% ' : ''}${r.newErrors[0]?.slice(0, 140) ?? ''}`);

if (process.argv.includes('--write') && !process.argv.some(a => a.startsWith('--filter='))) {
    const cell = s => String(s).replaceAll('|', '\\|').replace(/https?:\/\/localhost:\d+\/\S*/g, '').slice(0, 160);
    const lines = ['<!-- examples:start -->', '## The example pages of MapLibre GL JS', '',
        'The documentation of MapLibre GL JS has an example page for each common task. `node test/conformance/examples.mjs --write`',
        'runs each page two times: with MapLibre GL JS, and with this library in its place (the page itself is not changed).',
        `A page works when this library gives no error that MapLibre GL JS does not give, and at most ${LIMIT} percent of the`,
        'pixels of the two images differ clearly (labels and controls are drawn in different ways).', '',
        `**${count('works')} of ${rows.length} pages work.** ${count('error')} give an error, ${count('differs')} draw a different image, ${count('no image') + count('not run')} were not compared.`, '',
        '| Example page | Result | Pixels that differ | First error of this library |', '|---|---|---|---|',
        ...rows.filter(r => r.state !== 'works').map(r => `| ${r.name} | ${r.state} | ${r.diff ?? ''} | ${cell(r.newErrors[0] ?? '')} |`),
        '<!-- examples:end -->'];
    const file = path.join(root, 'docs/ecosystem.md'), doc = readFileSync(file, 'utf8'), block = lines.join('\n');
    writeFileSync(file, doc.includes('<!-- examples:start -->') ? doc.replace(/<!-- examples:start -->[\s\S]*<!-- examples:end -->/, block) : doc.replace('## What is missing most often', block + '\n\n## What is missing most often'));
}
