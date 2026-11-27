// The edits of the plugin `spec-names` of build.mjs, in a module of their own so that test/unit can check them.

/**
 * In `SPEC` of src/style.ts, the name of each property of a layer type other than `symbol` starts with that type
 * (`'fill-opacity'` in `fill`). The built files leave that start out (`'-opacity'`), and a loop after `SPEC` puts it back
 * when the module loads, so `SPEC` holds the same names as in src/ (#2342). The names of `symbol` start with `icon-`,
 * `text-` or `symbol-` and stay as they are, and so does a name that does not start with its type (`resampling`).
 * @returns `[start, end, text]` for each edit, in the order of `code`; the last one inserts the loop.
 */
export function specNames(code) {
    const start = code.indexOf('\nexport const SPEC'), end = code.indexOf('\n};\n', start);
    if (start < 0 || end < 0) throw new Error('scripts/spec-names.mjs: src/style.ts has no "export const SPEC = {" that ends with a line "};".');
    const edits = [];
    let type = null;
    for (let at = start + 1; at < end; at = code.indexOf('\n', at) + 1) {
        const line = code.slice(at, code.indexOf('\n', at));
        const head = /^ {4}'?([\w-]+)'?: \{/.exec(line);
        if (head) { type = head[1]; continue; }
        const prop = type && type !== 'symbol' ? /^ {8}\w+: \['([\w-]+)'/.exec(line) : null;
        if (prop?.[1].startsWith(type + '-')) {
            const from = at + line.indexOf("'") + 1;
            edits.push([from, from + type.length, '']);
        }
    }
    if (!edits.length) throw new Error('scripts/spec-names.mjs: no name of SPEC in src/style.ts starts with its layer type.');
    const after = end + '\n};'.length;
    edits.push([after, after, "\nfor (const t in SPEC) for (const k in SPEC[t]) { const p = SPEC[t][k]; if (p[0][0] === '-') p[0] = t + p[0]; }"]);
    return edits;
}
