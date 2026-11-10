/**
 * Image decoders for the server renderer, where there is no browser to decode elevation tiles: PNG, and lossless
 * WebP (VP8L), the usual format of WebP elevation tiles. Lossy WebP is not handled.
 */
import type {Pixels} from './contour.ts';

class Bits {
    private pos = 0; private bit = 0;
    private data: Uint8Array;
    constructor(data: Uint8Array) { this.data = data; }
    one(): number {
        const v = (this.data[this.pos] >> this.bit) & 1;
        if (++this.bit === 8) { this.bit = 0; this.pos++; }
        return v;
    }
    read(n: number): number {
        let v = 0;
        for (let i = 0; i < n; i++) v |= this.one() << i;
        return v >>> 0;
    }
}

/** Canonical prefix code: symbols sorted by code length, walked one bit at a time. */
class Code {
    private single = -1;
    private counts = new Uint16Array(16);
    private symbols: Uint16Array;
    constructor(lengths: ArrayLike<number>) {
        let used = 0, last = 0;
        for (let i = 0; i < lengths.length; i++) if (lengths[i]) { used++; last = i; this.counts[lengths[i]]++; }
        this.symbols = new Uint16Array(used);
        if (used <= 1) { this.single = last; return; }
        const next = new Uint16Array(16);
        for (let len = 1; len < 16; len++) next[len] = next[len - 1] + this.counts[len - 1];
        for (let i = 0; i < lengths.length; i++) if (lengths[i]) this.symbols[next[lengths[i]]++] = i;
    }
    read(b: Bits): number {
        if (this.single >= 0) return this.single;
        for (let len = 1, code = 0, first = 0, index = 0; len < 16; len++) {
            code |= b.one();
            const count = this.counts[len];
            if (code - count < first) return this.symbols[index + code - first];
            index += count; first = (first + count) << 1; code <<= 1;
        }
        throw new Error('Corrupt WebP data');
    }
}

const ORDER = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
function readCode(b: Bits, alphabet: number): Code {
    const lengths = new Uint8Array(alphabet);
    if (b.read(1)) {
        const two = b.read(1), first = b.read(b.read(1) ? 8 : 1);
        lengths[first] = 1;
        if (two) lengths[b.read(8)] = 1;
        return new Code(lengths);
    }
    const cl = new Uint8Array(19), n = 4 + b.read(4);
    for (let i = 0; i < n; i++) cl[ORDER[i]] = b.read(3);
    const lengthCode = new Code(cl);
    let budget = alphabet;
    if (b.read(1)) budget = 2 + b.read(2 + 2 * b.read(3));
    for (let i = 0, prev = 8; i < alphabet && budget-- > 0;) {
        const s = lengthCode.read(b);
        if (s < 16) { lengths[i++] = s; if (s) prev = s; continue; }
        const repeat = s === 16 ? 3 + b.read(2) : s === 17 ? 3 + b.read(3) : 11 + b.read(7), value = s === 16 ? prev : 0;
        for (let k = 0; k < repeat && i < alphabet; k++) lengths[i++] = value;
    }
    return new Code(lengths);
}

// Short distances name nearby pixels by (dx, dy), nearest first.
const NEAR = '0,1,1,0,1,1,-1,1,0,2,2,0,1,2,-1,2,2,1,-2,1,2,2,-2,2,0,3,3,0,1,3,-1,3,3,1,-3,1,2,3,-2,3,3,2,-3,2,0,4,4,0,1,4,-1,4,4,1,-4,1,3,3,-3,3,2,4,-2,4,4,2,-4,2,0,5,3,4,-3,4,4,3,-4,3,5,0,1,5,-1,5,5,1,-5,1,2,5,-2,5,5,2,-5,2,4,4,-4,4,3,5,-3,5,5,3,-5,3,0,6,6,0,1,6,-1,6,6,1,-6,1,2,6,-2,6,6,2,-6,2,4,5,-4,5,5,4,-5,4,3,6,-3,6,6,3,-6,3,0,7,7,0,1,7,-1,7,5,5,-5,5,7,1,-7,1,4,6,-4,6,6,4,-6,4,2,7,-2,7,7,2,-7,2,3,7,-3,7,7,3,-7,3,5,6,-5,6,6,5,-6,5,8,0,4,7,-4,7,7,4,-7,4,8,1,8,2,6,6,-6,6,8,3,5,7,-5,7,7,5,-7,5,8,4,6,7,-6,7,7,6,-7,6,8,5,7,7,-7,7,8,6,8,7'.split(',').map(Number);

const lz = (b: Bits, prefix: number) => {
    if (prefix < 4) return prefix + 1;
    const extra = (prefix - 2) >> 1;
    return ((2 + (prefix & 1)) << extra) + b.read(extra) + 1;
};
const blocks = (size: number, bits: number) => (size + (1 << bits) - 1) >> bits;

/** Reads one entropy-coded image of ARGB pixels. Only the main image may have its own prefix-code map. */
function readImage(b: Bits, w: number, h: number, main: boolean): Uint32Array {
    const cacheBits = b.read(1) ? b.read(4) : 0, cache = cacheBits ? new Uint32Array(1 << cacheBits) : null;
    let groupBits = 0, groupMap: Uint32Array | null = null, groupW = 0, groups = 1;
    if (main && b.read(1)) {
        groupBits = b.read(3) + 2; groupW = blocks(w, groupBits);
        groupMap = readImage(b, groupW, blocks(h, groupBits), false);
        for (let i = 0; i < groupMap.length; i++) { groupMap[i] = (groupMap[i] >> 8) & 0xffff; groups = Math.max(groups, groupMap[i] + 1); }
    }
    const codes: Code[][] = [];
    for (let g = 0; g < groups; g++) codes.push([256 + 24 + (cacheBits ? 1 << cacheBits : 0), 256, 256, 256, 40].map(n => readCode(b, n)));
    const out = new Uint32Array(w * h), n = w * h;
    const remember = (p: number) => { if (cache) cache[Math.imul(0x1e35a7bd, p) >>> (32 - cacheBits)] = p; };
    for (let pos = 0; pos < n;) {
        const c = codes[groupMap ? groupMap[((pos / w | 0) >> groupBits) * groupW + ((pos % w) >> groupBits)] : 0];
        const s = c[0].read(b);
        if (s < 256) {
            const red = c[1].read(b), blue = c[2].read(b), alpha = c[3].read(b);
            remember(out[pos++] = (alpha << 24 | red << 16 | s << 8 | blue) >>> 0);
        } else if (s < 280) {
            const length = lz(b, s - 256), code = lz(b, c[4].read(b));
            const dist = code > 120 ? code - 120 : Math.max(1, NEAR[(code - 1) * 2] + NEAR[(code - 1) * 2 + 1] * w);
            for (let i = 0; i < length && pos < n; i++, pos++) remember(out[pos] = out[pos - dist]);
        } else remember(out[pos++] = cache![s - 280]);
    }
    return out;
}

// Per-channel arithmetic on packed ARGB values.
const add = (a: number, b: number) => ((((a & 0xff00ff00) >>> 0) + ((b & 0xff00ff00) >>> 0)) & 0xff00ff00 | ((a & 0xff00ff) + (b & 0xff00ff)) & 0xff00ff) >>> 0;
const avg = (a: number, b: number) => ((((a ^ b) & 0xfefefefe) >>> 1) + (a & b)) >>> 0;
const ch = (p: number, shift: number) => (p >>> shift) & 0xff;
const clamp = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;
const perChannel = (f: (shift: number) => number) => (f(24) << 24 | f(16) << 16 | f(8) << 8 | f(0)) >>> 0;
function select(L: number, T: number, TL: number) {
    let pL = 0, pT = 0;
    for (const s of [0, 8, 16, 24]) { const p = ch(L, s) + ch(T, s) - ch(TL, s); pL += Math.abs(p - ch(L, s)); pT += Math.abs(p - ch(T, s)); }
    return pL < pT ? L : T;
}
function predict(mode: number, L: number, T: number, TL: number, TR: number): number {
    switch (mode) {
        case 0: return 0xff000000;
        case 1: return L;
        case 2: return T;
        case 3: return TR;
        case 4: return TL;
        case 5: return avg(avg(L, TR), T);
        case 6: return avg(L, TL);
        case 7: return avg(L, T);
        case 8: return avg(TL, T);
        case 9: return avg(T, TR);
        case 10: return avg(avg(L, TL), avg(T, TR));
        case 11: return select(L, T, TL);
        case 12: return perChannel(s => clamp(ch(L, s) + ch(T, s) - ch(TL, s)));
        case 13: { const a = avg(L, T); return perChannel(s => clamp(ch(a, s) + Math.trunc((ch(a, s) - ch(TL, s)) / 2))); }
        default: return 0xff000000;
    }
}
const int8 = (v: number) => v << 24 >> 24;
const delta = (t: number, c: number) => (int8(t) * int8(c)) >> 5;

/** Decodes a lossless WebP image into RGBA pixels. */
export function decodeWebPLossless(bytes: Uint8Array): Pixels {
    const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('Not a WebP image');
    let o = 12;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (o < bytes.length && tag(o) !== 'VP8L') o += 8 + view.getUint32(o + 4, true) + (view.getUint32(o + 4, true) & 1);
    if (o >= bytes.length || bytes[o + 8] !== 0x2f) throw new Error('Only lossless WebP can be decoded here; pass a decodeImage function for lossy WebP');
    const b = new Bits(bytes.subarray(o + 9));
    const width = b.read(14) + 1, height = b.read(14) + 1;
    b.read(4); // alpha hint and version

    type Step = {type: number; bits: number; data: Uint32Array};
    const steps: Step[] = [];
    let w = width;
    while (b.read(1)) {
        const type = b.read(2);
        if (type === 0 || type === 1) { const bits = b.read(3) + 2; steps.push({type, bits, data: readImage(b, blocks(w, bits), blocks(height, bits), false)}); }
        else if (type === 2) steps.push({type, bits: 0, data: new Uint32Array(0)});
        else {
            const colours = b.read(8) + 1, palette = readImage(b, colours, 1, false);
            for (let i = 1; i < colours; i++) palette[i] = add(palette[i], palette[i - 1]);
            const bits = colours <= 2 ? 3 : colours <= 4 ? 2 : colours <= 16 ? 1 : 0;
            steps.push({type, bits, data: palette});
            w = blocks(w, bits);
        }
    }
    let px = readImage(b, w, height, true);

    for (const {type, bits, data} of steps.reverse()) {
        if (type === 0) {
            const bw = blocks(width, bits);
            for (let i = 0; i < px.length; i++) {
                const x = i % width, y = i / width | 0;
                const p = y === 0 ? (x === 0 ? 0xff000000 : px[i - 1]) : x === 0 ? px[i - width]
                    : predict((data[(y >> bits) * bw + (x >> bits)] >> 8) & 0xf, px[i - 1], px[i - width], px[i - width - 1], px[i - width + 1]);
                px[i] = add(px[i], p);
            }
        } else if (type === 1) {
            const bw = blocks(width, bits);
            for (let i = 0; i < px.length; i++) {
                const t = data[((i / width | 0) >> bits) * bw + ((i % width) >> bits)], p = px[i], green = ch(p, 8);
                const red = (ch(p, 16) + delta(ch(t, 0), green)) & 0xff;
                const blue = (ch(p, 0) + delta(ch(t, 8), green) + delta(ch(t, 16), red)) & 0xff;
                px[i] = ((p & 0xff00ff00) | red << 16 | blue) >>> 0;
            }
        } else if (type === 2) {
            for (let i = 0; i < px.length; i++) { const p = px[i], g = ch(p, 8); px[i] = ((p & 0xff00ff00) | ((ch(p, 16) + g) & 0xff) << 16 | ((ch(p, 0) + g) & 0xff)) >>> 0; }
        } else {
            const packedW = blocks(width, bits), per = 8 >> bits, mask = (1 << per) - 1, full = new Uint32Array(width * height);
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                const packed = ch(px[y * packedW + (x >> bits)], 8);
                full[y * width + x] = data[(packed >> ((x & ((1 << bits) - 1)) * per)) & mask] ?? 0;
            }
            px = full;
        }
    }
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < px.length; i++) { const p = px[i]; data[i * 4] = ch(p, 16); data[i * 4 + 1] = ch(p, 8); data[i * 4 + 2] = ch(p, 0); data[i * 4 + 3] = ch(p, 24); }
    return {width, height, data};
}

/** Decodes an 8-bit RGB or RGBA PNG without a browser (enough for elevation tiles). */
export async function decodePNG(bytes: Uint8Array): Promise<Pixels> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0) !== 0x89504e47) throw new Error('Not a PNG image; pass a decodeImage function for other formats');
    let width = 0, height = 0, channels = 0;
    const parts: Uint8Array[] = [];
    for (let o = 8; o < bytes.length;) {
        const len = view.getUint32(o), type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
        if (type === 'IHDR') {
            width = view.getUint32(o + 8); height = view.getUint32(o + 12);
            const depth = bytes[o + 16], colour = bytes[o + 17];
            if (depth !== 8 || (colour !== 2 && colour !== 6) || bytes[o + 20]) throw new Error('Only 8-bit RGB(A), non-interlaced PNG is supported; pass a decodeImage function');
            channels = colour === 2 ? 3 : 4;
        } else if (type === 'IDAT') parts.push(bytes.subarray(o + 8, o + 8 + len));
        o += len + 12;
    }
    const raw = new Uint8Array(await new Response(new Blob(parts as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const stride = width * channels, data = new Uint8Array(width * height * 4), prev = new Uint8Array(stride), row = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? row[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
            let pred = 0;
            if (filter === 1) pred = a; else if (filter === 2) pred = b; else if (filter === 3) pred = (a + b) >> 1;
            else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
            row[i] = src[i] + pred;
        }
        for (let x = 0; x < width; x++) {
            const d = (y * width + x) * 4, r = x * channels;
            data[d] = row[r]; data[d + 1] = row[r + 1]; data[d + 2] = row[r + 2]; data[d + 3] = channels === 4 ? row[r + 3] : 255;
        }
        prev.set(row);
    }
    return {width, height, data};
}

/** Decodes a PNG or lossless WebP image by looking at its first bytes. */
export function decodeImage(bytes: Uint8Array): Promise<Pixels> | Pixels {
    return bytes[0] === 0x52 && bytes[1] === 0x49 ? decodeWebPLossless(bytes) : decodePNG(bytes);
}
