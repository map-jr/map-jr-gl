// Compares the source of this library with the source of other projects and prints the longest similar runs.
// The comparison ignores names: every identifier becomes one token, so a copy with renamed variables still matches.
// It runs locally and uploads nothing. See docs/similarity-scan.md.
//
// Usage: node scripts/similarity-scan.mjs <ours-dir> <theirs-dir> [more theirs-dirs...] [--k=40] [--top=20]
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => Number((args.find((a) => a.startsWith(`--${name}=`)) || `=${def}`).split('=')[1]);
const K = opt('k', 40);
const TOP = opt('top', 20);
const [ours, ...theirs] = args.filter((a) => !a.startsWith('--'));
if (!ours || !theirs.length) {
    console.error('Usage: node scripts/similarity-scan.mjs <ours-dir> <theirs-dir> [...] [--k=40] [--top=20]');
    process.exit(1);
}

const KEYWORDS = new Set(('break case catch class const continue default do else export extends false finally for ' +
    'function if import in instanceof let new null return static super switch this throw true try typeof undefined ' +
    'var void while yield async await of float vec2 vec3 vec4 mat4 uniform attribute varying in out highp mediump ' +
    'precision sampler2D texture2D gl_FragColor gl_Position Math').split(' '));
const EXT = /\.(ts|js|mjs|glsl|css)$/;

function files(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...files(p));
        else if (EXT.test(name) && !/\.(test|d)\.ts$/.test(name)) out.push(p);
    }
    return out;
}

// Tokens with their line numbers. Comments are dropped; strings become one token; names become "I".
function tokens(text) {
    const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|'(?:\\.|[^'\n])*'|"(?:\\.|[^"\n])*"|[A-Za-z_$][\w$]*|\d[\w.]*|\n|[^\s\w]/g;
    const out = [];
    let line = 1;
    for (const [t] of text.matchAll(re)) {
        if (t === '\n') { line++; continue; }
        if (t.startsWith('//') || t.startsWith('/*')) { line += t.split('\n').length - 1; continue; }
        const n = /^[A-Za-z_$]/.test(t) ? (KEYWORDS.has(t) ? t : 'I') : /^['"`]/.test(t) ? 'S' : t;
        out.push({n, line});
        line += t.split('\n').length - 1;
    }
    return out;
}

const hash = (toks, i) => toks.slice(i, i + K).map((t) => t.n).join(' ');

const index = new Map();
for (const dir of theirs) {
    for (const f of files(dir)) {
        const toks = tokens(readFileSync(f, 'utf8'));
        for (let i = 0; i + K <= toks.length; i++) {
            const h = hash(toks, i);
            if (!index.has(h)) index.set(h, {f, toks, i});
        }
    }
}

const runs = [];
for (const f of files(ours)) {
    const toks = tokens(readFileSync(f, 'utf8'));
    for (let i = 0; i + K <= toks.length;) {
        const hit = index.get(hash(toks, i));
        if (!hit) { i++; continue; }
        let len = K;
        while (i + len < toks.length && hit.i + len < hit.toks.length && toks[i + len].n === hit.toks[hit.i + len].n) len++;
        runs.push({len, ours: `${relative('.', f)}:${toks[i].line}-${toks[i + len - 1].line}`,
            theirs: `${relative('.', hit.f)}:${hit.toks[hit.i].line}-${hit.toks[hit.i + len - 1].line}`});
        i += len;
    }
}
runs.sort((a, b) => b.len - a.len);
console.log(`${runs.length} runs of at least ${K} tokens (names ignored).`);
for (const r of runs.slice(0, TOP)) console.log(`${r.len}\t${r.ours}\t${r.theirs}`);
