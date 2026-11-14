/**
 * Marker layers and SVG templates.
 *
 * A marker layer is shorthand: a GeoJSON source with one point for each marker, and a symbol layer that draws an image
 * at each point (see src/marker-layers.ts). An image can be an SVG template: a plain SVG string with `{{name}}` slots,
 * which each feature fills (see `templateSlots`).
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
