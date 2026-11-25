// The plugin minify-shaders of build.mjs: comments and whitespace go from the GLSL templates of src/gl.ts, and nothing else changes (#902).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error a script without type declarations
import {minifyShaders} from '../../scripts/minify-shaders.mjs';

const apply = (code: string) => {
    let out = code;
    for (const [start, end, text] of [...minifyShaders(code)].reverse()) out = out.slice(0, start) + text + out.slice(end);
    return out;
};

test('an escaped backtick in a comment of a shader does not end the template, and the next template stays whole (#902)', () => {
    const code = 'const vs = `uniform float u_a; // the \\` of a comment\nvoid main() {\n    gl_Position = vec4(u_a);\n}`;\nconst label = `a // b`;\n';
    assert.equal(apply(code), 'const vs = `uniform float u_a;void main(){gl_Position=vec4(u_a);}`;\nconst label = `a // b`;\n');
});

test('a preprocessor line keeps a line of its own, and a template without GLSL is not changed', () => {
    const code = 'const s = `#ifdef GLOBE\nuniform float u_r;\n#endif\nvoid main() {}`; const t = `x  // y`;';
    assert.equal(apply(code), 'const s = `#ifdef GLOBE\nuniform float u_r;\n#endif\nvoid main(){}`; const t = `x  // y`;');
});

test('spaces go from around + and - unless the other side is + or - too, and numbers lose the zeros they do not need (#1948)', () => {
    const code = 'const s = `uniform float u_a; void main() { float b = u_a * 2.0 - 1.0 + 0.5; float c = b - -u_a + 10.0 - 1.05; float d = 1.0e3 + v0.0 - ${N}.0; }`;';
    assert.equal(apply(code), 'const s = `uniform float u_a;void main(){float b=u_a*2.-1.+.5;float c=b- -u_a+10.-1.05;float d=1.0e3+v0.0-${N}.0;}`;');
});

test('declarations of uniforms, inputs and outputs of the same type that follow each other become one (#2075)', () => {
    const code = 'const s = `uniform vec4 u_a; uniform float u_b; uniform vec4 u_c[4]; in vec2 v_x; flat in vec4 v_y; in vec2 v_z; layout(location=0) in vec2 a_p; layout(location=1) in vec2 a_q; uniform highp sampler2D u_d; uniform highp sampler2D u_e; uniform vec2 u_n[${N}]; uniform vec2 u_m; out vec4 o; void main() { float a; float b; }`;';
    assert.equal(apply(code), 'const s = `uniform vec4 u_a,u_c[4];uniform float u_b;in vec2 v_x,v_z;flat in vec4 v_y;layout(location=0)in vec2 a_p;layout(location=1)in vec2 a_q;uniform highp sampler2D u_d,u_e;uniform vec2 u_n[${N}];uniform vec2 u_m;out vec4 o;void main(){float a;float b;}`;');
});
