// The elevation of a `raster-dem` source. 3D terrain, the contour lines, the hillshade and `queryTerrainElevation` use
// it, so it is in the files that load up front. (The queries of features, src/query.ts, load on demand.)

/**
 * The encoding of the elevation of a `raster-dem` source: `'terrarium'`, `'mapbox'`, or for `encoding: 'custom'` the
 * factors of red, green and blue and the shift (`redFactor`, `greenFactor`, `blueFactor`, `baseShift`).
 */
export type DemEncoding = string | number[];

/** The factors of red, green and blue (0 to 255) and the shift that give the elevation in meters, for the shaders. */
export const demUnpack = (encoding: DemEncoding) => typeof encoding != 'string' ? encoding : encoding === 'terrarium' ? [256, 1, 1 / 256, 32768] : [6553.6, 25.6, 0.1, 10000];

/** Decodes one elevation sample from RGBA pixels. */
export function decodeElevation(d: ArrayLike<number>, i: number, encoding: DemEncoding) {
    return typeof encoding != 'string' ? d[i] * encoding[0] + d[i + 1] * encoding[1] + d[i + 2] * encoding[2] - encoding[3] : encoding === 'terrarium' ? d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768 : -10000 + (d[i] * 65536 + d[i + 1] * 256 + d[i + 2]) * 0.1;
}

/** Bilinear elevation lookup at fractional tile position (u, v in 0..1) in decoded elevation-tile pixels. */
export function sampleElevation(pixels: ArrayLike<number>, width: number, height: number, u: number, v: number, encoding: DemEncoding): number {
    const fx = Math.max(0, Math.min(width - 1, u * width - 0.5)), fy = Math.max(0, Math.min(height - 1, v * height - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const e = (x: number, y: number) => decodeElevation(pixels, (y * width + x) * 4, encoding);
    return (e(x0, y0) * (1 - tx) + e(x1, y0) * tx) * (1 - ty) + (e(x0, y1) * (1 - tx) + e(x1, y1) * tx) * ty;
}
