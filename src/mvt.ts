/** Minimal protobuf reader and Mapbox Vector Tile decoder. */
export class Pbf {
    pos = 0;
    constructor(public buf: Uint8Array, public end = buf.length) {}

    varint(): number {
        const b = this.buf;
        let v = 0, mul = 1, byte;
        do {
            byte = b[this.pos++];
            v += (byte & 0x7f) * mul;
            mul *= 128;
        } while (byte & 0x80);
        return v;
    }
    svarint(): number {
        const n = this.varint();
        return n % 2 === 1 ? -(n + 1) / 2 : n / 2;
    }
    skip(wire: number) {
        if (wire === 0) this.varint();
        else if (wire === 1) this.pos += 8;
        else if (wire === 2) this.pos = this.varint() + this.pos; // (the length is read first: it moves `pos`)
        else if (wire === 5) this.pos += 4;
        else throw new Error('Unsupported protobuf wire type ' + wire);
    }
    /** Returns a reader scoped to a length-delimited field and advances past it. */
    sub(): Pbf {
        const len = this.varint();
        const p = new Pbf(this.buf, Math.min(this.end, this.pos + len)); // (a length from the file is not trusted past its parent)
        p.pos = this.pos;
        this.pos += len;
        return p;
    }
}

const utf8 = new TextDecoder();

export class VTFeature {
    id: number | undefined;
    /** 1 point, 2 line, 3 polygon */
    type = 0;
    private tagPos = -1;
    private tagEnd = 0;
    private geomPos = -1;
    private geomEnd = 0;
    private props: Record<string, any> | undefined;

    constructor(p: Pbf, private layer: VTLayer) {
        while (p.pos < p.end) {
            const tag = p.varint(), field = tag >> 3;
            if (field === 1) this.id = p.varint();
            else if (field === 3) this.type = p.varint();
            else if (field === 2 || field === 4) {
                const len = p.varint();
                if (field === 2) { this.tagPos = p.pos; this.tagEnd = p.pos + len; } else { this.geomPos = p.pos; this.geomEnd = p.pos + len; }
                p.pos += len;
            } else p.skip(tag & 7);
        }
    }

    get properties(): Record<string, any> {
        if (!this.props) {
            this.props = {};
            if (this.tagPos >= 0) {
                const p = new Pbf(this.layer.buf, this.tagEnd);
                p.pos = this.tagPos;
                while (p.pos < p.end) {
                    const k = this.layer.keys[p.varint()];
                    this.props[k] = this.layer.values[p.varint()];
                }
            }
        }
        return this.props;
    }

    /** Appends rings to `coords` (scaled to `extent`) and their cumulative end offsets (in points) to `ringEnds`. */
    geometry(extent: number, coords: number[], ringEnds: number[]): number {
        if (this.geomPos < 0) return 0;
        const p = new Pbf(this.layer.buf, this.geomEnd);
        p.pos = this.geomPos;
        const scale = extent / this.layer.extent;
        const clampI16 = (v: number) => v < -32768 ? -32768 : v > 32767 ? 32767 : v;
        let cmd = 1, len = 0, x = 0, y = 0, rings = 0, open = false;
        const close = () => {
            if (open) { ringEnds.push(coords.length / 2); rings++; open = false; }
        };
        while (p.pos < p.end) {
            if (len <= 0) {
                const c = p.varint();
                cmd = c & 7;
                len = c >> 3;
            }
            len--;
            if (cmd === 1 || cmd === 2) {
                x += p.svarint();
                y += p.svarint();
                if (cmd === 1 && this.type !== 1) close();
                coords.push(clampI16(Math.round(x * scale)), clampI16(Math.round(y * scale)));
                open = true;
                if (this.type === 1) close();
            } else if (cmd === 7) {
                close();
            } else throw new Error('Unknown vector tile command ' + cmd);
        }
        close();
        return rings;
    }
}

export class VTLayer {
    name = '';
    extent = 4096;
    keys: string[] = [];
    values: any[] = [];
    features: VTFeature[] = [];
    buf: Uint8Array;

    constructor(p: Pbf) {
        this.buf = p.buf;
        const feats: Pbf[] = [];
        while (p.pos < p.end) {
            const tag = p.varint(), field = tag >> 3;
            if (field === 1) { const s = p.sub(); this.name = utf8.decode(s.buf.subarray(s.pos, s.end)); } else if (field === 2) feats.push(p.sub());
            else if (field === 3) { const s = p.sub(); this.keys.push(utf8.decode(s.buf.subarray(s.pos, s.end))); } else if (field === 4) this.values.push(readValue(p.sub()));
            else if (field === 5) this.extent = p.varint();
            else p.skip(tag & 7);
        }
        for (const f of feats) this.features.push(new VTFeature(f, this));
    }
}

function readValue(p: Pbf): any {
    let v: any = null;
    const dv = new DataView(p.buf.buffer, p.buf.byteOffset);
    while (p.pos < p.end) {
        const tag = p.varint(), field = tag >> 3;
        if (field === 1) { const s = p.sub(); v = utf8.decode(s.buf.subarray(s.pos, s.end)); } else if (field === 2) { v = dv.getFloat32(p.pos, true); p.pos += 4; } else if (field === 3) { v = dv.getFloat64(p.pos, true); p.pos += 8; } else if (field === 4 || field === 5) v = p.varint();
        else if (field === 6) v = p.svarint();
        else if (field === 7) v = !!p.varint();
        else p.skip(tag & 7);
    }
    return v;
}

export function decodeVectorTile(bytes: Uint8Array): Record<string, VTLayer> {
    const p = new Pbf(bytes);
    const layers: Record<string, VTLayer> = {};
    while (p.pos < p.end) {
        const tag = p.varint();
        // (Some programs give a tile in a larger buffer, with zeros after its end. No field has the number 0.)
        if (!tag) break;
        if (tag >> 3 === 3) {
            const l = new VTLayer(p.sub());
            if (l.features.length) layers[l.name] = l;
        } else p.skip(tag & 7);
    }
    return layers;
}
