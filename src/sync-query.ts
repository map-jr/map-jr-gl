// Features of GeoJSON sources at a place, found on the page without a worker. `queryRenderedFeatures` uses this to
// give a result at once for the sources whose data the page has. The page loads this file only when the style has
// such a source, because it needs the expression compiler (for the filters of layers).
import type {Transform} from './geo.ts';
import {prepareSource, sliceGeoJSON, type GeoJSONOptions, type PreparedSource} from './geojson.ts';
import {mercX, mercY} from './geo.ts';
import {circleCenters, circleRadius, circleTouches, featureKey, pitchedCircles, queryTile, setBox, setReach, tilesUnderBox, type QueriedFeature, type QuerySet} from './query.ts';

const prepared = new WeakMap<object, PreparedSource>();

/** The features of one GeoJSON source that the given style layers draw in a rectangle of the screen. */
export function queryGeoJSON(source: string, spec: GeoJSONOptions & {data: object; maxzoom?: number}, tr: Transform, box: number[], sets: QuerySet[], /** The feature state of the source, by "sourceLayer|id". */ states?: Record<string, Record<string, unknown>>): QueriedFeature[] {
    let data = prepared.get(spec.data);
    if (!data) prepared.set(spec.data, data = prepareSource(spec.data, spec, spec.maxzoom ?? 18));
    const out: QueriedFeature[] = [], seen = new Set<string>(), pitched = pitchedCircles(tr, box, sets);
    // (A set with a translation is asked with its own rectangle; see `setBox`.)
    // (The tiles are chosen under the rectangle grown by the reach of the set; see `setReach`.)
    const groups = new Map<string, {box: number[]; pad: number; sets: QuerySet[]}>();
    for (const s of sets) {
        const tilted = pitched?.circles.has(s), b = tilted ? pitched!.box : setBox(pitched?.box ?? box, s), pad = tilted ? 0 : setReach(s), key = b.join() + ',' + pad;
        groups.set(key, {box: b, pad, sets: [...groups.get(key)?.sets ?? [], s]});
    }
    for (const g of groups.values()) for (const t of tilesUnderBox(tr, g.box, 0, spec.maxzoom ?? 18, g.pad)) {
        for (const f of queryTile(sliceGeoJSON(data, t.z, t.x, t.y), {source, z: t.z, x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: true, sets: g.sets.map(s => pitched?.circles.has(s) ? {...s, radius: 0, size: s.size && {...s.size, scale: t.scale * pitched.k}} : {...s, radius: s.radius * t.scale, size: s.size && s.radius ? {...s.size, scale: t.scale} : undefined})}, states)) {
            const set = pitched && sets.find(s => s.layer === f.layer && pitched.circles.has(s));
            if (set && !circleCenters(f.geometry!).some(([lng, lat]) => circleTouches(tr, mercX(lng), mercY(lat), setBox(box, set), circleRadius(set, f, states), set.pitch!))) continue;
            const key = featureKey(f);
            if (key && seen.has(key)) continue;
            seen.add(key);
            out.push(f);
        }
    }
    return out;
}
