// A minimal TrueType font for tests: each printable ASCII character is a filled square of 1 em, so text drawn with it
// looks clearly different from text drawn with any font of the device.
export function squareFont(familyName = 'Test Square') {
    const u16 = n => [(n >> 8) & 255, n & 255], i16 = n => u16(n & 0xffff), u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const glyf = [
        // glyph 1: one contour of four points on the curve, a square from (0, -100) to (1000, 900)
        ...i16(1), ...i16(0), ...i16(-100), ...i16(1000), ...i16(900), ...u16(3), ...u16(0), 1, 1, 1, 1,
        ...i16(0), ...i16(1000), ...i16(0), ...i16(-1000), ...i16(-100), ...i16(0), ...i16(1000), ...i16(0),
    ];
    while (glyf.length % 4) glyf.push(0);
    const loca = [...u16(0), ...u16(0), ...u16(glyf.length / 2)];
    // cmap format 4: 0x20–0x7E to glyph 1 (through the glyph id array), and the final segment.
    const sub = [...u16(4), ...u16(32 + 2 * 95), ...u16(0), ...u16(4), ...u16(4), ...u16(1), ...u16(0),
        ...u16(0x7e), ...u16(0xffff), ...u16(0), ...u16(0x20), ...u16(0xffff), ...i16(0), ...i16(1), ...u16(4), ...u16(0), ...Array(95).fill(u16(1)).flat()];
    const cmap = [...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12), ...sub];
    const head = [...u32(0x10000), ...u32(0x10000), ...u32(0), ...u32(0x5f0f3cf5), ...u16(0x000b), ...u16(1000),
        ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...i16(0), ...i16(-100), ...i16(1000), ...i16(900), ...u16(0), ...u16(8), ...i16(2), ...i16(0), ...i16(0)];
    const hhea = [...u32(0x10000), ...i16(900), ...i16(-100), ...i16(0), ...u16(1000), ...i16(0), ...i16(0), ...i16(1000),
        ...i16(1), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...u16(2)];
    const hmtx = [...u16(500), ...i16(0), ...u16(1100), ...i16(0)];
    const maxp = [...u32(0x10000), ...u16(2), ...u16(4), ...u16(1), ...u16(0), ...u16(0), ...u16(1), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0)];
    const os2 = [...u16(1), ...i16(1000), ...u16(400), ...u16(5), ...u16(0), ...Array(20).fill(0), ...i16(0), ...Array(10).fill(0),
        ...Array(16).fill(0), ...Array(4).fill(0), ...u16(0x40), ...u16(0x20), ...u16(0x7e), ...i16(900), ...i16(-100), ...i16(0), ...u16(900), ...u16(100), ...u32(1), ...u32(0)];
    const names = [[1, familyName], [2, 'Regular'], [4, familyName + ' Regular'], [6, familyName.replace(/\s/g, '') + '-Regular']];
    const strings = names.map(([, s]) => [...s].flatMap(c => u16(c.charCodeAt(0))));
    let offset = 0;
    const records = names.flatMap(([id], i) => { const r = [...u16(3), ...u16(1), ...u16(0x409), ...u16(id), ...u16(strings[i].length), ...u16(offset)]; offset += strings[i].length; return r; });
    const name = [...u16(0), ...u16(names.length), ...u16(6 + 12 * names.length), ...records, ...strings.flat()];
    const post = [...u32(0x30000), ...u32(0), ...i16(0), ...i16(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)];
    const tables = Object.entries({'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca, maxp, name, post});
    const out = [...u32(0x10000), ...u16(tables.length), ...u16(128), ...u16(3), ...u16(tables.length * 16 - 128)];
    let at = 12 + 16 * tables.length;
    const body = [];
    for (const [tag, data] of tables) {
        const padded = [...data]; while (padded.length % 4) padded.push(0);
        let sum = 0; for (let i = 0; i < padded.length; i += 4) sum = (sum + ((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3])) >>> 0;
        out.push(...[...tag].map(c => c.charCodeAt(0)), ...u32(sum), ...u32(at), ...u32(data.length));
        body.push(...padded); at += padded.length;
    }
    return Buffer.from([...out, ...body]);
}
