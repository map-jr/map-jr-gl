/**
 * Text shaping and the glyph atlas.
 *
 * Glyphs are rasterised from local fonts with Canvas2D and converted to signed distance fields, one grapheme at a
 * time, so layout (advances, wrapping, collision boxes) is computed by our own code and behaves the same in every
 * browser. Scripts that need contextual shaping or bidi reordering (Arabic, Hebrew, Indic, Thai, ...) are rasterised
 * a whole line at a time instead, letting the browser's own shaper do the work.
 */
export const EM = 24;
export const DEFAULT_FONT = '"Noto Sans", "Helvetica Neue", Arial, sans-serif';
export const SDF_BUFFER = 4;
export const SDF_RADIUS = 8;
const LINE_HEIGHT = 1.2 * EM;

export interface Glyph {
    x: number; y: number; w: number; h: number; left: number; top: number; advance: number;
    /** An image in the text rather than a character: its name and height (in the same units as `advance`, which is its width). */
    image?: string; imageHeight?: number;
}
/** Images that can appear inside text: their size in pixels, or undefined while one is not available yet. */
export type ImageSizes = (name: string) => {width: number; height: number; pixelRatio: number} | undefined;
// Inside the shaper each image in the text is one private-use character, so line breaking treats it as a single unit.
const IMAGE_CHAR = 0xE100;
export interface ShapedLine {
    text: string; width: number; glyphs?: Glyph[];
    /** The line split into the units that are positioned individually, with each one's advance. */
    chars: string[]; advances: number[];
}
/** All measurements are in pixels at a font size of EM. */
export interface Shaped { lines: ShapedLine[]; width: number; height: number; lineHeight: number }
export interface Shaper { shape(text: string, font: string, maxWidthEm: number, spacingEm: number, lineHeightEm?: number, sizePx?: number): Shaped }

const COMPLEX = /[֐-ࣿऀ-႟ក-៿יִ-﷿ﹰ-﻿]/;
const IDEOGRAPH = /[⺀-鿿가-힯豈-﫿＀-￯]/;
const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, {granularity: 'grapheme'}) : null;

export function graphemes(s: string): string[] {
    return segmenter ? Array.from(segmenter.segment(s), (x: any) => x.segment) : Array.from(s);
}

/** Greedy line breaking at spaces (and between ideographs), shared by the browser and server shapers. */
/**
 * Breaks text into lines the way MapLibre does: not by filling each line, but by choosing the breaks that leave the
 * lines closest to one even width (so a label is a balanced block rather than a long line and a stub). A short last
 * line is penalised less, a long one more. Widths ignore the spaces themselves, as MapLibre's do.
 */
function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
    const lines: string[] = [];
    for (const para of text.split('\n')) {
        const words = para.split(/(?<=\s)|(?<=[⺀-鿿가-힯])|(?=[⺀-鿿가-힯])/).filter(w => w.length);
        // (The number of lines comes from the full width, spaces included; the break positions from widths without them.)
        const widths = words.map(w => measure(w.trim())), total = measure(para);
        if (!words.length) continue;
        const target = total / Math.max(1, Math.ceil(total / maxWidth));
        // best[i]: the least "badness" of any way of breaking before word i, and which earlier break it follows.
        const best: {badness: number; prev: number; x: number}[] = [{badness: 0, prev: -1, x: 0}];
        let x = 0;
        for (let i = 1; i <= words.length; i++) {
            x += widths[i - 1];
            const last = i === words.length;
            // Opening brackets prefer to start a line and closing ones to end it, so breaks beside them cost a little.
            const penalty = !last && (/[(（]\s*$/.test(words[i - 1]) || /^[)）]/.test(words[i])) ? 50 : 0;
            let choice = {badness: Infinity, prev: 0, x};
            for (let j = 0; j < i; j++) {
                const width = x - best[j].x;
                let ragged = (width - target) ** 2;
                if (last) ragged = width < target ? ragged / 2 : ragged * 2;
                const badness = best[j].badness + ragged + penalty * penalty;
                if (badness <= choice.badness) choice = {badness, prev: j, x};
            }
            best.push(choice);
        }
        const cuts: number[] = [];
        for (let i = words.length; i > 0; i = best[i].prev) cuts.unshift(i);
        let from = 0;
        for (const to of cuts) { const line = words.slice(from, to).join('').trim(); if (line) lines.push(line); from = to; }
    }
    return lines.length ? lines : [''];
}

abstract class BaseShaper implements Shaper {
    private cache = new Map<string, Shaped>();
    protected abstract line(text: string, font: string, spacing: number): ShapedLine;

    /** Set by whoever can supply images, to allow them inside text. */
    images?: ImageSizes;
    /** Images in the text being shaped, by placeholder character, and how many text units one image pixel is. */
    protected inline: string[] = [];
    protected imageScale = 1;
    protected missingImage = false;

    shape(text: string, font: string, maxWidthEm: number, spacingEm: number, lineHeightEm = 1.2, sizePx = 16): Shaped {
        const hasImages = text.includes('\uE000');
        const key = `${font}|${maxWidthEm}|${spacingEm}|${lineHeightEm}|${hasImages ? sizePx : ''}|${text}`, LINE_HEIGHT = lineHeightEm * EM;
        let s = this.cache.get(key);
        if (!s) {
            if (this.cache.size > 5000) this.cache.clear();
            const spacing = spacingEm * EM;
            this.inline = []; this.missingImage = false;
            // An image is drawn at its own size whatever the text size, so its width in text units depends on that size.
            this.imageScale = EM / sizePx;
            if (hasImages) text = text.replace(/\uE000([^\uE001]*)\uE001/g, (_, name) => this.images ? String.fromCharCode(IMAGE_CHAR + this.inline.push(name) - 1) : '');
            const lines = wrap(text, maxWidthEm * EM, t => this.line(t, font, spacing).width).map(t => this.line(t, font, spacing));
            s = {lines, width: Math.max(...lines.map(l => l.width)), height: lines.length * LINE_HEIGHT, lineHeight: LINE_HEIGHT};
            // Text waiting for an image is shaped again once the image has arrived.
            if (!this.missingImage) this.cache.set(key, s);
        }
        return s;
    }
    /** The stand-in glyph for an image placeholder character, or null for an ordinary character. */
    protected imageGlyph(part: string): Glyph | null {
        const i = part.charCodeAt(0) - IMAGE_CHAR;
        if (part.length !== 1 || i < 0 || i >= this.inline.length) return null;
        const name = this.inline[i], img = this.images?.(name);
        if (!img) { this.missingImage = true; return {x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance: EM, image: name, imageHeight: EM}; }
        const k = this.imageScale / img.pixelRatio;
        return {x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance: img.width * k, image: name, imageHeight: img.height * k};
    }
    reset() { this.cache.clear(); }
}

/** Server-side shaper: no font access, so widths are estimated. Good enough for collision; the browser draws the actual text. */
export class EstimateShaper extends BaseShaper {
    protected line(text: string, font: string, spacing: number): ShapedLine {
        let w = 0, n = 0;
        const bold = /[6-9]00/.test(font) ? 1.06 : 1, chars: string[] = [], advances: number[] = [];
        for (const ch of text) {
            n++;
            const a = this.imageGlyph(ch)?.advance ?? (IDEOGRAPH.test(ch) ? EM : /[iljtfr.,:;'|! ]/.test(ch) ? EM * 0.3 : /[mwMW@]/.test(ch) ? EM * 0.85 : /[A-Z0-9]/.test(ch) ? EM * 0.66 : EM * 0.54);
            w += a; chars.push(ch); advances.push(a * bold);
        }
        return {text, width: w * bold + spacing * Math.max(0, n - 1), chars, advances};
    }
}

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Single-channel SDF atlas with shelf packing. Works on the main thread and in workers (OffscreenCanvas). */
export class GlyphAtlas extends BaseShaper {
    readonly width = 2048;
    readonly height = 2048;
    data = new Uint8Array(this.width * this.height);
    /** Bumped whenever pixels change, so the renderer knows to re-upload. */
    version = 0;
    /** Rows changed since the renderer last uploaded, so it can send just those; null means everything. */
    dirty: [number, number] | null = null;
    /** How many times the atlas has been emptied. Shaped text from before a reset points at stale positions. */
    resets = 0;
    private glyphs = new Map<string, Glyph>();
    /** Called when the atlas had to be emptied, invalidating any shaped text held elsewhere. */
    onReset?: () => void;
    private ctx!: Canvas2D;
    private penX = 1;
    private penY = 1;
    private shelf = 0;

    constructor(private family: string) {
        super();
        this.ctx = this.newContext();
    }

    private newContext(): Canvas2D {
        const size = 256;
        const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), {width: size, height: size});
        return canvas.getContext('2d', {willReadFrequently: true}) as Canvas2D;
    }

    protected line(text: string, font: string, spacing: number): ShapedLine {
        // One atlas entry per grapheme, or per whole line when the browser must shape it.
        const parts = COMPLEX.test(text) ? [text] : graphemes(text);
        const glyphs = parts.map(p => this.imageGlyph(p) ?? this.glyph(p, font));
        let width = spacing * Math.max(0, glyphs.length - 1);
        for (const g of glyphs) width += g.advance;
        return {text, width, glyphs, chars: parts, advances: glyphs.map(g => g.advance)};
    }

    /** Label fonts arrive as "style weight|family"; the family named by the style is tried before the map default. */
    private css(font: string) {
        const [variant, family] = font.split('|');
        return `${variant} ${EM}px ${family ? `"${family}", ` : ''}${this.family}`;
    }

    /** Forgets every glyph, e.g. after a web font finishes loading and text must be redrawn with it. */
    clear(fontsChanged = false) {
        // A canvas context remembers which font it resolved for a given font string, so after new fonts load it
        // would keep drawing with the old fallback. A fresh context resolves them again.
        if (fontsChanged) this.ctx = this.newContext();
        this.data.fill(0); this.glyphs.clear(); this.reset();
        this.penX = this.penY = 1; this.shelf = 0;
        this.version++; this.resets++; this.dirty = null;
    }

    private glyph(text: string, font: string): Glyph {
        const key = font + '|' + text;
        let g = this.glyphs.get(key);
        if (g) return g;
        const ctx = this.ctx, B = SDF_BUFFER;
        const css = this.css(font);
        ctx.font = css;
        const m = ctx.measureText(text);
        const left = Math.ceil(m.actualBoundingBoxLeft), top = Math.ceil(m.actualBoundingBoxAscent);
        const gw = Math.max(0, left + Math.ceil(m.actualBoundingBoxRight)), gh = Math.max(0, top + Math.ceil(m.actualBoundingBoxDescent));
        const w = gw + 2 * B, h = gh + 2 * B;
        g = {x: 0, y: 0, w, h, left: -left, top, advance: m.width};
        if (gw && gh && w < this.width) {
            if (ctx.canvas.width < w || ctx.canvas.height < h) {
                ctx.canvas.width = Math.max(ctx.canvas.width, w);
                ctx.canvas.height = Math.max(ctx.canvas.height, h);
                ctx.font = css;
            }
            ctx.clearRect(0, 0, w, h);
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#000';
            ctx.fillText(text, B + left, B + top);
            const sdf = toSDF(ctx.getImageData(0, 0, w, h).data, w, h);
            if (this.penX + w + 1 > this.width) { this.penX = 1; this.penY += this.shelf + 1; this.shelf = 0; }
            if (this.penY + h + 1 > this.height) {
                // Atlas full: start over. Shaped text holds glyph references, so drop those too.
                this.clear();
                this.onReset?.();
            }
            g.x = this.penX; g.y = this.penY;
            for (let row = 0; row < h; row++) this.data.set(sdf.subarray(row * w, row * w + w), (g.y + row) * this.width + g.x);
            this.penX += w + 1;
            this.shelf = Math.max(this.shelf, h);
            if (this.dirty) { this.dirty[0] = Math.min(this.dirty[0], g.y); this.dirty[1] = Math.max(this.dirty[1], g.y + h); }
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
