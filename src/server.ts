import type {LngLatBoundsInput} from './lnglat.ts';
import {Transform, fitBox, sides, toLngLat, type LngLatLike, type PaddingInput} from './geo.ts';
import {SSR_KEY, applySSROverrides, type SSROverrides, compileLayer, loadSprite, resolveStyle, tileURL, type CompiledLayer, type Sprite} from './style.ts';
import {TileBuilder} from './tiles.ts';
import type {TileImage, TileIR} from './tile.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {DEFAULT_FONT, EstimateShaper} from './text.ts';
import {dataTypeError, extended, styleFor, fillTemplate, svgSize, templateSlots, withData, VARIANT} from './markers.ts';
import {renderSVG} from './svg.ts';
import {ATTRIBUTES, VIEW_FIELDS, attributeOf, readAttribute} from './element-attributes.ts';
import type {MapDescription} from './host.ts';
import {compileFor, pickImage} from './expr.ts';
import {styleImages} from './style-images.ts';
import type {ImageDecoder} from './contour.ts';
import {decodeImage, decodePNG, decodeWebPLossless} from './webp.ts';
export {decodePNG, decodeWebPLossless, type ImageDecoder};

export interface RenderOptions {
    /**
     * A style object or URL, exactly as passed to the client-side map. Of a pair `{light, dark}` the server uses the
     * style of `colorScheme`: `'dark'` uses `dark`, and `'light'`, `'auto'` or no value use `light`, because the server
     * cannot read the scheme of the browser.
     */
    style: unknown;
    /** The colour scheme for a pair `{light, dark}` in `style`, and for the credits of `renderFirstView`. */
    colorScheme?: 'auto' | 'light' | 'dark';
    center: LngLatLike;
    zoom: number;
    bearing?: number;
    /** A box [west, south, east, north] to fit into the view, in place of `center` and `zoom`, with `padding` in pixels. */
    bounds?: LngLatBoundsInput;
    padding?: PaddingInput;
    width: number;
    height: number;
    /**
     * Images for the style layers, by name: SVG documents. An SVG with slots (`{{name}}`) is a
     * template, as in the description of a map. `{image, width, height}` gives a size in CSS pixels; without it the
     * size is the size of the `viewBox`, or else of the `width` and `height` attributes, or 24 by 24. An image that is not an SVG document is not drawn.
     */
    images?: Record<string, string | {image: string; width?: number; height?: number}>;
    fontFamily?: string;
    /**
     * The name of the SVG for assistive technology. The SVG has `role="img"` and this text as its `aria-label`.
     * The default is "Map". It has no effect on the image of `renderToImage`. Say what the map shows, for example "Map of the hotels in Bern".
     */
    label?: string;
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
    /**
     * Changes for the server render, for each id of a style layer: the same values as `map-jr:ssr` in the metadata of a
     * layer. Use this for a style that you do not write yourself (a style from a URL), to make the render smaller:
     * `{building: {hidden: true}, 'road-minor': {minzoom: 15}}`. A value here comes before the value in the style.
     * Without the option, the values of `map-jr:ssr` in the style apply. `false` renders the style with no override:
     * every value of `map-jr:ssr` in the style is ignored, `simplify` and `minSize` included.
     */
    overrides?: false | Record<string, SSROverrides>;
    /** Sources to add to the style, by id, as `sources` in the description of a map (`MapDescription`). */
    sources?: Record<string, object>;
    /** Layers to add to the layers of the style, as `layers` in the description of a map (`MapDescription`). */
    layers?: ({id: string; before?: string} & Record<string, unknown>)[];
    /**
     * Sprites to add to the sprite of the style, as `sprite` in the description of a map (`MapDescription`):
     * `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`. An `icon-image` names an image of such a sprite as `id:name`.
     * A relative URL is relative to the URL of the style.
     */
    sprite?: {id: string; url: string}[];
    /** Terrain in place of that of the style, as `terrain` in the description of a map (`MapDescription`). */
    terrain?: object | null;
    /** GeoJSON data for GeoJSON sources of the style, by the id of the source, as `data` in the description of a map. */
    data?: Record<string, unknown>;
    fetch?: typeof fetch;
    /**
     * The time in milliseconds that all requests of one render can take together. The default is 30000. The render
     * rejects when the time is over. `0` sets no limit.
     */
    timeout?: number;
    /**
     * The time in milliseconds that one request can take, with its redirects and its body. The default is 10000. The
     * render rejects when a request takes longer. `0` sets no limit.
     */
    requestTimeout?: number;
    /** The largest body of one response in bytes, after decompression. The render rejects for a larger body. There is no limit by default. */
    maxBytes?: number;
    /**
     * The host names that the render can request, for example `['tiles.openfreemap.org']`. Each name is compared with
     * the complete host name of the URL, without the port. The render rejects for a request or a redirect to another
     * host. All hosts are allowed by default.
     */
    allowHosts?: string[];
    /**
     * Decodes elevation tile images for contour sources. PNG and lossless WebP are built in; pass a function for
     * anything else (lossy WebP, for instance), returning `{width, height, data}` with RGBA bytes.
     */
    decodeImage?: ImageDecoder;
    /**
     * Builds the render from vector tiles this many zoom levels below the zoom of the render, drawn over-zoomed. The
     * default is 0. With 2, a render at zoom 12 uses tiles of zoom 10: the server fetches fewer tiles, and the SVG is
     * usually smaller, with fewer and coarser features. Use it for a first view that the map draws over. A negative
     * value uses tiles of a higher zoom, for a more detailed image: each step fetches about four times as many tiles.
     * The zoom of the tiles stays within the `minzoom` and `maxzoom` of the source. A value that is not a whole number
     * makes the render reject.
     */
    tileZoomOffset?: number;
}
export interface RenderResult {
    svg: string;
    /** Tile URLs this view needs: emit them as `<link rel="preload" as="fetch" crossorigin>` so the client starts warm. */
    tiles: string[];
    /** The credits of the sources of the style, as HTML. Show them with the render. */
    attribution: string[];
}

/**
 * A `fetch` that keeps the limits of the options: the time for all requests and for one request, the size of a body,
 * and the allowed hosts. (The style, its sources and its tiles can come from another party.) It reads each body
 * itself, so that a body that does not end, or that is too large, stops the request.
 */
function limitedFetch(o: RenderOptions, fetchFn: typeof fetch): typeof fetch {
    const total = o.timeout ?? 30000, each = o.requestTimeout ?? 10000, max = o.maxBytes ?? 0;
    for (const [name, v] of [['timeout', total], ['requestTimeout', each], ['maxBytes', max]] as const)
        if (!(v >= 0)) throw new Error(`[map-jr-gl] server render: "${name}" is ${v}. Pass a number that is 0 (no limit) or more.`);
    if (o.allowHosts && !(Array.isArray(o.allowHosts) && o.allowHosts.every(h => typeof h === 'string' && /^[^/:@\s]+$/.test(h))))
        throw new Error(`[map-jr-gl] server render: "allowHosts" is ${JSON.stringify(o.allowHosts)}. Pass a list of host names without a scheme, a port or a path, for example ["tiles.example.com"].`);
    const hosts = o.allowHosts?.map(h => h.toLowerCase());
    if (!total && !each && !max && !hosts) return fetchFn;
    const end = total ? Date.now() + total : Infinity;
    const check = (url: string) => {
        let host: string | undefined;
        try { host = new URL(url).hostname; } catch { /* not a complete URL: no host */ }
        if (hosts && (host === undefined || !hosts.includes(host))) throw new Error(`[map-jr-gl] server render: the host of ${url} is not in "allowHosts". Add "${host ?? ''}" to "allowHosts" if the render can request it.`);
    };
    return async (input, init) => {
        let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const first = url, ac = new AbortController(), left = end - Date.now(), whole = left < (each || Infinity);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<never>((_, reject) => {
            if (!whole && !each) return;
            timer = setTimeout(() => {
                reject(new Error(whole
                    ? `[map-jr-gl] server render: the requests took longer than the "timeout" of ${total} ms; the request to ${first} was not complete. Pass a larger "timeout", or 0 for no limit.`
                    : `[map-jr-gl] server render: the request to ${first} took longer than the "requestTimeout" of ${each} ms. Pass a larger "requestTimeout", or 0 for no limit.`));
                ac.abort();
            }, Math.max(0, whole ? left : each));
        });
        init?.signal?.addEventListener('abort', () => ac.abort());
        const load = async () => {
            let res: Response;
            for (let hop = 0; ; hop++) {
                check(url);
                res = await fetchFn(url, {...init, signal: ac.signal, ...(hosts && {redirect: 'manual' as const})});
                // A `fetch` that followed a redirect itself says where the response came from.
                if (res.url) check(res.url);
                const to = hosts && res.status > 300 && res.status < 400 && res.headers.get('location');
                if (!to) break;
                if (hop > 4) throw new Error(`[map-jr-gl] server render: the request to ${first} was redirected more than 5 times.`);
                void res.body?.cancel();
                url = new URL(to, url).href;
            }
            if (!res.body) return res;
            const large = () => new Error(`[map-jr-gl] server render: the response of ${first} is larger than "maxBytes" (${max} bytes). Pass a larger "maxBytes", or leave the source out of the style.`);
            if (max && +(res.headers.get('content-length') ?? 0) > max) { void res.body.cancel(); throw large(); }
            const reader = res.body.getReader(), parts: Uint8Array[] = [];
            for (let size = 0; ;) {
                const {done, value} = await reader.read();
                if (done) break;
                if (max && (size += value.length) > max) { void reader.cancel(); throw large(); }
                parts.push(value);
            }
            return new Response(new Blob(parts as BlobPart[]), {status: res.status, statusText: res.statusText, headers: res.headers});
        };
        try { return await Promise.race([late, load()]); } finally { clearTimeout(timer); }
    };
}

/** Renders the first frame of a map without a browser, for server-side rendering, static export or social images. */
export async function renderToSVG(o: RenderOptions): Promise<RenderResult> {
    // Wrapped, not passed by reference: Cloudflare Workers reject calls to a detached global `fetch`.
    const dz = o.tileZoomOffset ?? 0;
    if (!Number.isInteger(dz)) throw new Error(`[map-jr-gl] tileZoomOffset: ${dz} is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.`);
    const fetchFn = limitedFetch(o, o.fetch ?? ((...a) => fetch(...a)));
    // (`sources`, `layers` and `data` are added to the style. A style from a URL is fetched here, to add them to it and to read its images.)
    let given = styleFor(o.style, o.colorScheme === 'dark'), base: string | undefined;
    const adds = !!(o.sources || o.layers || o.terrain || o.sprite?.length);
    if (typeof given === 'string') {
        const res = await fetchFn(base = given);
        if (!res.ok) throw new Error(`Failed to load style ${given}: ${res.status}`);
        given = await res.json();
    }
    const full: any = withData(adds ? extended(given, o) : given, o.data, true, (id, type) => { throw dataTypeError(id, type); });
    const style = await resolveStyle(full, fetchFn, base);
    const over = o.overrides;
    // (`false` also removes `map-jr:ssr` from the layers, because `compileLayer` reads `simplify` and `minSize` from it (#723).)
    style.layers = over === false ? style.layers.map(l => l.metadata?.[SSR_KEY] ? {...l, metadata: {...l.metadata, [SSR_KEY]: undefined}} : l)
        : applySSROverrides(over ? style.layers.map(l => over[l.id] ? {...l, metadata: {...l.metadata, [SSR_KEY]: {...(l.metadata?.[SSR_KEY] as object), ...over[l.id]}}} : l) : style.layers);
    if (o.layerFilter) style.layers = style.layers.filter(l => o.layerFilter!(l.id));
    compileFor({g: style.state ?? {}, f: {}});
    const layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
    const tr = new Transform();
    tr.width = o.width; tr.height = o.height;
    if (o.bounds) { const p = sides(o.padding), b = (o.bounds as {toArray?(): unknown[]}).toArray?.() ?? o.bounds as unknown[], fit = fitBox(b.length > 2 ? b as number[] : [...toLngLat(b[0] as LngLatLike), ...toLngLat(b[1] as LngLatLike)], o.width, o.height, p, p, 22); tr.set(fit.center, fit.zoom, o.bearing ?? 0); }
    else tr.set(o.center, o.zoom, o.bearing ?? 0);

    const builder = new TileBuilder(fetchFn);
    builder.setStyle(style.layers, style.state);
    // The images of `images` that are SVG documents: the SVG and the size, and for a template its slots.
    // (The images of the style come first, and an image of `images` with the same name takes the place of one (#495).)
    const documents = new Map(Object.entries({...styleImages(given, message => console.warn(message)), ...o.images}).map(([name, v]) => [name, typeof v === 'string' ? {image: v} : v] as const).filter(([, v]) => typeof v.image === 'string' && v.image.trimStart().startsWith('<')));
    builder.setTemplates(Object.fromEntries([...documents].map(([name, v]) => [name, templateSlots(v.image)] as const).filter(([, slots]) => slots.length)));
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
        // (`tileZoomOffset` of vector sources: a positive value lowers the zoom through `maxzoom`, a negative one raises it through a smaller tile size.)
        const v = src.type === 'vector', maxzoom = v ? Math.max(src.minzoom, Math.min(src.maxzoom, Math.floor(tr.zoom) - dz)) : src.maxzoom;
        const ideal = tr.tileCover(src.minzoom, maxzoom, v && dz < 0 ? src.tileSize * 2 ** dz : src.tileSize, src.type === 'raster'), loaded = new Map<string, TileIR | TileImage>();
        // (`tiles` of the result are those that the live map requests, at the zoom of the render, whatever `tileZoomOffset` is.)
        if (v) for (const id of dz ? tr.tileCover(src.minzoom, src.maxzoom, src.tileSize) : ideal) urls.push(tileURL(src, id.z, id.x, id.y, o.highDensity ? 2 : 1));
        await Promise.all(ideal.filter((id, i) => ideal.findIndex(o => o.key === id.key) === i).map(async id => {
            const url = tileURL(src, id.z, id.x, id.y, o.highDensity ? 2 : 1);
            if (src.type === 'raster') { loaded.set(id.key, {href: o.inlineImages ? await dataURI(url) : url}); return; }
            loaded.set(id.key, await builder.loadIR({id: req++, source: name, url, z: id.z, overscaled: (id.z >= maxzoom || dz < 0) && Math.floor(tr.zoom)}));
        }));
        const list = renderItems(tr, ideal, k => loaded.get(k));
        items.set(name, list);
        if (src.type !== 'raster') all.push(...list as RenderItem<TileIR>[]);
    });
    if (style.sprite && layers.some(l => l.type === 'symbol')) {
        jobs.push((async () => {
            // (A sprite of several sheets keeps each image: the icons of a sheet with an id other than `default` have the names `id:name`.)
            const sheets: {id: string; url: string}[] = style.sprite![0] === '[' ? JSON.parse(style.sprite!) : [{id: 'default', url: style.sprite!}];
            const loaded = await Promise.all(sheets.map(async ({id, url}) => {
                const one = await loadSprite(url, !!o.highDensity, fetchFn);
                if (o.inlineImages) one.image = await dataURI(one.image);
                return {id, one};
            }));
            const icons: Sprite['icons'] = {};
            loaded.forEach(({id, one}, sheet) => { for (const name in one.icons) icons[id === 'default' ? name : `${id}:${name}`] = {...one.icons[name], sheet}; });
            sprite = {...loaded[0].one, icons, sheets: loaded.map(({one}) => one)};
        })());
    }
    await Promise.all(jobs);

    const grid = new CollisionGrid(), images = new Map<string, {svg: string; width: number; height: number}>();
    const find = (name: string) => {
        // (An image of `images` or of the style takes the place of an image of the sprite with the same name.)
        const fromSprite = (sprite as Sprite | null)?.icons[name];
        if (fromSprite && !documents.has(name)) return fromSprite;
        if (!images.has(name)) {
            // An image of `images`: for a template, the name has the value of each slot (see `buildTile`).
            const [image, ...values] = name.split(VARIANT), own = documents.get(image);
            // (`resolveImage` is asked for a name that `images` does not have, and never for the name of a variant.)
            let img = own || values.length ? undefined : o.resolveImage?.(name);
            if (own) {
                const slots = templateSlots(own.image), [w, h] = svgSize(own.image);
                img = {svg: fillTemplate(own.image, Object.fromEntries(slots.map((s, i) => [s, values[i]]))), width: own.width ?? w, height: own.height ?? h};
            }
            if (img) images.set(name, img); else return undefined;
        }
        const img = images.get(name)!;
        return {x: 0, y: 0, width: img.width, height: img.height, pixelRatio: 1, custom: true};
    };
    // `coalesce` with images gives several names (see `pickImage`). The SVG gets the name of the image that is drawn.
    const picked = new Map<string, string>();
    const labels = placeLabels(tr, all, layers, new EstimateShaper(), grid, name => {
        const one = pickImage(name, find);
        if (one !== name) picked.set(name, one);
        return find(one);
    });
    for (const l of labels) if (l.icon) l.icon.name = picked.get(l.icon.name) ?? l.icon.name;
    const svg = renderSVG({
        tr, layers, items, labels, sprite, images, fontFamily: o.fontFamily ?? DEFAULT_FONT, label: o.label,
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
 * `colorScheme` gives the colours of the credits: `'light'` (the default) or `'dark'`. The server cannot read the
 * scheme of the browser, so `'auto'` writes both colours with the CSS function `light-dark()`, and a browser without
 * it (before 2024) shows the light colours.
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

export async function renderFirstView(o: RenderOptions & {attribution?: string | string[] | false; colorScheme?: 'auto' | 'light' | 'dark'}): Promise<string> {
    const made = await renderToSVG(o);
    const credits = o.attribution === false ? [] : [o.attribution ?? made.attribution].flat().map(cleanCredits).filter(Boolean);
    const light = 'background:rgba(255,255,255,.75);color:#333', dark = 'background:rgba(30,30,30,.75);color:#ccc';
    const colors = o.colorScheme === 'dark' ? dark : o.colorScheme === 'auto' ? light + ';color-scheme:light dark;background:light-dark(rgba(255,255,255,.75),rgba(30,30,30,.75));color:light-dark(#333,#ccc)' : light;
    return made.svg + (credits.length ? `<div data-map-jr-ssr="" style="position:absolute;right:0;bottom:0;${colors};font:11px/1.4 sans-serif;padding:2px 6px">${credits.join(' ')}</div>` : '');
}

/** The options of `renderElement`: those of `renderToSVG` that the description does not give, and the attributes of the element. */
export interface ElementRenderOptions extends Omit<RenderOptions, 'style' | 'colorScheme' | 'center' | 'zoom' | 'bearing' | 'bounds' | 'padding' | 'width' | 'height' | 'images' | 'fontFamily' | 'sources' | 'layers' | 'sprite' | 'terrain' | 'data'> {
    /** The size in CSS pixels that the element has on most screens. The default is 800 by 500. */
    width?: number;
    height?: number;
    /** The credits to show, when the server must not take them from the sources of the style. */
    attribution?: string | string[];
    /**
     * More attributes of the element, by name: `{id: 'map', class: 'map', style: 'height:400px'}`. The text of `style`
     * comes after `display:block;position:relative;overflow:hidden`, which the first view needs before the script runs.
     */
    attributes?: Record<string, string>;
}

/**
 * The markup of the element `<map-jr>` of `@map-jr/map-jr-gl/element` for a description (`MapDescription`): an
 * attribute for each field that has one, and the first view (the result of `renderFirstView`) as its children. The
 * browser shows the first view before any script runs, and the map removes it after its first frame. The page gives
 * the fields that have no attribute (`layers`, `data`, a style object) to the element as properties, with the same
 * values as here. A render that fails does not fail the page: the result is the element without the first view, and
 * the console has the error.
 */
export async function renderElement(description: MapDescription, options: ElementRenderOptions = {}): Promise<string> {
    const d = description as MapDescription & Record<string, unknown>, quote = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const view: Record<string, unknown> = {...d.initialView, ...d.view}, attrs: string[] = [];
    for (const [field, kind] of Object.entries(ATTRIBUTES)) {
        const v = VIEW_FIELDS.includes(field) ? view[field] : field === 'projection' ? (d.projection as {type?: string} | null)?.type : d[field];
        const text = v === undefined || v === null || v === false || typeof v === 'object' && !Array.isArray(v) ? undefined
            : kind === 'b' || v === true ? '' : Array.isArray(v) ? v.join(kind === 'l' ? ' ' : ',') : String(v);
        if (text !== undefined && readAttribute(kind, text) !== undefined) attrs.push(text ? `${attributeOf(field)}="${quote(text)}"` : attributeOf(field));
    }
    if (d.nonce) attrs.push(`nonce="${quote(d.nonce)}"`);
    const {attributes = {}, width = 800, height = 500, attribution, ...rest} = options;
    for (const name in attributes) {
        if (!/^[a-z_:][\w:.-]*$/i.test(name) || /^on/i.test(name)) throw new Error(`[map-jr-gl] renderElement(): "${name}" is not the name of an attribute${/^on/i.test(name) ? ' that the element can have: an event handler attribute runs script' : ''}. Give names such as "id", "class" or "style".`);
        if (name !== 'style') attrs.push(`${name}="${quote(attributes[name])}"`);
    }
    attrs.push(`style="${quote('display:block;position:relative;overflow:hidden;' + (attributes.style ?? ''))}"`);
    let first = '';
    try {
        const fit = !d.view && d.initialView?.bounds;
        first = await renderFirstView({...rest, style: d.style, center: (view.center as LngLatLike) ?? [0, 0], zoom: (view.zoom as number) ?? 0, bearing: view.bearing as number, bounds: fit ? fit as LngLatBoundsInput : undefined, padding: d.initialView?.padding,
            width, height, images: d.images as RenderOptions['images'], sources: d.sources, layers: d.layers as RenderOptions['layers'], terrain: d.terrain, sprite: d.sprite, data: d.data, fontFamily: d.fontFamily,
            attribution: d.attribution === false ? false : attribution, colorScheme: d.colorScheme ?? 'light'});
    } catch (cause) {
        console.error(`[map-jr-gl] renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: ${(cause as Error)?.message ?? cause}`);
    }
    return `<map-jr ${attrs.join(' ')}>${first}</map-jr>`;
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
