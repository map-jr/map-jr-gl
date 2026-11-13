/**
 * Marker layers and SVG templates.
 *
 * A marker layer is shorthand: a GeoJSON source with one point for each marker, and a symbol layer that draws an image
 * at each point. `markerStyle` gives the source and the layer, and `markerFeatures` the data of the source. An image
 * can be an SVG template: a plain SVG string with `{{name}}` slots, which each feature fills (see `templateSlots`).
 */
export type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface MarkerInput { /** The position: `[lng, lat]`. */ lngLat: readonly number[]; /** The properties of the marker. A slot of a template image reads the property with its name. */ props?: Record<string, unknown> }
export interface MarkerLayerOptions {
    /** The id of the layer and of its source. Use it in `interactiveLayers` and in `before` of other layers. */
    id: string;
    /** The name of an image of the map: of `images` in the description, or of the sprite of the style. */
    image: string;
    /** The part of the image that is on the position. The default is `'center'`. */
    anchor?: Anchor;
    /** When true, map labels keep away from these markers. */
    collide?: boolean;
    /** The zoom range in which the layer shows. */
    minZoom?: number;
    maxZoom?: number;
    /**
     * 'hide': a marker that would cover another marker or a label does not show, and labels keep away from the
     * markers. The default, 'show', draws every marker.
     */
    overlap?: 'show' | 'hide';
    /** The id of a style layer: the markers are drawn below it. Without it, they are drawn above each layer of the style. */
    before?: string;
    data: MarkerInput[];
}

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
    return {type: 'FeatureCollection', features: data.map((m, id) => ({type: 'Feature', id, properties: m.props ?? {}, geometry: {type: 'Point', coordinates: [m.lngLat[0], m.lngLat[1]]}}))};
}

export const escapeXML = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export function fillTemplate(svg: string, props: Record<string, unknown> | undefined): string {
    return svg.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, k) => escapeXML(props?.[k]));
}

/** The names of the slots of a template, each one time, in the order of the template. */
export const templateSlots = (svg: string) => [...new Set([...svg.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)].map(m => m[1]))];

/**
 * Between the parts of the name of a variant of a template image. The tile worker makes the name: the name of the
 * template, then the value of each slot in the order of `templateSlots`. The page splits it to draw the variant.
 */
export const VARIANT = '\u001f';

export function parseSVG(svg: string): {viewBox: string | null; inner: string} {
    const m = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg);
    if (!m) throw new Error('Marker template must be a single <svg> element');
    return {viewBox: /viewBox\s*=\s*["']([^"']+)["']/.exec(m[1])?.[1] ?? null, inner: m[2]};
}

/** Rewrites the root element with explicit pixel dimensions, which every browser needs to rasterise an SVG image reliably. */
export function sizedSVG(svg: string, w: number, h: number): string {
    const {viewBox, inner} = parseSVG(svg);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${viewBox ?? `0 0 ${w} ${h}`}">${inner}</svg>`;
}

