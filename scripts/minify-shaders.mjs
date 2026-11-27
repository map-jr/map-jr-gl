// The edits of the plugin `minify-shaders` of build.mjs, in a module of their own so that test/unit can check them.

/**
 * Finds the template literals of `code` that hold GLSL and gives, for each, its place and its shorter text. Comments (line
 * comments and block comments) and whitespace go, and a preprocessor line (`#ifdef GLOBE`, `#define`) keeps a line of its own, as GLSL requires. An
 * escaped backtick inside a template does not end the template (#902).
 * @returns `[start, end, text]` for each template, in the order of `code`.
 */
export function minifyShaders(code) {
    const out = [];
    for (const m of code.matchAll(/`((?:[^`\\]|\\.)*)`/gs)) if (/void main|uniform |\bfloat /.test(m[1]))
        // (Spaces also go from around the operators. Around + and - they stay when the other side is + or - too: `a - -b`
        // must not become `a--b`. A number loses the zero that it does not need: `1.0` is `1.`, and `0.5` is `.5`.)
        out.push([m.index, m.index + m[0].length, '`' + m[1].replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').split(/\n(?=[ \t]*#)|(?<=^[ \t]*#[^\n]*)\n/m)
            .map(part => part.replace(/\s+/g, ' ').replace(/ ?([{};,()=*\/<>?:!&|]) ?/g, '$1').replace(/(?<![+-]) ?([+-]) (?![+-])|(?<![+-]) ([+-]) ?(?![+-])/g, '$1$2')
                .replace(/(?<![\w.])(\d+)\.0(?![\w.])/g, '$1.').replace(/(?<![\w.])0\.(?=\d)/g, '.').trim().replace(DECLARATIONS, mergeDeclarations)).filter(Boolean).join('\n')
            // (Text that ends with a preprocessor line keeps the end of that line: the shader that includes it goes on after it.)
            .replace(/(^|\n)(#[^\n]*)$/, '$1$2\n') + '`']);
    return out;
}

/**
 * A run of declarations of uniforms, inputs and outputs, one after the other (`uniform vec4 a;uniform float b;uniform vec4 c;`).
 * A declaration with `layout`, a value or a `${...}` part of JavaScript ends the run.
 */
const DECLARATIONS = /(?<=^|[;}])(?:(?:uniform|in|out|flat in|flat out) (?:(?:highp|mediump|lowp) )?\w+ \w+(?:\[\d+\])?;){2,}/g;

/**
 * The declarations of a run with the same qualifier and type become one (`uniform vec4 a,c;uniform float b;`). Their
 * order does not matter in GLSL ES 3.00: a program matches the outputs of the vertex shader to the inputs of the
 * fragment shader by name, and the page finds a uniform by its name.
 */
function mergeDeclarations(run) {
    const byType = new Map();
    for (const [, type, name] of run.matchAll(/(\D[\w ]*?) (\w+(?:\[\d+\])?);/g)) byType.set(type, [...byType.get(type) ?? [], name]);
    return [...byType].map(([type, names]) => `${type} ${names.join(',')};`).join('');
}
