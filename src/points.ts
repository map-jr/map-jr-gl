/**
 * `points`: a GeoJSON `FeatureCollection` of points from records of the application. It needs no part of the map, so
 * a server can call it, and a bundler leaves this file out of a page that does not import it.
 */
declare const __DEV__: boolean;

export interface PointsOptions<R> {
    /** The position of a record: `[lng, lat]`. Required. */
    lngLat: (record: R, index: number) => readonly number[] | null | undefined;
    /** The id of the feature of a record. Without it, the features have no id. */
    id?: (record: R, index: number) => string | number | undefined;
    /** The properties of the feature of a record. Without it, the properties are the record itself. */
    properties?: (record: R, index: number) => Record<string, unknown>;
}
export interface PointFeature<P = Record<string, unknown>> { type: 'Feature'; id?: string | number; properties: P; geometry: {type: 'Point'; coordinates: [number, number]} }
export interface PointCollection<P = Record<string, unknown>> { type: 'FeatureCollection'; features: PointFeature<P>[] }

/**
 * A `FeatureCollection` with a point for each record. A record whose position is not two finite numbers is left out,
 * and the development build warns once with the index of the first such record.
 */
export function points<R>(records: readonly R[], options: PointsOptions<R>): PointCollection {
    const features: PointFeature[] = [];
    let bad = -1;
    records.forEach((r, i) => {
        const p = options.lngLat(r, i), x = p?.[0], y = p?.[1];
        if (typeof x != 'number' || typeof y != 'number' || !isFinite(x) || !isFinite(y)) { if (bad < 0) bad = i; return; }
        const id = options.id?.(r, i), f: PointFeature = {type: 'Feature', properties: options.properties ? options.properties(r, i) : r as Record<string, unknown>, geometry: {type: 'Point', coordinates: [x, y]}};
        if (id !== undefined) f.id = id;
        features.push(f);
    });
    if (__DEV__ && bad >= 0) import('./mistakes.ts').then(m => m.warnOnce(21, String(bad)), () => {});
    return {type: 'FeatureCollection', features};
}
