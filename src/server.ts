import {Transform, type LngLatLike} from './geo.ts';
import {compileLayer, loadSprite, resolveStyle, tileURL, type CompiledLayer, type Sprite} from './style.ts';
import {TileBuilder} from './tiles.ts';
import type {TileImage, TileIR} from './tile.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {DEFAULT_FONT, EstimateShaper} from './text.ts';
import {anchorOffset, type MarkerLayerOptions} from './markers.ts';
import {renderSVG} from './svg.ts';

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
    fetch?: typeof fetch;
}
export interface RenderResult {
    svg: string;
    /** Tile URLs this view needs: emit them as `<link rel="preload" as="fetch" crossorigin>` so the client starts warm. */
    tiles: string[];
}


/** Renders the first frame of a map without a browser, for server-side rendering, static export or social images. */
export async function renderToSVG(o: RenderOptions): Promise<RenderResult> {
    // Wrapped, not passed by reference: Cloudflare Workers reject calls to a detached global `fetch`.
    const fetchFn: typeof fetch = o.fetch ?? ((...a) => fetch(...a));
    const style = await resolveStyle(o.style, fetchFn);
    if (o.layerFilter) style.layers = style.layers.filter(l => o.layerFilter!(l.id));
    const layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
    const tr = new Transform();
    tr.width = o.width; tr.height = o.height;
    tr.set(o.center, o.zoom, o.bearing ?? 0);

    const builder = new TileBuilder(fetchFn);
    builder.setStyle(style.layers);
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
        if (src.type === 'raster-dem') return;
        const ideal = tr.coveringTiles(src.minzoom, src.maxzoom, src.tileSize, src.type !== 'vector'), loaded = new Map<string, TileIR | TileImage>();
        await Promise.all(ideal.filter((id, i) => ideal.findIndex(o => o.key === id.key) === i).map(async id => {
            const url = tileURL(src, id.z, id.x, id.y);
            if (src.type === 'raster') { loaded.set(id.key, {href: o.inlineImages ? await dataURI(url) : url}); return; }
            urls.push(url);
            loaded.set(id.key, await builder.loadIR({id: req++, source: name, url, z: id.z, overscaled: id.z >= src.maxzoom}));
        }));
        const list = renderItems(tr, ideal, k => loaded.get(k));
        items.set(name, list);
        if (src.type === 'vector') all.push(...list as RenderItem<TileIR>[]);
    });
    if (style.sprite && layers.some(l => l.type === 'symbol')) {
        jobs.push((async () => {
            sprite = await loadSprite(style.sprite!, !!o.highDensity, fetchFn);
            if (o.inlineImages) sprite.image = await dataURI(sprite.image);
        })());
    }
    await Promise.all(jobs);

    const grid = new CollisionGrid();
    for (const m of o.markers ?? []) {
        if (!m.collide) continue;
        const [ox, oy] = anchorOffset(m.anchor, m.width, m.height);
        for (const d of m.data) {
            const [x, y] = tr.project(d.lngLat[0], d.lngLat[1]);
            grid.insert(x + ox, y + oy, x + ox + m.width, y + oy + m.height);
        }
    }
    const labels = placeLabels(tr, all, layers, new EstimateShaper(), grid, name => (sprite as Sprite | null)?.icons[name]);
    const svg = renderSVG({
        tr, layers, items, labels, sprite, markers: o.markers ?? [], fontFamily: o.fontFamily ?? DEFAULT_FONT,
        rootAttrs: 'data-tessera-ssr style="position:absolute;inset:0;width:100%;height:100%"',
    });
    return {svg, tiles: urls};
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
    const plain = svg.replace(/ data-tessera-ssr style="[^"]*"/, '');
    const image = await o.rasteriser.render(`<div style="display:flex;width:${o.width}px;height:${o.height}px">${plain}</div>`, {
        width: o.width * ratio, height: o.height * ratio, format, devicePixelRatio: ratio, // output size is in device pixels
        ...(format === 'png' ? {} : {quality: o.quality ?? 75}),
    });
    return {image, contentType: 'image/' + format, tiles};
}

export {renderSVG} from './svg.ts';
export type {MarkerLayerOptions} from './markers.ts';
