// A build step that gives short names to private class members. The minifier does not shorten property names,
// and the engine has some hundreds of private members with long names.
//
// A name is shortened only when each use of it in src/ is one of these:
//   - the declaration of a `private` member of a class
//   - `this.name`
// A name is kept when it appears anywhere as: a member that is not private, a property of something other than
// `this`, a key of an object literal or a destructuring pattern, a field of an interface or type, or a string.
// So a shortened name can never be the name of a message field, an option, or a property of the browser.
//
//   node scripts/private-names.mjs      prints the names that the build shortens
import {readdirSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// (On Windows, a module can be imported by a file URL only, not by a path with a drive letter.)
const {parseAst} = await import(pathToFileURL(createRequire(createRequire(import.meta.url).resolve('vite')).resolve('rolldown/parseAst')).href);
const src = path.resolve(import.meta.dirname, '../src');

/** Calls `fn` for each node of a syntax tree, with its parent. */
function walk(node, fn, parent = null) {
    if (!node || typeof node.type !== 'string') return;
    fn(node, parent);
    for (const key in node) {
        const v = node[key];
        if (Array.isArray(v)) for (const c of v) walk(c, fn, node); else if (v && typeof v === 'object') walk(v, fn, node);
    }
}

/** Each use of a property name in one file: `sites` are the places that can be renamed, `other` the names to keep. */
function uses(code, file) {
    const sites = [], other = new Set(), name = k => k.type === 'Identifier' ? k.name : k.type === 'Literal' && typeof k.value === 'string' ? k.value : null;
    walk(parseAst(code, {lang: 'ts'}, file), (n, parent) => {
        if (n.type === 'Literal' && typeof n.value === 'string') other.add(n.value);
        else if (n.type === 'TemplateElement') for (const word of (n.value?.cooked ?? '').match(/[A-Za-z_$][\w$]*/g) ?? []) other.add(word);
        else if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') {
            if (n.object.type === 'ThisExpression') sites.push(n.property); else other.add(n.property.name);
        } else if (n.type === 'PropertyDefinition' || n.type === 'MethodDefinition' || n.type === 'AccessorProperty' || n.type === 'TSAbstractPropertyDefinition' || n.type === 'TSAbstractMethodDefinition') {
            const k = !n.computed && name(n.key);
            if (k && n.accessibility === 'private' && n.key.type === 'Identifier') sites.push({...n.key, declared: true}); else if (k) other.add(k);
        } else if (n.type === 'TSParameterProperty') walk(n.parameter, p => { if (p.type === 'Identifier') other.add(p.name); });
        else if ((n.type === 'Property' || n.type === 'TSPropertySignature' || n.type === 'TSMethodSignature') && !n.computed) { const k = name(n.key); if (k) other.add(k); }
        else if (n.type === 'TSEnumMember') { const k = name(n.id); if (k) other.add(k); }
        void parent;
    });
    return {sites, other};
}

/** The names that are safe to shorten, each with its short name. The most used names get the shortest ones. */
export function privateNames() {
    const count = new Map(), declared = new Set(), other = new Set();
    for (const f of readdirSync(src).filter(f => f.endsWith('.ts'))) {
        const u = uses(readFileSync(path.join(src, f), 'utf8'), f);
        for (const s of u.sites) { count.set(s.name, (count.get(s.name) ?? 0) + 1); if (s.declared) declared.add(s.name); }
        for (const o of u.other) other.add(o);
    }
    const names = [...declared].filter(n => !other.has(n) && n.length > 2).sort((a, b) => count.get(b) - count.get(a) || (a < b ? -1 : 1));
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', short = new Map();
    let i = 0;
    for (const n of names) {
        let s;
        do { s = '_' + (i < 52 ? letters[i] : letters[Math.floor(i / 52) - 1] + letters[i % 52]); i++; } while (other.has(s) || count.has(s));
        short.set(n, s);
    }
    return short;
}

/**
 * The names of uniforms, attributes and varyings in the shaders (`u_matrix`, `a_pos`, `v_color`) get short names too.
 * They are only in src/gl.ts: in the GLSL text, and in the JavaScript that sets a uniform (`u.u_matrix`). The
 * JavaScript learns the names of the uniforms from the compiled program, so the two always agree.
 */
function shortenShaderNames(code) {
    const count = new Map();
    for (const name of code.match(/\b[uav]_[A-Za-z0-9]+\b/g) ?? []) count.set(name, (count.get(name) ?? 0) + 1);
    // A short name is a letter and a number in base 36 (`u0`, `u1f`). It must not be a name that the file has already.
    const taken = new Set(code.match(/[A-Za-z_$][\w$]*/g)), next = {u: 0, a: 0, v: 0}, short = new Map();
    for (const name of [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || (a < b ? -1 : 1))) {
        let s;
        do s = name[0] + (next[name[0]]++).toString(36); while (taken.has(s));
        short.set(name, s);
    }
    return code.replace(/\b[uav]_[A-Za-z0-9]+\b/g, name => short.get(name));
}

/**
 * The local names in the shaders (variables, parameters, functions and the values that go from the vertex shader to the
 * fragment shader) get short names. Only the GLSL text changes: the template strings of src/gl.ts that hold GLSL, and
 * in them not the `${...}` parts, which are JavaScript. A name is changed only when the GLSL declares it with a type
 * and without `uniform`, so the names that JavaScript uses (the uniforms) and the names of GLSL itself stay.
 */
function shortenShaderLocals(code) {
    const isShader = text => /void main|uniform |\bfloat /.test(text), literal = /`((?:[^`\\]|\\.)*)`/gs, hole = /(\$\{[^}]*\})/;
    const declared = /\b(uniform\s+)?(?:(?:highp|mediump|lowp)\s+)?(?:float|int|bool|vec[234]|ivec[234]|mat[234]|sampler2D)\s+([A-Za-z_]\w*)\s*(?=[=;,)(\[])/g;
    const count = new Map(), kept = new Set(['main']);
    const texts = [...code.matchAll(literal)].map(m => m[1]).filter(isShader).flatMap(text => text.split(hole).filter((_, i) => i % 2 === 0));
    for (const text of texts) for (const m of text.matchAll(declared)) if (m[1]) kept.add(m[2]); else count.set(m[2], 0);
    for (const name of [...count.keys()]) if (kept.has(name) || name.length < 3 || /^[uav]\d|^gl_/.test(name)) count.delete(name);
    for (const text of texts) for (const word of text.match(/[A-Za-z_]\w*/g) ?? []) if (count.has(word)) count.set(word, count.get(word) + 1);
    const taken = new Set(code.match(/[A-Za-z_$][\w$]*/g)), letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', short = new Map();
    let next = 0;
    for (const name of [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || (a < b ? -1 : 1))) {
        let s;
        do { s = (next < 52 ? '' : letters[Math.floor(next / 52) - 1]) + letters[next % 52]; next++; } while (taken.has(s));
        short.set(name, s);
    }
    const words = new RegExp(`(?<![.\\w])(${[...short.keys()].join('|')})\\b`, 'g');
    return short.size ? code.replace(literal, (all, text) => !isShader(text) ? all
        : '`' + text.split(hole).map((part, i) => i % 2 ? part : part.replace(words, name => short.get(name))).join('') + '`') : code;
}

/** The Vite plugin: renames the members in each file of src/ before the file is compiled. */
export function shortenPrivateNames() {
    const short = privateNames();
    return {
        name: 'shorten-private-names',
        enforce: 'pre',
        transform(code, id) {
            const file = id.split('?')[0];
            // (Vite gives a path with forward slashes on each system.)
            if (!file.endsWith('.ts') || path.resolve(path.dirname(file)) !== src) return null;
            const edits = uses(code, file).sites.filter(s => short.has(s.name)).sort((a, b) => b.start - a.start);
            for (const s of edits) code = code.slice(0, s.start) + short.get(s.name) + code.slice(s.end);
            if (file.endsWith('gl.ts')) code = shortenShaderLocals(shortenShaderNames(code));
            return {code, map: null};
        },
    };
}

if (process.argv[1] === import.meta.filename) { const names = privateNames(); console.log([...names.keys()].join(' ')); console.log(names.size + ' names'); }
