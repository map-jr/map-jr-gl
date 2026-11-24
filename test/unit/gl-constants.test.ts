// The plugin gl-constants of build.mjs: each read of a WebGL constant from the context becomes its number (#1767).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
// @ts-expect-error a script without type declarations
import {inlineGlConstants, GL_CONSTANTS} from '../../scripts/gl-constants.mjs';

const apply = (code: string) => {
    let out = code;
    for (const [start, end, text] of [...inlineGlConstants(code)].reverse()) out = out.slice(0, start) + text + out.slice(end);
    return out;
};

test('gl.NAME becomes the number of the constant, and other reads stay', () => {
    assert.equal(apply('gl.bindTexture(gl.TEXTURE_2D, t); this.gl.LINEAR; ogl.FLOAT; gl.drawArrays(gl.TRIANGLES, 0, 3);'),
        'gl.bindTexture(3553, t); this.gl.LINEAR; ogl.FLOAT; gl.drawArrays(4, 0, 3);');
});

test('a constant that the table does not have stops the build', () => {
    assert.throws(() => inlineGlConstants('gl.NOT_A_CONSTANT'), /add the value of gl\.NOT_A_CONSTANT/);
});

test('the table has the values of the WebGL specification', () => {
    // A few values from the specification (WebGL 1 section 5.14, WebGL 2 section 3.7).
    assert.deepEqual([GL_CONSTANTS.TEXTURE_2D, GL_CONSTANTS.FRAMEBUFFER, GL_CONSTANTS.RGBA16F, GL_CONSTANTS.UNPACK_FLIP_Y_WEBGL, GL_CONSTANTS.HALF_FLOAT],
        [0x0DE1, 0x8D40, 0x881A, 0x9240, 0x140B]);
});

test('the built worker file reads no WebGL constant from the context', () => {
    const reads = readFileSync('dist/map-jr-gl-worker.js', 'utf8').match(/\.(?:TEXTURE_2D|FRAMEBUFFER|ARRAY_BUFFER|UNSIGNED_BYTE)\b/g);
    assert.equal(reads, null);
});

test('every constant that src/ reads is in the table', () => {
    for (const f of readdirSync('src').filter(f => f.endsWith('.ts'))) inlineGlConstants(readFileSync('src/' + f, 'utf8'));
});
