import {Transform, type LngLatLike} from './geo.ts';
import {SSR_KEY, applySSROverrides, type SSROverrides, compileLayer, loadSprite, resolveStyle, tileURL, type CompiledLayer, type Sprite} from './style.ts';
import {TileBuilder} from './tiles.ts';
import type {TileImage, TileIR} from './tile.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {DEFAULT_FONT, EstimateShaper} from './text.ts';
import {anchorOffset, type MarkerLayerOptions} from './markers.ts';
import {renderSVG} from './svg.ts';
import type {ImageDecoder} from './contour.ts';
import {decodeImage, decodePNG, decodeWebPLossless} from './webp.ts';
export {decodePNG, decodeWebPLossless, type ImageDecoder};

export interface RenderOptions {
    /** A style object or URL, exactly as passed to the client-side map. */
    style: unknown;
    center: LngLatLike;
    zoom: number;
    bearing?: number;
    width: number;
    height: number;
    markers?: MarkerLayerOptions[];
    fontFamily?: string;
    /** Return false to leave a style layer out of the server output, e.g. dense building footprints, to keep the markup small. */
    layerFilter?: (layerId: string) => boolean;
    /** Embed raster tiles and the icon sheet as data URIs instead of linking to them. Needed when the SVG is rasterised. */
    inlineImages?: boolean;
    /** Use the high-density (@2x) icon sheet. */
    highDensity?: boolean;
    /**
     * Supplies icons the sprite sheet lacks, as SVG: the server-side counterpart of `map.setMissingStyleImageResolver`.
     * Return undefined for names you do not handle. The SVG goes into the output as vector artwork.
     */
    resolveImage?: (name: string) => {svg: string; width: number; height: number} | undefined;
    /** Set false to ignore the style's `map-jr:ssr` layer overrides and render exactly what the client would. */
    ssrOverrides?: boolean;
    /**
     * Changes for the server render, for each id of a style layer: the same values as `map-jr:ssr` in the metadata of a
     * layer. Use this for a style that you do not write yourself (a style from a URL), to make the render smaller:
     * `{building: {hidden: true}, 'road-minor': {minzoom: 15}}`. A value here comes before the value in the style.
     */
    overrides?: Record<string, SSROverrides>;
    fetch?: typeof fetch;
    /**
     * Decodes elevation tile images for contour sources. PNG and lossless WebP are built in; pass a function for
     * anything else (lossy WebP, for instance), returning `{width, height, data}` with RGBA bytes.
     */
    decodeImage?: ImageDecoder;
}
export interface RenderResult {
    svg: string;
    /** Tile URLs this view needs: emit them as `<link rel="preload" as="fetch" crossorigin>` so the client starts warm. */
    tiles: string[];
    /** The credits of the sources of the style, as HTML. Show them with the render. */
    attribution: string[];
}


/** Renders the first frame of a map without a browser, for server-side rendering, static export or social images. */
export async function renderToSVG(o: RenderOptions): Promise<RenderResult> {
    // Wrapped, not passed by reference: Cloudflare Workers reject calls to a detached global `fetch`.
    const fetchFn: typeof fetch = o.fetch ?? ((...a) => fetch(...a));
    const style = await resolveStyle(o.style, fetchFn);
    if (o.overrides) style.layers = style.layers.map(l => o.overrides![l.id] ? {...l, metadata: {...l.metadata, [SSR_KEY]: {...(l.metadata?.[SSR_KEY] as object), ...o.overrides![l.id]}}} : l);
    if (o.ssrOverrides !== false) style.layers = applySSROverrides(style.layers);
    if (o.layerFilter) style.layers = style.layers.filter(l => o.layerFilter!(l.id));
    const layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
    const tr = new Transform();
    tr.width = o.width; tr.height = o.height;
    tr.set(o.center, o.zoom, o.bearing ?? 0);

    const builder = new TileBuilder(fetchFn);
    builder.setStyle(style.layers, style.state);
    builder.decodeImage = o.decodeImage ?? decodeImage;
    builder.setContours(Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!])));
    for (const [name, src] of Object.entries(style.sources)) if (src.type === 'geojson') builder.setGeoJSON(name, src.data, src.options, src.maxzoom);
    const items = new Map<string, RenderItem<TileIR | TileImage>[]>(), all: RenderItem<TileIR>[] = [], urls: string[] = [];
    const dataURI = async (url: string) => {
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `data:${res.headers.get('content-type') ?? 'image/png'};base64,${btoa(bin)}`;
    };
    let req = 0, sprite: Sprite | null = null;
    const jobs = Object.entries(style.sources).map(async ([name, src]) => {
        if (!layers.some(l => l.source === name && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)) return;
        if (src.type === 'raster-dem') return; // hillshading is drawn by the client only
        const ideal = tr.coveringTiles(src.minzoom, src.maxzoom, src.tileSize, src.type === 'raster'), loaded = new Map<string, TileIR | TileImage>();
        await Promise.all(ideal.filter((id, i) => ideal.findIndex(o => o.key === id.key) === i).map(async id => {
            const url = tileURL(src, id.z, id.x, id.y);
            if (src.type === 'raster') { loaded.set(id.key, {href: o.inlineImages ? await dataURI(url) : url}); return; }
            if (src.type === 'vector') urls.push(url);
            loaded.set(id.key, await builder.loadIR({id: req++, source: name, url, z: id.z, overscaled: id.z >= src.maxzoom && Math.floor(tr.zoom)}));
        }));
        const list = renderItems(tr, ideal, k => loaded.get(k));
        items.set(name, list);
        if (src.type !== 'raster') all.push(...list as RenderItem<TileIR>[]);
    });
    if (style.sprite && layers.some(l => l.type === 'symbol')) {
        jobs.push((async () => {
            sprite = await loadSprite(style.sprite!, !!o.highDensity, fetchFn);
            if (o.inlineImages) sprite.image = await dataURI(sprite.image);
        })());
    }
    await Promise.all(jobs);

    const grid = new CollisionGrid(), images = new Map<string, {svg: string; width: number; height: number}>();
    for (const m of o.markers ?? []) {
        if (!m.collide) continue;
        const [ox, oy] = anchorOffset(m.anchor, m.width, m.height);
        for (const d of m.data) {
            const [x, y] = tr.project(d.lngLat[0], d.lngLat[1]);
            grid.insert(x + ox, y + oy, x + ox + m.width, y + oy + m.height);
        }
    }
    const labels = placeLabels(tr, all, layers, new EstimateShaper(), grid, name => {
        const fromSprite = (sprite as Sprite | null)?.icons[name];
        if (fromSprite) return fromSprite;
        if (!images.has(name)) { const img = o.resolveImage?.(name); if (img) images.set(name, img); else return undefined; }
        const img = images.get(name)!;
        return {x: 0, y: 0, width: img.width, height: img.height, pixelRatio: 1, custom: true};
    });
    const svg = renderSVG({
        tr, layers, items, labels, sprite, images, markers: o.markers ?? [], fontFamily: o.fontFamily ?? DEFAULT_FONT,
        rootAttrs: 'data-map-jr-ssr="" style="position:absolute;inset:0;width:100%;height:100%"',
    });
    return {svg, tiles: urls, attribution: [...new Set(Object.values(style.sources).map(s => s.attribution).filter((a): a is string => !!a))]};
}

/**
 * The first view of a map as HTML for a page from a server: the SVG, and the credits of the sources over it. Put the
 * HTML into the element of the map. In the browser the map removes it when it has drawn its first frame. (The
 * adapters for the frameworks use this.)
 *
 * `attribution` gives the credits to show, when they must not come from the sources; `false` shows none.
 * Only text and links to http(s) addresses are kept from the HTML of the credits.
 */
/**
 * The HTML of credits, made safe: text, and links to http(s) addresses that this function writes itself. Each other
 * tag is taken out, also one that is not complete, and the text is escaped. (The credits can come from the TileJSON
 * of another party, and the page puts this HTML into the document.)
 */
export function cleanCredits(html: string): string {
    const text = (t: string) => t.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let out = '', open = 0;
    for (const [part] of html.matchAll(/<a\b[^>]*>|<\/a\s*>|<[^>]*>?|[^<]+/gi)) {
        if (part[0] !== '<') out += text(part);
        else if (/^<\/a/i.test(part)) { if (open) { open--; out += '</a>'; } }
        else if (/^<a\b/i.test(part) && part.endsWith('>')) {
            const href = /href\s*=\s*(?:"(https?:\/\/[^"]*)"|'(https?:\/\/[^']*)')/i.exec(part);
            if (href) { open++; out += `<a href="${text(href[1] ?? href[2])}">`; }
        }
    }
    return out + '</a>'.repeat(open);
}

export async function renderFirstView(o: RenderOptions & {attribution?: string | string[] | false}): Promise<string> {
    const made = await renderToSVG(o);
    const credits = o.attribution === false ? [] : [o.attribution ?? made.attribution].flat().map(cleanCredits).filter(Boolean);
    return made.svg + (credits.length ? `<div data-map-jr-ssr="" style="position:absolute;right:0;bottom:0;background:rgba(255,255,255,.75);color:#333;font:11px/1.4 sans-serif;padding:2px 6px">${credits.join(' ')}</div>` : '');
}

/**
 * The part of takumi's `Renderer` this library uses. Pass an instance from `@takumi-rs/core` (Node, Bun) or
 * `@takumi-rs/wasm` (Cloudflare Workers and other edge runtimes); nothing is imported here, so the choice is yours.
 */
export interface Rasteriser {
    render(source: string, options: Record<string, unknown>): Promise<Uint8Array>;
}
export interface ImageOptions extends RenderOptions {
    rasteriser: Rasteriser;
    /** 'jpeg' is the compact choice everywhere. Lossy 'webp' is smaller still but only the native build supports it. */
    format?: 'jpeg' | 'webp' | 'png';
    quality?: number;
    /** Output pixels per CSS pixel, for sharp results on high-density screens. */
    pixelRatio?: number;
}
export interface ImageResult { image: Uint8Array; contentType: string; tiles: string[] }

/** Renders the first frame as a raster image: a fixed, predictable payload however dense the map data is. */
export async function renderToImage(o: ImageOptions): Promise<ImageResult> {
    const {svg, tiles} = await renderToSVG({inlineImages: true, highDensity: (o.pixelRatio ?? 1) > 1, ...o});
    const format = o.format ?? 'jpeg', ratio = o.pixelRatio ?? 1;
    const plain = svg.replace(/ data-map-jr-ssr="" style="[^"]*"/, '');
    const image = await o.rasteriser.render(`<div style="display:flex;width:${o.width}px;height:${o.height}px">${plain}</div>`, {
        width: o.width * ratio, height: o.height * ratio, format, devicePixelRatio: ratio, // output size is in device pixels
        ...(format === 'png' ? {} : {quality: o.quality ?? 75}),
    });
    return {image, contentType: 'image/' + format, tiles};
}

export {renderSVG} from './svg.ts';
export type {MarkerLayerOptions} from './markers.ts';
