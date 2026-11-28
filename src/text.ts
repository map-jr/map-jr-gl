/**
 * Text shaping and the glyph atlas.
 *
 * Glyphs are rasterized from local fonts with Canvas2D and converted to signed distance fields, one grapheme at a
 * time, so layout (advances, wrapping, collision boxes) is computed by our own code and behaves the same in every
 * browser. Scripts that need contextual shaping or bidi reordering (Arabic, Hebrew, Indic, Thai, ...) are rasterized
 * a whole line at a time instead, letting the browser's own shaper do the work.
 */
/** How far below the middle of a line the baseline is, in ems. The value puts text where MapLibre draws it. */
export const BASELINE = 0.38;

import {cssFamilies, fontKey, splitFontKey} from './resolve.ts';
import {Pbf} from './mvt.ts';
import {pickImage} from './expr.ts';

export const EM = 24;
export {DEFAULT_FONT} from './resolve.ts';
export const SDF_BUFFER = 4;
export const SDF_RADIUS = 8;
const LINE_HEIGHT = 1.2 * EM;

export interface Glyph {
    x: number; y: number; w: number; h: number; left: number; top: number; advance: number;
    /** An image in the text rather than a character: its name and height (in the same units as `advance`, which is its width). */
    image?: string; imageHeight?: number;
    /** Rich text: the size of this glyph relative to the text size, and its own color. */
    scale?: number; color?: number[];
    /** Rich text: "vertical-align" as in MapLibre (top 0, center 0.5, bottom 1), and the shift down that it gives in the line. */
    align?: number; dy?: number;
}
/** Images that can appear inside text: their size in pixels, or undefined while one is not available yet. */
export type ImageSizes = (name: string) => {width: number; height: number; pixelRatio: number} | undefined;
// Inside the shaper each image in the text is one private-use character, so line breaking treats it as a single unit.
const IMAGE_CHAR = 0xE100;
// Rich text: one private-use character before each character of a styled section names its style.
const STYLE_CHAR = 0xE800, STYLE_CHARS = /[\uE800-\uEFFF]/g;
interface TextStyle { scale: number; font?: string; color?: number[]; align?: number }
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
export interface Shaped { lines: ShapedLine[]; width: number; height: number; lineHeight: number; /** A glyph file of the text is on its way: the text is not drawn yet. */ wait?: boolean; /** The names of the images inside the text, by placeholder character from U+E100. */ images?: string[] }
/** The middle of line `i`, from the middle of the text. Lines of rich text can have different heights. */
export function lineMiddle(shaped: Shaped, i: number): number {
    const line = shaped.lines[i];
    return -shaped.height / 2 + (line.top ?? i * shaped.lineHeight) + shaped.lineHeight * (line.scale ?? 1) / 2;
}
export interface Shaper {
    /** A number that changes when the shaper has new glyphs or images, so that text shaped before can come out different. */
    generation?: number;
    shape(text: string, font: string, maxWidthEm: number, spacingEm: number, lineHeightEm?: number, sizePx?: number): Shaped }

const COMPLEX = /[֐-ࣿऀ-႟ក-៿יִ-﷿ﹰ-﻿]/;
const IDEOGRAPH = /[⺀-鿿가-힯豈-﫿＀-￯]/;
const segmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter(undefined, {granularity: 'grapheme'}) : null;

export function graphemes(s: string): string[] {
    return segmenter ? Array.from(segmenter.segment(s), (x: any) => x.segment) : Array.from(s);
}

// Where a line can break, as in MapLibre: after a space, a hyphen or a dash, "/", "&", "+", ")", a soft hyphen, a middle
// dot, a zero-width space, an image in the text or an ideograph; before "(" and before an ideograph; and between two
// words of a script that is written without spaces (Thai, Lao, Khmer, Burmese, ...), where the browser finds the words.
const BREAK_AFTER = /[\s\-/&+)\u00AD\u00B7\u200B\u2010\u2013\u2027\uE100-\uE7FF]/, IDEO_BREAK = /[⺀-鿿가-힯]/;
const WORDLESS = /[\u0E01-\u0E3A\u0E40-\u0E4E\u0E81-\u0EDF\u0F00-\u0FD4\u1000-\u109F\u1780-\u17DD\u1950-\u19DF\u1A20-\u1AAD\u1B00-\u1B7F\uA980-\uA9FE\uAA60-\uAADF]/;
const wordSegmenter = segmenter && new (Intl as any).Segmenter(undefined, {granularity: 'word'});
/** Splits a paragraph into the units between which a line can break. A style character stays with the character after it. */
function splitWords(para: string): string[] {
    const isStyle = (k: number) => para.charCodeAt(k) >= 0xE800 && para.charCodeAt(k) <= 0xEFFF;
    const plain = para.replace(STYLE_CHARS, '');
    const bounds: Set<number> | null = wordSegmenter && WORDLESS.test(plain) ? new Set(Array.from(wordSegmenter.segment(plain), (x: any) => x.index as number)) : null;
    const words: string[] = [];
    let from = 0, prev = '', p = -1;
    for (let k = 0; k < para.length; k++) {
        if (isStyle(k)) continue;
        const c = para[k], at = k > 0 && isStyle(k - 1) ? k - 1 : k;
        p++;
        if (c >= '\uDC00' && c <= '\uDFFF') continue;
        if (prev && (BREAK_AFTER.test(prev) || IDEO_BREAK.test(prev) || IDEO_BREAK.test(c) || c === '(' && k < para.length - 1 ||
            bounds?.has(p) && WORDLESS.test(prev) && WORDLESS.test(c))) { words.push(para.slice(from, at)); from = at; }
        prev = c;
    }
    words.push(para.slice(from));
    return words.filter(w => w.length);
}

/**
 * Breaks text into lines the way MapLibre does: not by filling each line, but by choosing the breaks that leave the
 * lines closest to one even width (so a label is a balanced block rather than a long line and a stub). A short last
 * line is penalized less, a long one more. Widths ignore the spaces themselves, as MapLibre's do.
 */
function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
    // C0 controls and DEL have no glyph and would draw as a box, so they go before shaping (the line break stays).
    // Tab, VT, FF and CR stay as whitespace, as in MapLibre; the CR of "\r\n" goes so that it adds no line.
    text = text.replace(/\r\n/g, '\n').replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '');
    const lines: string[] = [], paras = text.split('\n');
    // (The even width comes from the whole text, also when it has line breaks of its own: a name over a short second
    // line stays on one line although it is a little wider than the limit, as in MapLibre.)
    let total = 0;
    for (const para of paras) total += measure(para);
    const target = total / Math.max(1, Math.ceil(total / maxWidth));
    const zwsp = text.includes('\u200B');
    for (let pi = 0; pi < paras.length; pi++) {
        const para = paras[pi];
        const words = splitWords(para);
        // (The number of lines comes from the full width, spaces included; the break positions from widths without them.)
        const widths = words.map(w => measure(w.trim()));
        if (!words.length) { lines.push(''); continue; }
        // best[i]: the least "badness" of any way of breaking before word i, and which earlier break it follows.
        const best: {badness: number; prev: number; x: number}[] = [{badness: 0, prev: -1, x: 0}];
        let x = 0;
        for (let i = 1; i <= words.length; i++) {
            x += widths[i - 1];
            const last = i === words.length;
            // Opening brackets prefer to start a line and closing ones to end it, so breaks beside them cost a little.
            // A break between ideographs costs more when the text marks better places with zero-width spaces, as in MapLibre.
            const penalty = last ? 0 : (/[(（]\s*$/.test(words[i - 1]) ? 50 : 0) + (/^[-]?[)）]/.test(words[i]) ? 50 : 0) + (zwsp && IDEO_BREAK.test(words[i - 1].slice(-1)) ? 150 : 0);
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
    generation = 0;
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
            if (hasStyles || hasImages) {
                // A line is as tall as its largest text, as in MapLibre.
                height = 0;
                for (const l of lines) {
                    l.scale ??= l.glyphs?.length ? Math.max(...l.glyphs.map(g => g.scale ?? 1)) : 1; l.top = height; height += LINE_HEIGHT * l.scale;
                    // "vertical-align" moves a section within the height of the largest text or image of the line, as in
                    // MapLibre. Without it, text and images sit at the bottom.
                    const h = Math.max(EM * l.scale, ...(l.glyphs ?? []).map(g => g.image ? g.imageHeight! : 0));
                    for (const g of l.glyphs ?? []) if (g.align != null || g.image) g.dy = (h - (g.image ? g.imageHeight! : EM * (g.scale ?? 1))) * ((g.align ?? 1) - (g.image ? 0.5 : 1)) - (g.image ? (h - EM * l.scale) / 2 : 0);
                }
            }
            s = {lines, width: Math.max(...lines.map(l => l.width)), height, lineHeight: LINE_HEIGHT};
            // Text waiting for an image or for a glyph file is shaped again once that has arrived.
            if (this.waiting) s.wait = true;
            if (this.inline.length) s.images = this.inline;
            if (!this.missingImage && !this.waiting) this.cache.set(key, s);
        }
        return s;
    }
    /** Puts a style character before each character of the styled sections, so that a part of the text keeps its styles. */
    private markStyles(text: string): string {
        let out = '', mark = '';
        for (const part of text.split(/(\uE002[^\uE003]*\uE003)/)) {
            if (part[0] === '\uE002') {
                const [scale, font, color, align] = part.slice(1, -1).split('|');
                if (!scale && !font && !color && !align) { mark = ''; continue; }
                this.styles.push({scale: +scale || 1, font: font ? fontKey(font.split(',')) : undefined, color: color ? color.split(',').map(Number) : undefined,
                    align: align === 'top' ? 0 : align === 'center' ? 0.5 : align ? 1 : undefined});
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
            glyphs.push(style ? {...g, advance: g.advance * style.scale, imageHeight: g.imageHeight, scale: style.scale, color: style.color, align: style.align} : g);
            chars.push(p);
            style = undefined;
        }
        return {glyphs, chars};
    }
    /** The stand-in glyph for an image placeholder character, or null for an ordinary character. */
    protected imageGlyph(part: string): Glyph | null {
        const i = part.charCodeAt(0) - IMAGE_CHAR;
        if (part.length !== 1 || i < 0 || i >= this.inline.length) return null;
        const name = this.inline[i] = pickImage(this.inline[i], n => this.images?.(n)), img = this.images?.(name);
        if (!img) { this.missingImage = true; return {x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance: EM, image: name, imageHeight: EM}; }
        const k = this.imageScale / img.pixelRatio;
        return {x: 0, y: 0, w: 0, h: 0, left: 0, top: 0, advance: img.width * k, image: name, imageHeight: img.height * k};
    }
    reset() { this.cache.clear(); this.generation++; }
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
    /** Starts at 128 rows (256 KB) and doubles up to 2048 rows (4 MB) as glyphs arrive (#27). */
    height = 128;
    data = new Uint8Array(this.width * this.height);
    /** Bumped whenever glyphs are added, so the renderer knows to bring its texture up to date. */
    version = 0;
    /**
     * The places of the glyphs from glyph files that the renderer has not sent yet, as [x, y, w, h] in `data`
     * (neighbors on one shelf share one). `data` has only these glyphs: the renderer computes the distance fields of
     * glyphs drawn with the canvas itself, into its texture (see `drawn`). After a reset, it sends all of `data`.
     */
    dirty: number[][] = [];
    /**
     * Glyphs drawn on the canvas (`canvas`) that wait for the renderer, each [x, y] on the canvas then [x, y, w, h] in
     * the atlas. Nothing reads the pixels of the canvas back: in Firefox, `getImageData` in a worker waits until the
     * page thread is free (#1841). The renderer uploads the canvas into a texture and computes the distance field
     * of each glyph on the GPU, then calls `drawnSent`.
     */
    drawn: number[][] = [];
    /** Called when the canvas is full: the renderer takes the glyphs that wait (`drawn`) so that the canvas can be used again. */
    flush?: () => void;
    /** How many times the atlas has been emptied. Shaped text from before a reset points at stale positions. */
    resets = 0;
    private glyphs = new Map<string, Glyph>();
    /** Called when the atlas had to be emptied, invalidating any shaped text held elsewhere. */
    onReset?: () => void;
    private ctx!: Canvas2D;
    private penX = 1;
    private penY = 1;
    private shelf = 0;
    /** The shelf packing of the canvas, as of the atlas: the glyphs that wait for the renderer. */
    private canvasX = 0;
    private canvasY = 0;
    private canvasShelf = 0;
    /** The canvas that glyphs are drawn on, and the number of its rows that glyphs use. */
    get canvas() { return this.ctx.canvas; }
    get canvasRows() { return this.canvasY + this.canvasShelf; }

    constructor(private family: string) {
        super();
        this.ctx = this.newContext();
    }

    /** The canvas is as wide as the atlas, so that any glyph fits, and 128 rows high (1 MB), or as high as the highest glyph. */
    private newContext(height = 128): Canvas2D {
        const width = this.width;
        const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), {width, height});
        // (A canvas in memory, not on the GPU: the renderer uploads it into its own context.)
        return canvas.getContext('2d', {willReadFrequently: true}) as Canvas2D;
    }

    /** The renderer has taken the glyphs that waited: the canvas is free again. */
    drawnSent() {
        if (this.canvasRows) this.ctx.clearRect(0, 0, this.width, this.canvasRows);
        this.drawn = []; this.canvasX = this.canvasY = this.canvasShelf = 0;
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

    /** Label fonts arrive as "style weight|family|font stack" (see `fontKey`); each family of the stack is tried in order before the map default. */
    private css(font: string) {
        const [variant, family, stack] = splitFontKey(font), list = cssFamilies(stack ?? family);
        // (After web fonts load, a family that is never found ends the string: Chromium keeps, in a worker, the font that it
        // resolved for each font string, also for a new context, and a new string resolves the fonts again.)
        return `${variant} ${EM}px ${list ? list + ', ' : ''}${this.family}${this.fontsRev ? `, "map-jr-${this.fontsRev}"` : ''}`;
    }

    /**
     * Looks up the fonts of the style (values of `text-font`) before the first labels need them. The first use of a
     * font family can take half a second, while the browser looks for the font and its fallback, and the first label
     * placement would wait for it. One font is looked up in each task, so that the messages of the tiles go between.
     * Nothing is drawn: what the labels look like does not change. A style with glyph files needs no lookup; its first
     * glyph files are requested here instead.
     */
    warm(fonts: unknown[]) {
        // With glyph files, the file of the first 256 characters of each font stack is requested now, before the tiles
        // arrive: nearly every label needs it, and otherwise its request would wait for the first placement (#371).
        if (this.glyphsURL) { for (const names of fonts) this.file(Array.isArray(names) ? names.join(',') : String(names), 0); return; }
        const todo = [...new Set(fonts.map(names => this.css(fontKey(names))))];
        const next = () => {
            const css = todo.shift();
            if (!css || this.glyphsURL) return;
            if (!this.warmed.has(css)) { this.warmed.add(css); this.ctx.font = css; this.ctx.measureText('a'); }
            setTimeout(next);
        };
        setTimeout(next);
    }
    private warmed = new Set<string>();
    /** The number of times that web fonts were loaded (see `css`). */
    private fontsRev = 0;

    /** Forgets every glyph, e.g. after a web font finishes loading and text must be redrawn with it. */
    clear(fontsChanged = false) {
        // A canvas context remembers which font it resolved for a given font string, so after new fonts load it
        // would keep drawing with the old fallback. A fresh context resolves them again.
        if (fontsChanged) { this.ctx = this.newContext(); this.warmed.clear(); this.fontsRev++; }
        this.data.fill(0); this.glyphs.clear(); this.reset(); this.drawnSent();
        this.penX = this.penY = 1; this.shelf = 0;
        this.version++; this.resets++; this.dirty = [];
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
    /** The glyph file of a font stack and range: requested when it is not known yet (0 while it is on its way). */
    private file(stack: string, range: number) {
        const key = stack + '|' + range;
        let glyphs = this.ranges.get(key);
        if (glyphs === undefined) {
            this.ranges.set(key, glyphs = 0);
            this.loading++;
            const from = this.glyphsURL!, ranges = this.ranges;
            // (A file that is not a glyph file, or that does not arrive, is the same as no file: the text then uses the
            // canvas. The count of files on their way goes down in each case, or the map is never idle.)
            this.fetchGlyphs!(from.replace('{fontstack}', encodeURIComponent(stack)).replace('{range}', `${range * 256}-${range * 256 + 255}`))
                .then(res => res.ok ? res.arrayBuffer() : null).then(bytes => bytes && readGlyphs(new Uint8Array(bytes))).catch(() => null)
                .then(found => { ranges.set(key, found); this.loading--; this.generation++; this.onGlyphs?.(); });
        }
        return glyphs;
    }
    private fromFile(text: string, stack: string): Glyph | null | undefined {
        const code = text.codePointAt(0)!;
        if (text.length > (code > 0xFFFF ? 2 : 1)) return null;
        const glyphs = this.file(stack, code >> 8);
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
    /** Finds the place of a glyph in the atlas. With `sdf` (a glyph from a file), its distance field goes into `data`. */
    private pack(g: Glyph, sdf: Uint8Array | null, w: number, h: number) {
        if (this.penX + w + 1 > this.width) { this.penX = 1; this.penY += this.shelf + 1; this.shelf = 0; }
        // (Rows keep their offsets when the atlas grows: the renderer copies its texture into a larger one.)
        while (this.penY + h + 1 > this.height && this.height < 2048) {
            const data = new Uint8Array(this.width * (this.height *= 2));
            data.set(this.data); this.data = data;
        }
        if (this.penY + h + 1 > this.height) {
            // Atlas full: start over. Shaped text holds glyph references, so drop those too.
            this.clear();
            this.onReset?.();
        }
        g.x = this.penX; g.y = this.penY; g.w = w; g.h = h;
        if (sdf) {
            for (let row = 0; row < h; row++) this.data.set(sdf.subarray(row * w, row * w + w), (g.y + row) * this.width + g.x);
            const last = this.dirty[this.dirty.length - 1];
            if (last && last[1] === g.y && last[0] + last[2] + 1 === g.x) { last[2] += w + 1; last[3] = Math.max(last[3], h); }
            else this.dirty.push([g.x, g.y, w, h]);
        }
        this.penX += w + 1;
        this.shelf = Math.max(this.shelf, h);
        this.version++;
    }

    /** Finds a place on the canvas for a glyph of w × h pixels; the renderer takes the glyphs on it first when it is full. */
    private place(w: number, h: number): [number, number] {
        if (this.canvasX + w > this.width) { this.canvasX = 0; this.canvasY += this.canvasShelf; this.canvasShelf = 0; }
        if (this.canvasY + h > this.ctx.canvas.height) {
            if (this.drawn.length) this.flush?.();
            this.drawnSent();
            if (h > this.ctx.canvas.height) this.ctx = this.newContext(h);
        }
        const at: [number, number] = [this.canvasX, this.canvasY];
        this.canvasX += w; this.canvasShelf = Math.max(this.canvasShelf, h);
        return at;
    }

    private glyph(text: string, font: string): Glyph {
        const key = font + '|' + text;
        let g = this.glyphs.get(key);
        if (g) return g;
        const stack = this.glyphsURL && splitFontKey(font)[2];
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
            // (The place in the atlas comes first: when the atlas is full, it is emptied, and the canvas with it.)
            this.pack(g, null, w, h);
            const [x, y] = this.place(w, h), c = this.ctx;
            c.font = css;
            c.textBaseline = 'alphabetic';
            c.fillStyle = '#000';
            c.fillText(text, x + B + left, y + B + top);
            this.drawn.push([x, y, g.x, g.y, w, h]);
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
