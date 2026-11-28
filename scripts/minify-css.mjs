// The edits of the plugin `minify-css` of build.mjs, in a module of their own so that test/unit can check them.

/**
 * `CONTROL_CSS` of src/controls.ts has one rule on each line, for the reader. The page scripts do not need the line
 * breaks: a line break and the spaces after it go where they follow `{`, `}`, `;` or `,` or start a template, and become
 * one space anywhere else, where a line break can separate two parts of a selector (#2342). server.js keeps the lines.
 * @returns `[start, end, text]` for each template literal of `CONTROL_CSS`, in the order of `code`.
 */
export function minifyControlCss(code) {
    const start = code.indexOf('\nexport const CONTROL_CSS = `'), end = code.slice(start).search(/\n`;\r?\n/) + start;
    if (start < 0 || end < 0) throw new Error('scripts/minify-css.mjs: src/controls.ts has no "export const CONTROL_CSS = `" that ends with a line "`;".');
    const out = [];
    for (const m of code.slice(start, end + 2).matchAll(/`([^`$\\]*)`/g)) {
        const text = m[1].replace(/\r?\n[ \t]*/g, (_, at, all) => at === 0 || '{};,'.includes(all[at - 1]) ? '' : ' ');
        out.push([start + m.index, start + m.index + m[0].length, '`' + text + '`']);
    }
    return out;
}
