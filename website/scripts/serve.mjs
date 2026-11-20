// A plain static server for the output of `pnpm generate` (.output/public). It answers as the published site does:
// `/vue` gives `vue/index.html` with no redirect, an address with no file gives `404.html` with the status 404, and the
// rules of `_headers` add their headers (a path, where "*" matches the rest, and the indented headers under it).
// Usage: node scripts/serve.mjs [port]. The default port is 4173.
import {createReadStream, existsSync, readFileSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(import.meta.dirname, '../.output/public');
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.map': 'application/json',
};

export function serve(port = 4173) {
    if (!existsSync(join(root, 'index.html'))) throw new Error(`[map-jr-gl site] ${root} has no index.html. Run "pnpm generate" first.`);
    const rules = [];
    for (const line of existsSync(join(root, '_headers')) ? readFileSync(join(root, '_headers'), 'utf8').split('\n') : []) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue;
        if (!/^\s/.test(line)) rules.push({path: new RegExp('^' + line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), headers: {}});
        else if (rules.length) { const [name, ...value] = line.trim().split(':'); rules.at(-1).headers[name.trim().toLowerCase()] = value.join(':').trim(); }
    }
    const server = createServer((request, response) => {
        const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
        let file = join(root, path);
        if (!file.startsWith(root)) file = root;
        const isFile = candidate => existsSync(candidate) && statSync(candidate).isFile();
        const found = [file, join(file, 'index.html'), file + '.html'].find(isFile);
        const target = found ?? join(root, '404.html');
        const headers = Object.assign({}, ...rules.filter(rule => rule.path.test(path)).map(rule => rule.headers));
        response.writeHead(found ? 200 : 404, {...headers, 'content-type': types[extname(target)] ?? 'application/octet-stream'});
        createReadStream(target).pipe(response);
    });
    return new Promise(done => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = await serve(Number(process.argv[2]) || 4173);
    console.log(`http://localhost:${server.address().port}/`);
}
