// Elevation tiles in the tile workers (`decodePixels` in src/contour.ts) are read exactly when the 2D canvas adds
// noise to `getImageData`, as Safari does in private browsing (#427). The browser APIs are fakes: the 2D context adds
// noise, and the WebGL context returns the pixels of the image unchanged.
import {test} from 'node:test';
import assert from 'node:assert/strict';

const W = 4, H = 3;
// A terrarium tile: height = R * 256 + G + B / 256 - 32768.
const heights = Array.from({length: W * H}, (_, i) => 100 + i * 37.5);
const tile = new Uint8ClampedArray(W * H * 4);
heights.forEach((h, i) => { const v = h + 32768; tile.set([v >> 8, v & 255, Math.round((v % 1) * 256), 255], i * 4); });

const used = {noisyReads: 0, glReads: 0};
class Fake2D {
    px: Uint8ClampedArray; w: number; fillStyle = ''; imageSmoothingEnabled = true;
    constructor(w: number, h: number) { this.w = w; this.px = new Uint8ClampedArray(w * h * 4); }
    fillRect(x: number, y: number) { const [r, g, b] = this.fillStyle.match(/\d+/g)!.map(Number); this.px.set([r, g, b, 255], (y * this.w + x) * 4); }
    drawImage(image: {px: Uint8ClampedArray}) { this.px.set(image.px); }
    getImageData(_x: number, _y: number, w: number, h: number) {
        used.noisyReads++;
        const data = this.px.slice();
        for (let i = 0; i < data.length; i++) if (i % 4 !== 3) data[i] = Math.min(255, Math.max(0, data[i] + (i % 3) - 1 || 1));
        return {width: w, height: h, data};
    }
}
class FakeGL {
    TEXTURE_2D = 1; RGBA = 2; UNSIGNED_BYTE = 3; FRAMEBUFFER = 4; COLOR_ATTACHMENT0 = 5; FRAMEBUFFER_COMPLETE = 6; NONE = 0;
    UNPACK_PREMULTIPLY_ALPHA_WEBGL = 7; UNPACK_FLIP_Y_WEBGL = 8; UNPACK_COLORSPACE_CONVERSION_WEBGL = 9;
    private source?: {px: Uint8ClampedArray};
    isContextLost() { return false; }
    createTexture() { return {}; } createFramebuffer() { return {}; } deleteTexture() {} deleteFramebuffer() {}
    bindTexture() {} bindFramebuffer() {} pixelStorei() {} framebufferTexture2D() {}
    checkFramebufferStatus() { return this.FRAMEBUFFER_COMPLETE; }
    texImage2D(_t: number, _l: number, _i: number, _f: number, _ty: number, source: {px: Uint8ClampedArray}) { this.source = source; }
    readPixels(_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, out: Uint8ClampedArray) { used.glReads++; out.set(this.source!.px); }
}
const g = globalThis as any;
g.OffscreenCanvas = class { w: number; h: number; constructor(w: number, h: number) { this.w = w; this.h = h; } getContext(kind: string) { return kind === '2d' ? new Fake2D(this.w, this.h) : new FakeGL(); } };
g.createImageBitmap = async () => ({width: W, height: H, px: tile, close() {}});

test('a distorted 2D canvas is detected, and elevation tiles are read through WebGL with exact heights (#427)', async () => {
    const {canvasDistorted} = await import('../../src/exact-pixels.ts');
    const {decodeDEM} = await import('../../src/contour.ts');
    assert.equal(canvasDistorted(), true, 'the check finds the noise');
    const before = used.noisyReads;
    const dem = await decodeDEM(new Uint8Array([1]), 'terrarium');
    assert.equal(used.glReads, 1, 'the tile is read through WebGL');
    assert.equal(used.noisyReads, before, 'the tile is not read through the 2D canvas');
    assert.deepEqual([...dem.data], heights, 'the heights are exact');
    canvasDistorted(); canvasDistorted();
    assert.equal(used.noisyReads, before, 'the check runs once');
});
