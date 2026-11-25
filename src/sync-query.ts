// Features of GeoJSON sources at a place, found on the page without a worker. `queryRenderedFeatures` uses this to
// give a result at once for the sources whose data the page has. The page loads this file only when the style has
// such a source, because it needs the expression compiler (for the filters of layers).
import type {Transform} from './geo.ts';
import {prepareSource, sliceGeoJSON, type GeoJSONOptions, type PreparedSource} from './geojson.ts';
import {mercX, mercY} from './geo.ts';
import {circleCenters, circleTouches, featureKey, pitchedCircles, queryTile, setBox, tilesUnderBox, type QueriedFeature, type QuerySet} from './query.ts';

const prepared = new WeakMap<object, PreparedSource>();

/** The features of one GeoJSON source that the given style layers draw in a rectangle of the screen. */
export function queryGeoJSON(source: string, spec: GeoJSONOptions & {data: object; maxzoom?: number}, tr: Transform, box: number[], sets: QuerySet[]): QueriedFeature[] {
    let data = prepared.get(spec.data);
    if (!data) prepared.set(spec.data, data = prepareSource(spec.data, spec, spec.maxzoom ?? 18));
    const out: QueriedFeature[] = [], seen = new Set<string>(), pitched = pitchedCircles(tr, box, sets);
    // (A set with a translation is asked with its own rectangle; see `setBox`.)
    const groups = new Map<string, {box: number[]; sets: QuerySet[]}>();
    for (const s of sets) {
        const b = pitched?.circles.has(s) ? pitched.box : setBox(pitched?.box ?? box, s), key = b.join();
        groups.set(key, {box: b, sets: [...groups.get(key)?.sets ?? [], s]});
    }
    for (const g of groups.values()) for (const t of tilesUnderBox(tr, g.box, 0, spec.maxzoom ?? 18)) {
        for (const f of queryTile(sliceGeoJSON(data, t.z, t.x, t.y), {source, z: t.z, x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: true, sets: g.sets.map(s => pitched?.circles.has(s) ? {...s, radius: 0, circle: undefined} : {...s, radius: s.radius * t.scale, circle: s.circle && s.radius ? {...s.circle, scale: t.scale} : undefined})})) {
            const set = pitched && sets.find(s => s.layer === f.layer && pitched.circles.has(s));
            if (set && !circleCenters(f.geometry!).some(([lng, lat]) => circleTouches(tr, mercX(lng), mercY(lat), setBox(box, set), set.radius, set.pitch!))) continue;
            const key = featureKey(f);
            if (key && seen.has(key)) continue;
            seen.add(key);
            out.push(f);
        }
    }
    return out;
}
