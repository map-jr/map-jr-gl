/** Marker templates: plain SVG strings with `{{name}}` slots, shared by the canvas renderer and server output. */
export type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right';
export interface MarkerInput { /** The position: `[lng, lat]`. */ lngLat: readonly number[]; props?: Record<string, unknown> }
export interface MarkerLayerOptions {
    id: string;
    /** A complete `<svg>` document. `{{name}}` is replaced with the marker's (XML-escaped) property. */
    svg: string;
    width: number;
    height: number;
    anchor?: Anchor;
    /** When true, map labels avoid these markers. */
    collide?: boolean;
    /**
     * The zoom range in which the layer shows. Give the same data to two layers with different templates and ranges
     * to change a marker's look with zoom, e.g. small dots when zoomed out and full pins when zoomed in.
     */
    minZoom?: number;
    maxZoom?: number;
    /**
     * 'hide' drops markers that would overlap one already shown (earlier in `data` wins), re-deciding as the map
     * moves, the way labels do. The default, 'show', draws every marker.
     */
    overlap?: 'show' | 'hide';
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

/** Offset of the image's top-left corner from the anchored map position. */
export function anchorOffset(anchor: Anchor | undefined, w: number, h: number): [number, number] {
    return [anchor === 'left' ? 0 : anchor === 'right' ? -w : -w / 2, anchor === 'top' ? 0 : anchor === 'bottom' ? -h : -h / 2];
}

/** Groups markers by their resolved SVG so each distinct appearance is rasterised (or emitted) once. */
export function resolveVariants(o: MarkerLayerOptions): {svgs: string[]; variant: Uint32Array} {
    const index = new Map<string, number>(), svgs: string[] = [], variant = new Uint32Array(o.data.length);
    o.data.forEach((m, i) => {
        const svg = fillTemplate(o.svg, m.props);
        let v = index.get(svg);
        if (v === undefined) { v = svgs.length; svgs.push(svg); index.set(svg, v); }
        variant[i] = v;
    });
    return {svgs, variant};
}
