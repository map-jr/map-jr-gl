// Reads the pixels of an image exactly. Some browsers add noise to the pixels that `getImageData` returns, to make
// fingerprinting harder (Safari in private browsing does this, also on an OffscreenCanvas). Heights of elevation
// tiles are stored in the color channels, so that noise turns terrain into spikes. The check for a distorted canvas
// follows the method of MapLibre GL JS (`isOffscreenCanvasDistorted`, BSD-3-Clause); the code here is new. When the
// canvas is distorted, the image is read through WebGL (`texImage2D` and `readPixels`), which is not distorted.
//
// The result of the check and the WebGL context are kept per JavaScript context (page or worker). They describe the
// browser, not a map, so two maps can share them. The context exists only in a browser that distorts the canvas, and
// it is kept because it reads every elevation and contour tile; such a page holds one for each JavaScript context
// that reads tiles (the page and each tile worker), which counts toward WebKit's limit of active contexts (#839).

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Source = CanvasImageSource & TexImageSource;

function canvas(w: number, h: number): Canvas {
    return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h)
        : Object.assign((globalThis as any).document.createElement('canvas') as HTMLCanvasElement, {width: w, height: h});
}

let distorted: boolean | undefined;

/** Whether `getImageData` returns other pixels than the ones drawn. Checked once per JavaScript context. */
export function canvasDistorted(): boolean {
    if (distorted === undefined) {
        distorted = false;
        try {
            const n = 5, ctx = canvas(n, n).getContext('2d', {willReadFrequently: true}) as CanvasRenderingContext2D | null;
            if (ctx) {
                // Pixel i gets the color (4i, 4i + 1, 4i + 2), so byte k of the result must be k (alpha aside).
                for (let i = 0; i < n * n; i++) { ctx.fillStyle = `rgb(${i * 4},${i * 4 + 1},${i * 4 + 2})`; ctx.fillRect(i % n, i / n | 0, 1, 1); }
                const d = ctx.getImageData(0, 0, n, n).data;
                for (let k = 0; k < d.length; k++) if (k % 4 !== 3 && d[k] !== k) { distorted = true; break; }
            }
        } catch { /* No 2D canvas here: nothing is read back through one. */ }
    }
    return distorted;
}

let gl: WebGLRenderingContext | null | undefined;

function readWithGL(source: Source, w: number, h: number): Uint8ClampedArray | null {
    if (!gl || gl.isContextLost()) gl = canvas(1, 1).getContext('webgl', {antialias: false, depth: false, stencil: false}) as WebGLRenderingContext | null;
    if (!gl) return null;
    const tex = gl.createTexture(), fb = gl.createFramebuffer();
    try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
        const out = new Uint8ClampedArray(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
        return out;
    } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        gl.deleteTexture(tex);
    }
}

/**
 * The RGBA pixels (not premultiplied) of `source`, which is `w` × `h` pixels in size. Uses a 2D canvas, or WebGL
 * when the 2D canvas is distorted.
 */
export function imagePixels(source: Source, w: number, h: number): Uint8ClampedArray {
    if (canvasDistorted()) {
        const px = readWithGL(source, w, h);
        if (px) return px;
    }
    const ctx = canvas(w, h).getContext('2d', {willReadFrequently: true}) as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, w, h).data;
}

/** Decoded image pixels, four bytes (red, green, blue, alpha) each. */
export interface Pixels { width: number; height: number; data: Uint8Array | Uint8ClampedArray }
/** Turns an encoded image into pixels. Needed where there is no browser to do it, e.g. for WebP tiles on a server. */
export type ImageDecoder = (bytes: Uint8Array) => Promise<Pixels> | Pixels;

/** The pixels of an elevation tile image, from `decode` if given and otherwise from the browser. */
export async function decodePixels(bytes: Uint8Array | ImageBitmap, decode?: ImageDecoder): Promise<Pixels> {
    // (An `ImageBitmap` is the answer of a custom protocol, which is on a page: a server has none.)
    const given = !('length' in bytes);
    if (decode && !given) return decode(bytes);
    if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('Elevation tiles need a browser or decodeImage');
    const image = given ? bytes : await createImageBitmap(new Blob([bytes as BlobPart]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
    const {width, height} = image; // read before close(), which zeroes them
    // Heights are in the color channels, so pixels must be exact: see `imagePixels`.
    const data = imagePixels(image, width, height);
    image.close();
    return {width, height, data};
}
