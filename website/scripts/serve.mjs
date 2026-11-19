// A plain static server for the output of `pnpm generate` (.output/public). It answers as the published site does:
// `/vue` gives `vue/index.html` with no redirect, and an address with no file gives `404.html` with the status 404.
// Usage: node scripts/serve.mjs [port]. The default port is 4173.
import {createReadStream, existsSync, statSync} from 'node:fs';
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
    const server = createServer((request, response) => {
        const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
        let file = join(root, path);
        if (!file.startsWith(root)) file = root;
        const isFile = candidate => existsSync(candidate) && statSync(candidate).isFile();
        const found = [file, join(file, 'index.html'), file + '.html'].find(isFile);
        const target = found ?? join(root, '404.html');
        response.writeHead(found ? 200 : 404, {'content-type': types[extname(target)] ?? 'application/octet-stream'});
        createReadStream(target).pipe(response);
    });
    return new Promise(done => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = await serve(Number(process.argv[2]) || 4173);
    console.log(`http://localhost:${server.address().port}/`);
}
