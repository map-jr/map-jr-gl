/**
 * SVG templates, and the `data`, `sources` and `layers` of the description in a style.
 *
 * An image can be an SVG template: a plain SVG string with `{{name}}` slots, which each feature fills (see `templateSlots`).
 */
export type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
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

/**
 * The name of the variant for a name that an `image` expression gives (the template, then `slot=value` parts from
 * `params`): the value of each slot in the order of `slots`, from `params` or else from the property of the feature
 * with the name of the slot. A name that is not of a template loses its `params`.
 */
export const variantName = (name: string, templates: Record<string, string[]> | undefined, properties: Record<string, unknown> = {}) => {
    const [image, ...given] = name.split(VARIANT), slots = templates && Object.hasOwn(templates, image) ? templates[image] : undefined;
    return slots ? [image, ...slots.map(s => given.find(g => g.startsWith(s + '='))?.slice(s.length + 1) ?? String(properties[s] ?? '').replaceAll(VARIANT, ''))].join(VARIANT) : image;
};

export function parseSVG(svg: string): {viewBox: string | null; inner: string} {
    const m = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg);
    if (!m) throw new Error('Marker template must be a single <svg> element');
    return {viewBox: /viewBox\s*=\s*["']([^"']+)["']/.exec(m[1])?.[1] ?? null, inner: m[2]};
}

/**
 * The display size of an SVG document in CSS pixels: the size of its `viewBox`, or else its `width` and `height`
 * attributes, each 24 when it is missing, is not a positive number of pixels (no unit or `px`), or is a percentage.
 */
export function svgSize(svg: string): [number, number] {
    const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '', box = /\sviewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(root);
    const length = (k: string) => +(new RegExp(`\\s${k}\\s*=\\s*["']?\\s*([\\d.]+)(?:px)?\\s*(?=["'\\s/>])`).exec(root)?.[1] ?? 0) || 24;
    return box ? [+box[1], +box[2]] : [length('width'), length('height')];
}

/** Rewrites the root element with explicit pixel dimensions, which every browser needs to rasterise an SVG image reliably. */
export function sizedSVG(svg: string, w: number, h: number): string {
    const {viewBox, inner} = parseSVG(svg);
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${viewBox ?? '0 0 ' + svgSize(svg).join(' ')}">${inner}</svg>`;
}

/**
 * A style with a GeoJSON source for each key of `data` that is not the id of a source of the style (#487). The source has
 * the default options, and no features unless `full` (for a renderer that gets the data with the style). `other` gets
 * each key that is the id of a source of another type.
 */
export function withData(style: any, data: Record<string, unknown> | undefined, full?: boolean, other?: (id: string, type: string) => void) {
    if (!data) return style;
    let sources = style.sources ?? {};
    for (const id in data) {
        const s = sources[id];
        if (!s) sources = {...sources, [id]: {type: 'geojson', data: full ? data[id] : {type: 'FeatureCollection', features: []}}};
        else if (s.type !== 'geojson') other?.(id, s.type);
        else if (full) sources = {...sources, [id]: {...s, data: data[id]}};
    }
    return sources === style.sources ? style : {...style, sources};
}

/** The error of a key of `data` that is the id of a source of another type. */
/** A pair of styles `{light, dark}` in `style`: an object with `light` or `dark` and no `layers` (a style has `layers`). */
export const isStylePair = (s: unknown): s is {light?: unknown; dark?: unknown} => !!s && typeof s === 'object' && !('layers' in s) && ('light' in s || 'dark' in s);
/** The style for the colour scheme: of a pair the value of the scheme (or the other one when it is missing), else `style` itself. */
export const styleFor = (s: unknown, dark: boolean): unknown => isStylePair(s) ? (dark ? s.dark ?? s.light : s.light ?? s.dark) : s;
export const dataTypeError = (id: string, type: string) => new Error(`[map-jr-gl] data: the source "${id}" has the type "${type}", and only a GeoJSON source takes data. Use another key in "data", or another id for the source.`);

/** A style with the `sources`, `layers` and `terrain` of the description. A `terrain` of `null` keeps that of the style. */
export function extended(style: any, extend?: {sources?: Record<string, object>; layers?: ({id: string; before?: string} & Record<string, unknown>)[]; terrain?: object | null}) {
    if (!extend) return style;
    const layers = [...style.layers];
    for (const {before, ...layer} of extend.layers ?? []) {
        const at = before ? layers.findIndex(l => l.id === before) : -1;
        layers.splice(at < 0 ? layers.length : at, 0, layer);
    }
    return {...style, sources: {...style.sources, ...extend.sources}, layers, ...(extend.terrain == null ? {} : {terrain: extend.terrain})};
}
