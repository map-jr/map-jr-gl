/**
 * Text shaping and the glyph atlas.
 *
 * Glyphs are rasterised from local fonts with Canvas2D and converted to signed distance fields, one grapheme at a
 * time, so layout (advances, wrapping, collision boxes) is computed by our own code and behaves the same in every
 * browser. Scripts that need contextual shaping or bidi reordering (Arabic, Hebrew, Indic, Thai, ...) are rasterised
 * a whole line at a time instead, letting the browser's own shaper do the work.
 */
export const EM = 24;
export const SDF_BUFFER = 4;
export const SDF_RADIUS = 8;
const LINE_HEIGHT = 1.2 * EM;

export interface Glyph { x: number; y: number; w: number; h: number; left: number; top: number; advance: number }
export interface ShapedLine { text: string; width: number; glyphs?: Glyph[] }
/** All measurements are in pixels at a font size of EM. */
export interface Shaped { lines: ShapedLine[]; width: number; height: number; lineHeight: number }
export interface Shaper { shape(text: string, font: string, maxWidthEm: number, spacingEm: number): Shaped }

const COMPLEX = /[֐-ࣿऀ-႟ក-៿יִ-﷿ﹰ-﻿]/;
const IDEOGRAPH = /[⺀-鿿가-힯豈-﫿＀-￯]/;
const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, {granularity: 'grapheme'}) : null;

export function graphemes(s: string): string[] {
    return segmenter ? Array.from(segmenter.segment(s), (x: any) => x.segment) : Array.from(s);
}

/** Greedy line breaking at spaces (and between ideographs), shared by the browser and server shapers. */
function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
    const lines: string[] = [];
    for (const para of text.split('\n')) {
        const words = para.split(/(?<=\s)|(?<=[⺀-鿿가-힯])|(?=[⺀-鿿가-힯])/);
        let line = '';
        for (const w of words) {
            if (line && measure((line + w).trimEnd()) > maxWidth) { lines.push(line.trimEnd()); line = w; } else line += w;
        }
        if (line.trim()) lines.push(line.trimEnd());
    }
    return lines.length ? lines : [''];
}

abstract class BaseShaper implements Shaper {
    private cache = new Map<string, Shaped>();
    protected abstract line(text: string, font: string, spacing: number): ShapedLine;

    shape(text: string, font: string, maxWidthEm: number, spacingEm: number): Shaped {
        const key = `${font}|${maxWidthEm}|${spacingEm}|${text}`;
        let s = this.cache.get(key);
        if (!s) {
            if (this.cache.size > 5000) this.cache.clear();
            const spacing = spacingEm * EM;
            const lines = wrap(text, maxWidthEm * EM, t => this.line(t, font, spacing).width).map(t => this.line(t, font, spacing));
            s = {lines, width: Math.max(...lines.map(l => l.width)), height: lines.length * LINE_HEIGHT, lineHeight: LINE_HEIGHT};
            this.cache.set(key, s);
        }
        return s;
    }
    reset() { this.cache.clear(); }
}

/** Server-side shaper: no font access, so widths are estimated. Good enough for collision; the browser draws the actual text. */
export class EstimateShaper extends BaseShaper {
    protected line(text: string, font: string, spacing: number): ShapedLine {
        let w = 0, n = 0;
        const bold = /[6-9]00/.test(font) ? 1.06 : 1;
        for (const ch of text) {
            n++;
            w += IDEOGRAPH.test(ch) ? EM : /[iljtfr.,:;'|! ]/.test(ch) ? EM * 0.3 : /[mwMW@]/.test(ch) ? EM * 0.85 : /[A-Z0-9]/.test(ch) ? EM * 0.66 : EM * 0.54;
        }
        return {text, width: w * bold + spacing * Math.max(0, n - 1)};
    }
}

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Single-channel SDF atlas with shelf packing. Works on the main thread and in workers (OffscreenCanvas). */
export class GlyphAtlas extends BaseShaper {
    readonly width = 1024;
    readonly height = 1024;
    data = new Uint8Array(this.width * this.height);
    /** Bumped whenever pixels change, so the renderer knows to re-upload. */
    version = 0;
    private glyphs = new Map<string, Glyph>();
    private ctx: Canvas2D;
    private penX = 1;
    private penY = 1;
    private shelf = 0;

    constructor(private family: string) {
        super();
        const size = 256;
        const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), {width: size, height: size});
        this.ctx = canvas.getContext('2d', {willReadFrequently: true}) as Canvas2D;
    }

    protected line(text: string, font: string, spacing: number): ShapedLine {
        // One atlas entry per grapheme, or per whole line when the browser must shape it.
        const parts = COMPLEX.test(text) ? [text] : graphemes(text);
        const glyphs = parts.map(p => this.glyph(p, font));
        let width = spacing * Math.max(0, glyphs.length - 1);
        for (const g of glyphs) width += g.advance;
        return {text, width, glyphs};
    }

    private glyph(text: string, font: string): Glyph {
        const key = font + '|' + text;
        let g = this.glyphs.get(key);
        if (g) return g;
        const ctx = this.ctx, B = SDF_BUFFER;
        ctx.font = `${font} ${EM}px ${this.family}`;
        const m = ctx.measureText(text);
        const left = Math.ceil(m.actualBoundingBoxLeft), top = Math.ceil(m.actualBoundingBoxAscent);
        const gw = Math.max(0, left + Math.ceil(m.actualBoundingBoxRight)), gh = Math.max(0, top + Math.ceil(m.actualBoundingBoxDescent));
        const w = gw + 2 * B, h = gh + 2 * B;
        g = {x: 0, y: 0, w, h, left: -left, top, advance: m.width};
        if (gw && gh && w < this.width) {
            if (ctx.canvas.width < w || ctx.canvas.height < h) {
                ctx.canvas.width = Math.max(ctx.canvas.width, w);
                ctx.canvas.height = Math.max(ctx.canvas.height, h);
                ctx.font = `${font} ${EM}px ${this.family}`;
            }
            ctx.clearRect(0, 0, w, h);
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#000';
            ctx.fillText(text, B + left, B + top);
            const sdf = toSDF(ctx.getImageData(0, 0, w, h).data, w, h);
            if (this.penX + w + 1 > this.width) { this.penX = 1; this.penY += this.shelf + 1; this.shelf = 0; }
            if (this.penY + h + 1 > this.height) {
                // Atlas full: start over. Shaped text holds glyph references, so drop those too.
                this.data.fill(0); this.glyphs.clear(); this.reset();
                this.penX = this.penY = 1; this.shelf = 0;
            }
            g.x = this.penX; g.y = this.penY;
            for (let row = 0; row < h; row++) this.data.set(sdf.subarray(row * w, row * w + w), (g.y + row) * this.width + g.x);
            this.penX += w + 1;
            this.shelf = Math.max(this.shelf, h);
            this.version++;
        } else { g.w = g.h = 0; }
        this.glyphs.set(key, g);
        return g;
    }
}

const INF = 1e20;

/** Alpha coverage -> signed distance field (Felzenszwalb & Huttenlocher squared distance transform, run on both sides of the edge). */
function toSDF(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
    const n = w * h, outer = new Float64Array(n), inner = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const a = rgba[i * 4 + 3] / 255;
        outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, 0.5 - a) ** 2;
        inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - 0.5) ** 2;
    }
    const size = Math.max(w, h), f = new Float64Array(size), d = new Float64Array(size), z = new Float64Array(size + 1), v = new Int32Array(size);
    edt(outer, w, h, f, d, v, z);
    edt(inner, w, h, f, d, v, z);
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const dist = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
        out[i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (dist / SDF_RADIUS + 0.25))));
    }
    return out;
}

function edt(grid: Float64Array, w: number, h: number, f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array) {
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
        edt1d(f, d, v, z, h);
        for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
        edt1d(f, d, v, z, w);
        for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
}

function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number) {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
        let s: number;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q * q - r * r) / (2 * (q - r));
        } while (s <= z[k] && --k > -1);
        k++;
        v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    for (let q = 0, k = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        const r = v[k];
        d[q] = (q - r) * (q - r) + f[r];
    }
}
