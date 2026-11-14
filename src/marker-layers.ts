/**
 * The source and the layer of a marker layer (see src/markers.ts), and the other additions of the main API to a style.
 * The main API and the server renderer use these functions. They are not in src/markers.ts, because the map imports
 * that file, and the page script of the compat entry does not need them.
 */
import type {MarkerInput, MarkerLayerOptions} from './markers.ts';

/** The source and the layer that a marker layer stands for. The source has no data: see `markerFeatures`. */
export function markerStyle(m: MarkerLayerOptions) {
    return {
        source: {type: 'geojson', data: {type: 'FeatureCollection', features: []}},
        layer: {
            id: m.id, type: 'symbol', source: m.id, before: m.before, ...(m.minZoom === undefined ? {} : {minzoom: m.minZoom}), ...(m.maxZoom === undefined ? {} : {maxzoom: m.maxZoom}),
            // (An icon that can be hidden must be known to the labels and to the other icons: it then also keeps labels away.)
            layout: {'icon-image': m.image, 'icon-anchor': m.anchor ?? 'center', 'icon-allow-overlap': m.overlap !== 'hide', 'icon-ignore-placement': !m.collide && m.overlap !== 'hide'},
        },
    };
}
/**
 * A style with the source and the layer of each marker layer. A layer goes below the layer with the id `before`, or
 * on top. `data`: the sources have the data of the markers (for a renderer that gets the data with the style).
 */
export function withMarkers(style: any, markers: MarkerLayerOptions[] | undefined, data?: boolean) {
    if (!markers?.length) return style;
    const layers = [...style.layers], sources = {...style.sources};
    for (const m of markers) {
        const {source, layer: {before, ...layer}} = markerStyle(m), at = before ? layers.findIndex(l => l.id === before) : -1;
        sources[m.id] = data ? {...source, data: markerFeatures(m.data)} : source;
        layers.splice(at < 0 ? layers.length : at, 0, layer);
    }
    return {...style, sources, layers};
}
/** The data of the source of a marker layer: a point for each marker. The id of a feature is the index of its marker in `data`. */
export function markerFeatures(data: MarkerInput[]) {
    // (A marker with no position is left out, and the other markers keep their index.)
    return {type: 'FeatureCollection', features: data.map((m, id) => ({type: 'Feature', id, properties: m?.props ?? {}, geometry: {type: 'Point', coordinates: [+m?.lngLat?.[0], +m?.lngLat?.[1]]}}))
        .filter(f => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1]))};
}

/** A style with the additions of `extend`. */
export function extended(style: any, extend?: {sources?: Record<string, object>; layers?: ({id: string; before?: string} & Record<string, unknown>)[]; terrain?: object | null}) {
    if (!extend) return style;
    const layers = [...style.layers];
    for (const {before, ...layer} of extend.layers ?? []) {
        const at = before ? layers.findIndex(l => l.id === before) : -1;
        layers.splice(at < 0 ? layers.length : at, 0, layer);
    }
    return {...style, sources: {...style.sources, ...extend.sources}, layers, ...(extend.terrain === undefined ? {} : {terrain: extend.terrain ?? undefined})};
}
