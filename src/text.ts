/**
 * Text shaping and the glyph atlas.
 *
 * Glyphs are rasterised from local fonts with Canvas2D and converted to signed distance fields, one grapheme at a
 * time, so layout (advances, wrapping, collision boxes) is computed by our own code and behaves the same in every
 * browser. Scripts that need contextual shaping or bidi reordering (Arabic, Hebrew, Indic, Thai, ...) are rasterised
 * a whole line at a time instead, letting the browser's own shaper do the work.
 */
/** How far below the middle of a line the baseline is, in ems. The value puts text where MapLibre draws it. */
export const BASELINE = 0.38;

import {parseFontName} from './resolve.ts';
import {Pbf} from './mvt.ts';

export const EM = 24;
export {DEFAULT_FONT} from './resolve.ts';
export const SDF_BUFFER = 4;
export const SDF_RADIUS = 8;
const LINE_HEIGHT = 1.2 * EM;

export interface Glyph {
    x: number; y: number; w: number; h: number; left: number; top: number; advance: number;
    /** An image in the text rather than a character: its name and height (in the same units as `advance`, which is its width). */
    image?: string; imageHeight?: number;
    /** Rich text: the size of this glyph relative to the text size, and its own colour. */
    scale?: number; color?: number[];
}
/** Images that can appear inside text: their size in pixels, or undefined while one is not available yet. */
export type ImageSizes = (name: string) => {width: number; height: number; pixelRatio: number} | undefined;
// Inside the shaper each image in the text is one private-use character, so line breaking treats it as a single unit.
const IMAGE_CHAR = 0xE100;
// Rich text: one private-use character before each character of a styled section names its style.
const STYLE_CHAR = 0xE800, STYLE_CHARS = /[\uE800-\uEFFF]/g;
interface TextStyle { scale: number; font?: string; color?: number[] }
export interface ShapedLine {
    text: string; width: number; glyphs?: Glyph[];
    /** The line split into the units that are positioned individually, with each one's advance. */
    chars: string[]; advances: number[];
    /** Rich text: the largest glyph scale in the line. The line is that much taller. Absent for plain text. */
    scale?: number;
    /** The distance from the top of the text to the top of this line. Absent for plain text, where lines are equal. */
    top?: number;
}
/** All measurements are in pixels at a font size of EM. */
export interface Shaped { lines: ShapedLine[]; width: number; height: number; lineHeight: number; /** A glyph file of the text is on its way: the text is not drawn yet. */ wait?: boolean }
/** The middle of line `i`, from the middle of the text. Lines of rich text can have different heights. */
export function lineMiddle(shaped: Shaped, i: number): number {
    const line = shaped.lines[i];
    return -shaped.height / 2 + (line.top ?? i * shaped.lineHeight) + shaped.lineHeight * (line.scale ?? 1) / 2;
}
export interface Shaper { shape(text: string, font: string, maxWidthEm: number, spacingEm: number, lineHeightEm?: number, sizePx?: number): Shaped }

const COMPLEX = /[֐-ࣿऀ-႟ក-៿יִ-﷿ﹰ-﻿]/;
const IDEOGRAPH = /[⺀-鿿가-힯豈-﫿＀-￯]/;
const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, {granularity: 'grapheme'}) : null;

export function graphemes(s: string): string[] {
    return segmenter ? Array.from(segmenter.segment(s), (x: any) => x.segment) : Array.from(s);
}

/**
 * Breaks text into lines the way MapLibre does: not by filling each line, but by choosing the breaks that leave the
 * lines closest to one even width (so a label is a balanced block rather than a long line and a stub). A short last
 * line is penalised less, a long one more. Widths ignore the spaces themselves, as MapLibre's do.
 */
function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
    const lines: string[] = [], paras = text.split('\n');
    // (The even width comes from the whole text, also when it has line breaks of its own: a name over a short second
    // line stays on one line although it is a little wider than the limit, as in MapLibre.)
    let total = 0;
    for (const para of paras) total += measure(para);
    const target = total / Math.max(1, Math.ceil(total / maxWidth));
    for (let pi = 0; pi < paras.length; pi++) {
        const para = paras[pi];
        const words = para.split(/(?<=\s)|(?<=[⺀-鿿가-힯])|(?<![\uE800-\uEFFF])(?=[⺀-鿿가-힯])|(?=[\uE800-\uEFFF][⺀-鿿가-힯])/).filter(w => w.length);
        // (The number of lines comes from the full width, spaces included; the break positions from widths without them.)
        const widths = words.map(w => measure(w.trim()));
        if (!words.length) continue;
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
                if (last && pi === paras.length - 1) ragged = width < target ? ragged / 2 : ragged * 2;
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
    /** A glyph of the text in work waits for its glyph file (see `GlyphAtlas`). */
    protected waiting = false;
    /** Rich text: the styles in the text being shaped, by style character. */
    protected styles: TextStyle[] = [];

    shape(text: string, font: string, maxWidthEm: number, spacingEm: number, lineHeightEm = 1.2, sizePx = 16): Shaped {
        const hasImages = text.includes('\uE000'), hasStyles = text.includes('\uE002');
        const key = `${font}|${maxWidthEm}|${spacingEm}|${lineHeightEm}|${hasImages ? sizePx : ''}|${text}`, LINE_HEIGHT = lineHeightEm * EM;
        let s = this.cache.get(key);
        if (!s) {
            if (this.cache.size > 5000) this.cache.clear();
            const spacing = spacingEm * EM;
            this.inline = []; this.missingImage = this.waiting = false; this.styles = [];
            // An image is drawn at its own size whatever the text size, so its width in text units depends on that size.
            this.imageScale = EM / sizePx;
            if (hasImages) text = text.replace(/\uE000([^\uE001]*)\uE001/g, (_, name) => this.images ? String.fromCharCode(IMAGE_CHAR + this.inline.push(name) - 1) : '');
            if (hasStyles) text = this.markStyles(text);
            const lines = wrap(text, maxWidthEm * EM, t => this.line(t, font, spacing).width).map(t => this.line(t, font, spacing));
            let height = lines.length * LINE_HEIGHT;
            if (hasStyles) {
                // A line is as tall as its largest text, as in MapLibre.
                height = 0;
                for (const l of lines) { l.scale ??= l.glyphs?.length ? Math.max(...l.glyphs.map(g => g.scale ?? 1)) : 1; l.top = height; height += LINE_HEIGHT * l.scale; }
            }
            s = {lines, width: Math.max(...lines.map(l => l.width)), height, lineHeight: LINE_HEIGHT};
            // Text waiting for an image or for a glyph file is shaped again once that has arrived.
            if (this.waiting) s.wait = true;
            if (!this.missingImage && !this.waiting) this.cache.set(key, s);
        }
        return s;
    }
    /** Puts a style character before each character of the styled sections, so that a part of the text keeps its styles. */
    private markStyles(text: string): string {
        let out = '', mark = '';
        for (const part of text.split(/(\uE002[^\uE003]*\uE003)/)) {
            if (part[0] === '\uE002') {
                const [scale, font, color] = part.slice(1, -1).split('|');
                if (!scale && !font && !color) { mark = ''; continue; }
                const f = font ? parseFontName(font) : null;
                this.styles.push({scale: +scale || 1, font: f ? (f.style === 'italic' ? 'italic ' : '') + f.weight + '|' + f.family + '|' + font : undefined, color: color ? color.split(',').map(Number) : undefined});
                mark = String.fromCharCode(STYLE_CHAR + this.styles.length - 1);
            } else out += mark ? graphemes(part).map(g => g === '\n' ? g : mark + g).join('') : part;
        }
        return out;
    }
    /** The style named by a style character, or undefined for another character. */
    protected styleOf(part: string): TextStyle | undefined {
        const i = part.charCodeAt(0) - STYLE_CHAR;
        return part.length === 1 && i >= 0 ? this.styles[i] : undefined;
    }
    /** Makes the glyphs of a line from its characters: the shared code of the shapers for rich text. */
    protected styled(parts: string[], glyph: (part: string, font?: string) => Glyph): {glyphs: Glyph[]; chars: string[]} {
        const glyphs: Glyph[] = [], chars: string[] = [];
        let style: TextStyle | undefined;
        for (const p of parts) {
            const st = this.styleOf(p);
            if (st) { style = st; continue; }
            if (p.charCodeAt(0) >= STYLE_CHAR && p.charCodeAt(0) < 0xF000 && p.length === 1) continue; // a style that is not known
            const g = glyph(p, style?.font);
            glyphs.push(style ? {...g, advance: g.advance * style.scale, imageHeight: g.imageHeight, scale: style.scale, color: style.color} : g);
            chars.push(p);
            style = undefined;
        }
        return {glyphs, chars};
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
        let scale = 1, largest = 0;
        for (const ch of text) {
            const style = this.styleOf(ch);
            if (style) { scale = style.scale; continue; }
            n++;
            const a = scale * (this.imageGlyph(ch)?.advance ?? (IDEOGRAPH.test(ch) ? EM : /[iljtfr.,:;'|! ]/.test(ch) ? EM * 0.3 : /[mwMW@]/.test(ch) ? EM * 0.85 : /[A-Z0-9]/.test(ch) ? EM * 0.66 : EM * 0.54));
            largest = Math.max(largest, scale); scale = 1;
            w += a; chars.push(ch); advances.push(a * bold);
        }
        return {text, width: w * bold + spacing * Math.max(0, n - 1), chars, advances, scale: this.styles.length ? largest || 1 : undefined};
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
        // (Text that the browser shapes as a whole line has one style.)
        const parts = COMPLEX.test(text) ? [text.replace(STYLE_CHARS, '')] : graphemes(text);
        const {glyphs, chars} = this.styled(parts, (p, own) => this.imageGlyph(p) ?? this.glyph(p, own ?? font));
        let width = spacing * Math.max(0, glyphs.length - 1);
        for (const g of glyphs) width += g.advance;
        return {text, width, glyphs, chars, advances: glyphs.map(g => g.advance)};
    }

    /** Label fonts arrive as "style weight|family|font stack"; the family named by the style is tried before the map default. */
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

    /**
     * The glyphs of the style (`glyphs`: a URL with `{fontstack}` and `{range}`), as MapLibre uses them. A file has the
     * glyphs of 256 characters of one font stack, each as a distance field of the same kind as this atlas has, with
     * its measures. Text is then the same on each device, and its widths are those of MapLibre. A character that the
     * files do not have (most ideographs, emoji) and text that the browser must shape are drawn with the canvas.
     */
    glyphsURL?: string;
    /** Gives the atlas another URL for the glyph files: the files of the URL before are forgotten. */
    setGlyphs(url?: string) { this.glyphsURL = url; this.ranges = new Map(); this.clear(); }
    fetchGlyphs?: (url: string) => Promise<Response>;
    /** Called when a glyph file has arrived: text that waited for it can be shaped now. */
    onGlyphs?: () => void;
    /** How many glyph files are on their way. */
    loading = 0;
    /** By font stack and range: the glyphs of a file by character, 0 while it is on its way, null when there is none. */
    private ranges = new Map<string, Map<number, {bitmap?: Uint8Array; [field: number]: number}> | 0 | null>();
    private fromFile(text: string, stack: string): Glyph | null | undefined {
        const code = text.codePointAt(0)!;
        if (text.length > (code > 0xFFFF ? 2 : 1)) return null;
        const range = code >> 8, key = stack + '|' + range;
        let glyphs = this.ranges.get(key);
        if (glyphs === undefined) {
            this.ranges.set(key, glyphs = 0);
            this.loading++;
            const from = this.glyphsURL!, ranges = this.ranges;
            // (A file that is not a glyph file, or that does not arrive, is the same as no file: the text then uses the
            // canvas. The count of files on their way goes down in each case, or the map is never idle.)
            this.fetchGlyphs!(from.replace('{fontstack}', encodeURIComponent(stack)).replace('{range}', `${range * 256}-${range * 256 + 255}`))
                .then(res => res.ok ? res.arrayBuffer() : null).then(bytes => bytes && readGlyphs(new Uint8Array(bytes))).catch(() => null)
                .then(found => { ranges.set(key, found); this.loading--; this.onGlyphs?.(); });
        }
        if (!glyphs) return glyphs === 0 ? undefined : null;
        const f = glyphs.get(code);
        // (A glyph with a size that cannot be right is not used: it must not write outside its place in the atlas.)
        if (!f || (f[3] ?? 0) > 250 || (f[4] ?? 0) > 250 || f.bitmap && f.bitmap.length !== ((f[3] ?? 0) + 6) * ((f[4] ?? 0) + 6)) return null;
        // (The files have a border of 3 pixels about each glyph, the atlas one of SDF_BUFFER.)
        const pad = SDF_BUFFER - 3, gw = (f[3] ?? 0) + 6, w = gw + 2 * pad, h = (f[4] ?? 0) + 6 + 2 * pad;
        const g: Glyph = {x: 0, y: 0, w: 0, h: 0, left: f[5] ?? 0, top: (f[6] ?? 0) + 17 + BASELINE * EM, advance: f[7] ?? 0};
        if (f.bitmap) {
            const cell = new Uint8Array(w * h);
            for (let row = 0; row < h - 2 * pad; row++) cell.set(f.bitmap.subarray(row * gw, row * gw + gw), (row + pad) * w + pad);
            this.pack(g, cell, w, h);
        }
        return g;
    }
    /** Puts the distance field of a glyph into the atlas. */
    private pack(g: Glyph, sdf: Uint8Array, w: number, h: number) {
        if (this.penX + w + 1 > this.width) { this.penX = 1; this.penY += this.shelf + 1; this.shelf = 0; }
        if (this.penY + h + 1 > this.height) {
            // Atlas full: start over. Shaped text holds glyph references, so drop those too.
            this.clear();
            this.onReset?.();
        }
        g.x = this.penX; g.y = this.penY; g.w = w; g.h = h;
        for (let row = 0; row < h; row++) this.data.set(sdf.subarray(row * w, row * w + w), (g.y + row) * this.width + g.x);
        this.penX += w + 1;
        this.shelf = Math.max(this.shelf, h);
        if (this.dirty) { this.dirty[0] = Math.min(this.dirty[0], g.y); this.dirty[1] = Math.max(this.dirty[1], g.y + h); }
        this.version++;
    }

    private glyph(text: string, font: string): Glyph {
        const key = font + '|' + text;
        let g = this.glyphs.get(key);
        if (g) return g;
        const stack = this.glyphsURL && font.split('|')[2];
        if (stack) {
            const found = this.fromFile(text, stack);
            // (A glyph that waits for its file is not kept: the text is shaped again when the file is there.)
            if (found === undefined) { this.waiting = true; return {x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance: EM / 2}; }
            if (found) { this.glyphs.set(key, found); return found; }
        }
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
            this.pack(g, toSDF(ctx.getImageData(0, 0, w, h).data, w, h), w, h);
        } else { g.w = g.h = 0; }
        this.glyphs.set(key, g);
        return g;
    }
}

/** Reads a glyph file: for each glyph a record of its fields by number (1 id, 3 width, 4 height, 5 left, 6 top, 7 advance) and its bitmap. */
export function readGlyphs(bytes: Uint8Array) {
    const out = new Map<number, {bitmap?: Uint8Array; [field: number]: number}>(), file = new Pbf(bytes);
    while (file.pos < file.end) {
        const tag = file.varint();
        if (tag !== 10) { file.skip(tag & 7); continue; }
        const stack = file.sub();
        while (stack.pos < stack.end) {
            const t = stack.varint();
            if (t !== 26) { stack.skip(t & 7); continue; }
            const g = stack.sub(), glyph: {bitmap?: Uint8Array; [field: number]: number} = {};
            while (g.pos < g.end) {
                const k = g.varint(), field = k >> 3;
                if (field === 2) { const len = g.varint(); glyph.bitmap = bytes.subarray(g.pos, g.pos += len); }
                else if (k & 7) g.skip(k & 7);
                else glyph[field] = field === 5 || field === 6 ? g.svarint() : g.varint();
            }
            out.set(glyph[1], glyph);
        }
    }
    return out;
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
