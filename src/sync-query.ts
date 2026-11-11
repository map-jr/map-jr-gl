// Features of GeoJSON sources at a place, found on the page without a worker. `queryRenderedFeatures` uses this to
// give a result at once for the sources whose data the page has. The page loads this file only when the style has
// such a source, because it needs the expression compiler (for the filters of layers).
import type {Transform} from './geo.ts';
import {prepareSource, sliceGeoJSON, type GeoJSONOptions, type PreparedSource} from './geojson.ts';
import {queryTile, tilesUnderBox, type QueriedFeature, type QuerySet} from './query.ts';

const prepared = new WeakMap<object, PreparedSource>();

/** The features of one GeoJSON source that the given style layers draw in a rectangle of the screen. */
export function queryGeoJSON(source: string, spec: GeoJSONOptions & {data: object; maxzoom?: number}, tr: Transform, box: number[], sets: QuerySet[]): QueriedFeature[] {
    let data = prepared.get(spec.data);
    if (!data) prepared.set(spec.data, data = prepareSource(spec.data, spec, spec.maxzoom ?? 18));
    const out: QueriedFeature[] = [], seen = new Set<string>();
    for (const t of tilesUnderBox(tr, box, 0, spec.maxzoom ?? 18)) {
        for (const f of queryTile(sliceGeoJSON(data, t.z, t.x, t.y), {source, z: t.z, x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: true, sets: sets.map(s => ({...s, radius: s.radius * t.scale}))})) {
            const key = f.id === undefined ? '' : `${f.layer}|${f.id}`;
            if (key && seen.has(key)) continue;
            seen.add(key);
            out.push(f);
        }
    }
    return out;
}
