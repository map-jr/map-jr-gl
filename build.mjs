// Builds the library with Vite. Run with: pnpm build   (add --sizes for a size report of partial imports)
import {build, parseAst} from 'vite';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import MagicString from 'magic-string';
import {privateNames, shortenPrivateNames} from './scripts/private-names.mjs';
import {minifyShaders} from './scripts/minify-shaders.mjs';
import {inlineGlConstants} from './scripts/gl-constants.mjs';
import {removedReads} from './scripts/server-reads.mjs';
import {aliasGlobals, globalsModule, GLOBALS_MODULE} from './scripts/global-names.mjs';

// The public members of the classes of MapLibre GL JS, read from its type declarations. The development build of the
// entry maplibre-compat warns when code reads one of them that the class of this library does not have (see
// `watchMembers` in src/mistakes.ts). They go into src/maplibre-members.ts, a file in git that this build rewrites when
// the version of maplibre-gl changes them, so that each name in the built file has a line of src/ in the source map.
const maplibreMembers = (() => {
    const text = readFileSync(createRequire(import.meta.url).resolve('maplibre-gl/dist/maplibre-gl.d.ts'), 'utf8');
    const members = cls => {
        const start = text.search(new RegExp(`^(export )?declare (abstract )?class ${cls.replace('$', '\\$')}\\b`, 'm'));
        if (start < 0) throw new Error(`build.mjs: maplibre-gl.d.ts has no class ${cls}.`);
        const body = text.slice(start, text.indexOf('\n}', start)), names = new Set();
        for (const m of body.matchAll(/^ {2}(?:(private|protected|static) )?(?:readonly )?(?:get |set )?([a-zA-Z]\w*)\??(?:<[^(]*>)?[(:]/gm)) if (!m[1] && m[2] !== 'constructor') names.add(m[2]);
        return [...names];
    };
    const evented = members('Evented'), out = {Map: [...new Set([...members('Map$1'), ...members('Camera'), ...evented])]};
    for (const c of ['Marker', 'Popup', 'GeolocateControl', 'FullscreenControl']) out[c] = [...new Set([...members(c), ...evented])];
    for (const c of ['NavigationControl', 'ScaleControl', 'AttributionControl', 'TerrainControl', 'LogoControl', 'GlobeControl']) out[c] = members(c);
    return out;
})();
{
    const text = '// Written by build.mjs from the type declarations of maplibre-gl: the public members of its classes. Do not edit.\n' +
        '// (One string for each class, so that no string is the name of a member: scripts/private-names.mjs rejects that.)\n' +
        'export const maplibreMembers: Record<string, string> = {\n' + Object.entries(maplibreMembers).map(([c, n]) => `    ${c}: '${n.join(' ')}',\n`).join('') + '};\n';
    let old = ''; try { old = readFileSync('src/maplibre-members.ts', 'utf8'); } catch { /* the first build */ }
    if (old !== text) writeFileSync('src/maplibre-members.ts', text);
}
const privates = shortenPrivateNames();
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
// (COMPILE_HINTS: see where the built files get the hint, after the builds.)
if (process.env.COMPILE_HINTS && process.env.COMPILE_HINTS !== 'page') throw new Error(`[map-jr-gl] build.mjs: COMPILE_HINTS="${process.env.COMPILE_HINTS}" is not known. Write COMPILE_HINTS=page, or leave it unset.`);
/** The result of a plugin that changed `code` through `edited`, with the source map of the change. */
const withMap = (edited, id) => ({code: edited.toString(), map: edited.generateMap({source: id, hires: true})});

rmSync('dist', {recursive: true, force: true});
mkdirSync('dist', {recursive: true});

/**
 * Makes the shader programs smaller: the GLSL in src/gl.ts, src/terrain.ts and src/globe.ts keeps its comments and layout
 * in the source, but the built files do not need them. Whitespace and comments go, a number loses the zeros it does not
 * need (`1.0` is `1.`), and declarations of one type that follow each other become one (`uniform vec4 a,b;`), so the
 * programs stay the same (scripts/minify-shaders.mjs).
 */
const shaders = {
    name: 'minify-shaders',
    transform(code, id) {
        if (!/\/src\/(gl|terrain|globe)\.ts$/.test(id)) return null;
        const edited = new MagicString(code);
        for (const [start, end, text] of minifyShaders(code)) edited.overwrite(start, end, text);
        return withMap(edited, id);
    },
};

/** Puts the number of each WebGL constant in place of its read from the context (`gl.TEXTURE_2D` becomes `3553`). */
const glConstants = {
    name: 'gl-constants',
    transform(code, id) {
        if (!/\/src\/[^/]+\.ts$/.test(id)) return null;
        const edits = inlineGlConstants(code);
        if (!edits.length) return null;
        const edited = new MagicString(code);
        for (const [start, end, text] of edits) edited.overwrite(start, end, text);
        return withMap(edited, id);
    },
};

/**
 * For the worker file: each read of a member of `Math` or of `Array.isArray` (`Math.floor`) becomes a name that one module
 * exports, which the minifier shortens to one or two letters (scripts/global-names.mjs). The worker has about 900 of
 * them. The page scripts have few, and there the module would cost more than it saves.
 */
const globalNames = {
    name: 'global-names',
    resolveId: id => id === GLOBALS_MODULE ? id : null,
    load: id => id === GLOBALS_MODULE ? globalsModule() : null,
    transform(code, id) {
        if (!/\/src\/[^/]+\.[jt]s$/.test(id)) return null;
        const {edits, import: line} = aliasGlobals(code, id);
        if (!edits.length) return null;
        const edited = new MagicString(code);
        for (const [start, end, text] of edits) edited.overwrite(start, end, text);
        return withMap(edited.append(line), id);
    },
};

/**
 * For a built file that contains everything (the worker, the server renderer): the style resolver loads the PMTiles
 * reader on demand, which is correct for the page script only. Here the reader is in the file anyway, so the import
 * becomes a normal one and the code that loads a module on demand is not needed.
 */
const allInOne = {
    name: 'all-in-one',
    enforce: 'pre',
    transform(code, id) {
        // (The parts of the worker, src/parts.ts, are imported in the same way.)
        if (id.endsWith('/src/parts.ts')) {
            const edited = new MagicString(code);
            for (const m of code.matchAll(partImport)) edited.overwrite(m.index, m.index + m[0].length, `Promise.resolve(part_${m[1]})`).append(`\nimport * as part_${m[1]} from './${m[1]}.ts';\n`);
            return withMap(edited, id);
        }
        const lazy = "await import('./pmtiles-info.ts')";
        if (!id.endsWith('/src/resolve.ts') || !code.includes(lazy)) return null;
        const edited = new MagicString(code), at = code.indexOf(lazy);
        edited.overwrite(at, at + lazy.length, 'pmtilesInfo').append("\nimport * as pmtilesInfo from './pmtiles-info.ts';\n");
        return withMap(edited, id);
    },
};

/**
 * The parts of the worker that load on demand (#79): each line `name: () => import('./file.ts')` of src/parts.ts is a
 * file `map-jr-gl-worker-<name>.js` of its own. The worker file does not contain them: the worker loads one from the
 * URL that the page sends (`fromUrl` in src/worker.ts). A part file is a classic script that sets the global
 * `MapJrPart`, and the modules that the part imports are read from `MapJrWorker`, the global of the worker file, so
 * that their code is not in two files (the exports of src/worker.ts).
 */
const partImport = /(?<=\(\) => )import\('\.\/([\w-]+)\.ts'\)/g;
// The modules that only a part imports are in the file of that part, and not read from `MapJrWorker`: the part `dem`
// is the contour lines and 3D terrain (src/dem.ts, #1849).
const partOwn = /(^\.|\/src)\/(contour|terrain)\.ts$/;
const workerParts = [...readFileSync('src/parts.ts', 'utf8').matchAll(/^ {4}(\w+): \(\) => import\('\.\/([\w-]+)\.ts'\),$/gm)].map(m => ({name: m[1], file: m[2]}));
if (!workerParts.length) throw new Error('build.mjs: src/parts.ts has no parts.');
const splitParts = {
    name: 'worker-parts',
    enforce: 'pre',
    transform(code, id) {
        if (!id.endsWith('/src/parts.ts')) return null;
        const edited = new MagicString(code);
        for (const m of code.matchAll(partImport)) edited.overwrite(m.index, m.index + m[0].length, `Promise.reject(Error('[map-jr-gl] The page sent no URL for the part ${m[1]} of the worker.'))`);
        return withMap(edited, id);
    },
};

/**
 * Vite puts a helper around each `import()` that loads the CSS files and the other chunks of the imported file first.
 * The library has no CSS files, and a chunk imports what it needs itself, so the helper is replaced by a plain call.
 */
// `import.meta.env.SSR` in src/vue.ts is for the bundler of the application, which writes `false` there in a client
// build and so drops the import of the server renderer. This build would replace it itself, so it reaches the minifier
// under a name of the same length (so that the source maps stay right) and is written back into the built file.
const keepEnv = {
    name: 'keep-import-meta-env',
    enforce: 'pre',
    transform: (code, id) => /src[\\/]vue\.ts$/.test(id) ? {code: code.replaceAll('import.meta.env', '__IMPORT_META__'), map: null} : null,
    renderChunk: code => code.includes('__IMPORT_META__') ? {code: code.replaceAll('__IMPORT_META__', 'import.meta.env'), map: null} : null,
};
const noPreload = {
    name: 'no-preload-helper',
    enforce: 'pre',
    load: id => id === '\0vite/preload-helper.js' ? 'export const __vitePreload = load => load();' : null,
    // Each chunk gets its own copy of that call, which the minifier removes. Otherwise a chunk with an `import()`
    // imports the chunk that holds the helper (the map) only for the helper (#160).
    renderChunk: code => {
        const own = code.replace(/\bimport\s*\{([^}]*)\}\s*from\s*("[^"]*");?/g, (all, names, from) => {
            const list = names.split(','), rest = list.filter(n => !/(^|\bas\s+)__vitePreload$/.test(n.trim()));
            if (rest.length === list.length) return all;
            return (rest.some(n => n.trim()) ? `import {${rest.join(',')}} from ${from};` : '') + 'const __vitePreload = load => load();';
        });
        return own === code ? null : {code: own, map: null};
    },
};

/**
 * A chunk imports every chunk that it needs at start, also those that it reaches only through another chunk. Otherwise
 * the browser finds them one level at a time: the entry, then the host and the map, then the runtime of the bundler, a
 * serial round of requests for each level (#325). Rollup does this itself (`hoistTransitiveImports`); Rolldown does not.
 * The imports go at the end of the file, so that the source map stays right. A chunk that loads on demand is not in
 * `imports`, so it is not added.
 */
const hoistImports = {
    name: 'hoist-transitive-imports',
    generateBundle(_, bundle) {
        const all = (name, seen = new Set()) => {
            for (const dep of bundle[name]?.imports ?? []) if (!seen.has(dep) && bundle[dep]) { seen.add(dep); all(dep, seen); }
            return seen;
        };
        for (const chunk of Object.values(bundle)) {
            if (chunk.type !== 'chunk') continue;
            const extra = [...all(chunk.fileName)].filter(dep => !chunk.imports.includes(dep));
            if (!extra.length) continue;
            // (Before the line that names the source map, which stays the last line.)
            const add = extra.map(dep => `import"./${dep}";`).join('') + '\n', at = chunk.code.lastIndexOf('\n//# sourceMappingURL=');
            chunk.code = at < 0 ? chunk.code + '\n' + add : chunk.code.slice(0, at + 1) + add + chunk.code.slice(at + 1);
        }
    },
};

/**
 * One Vite build. Everything is written to dist/ next to what earlier builds put there. Each built file gets a source
 * map beside it (`<file>.map`) and a last line that names the map. A browser fetches the map only when its developer
 * tools are open.
 */
const run = (options, define = {__WORKER_SRC__: '""'}, plugins = []) => build({
    configFile: false, logLevel: 'warn', define: {__DEV__: 'false', __VERSION__: JSON.stringify(pkg.version), ...define}, plugins: [shaders, glConstants, privates, noPreload, keepEnv, hoistImports, ...plugins],
    build: {target: 'es2022', minify: true, sourcemap: true, emptyOutDir: false, outDir: 'dist', copyPublicDir: false, reportCompressedSize: false, modulePreload: false, ...options},
});

// The worker: tile parsing, and the whole rendering engine when a map renders off the main thread. A classic script,
// so it can be started from a blob or another origin.
// The copy of the worker inside a standalone file contains its parts. It starts from a blob, which has no file beside
// it: the line that names the source map goes. (It is built into a folder of its own, and only its text is used.)
const workerLib = {entry: 'src/worker.ts', formats: ['iife'], name: 'MapJrWorker', fileName: () => 'map-jr-gl-worker.js'};
await run({lib: workerLib, outDir: '.cache/worker-all-in-one', sourcemap: false}, undefined, [allInOne, globalNames]);
const workerSrc = readFileSync('.cache/worker-all-in-one/map-jr-gl-worker.js', 'utf8');
await run({lib: workerLib}, undefined, [splitParts, allInOne, globalNames]);
for (const {name, file} of workerParts) {
    await run({lib: {entry: `src/${file}.ts`, formats: ['iife'], name: 'MapJrPart', fileName: () => `map-jr-gl-worker-${name}.js`},
        rollupOptions: {external: (id, importer) => !!importer && !partOwn.test(id), output: {globals: () => 'MapJrWorker'}}});
}

// The default build. The page loads map-jr-gl.js, which is small; it finds map-jr-gl-worker.js beside itself, and the
// engine for main-thread rendering is a separate chunk that is only fetched if that path is taken.
const esm = (input, extra = {}) => ({
    rollupOptions: {input, external: ['vue', 'react', 'react-dom', '@nuxt/kit', '@map-jr/map-jr-gl/server'], preserveEntrySignatures: 'strict', output: {format: 'es', entryFileNames: '[name].js', chunkFileNames: 'map-jr-gl-[name]-[hash].js',
        // (The map and the styles of its controls are always loaded together: one file is smaller after gzip than two.)
        ...(extra.codeSplitting === false ? {} : {manualChunks: id => /src[\\/](map|controls|lnglat|markers|overlays)\.ts$/.test(id) ? 'map' : undefined}), ...extra}},
});
// Two entries in one build, so that they share their chunks: the main entry (the new API) and the entry that is a
// replacement for MapLibre GL JS.
// (The adapters for the frameworks are entries of the same build: they use the main entry's files. The framework itself is not in them.)
const entries = {'map-jr-gl': 'src/index.ts', 'map-jr-gl-maplibre-compat': 'src/maplibre-compat.ts', vue: 'src/vue.ts', react: 'src/react.ts', svelte: 'src/svelte.ts', element: 'src/element.ts', nuxt: 'src/nuxt.ts', controls: 'src/control-specs.ts'};
await run(esm(entries));
// The development build of the same entries (`<name>.dev.js`, the `development` condition of package.json). It differs
// from the build above in `__DEV__` only: it loads the checks for common mistakes (src/mistakes.ts) after the map has
// started, and the build above has no code for that. The name of a chunk has a hash of its content, so a chunk that is
// the same in both builds is one file, and dist/ grows only by the files that differ. The build stops if it would
// change a file of the production build.
const production = Object.fromEntries(readdirSync('dist').map(f => [f, readFileSync('dist/' + f, 'utf8')]));
await run(esm(entries, {entryFileNames: '[name].dev.js'}), {__WORKER_SRC__: '""', __DEV__: 'true'});
for (const f in production) if (readFileSync('dist/' + f, 'utf8') !== production[f]) throw new Error(`The development build changed dist/${f}, a file of the production build.`);

// Standalone: one self-contained file with the worker embedded, for places where shipping several files is awkward.
// (One for each of the two APIs. The checks for common mistakes are inside the file of the main API, as the worker is:
// a page with this file has no bundler that could choose a build, and the checks cost it no request.)
await run(esm({'map-jr-gl-standalone': 'src/standalone.ts'}, {codeSplitting: false}), {__WORKER_SRC__: JSON.stringify(workerSrc), __DEV__: 'true'});
await run(esm({'map-jr-gl-maplibre-compat-standalone': 'src/maplibre-compat.ts'}, {codeSplitting: false}), {__WORKER_SRC__: JSON.stringify(workerSrc)});
// The server renderer (Node, Cloudflare Workers and other runtimes without a DOM). It draws without WebGL, so of the
// part `dem` it takes the contour lines and not 3D terrain, which would bring the renderer of WebGL with it (#1849).
// The parts `globe` and `subdivide` are for the WebGL engine and its tiles only, and the server renderer does not contain them (#2006, #2075).
const contourOnly = {
    name: 'server-dem',
    enforce: 'pre',
    transform(code, id) {
        if (!id.endsWith('/src/parts.ts')) return null;
        const edited = new MagicString(code);
        for (const [from, to] of [["dem: () => import('./dem.ts')", "dem: () => import('./contour.ts')"], ["globe: () => import('./globe.ts')", "globe: () => Promise.reject(Error('globe'))"], ["subdivide: () => import('./subdivide.ts')", "subdivide: () => Promise.reject(Error('subdivide'))"]]) {
            const at = code.indexOf(from);
            if (at < 0) throw new Error(`build.mjs: src/parts.ts has no line "${from}".`);
            edited.overwrite(at, at + from.length, to);
        }
        return withMap(edited, id);
    },
};
// The methods of shared classes that only the browser map calls: the camera of the map (3D terrain, the globe,
// gestures), the queries of features and of 3D terrain of the tile builder, and the cluster queries of the map. The
// minifier keeps every method of a class, so the server build removes these (#2041). The build stops when the built
// server.js still reads a removed name (`x.name`, `x['name']` or a destructuring key; `this.name` for a private method;
// see scripts/server-reads.mjs), so that a method that the server renderer comes to call cannot go missing: remove its
// name here then.
// Of src/exact-pixels.ts, the server renderer needs only `decodePixels` with a decoder: it always has one (`decodeImage`,
// with a default), and it has no browser that could decode an image or an `ImageBitmap` to decode.
const serverDrops = {
    'geo.ts': {Transform: ['perspectiveAt', 'mercToScreen', 'screenToGround', 'fogRange', 'project', 'unproject', 'panned', 'unprojectFlat', 'recenterOnGround', 'setLocationAt']},
    'tiles.ts': {TileBuilder: ['loadElevation', 'loadImage', 'find', 'query']},
    'geojson.ts': {ClusterIndex: ['expansionZoom']},
};
const browserOnly = () => {
    const dropped = new Map(), short = privateNames();
    const walk = (node, fn) => {
        if (!node || typeof node.type !== 'string') return;
        fn(node);
        for (const key in node) { const v = node[key]; if (Array.isArray(v)) for (const c of v) walk(c, fn); else if (v && typeof v === 'object') walk(v, fn); }
    };
    return {
        name: 'server-browser-only',
        load: id => id.endsWith('/src/exact-pixels.ts') ? 'export const decodePixels = async (bytes, decode) => decode(bytes);' : null,
        // (Before the private names are shortened, so that the names here are those of src/.)
        transform: {order: 'pre', handler(code, id) {
            const file = /\/src\/([\w-]+\.ts)$/.exec(id)?.[1], drops = serverDrops[file];
            if (!drops) return null;
            const edited = new MagicString(code);
            walk(parseAst(code, {lang: 'ts'}), n => {
                const names = n.type === 'ClassDeclaration' ? drops[n.id.name] : null;
                for (const member of names ? n.body.body : []) {
                    if (member.type !== 'MethodDefinition' || !names.includes(member.key.name)) continue;
                    edited.remove(member.start, member.end);
                    dropped.set(member.key.name, member.accessibility === 'private');
                }
            });
            return withMap(edited, id);
        }},
        generateBundle(_, bundle) {
            const methods = new Map(), files = new Map();
            for (const [file, classes] of Object.entries(serverDrops)) for (const name of Object.values(classes).flat()) {
                if (!dropped.has(name)) throw new Error(`build.mjs: src/${file} has no method "${name}" to leave out of the server renderer.`);
                for (const built of new Set([name, short.get(name) ?? name])) methods.set(built, {name, private: dropped.get(name)});
                files.set(name, file);
            }
            for (const chunk of Object.values(bundle)) for (const name of chunk.type === 'chunk' ? removedReads(chunk.code, methods) : []) {
                throw new Error(`build.mjs: dist/server.js reads "${name}" of src/${files.get(name)}, which serverDrops leaves out of the server renderer. Remove "${name}" from serverDrops.`);
            }
        },
    };
};
await run(esm({server: 'src/server.ts'}, {codeSplitting: false}), undefined, [contourOnly, allInOne, globalNames, browserOnly()]);

// The name, the version and the licence go in the first line of each built file that package.json names. The chunks
// that these files share do not get the line, because each line counts against the size budgets. (The minifier of
// Vite removes a banner that Rollup adds, so the line is added here. The source map gets an empty first line too, so
// that it still fits.)
// The files of the React entry start with 'use client' (a line of its own, before the banner), so that a server
// component of Next.js can import the component without a client file of its own (#1202). Rollup removes the
// directive from the source, so it is added here, and the source map gets one more empty line for it.
for (const file of new Set(JSON.stringify(pkg.exports).match(/dist\/[\w.-]+\.js/g))) {
    const client = /^dist\/react(\.dev)?\.js$/.test(file);
    writeFileSync(file, (client ? `'use client';\n` : '') + `/*! ${pkg.name} ${pkg.version} | ${pkg.license} */\n` + readFileSync(file, 'utf8'));
    try { const map = JSON.parse(readFileSync(file + '.map', 'utf8')); writeFileSync(file + '.map', JSON.stringify({...map, mappings: (client ? ';;' : ';') + map.mappings})); } catch { /* a file that only passes exports on has no map */ }
}

// The type declarations that the `types` entries of package.json name. They are part of each build, so that a package
// packed after `node build.mjs` or `pnpm demo` has them.
execFileSync(process.execPath, [createRequire(import.meta.url).resolve('typescript/package.json').replace(/package\.json$/, 'bin/tsc'), '-p', 'tsconfig.types.json'], {stdio: 'inherit'});
// A part of the worker (`./worker-*`) is a script with no exports, so its declarations declare nothing.
writeFileSync('dist/types/worker-part.d.ts', '/** A part of the worker of map-jr-gl. It is a script with no exports. */\nexport {};\n');
// The texts of the codes of the messages (#2148), for a user who reads a log without network. No page loads this file.
execFileSync(process.execPath, ['scripts/messages.mjs', '--json'], {stdio: ['ignore', 'ignore', 'inherit']});

const kb = n => (n / 1024).toFixed(1).padStart(6);
const report = (label, bytes) => console.log(label.padEnd(46), `${kb(bytes.length)} KB min ${kb(gzipSync(bytes, {level: 9}).length)} KB gzip ${kb(brotliCompressSync(bytes).length)} KB brotli`);
/** A file and every chunk it imports statically (dynamic imports are fetched later, if ever). */
const withStaticImports = (name, read, seen = new Set()) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const m of read(name).matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) if (!new RegExp(`import\\(\\s*["']\\./${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(read(name))) withStaticImports(m[1], read, seen);
    return seen;
};
const fromDist = name => readFileSync('dist/' + name, 'utf8');
// COMPILE_HINTS=page writes the explicit compile hint of V8 (https://v8.dev/blog/explicit-compile-hints) as the first
// line of each file that the page loads up front, for both entries, so that Chromium compiles their functions on a
// background thread instead of lazily on the main thread. It is off by default, so the published files do not have
// it, until a comparison on devices shows a gain (#1688). The worker file does not get it: a worker compiles its script
// on its own thread, and the hint made that compile slower there.
if (process.env.COMPILE_HINTS === 'page') {
    for (const file of new Set(['map-jr-gl.js', 'map-jr-gl-maplibre-compat.js'].flatMap(entry => [...withStaticImports(entry, fromDist)]))) {
        writeFileSync('dist/' + file, '//# allFunctionsCalledOnLoad\n' + fromDist(file));
        try { const map = JSON.parse(fromDist(file + '.map')); writeFileSync('dist/' + file + '.map', JSON.stringify({...map, mappings: ';' + map.mappings})); } catch { /* a file without a map */ }
    }
}
const upfront =[...withStaticImports('map-jr-gl.js', fromDist)];
report('page script, up front (' + upfront.join(' + ') + ')', Buffer.concat(upfront.map(f => readFileSync('dist/' + f))));
const upfrontDev = [...withStaticImports('map-jr-gl.dev.js', fromDist)];
report('the same in the development build (' + upfrontDev.join(' + ') + ')', Buffer.concat(upfrontDev.map(f => readFileSync('dist/' + f))));
report('map-jr-gl-worker.js (loaded in a worker)', readFileSync('dist/map-jr-gl-worker.js'));
for (const {name} of workerParts) report(`map-jr-gl-worker-${name}.js (worker, on demand)`, readFileSync(`dist/map-jr-gl-worker-${name}.js`));
for (const f of readdirSync('dist').filter(f => /^map-jr-gl-.*-[\w-]{8}\.js$/.test(f))) if (!upfront.includes(f) && !upfrontDev.includes(f)) report(`${f} (${f.startsWith('map-jr-gl-engine-entry') ? 'main-thread engine, ' : ''}on demand)`, readFileSync('dist/' + f));
report('map-jr-gl-standalone.js (everything in one file)', readFileSync('dist/map-jr-gl-standalone.js'));
report('server.js', readFileSync('dist/server.js'));

if (process.argv.includes('--sizes')) {
    // What an application's own bundler ends up with when it imports only part of the library.
    const only = async (label, code) => {
        const virtual = {name: 'virtual-entry', resolveId: id => id === 'virtual:entry' ? '\0entry.ts' : null, load: id => id === '\0entry.ts' ? code : null};
        const out = await build({configFile: false, logLevel: 'silent', define: {__WORKER_SRC__: '""', __DEV__: 'false', __VERSION__: JSON.stringify(pkg.version)}, plugins: [virtual],
            build: {write: false, target: 'es2022', minify: true, modulePreload: false, rollupOptions: {input: {entry: 'virtual:entry'}, preserveEntrySignatures: 'strict', output: {format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js'}}}});
        const text = Object.fromEntries((Array.isArray(out) ? out[0] : out).output.filter(o => o.type === 'chunk').map(o => [o.fileName, o.code]));
        report(label, Buffer.from([...withStaticImports('entry.js', n => text[n])].map(n => text[n]).join('')));
    };
    const src = process.cwd() + '/src';
    console.log('\nPage script when importing selectively (tree-shaken):');
    await only('Map', `export {Map} from '${src}/map.ts'`);
    await only('Map + NavigationControl + ScaleControl', `export {Map} from '${src}/map.ts'; export {NavigationControl, ScaleControl} from '${src}/controls-more.ts'`);
    await only('Map + Marker + Popup', `export {Map} from '${src}/map.ts'; export {Marker, Popup} from '${src}/overlays.ts'`);
    await only('everything (index)', `export * from '${src}/index.ts'`);
}
