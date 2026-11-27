// The edits of the plugin `spec-names` of build.mjs, in a module of their own so that test/unit can check them.

/**
 * In `SPEC` of src/style.ts, the name of each property of a layer type other than `symbol` starts with that type
 * (`'fill-opacity'` in `fill`). The built files leave that start out (`'-opacity'`), and a loop after `SPEC` puts it back
 * when the module loads, so `SPEC` holds the same names as in src/ (#2342). In `symbol`, a name that starts with
 * `text-` loses `text` in the same way (`'-size'`). A name with another start stays as it is (`'icon-image'`,
 * `'symbol-placement'`, `'resampling'`): a second mark for `icon-` made the loop longer than what it saved.
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
        const name = type && /^ {8}\w+: \['([\w-]+)'/.exec(line)?.[1], prefix = type === 'symbol' ? 'text' : type;
        const from = at + line.indexOf("'") + 1;
        if (name?.startsWith(prefix + '-')) edits.push([from, from + prefix.length, '']);
    }
    if (!edits.length) throw new Error('scripts/spec-names.mjs: no name of SPEC in src/style.ts starts with its layer type.');
    const after = end + '\n};'.length;
    edits.push([after, after, "\nfor (const t in SPEC) for (const k in SPEC[t]) { const p = SPEC[t][k]; if (p[0][0] === '-') p[0] = (t === 'symbol' ? 'text' : t) + p[0]; }"]);
    return edits;
}
