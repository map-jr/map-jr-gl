/** The options of `createTileMesh`, as in MapLibre GL JS 6.17. */
export type CreateTileMeshOptions = {
    /** How many quads each axis has (default 1). */
    granularity?: number;
    /** Adds a ring of quads 64 units outside the tile. */
    generateBorders?: boolean;
    /** Connects the north edge to the vertex of the north pole (y -32768), in place of the border there. */
    extendToNorthPole?: boolean;
    /** Connects the south edge to the vertex of the south pole (y 32767), in place of the border there. */
    extendToSouthPole?: boolean;
};
/** The vertices (pairs of `Int16`) and the indices (`Uint16` or `Uint32`, three for each triangle) of a mesh. */
export type TileMesh = {vertices: ArrayBuffer; indices: ArrayBuffer; uses32bitIndices: boolean};
/** `'16bit'` or `'32bit'` forces the size of the indices; `undefined` takes 16 bits when the mesh fits. */
export type IndicesType = '32bit' | '16bit' | undefined;
/**
 * The mesh of a quad that covers a tile (0 to 8192 on each axis), as `createTileMesh` of MapLibre GL JS 6.17 makes it,
 * with the same vertices and indices in the same order. Custom layers on the globe use it.
 * It throws when `forceIndicesSize` is `'16bit'` and the mesh has more than 65,536 vertices.
 */
export function createTileMesh(options: CreateTileMeshOptions, forceIndicesSize?: IndicesType): TileMesh {
    const {generateBorders: b, extendToNorthPole: n, extendToSouthPole: s} = options;
    const g = Math.max(options.granularity ?? 1, 1);
    const x0 = b ? -1 : 0, y0 = b || n ? -1 : 0, x1 = g + (b ? 1 : 0), y1 = g + (b || s ? 1 : 0);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, big = w * h > 65536;
    if (big && forceIndicesSize === '16bit') throw new Error('[map-jr-gl] E1465 createTileMesh(): the granularity is too large for 16-bit indices. Pass a smaller granularity, or "32bit".');
    const wide = big || forceIndicesSize === '32bit';
    const vertices = new Int16Array(w * h * 2), indices = new (wide ? Uint32Array : Uint16Array)((w - 1) * (h - 1) * 6);
    let i = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        vertices[i++] = x < 0 ? -64 : x > g ? 8256 : x / g * 8192;
        vertices[i++] = y < 0 ? (n ? -32768 : -64) : y > g ? (s ? 32767 : 8256) : y / g * 8192;
    }
    i = 0;
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
        const v = x + y * w;
        indices.set([v, v + w, v + 1, v + 1, v + w, v + w + 1], i);
        i += 6;
    }
    return {vertices: vertices.buffer, indices: indices.buffer, uses32bitIndices: wide};
}
