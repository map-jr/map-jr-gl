// The edits of the plugin `gl-constants` of build.mjs, in a module of their own so that test/unit can check them.

/**
 * The values of the WebGL constants that src/ reads from a context. The WebGL 1 and 2 specifications fix them, so they
 * are the same in every browser. A constant that src/ starts to use is added here; the build stops until it is.
 */
export const GL_CONSTANTS = {
    ACTIVE_UNIFORMS: 35718,
    ARRAY_BUFFER: 34962,
    BACK: 1029,
    BLEND: 3042,
    BROWSER_DEFAULT_WEBGL: 37444,
    CCW: 2305,
    CLAMP_TO_EDGE: 33071,
    COLOR_ATTACHMENT0: 36064,
    COLOR_BUFFER_BIT: 16384,
    CULL_FACE: 2884,
    DEPTH_ATTACHMENT: 36096,
    DEPTH_BUFFER_BIT: 256,
    DEPTH_COMPONENT: 6402,
    DEPTH_COMPONENT24: 33190,
    DEPTH_TEST: 2929,
    DST_COLOR: 774,
    DYNAMIC_DRAW: 35048,
    ELEMENT_ARRAY_BUFFER: 34963,
    FLOAT: 5126,
    FRAGMENT_SHADER: 35632,
    FRONT: 1028,
    FRAMEBUFFER: 36160,
    FRAMEBUFFER_BINDING: 36006,
    FRAMEBUFFER_COMPLETE: 36053,
    FUNC_ADD: 32774,
    HALF_FLOAT: 5131,
    KEEP: 7680,
    LEQUAL: 515,
    LINEAR: 9729,
    LINEAR_MIPMAP_LINEAR: 9987,
    LINEAR_MIPMAP_NEAREST: 9985,
    LINES: 1,
    LINK_STATUS: 35714,
    NEAREST: 9728,
    NONE: 0,
    NOTEQUAL: 517,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 771,
    ONE_MINUS_SRC_COLOR: 769,
    PACK_ALIGNMENT: 3333,
    PACK_ROW_LENGTH: 3330,
    PACK_SKIP_PIXELS: 3332,
    PACK_SKIP_ROWS: 3331,
    PIXEL_PACK_BUFFER: 35051,
    PIXEL_UNPACK_BUFFER: 35052,
    POLYGON_OFFSET_FILL: 32823,
    R32F: 33326,
    R8: 33321,
    RASTERIZER_DISCARD: 35977,
    RED: 6403,
    REPLACE: 7681,
    RGBA: 6408,
    RGBA16F: 34842,
    SAMPLE_ALPHA_TO_COVERAGE: 32926,
    SAMPLE_COVERAGE: 32928,
    SCISSOR_TEST: 3089,
    SHORT: 5122,
    STATIC_DRAW: 35044,
    STENCIL_BUFFER_BIT: 1024,
    STENCIL_TEST: 2960,
    TEXTURE0: 33984,
    TEXTURE1: 33985,
    TEXTURE2: 33986,
    TEXTURE_2D: 3553,
    TEXTURE_MAG_FILTER: 10240,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    TRIANGLES: 4,
    TRIANGLE_STRIP: 5,
    UNPACK_ALIGNMENT: 3317,
    UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
    UNPACK_FLIP_Y_WEBGL: 37440,
    UNPACK_IMAGE_HEIGHT: 32878,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
    UNPACK_ROW_LENGTH: 3314,
    UNPACK_SKIP_IMAGES: 32877,
    UNPACK_SKIP_PIXELS: 3316,
    UNPACK_SKIP_ROWS: 3315,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_INT: 5125,
    UNSIGNED_SHORT: 5123,
    VERTEX_SHADER: 35633,
};

/**
 * Finds each `gl.NAME` of `code`, where NAME is a WebGL constant, and gives its place and its number. A number is
 * shorter than a property read, and the minifier cannot do this itself because it does not know that `gl` is a context.
 * @returns `[start, end, text]` for each read, in the order of `code`.
 */
export function inlineGlConstants(code) {
    const out = [];
    for (const m of code.matchAll(/(?<![\w$.])gl\.([A-Z][A-Z0-9_]+)\b/g)) {
        const value = GL_CONSTANTS[m[1]];
        if (value === undefined) throw new Error('gl-constants: add the value of gl.' + m[1] + ' to scripts/gl-constants.mjs');
        out.push([m.index, m.index + m[0].length, String(value)]);
    }
    return out;
}
