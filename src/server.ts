import type {LngLatBoundsInput} from './lnglat.ts';
import {Transform, fitBox, sides, toLngLat, type LngLatLike, type PaddingInput} from './geo.ts';
import {SSR_KEY, applySSROverrides, type SSROverrides, compileLayer, loadSprite, promoteIds, resolveStyle, tileURL, type CompiledLayer, type Sprite} from './style.ts';
import {TileBuilder} from './tiles.ts';
import type {TileImage, TileIR} from './tile.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {DEFAULT_FONT, EstimateShaper} from './text.ts';
import {dataTypeError, extended, styleFor, fillTemplate, svgSize, templateSlots, withData, VARIANT} from './markers.ts';
import {renderSVG, cleanCredits} from './svg.ts';
import {controlsMarkup} from './server-controls.ts';
import {ATTRIBUTES, VIEW_FIELDS, attributeOf, readAttribute} from './element-attributes.ts';
import type {ControlSpec, MapDescription} from './host.ts';
import {unset, type Given} from './unset.ts';
import {compileFor, pickImage} from './expr.ts';
import {styleImages} from './style-images.ts';
import type {ImageDecoder} from './contour.ts';
import {decodeImage, decodePNG, decodeWebPLossless} from './webp.ts';
export {decodePNG, decodeWebPLossless, type ImageDecoder};

/** The options of `renderToSVG` and `renderFirstView`. */
export interface RenderOptions {
    /**
     * The style: a style object, the URL of a style, or `{light, dark}` with one style or URL for each scheme, as
     * `style` of `MapDescription`. Of `{light, dark}`, the server renders `dark` when `colorScheme` is `'dark'`, and `light` otherwise.
     */
    style: unknown;
    /** The color scheme that selects the style of `{light, dark}` in `style`, and the colors of the credits of `renderFirstView`. */
    colorScheme?: 'auto' | 'light' | 'dark';
    /** The center of the view, `[lng, lat]`. `bounds` overrides it. */
    center: LngLatLike;
    /** The zoom level of the view. `bounds` overrides it. */
    zoom: number;
    /**
     * The bearing of the view in degrees.
     * @default 0
     */
    bearing?: number;
    /** A box `[west, south, east, north]` to fit into the view. It overrides `center` and `zoom`. */
    bounds?: LngLatBoundsInput;
    /**
     * Space in CSS pixels around `bounds` for the fit: one number, or `{top, right, bottom, left}`.
     * @default 0
     */
    padding?: PaddingInput;
    /** The width of the render in CSS pixels. */
    width: number;
    /** The height of the render in CSS pixels. */
    height: number;
    /**
     * Images for the style layers, by name: an SVG document as a string, or `{image, width, height}` with the size in CSS pixels.
     * An SVG with slots (`{{name}}`) is a template. An image that is not an SVG document is not rendered.
     */
    images?: Record<string, string | {image: string; width?: number; height?: number}>;
    /**
     * The CSS font family of labels.
     * @default the `@default` of {@link MapSetup.fontFamily} in the main API
     */
    fontFamily?: string;
    /**
     * The `aria-label` of the SVG, which has `role="img"`. Say what the map shows, for example "Map of the hotels in Bern".
     * The image of `renderToImage` has no label.
     * @default 'Map'
     */
    label?: string;
    /** A function that returns `false` for the ids of style layers to leave out of the render, for example dense building footprints. */
    layerFilter?: (layerId: string) => boolean;
    /**
     * Whether raster tiles and the icon sheet are embedded as data URIs instead of linked. A rasterized SVG needs it.
     * @default false in `renderToSVG`, true in `renderToImage`
     */
    inlineImages?: boolean;
    /**
     * Whether the render uses the high-density (@2x) icon sheet and requests raster tiles at @2x.
     * @default false in `renderToSVG`; in `renderToImage`, true when `pixelRatio` is above 1
     */
    highDensity?: boolean;
    /**
     * A function that returns an SVG icon for an image name that the sprite does not have, or `undefined` for a name that
     * it does not handle. It is the server counterpart of `map.setMissingStyleImageResolver`.
     */
    resolveImage?: (name: string) => {svg: string; width: number; height: number} | undefined;
    /**
     * Changes for the server render, for each id of a style layer: the same values as `map-jr:ssr` in the metadata of a
     * layer, for example `{building: {hidden: true}, 'road-minor': {minzoom: 15}}`. A value here overrides the value in
     * the style, and `false` ignores every `map-jr:ssr` of the style.
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
    /** 3D terrain, as `terrain` in the description of a map (`MapDescription`). It overrides the `terrain` of the style, and `null` renders none. */
    terrain?: object | null;
    /** GeoJSON data for GeoJSON sources of the style, by the id of the source, as `data` in the description of a map. */
    data?: Record<string, unknown>;
    /**
     * The function that the render uses for its requests.
     * @default globalThis.fetch
     */
    fetch?: typeof fetch;
    /**
     * The time in milliseconds that all requests of one render can take together. The render rejects when the time is over, and `0` sets no limit.
     * @default 30000
     */
    timeout?: number;
    /**
     * The time in milliseconds that one request can take, with its redirects and its body. The render rejects when a request takes longer, and `0` sets no limit.
     * @default 10000
     */
    requestTimeout?: number;
    /**
     * The largest body of one response in bytes, after decompression. The render rejects for a larger body, and `0` sets no limit.
     * @default 0
     */
    maxBytes?: number;
    /**
     * The host names that the render can request, for example `['tiles.openfreemap.org']`, compared with the host of the
     * URL without the port. The render rejects for a request or a redirect to another host. Without it, all hosts are allowed.
     */
    allowHosts?: string[];
    /**
     * A function that decodes elevation tile images of another format than PNG and lossless WebP, such as lossy WebP.
     * It returns `{width, height, data}` with RGBA bytes.
     */
    decodeImage?: ImageDecoder;
    /**
     * The number of zoom levels below the zoom of the render at which the server loads vector tiles, as a whole number.
     * With 2, a render at zoom 12 uses tiles of zoom 10, which makes the SVG smaller and coarser; a negative value loads more detailed tiles.
     * @default 0
     */
    tileZoomOffset?: number;
}
/** The result of `renderToSVG`. */
export interface RenderResult {
    /** The SVG document of the render. */
    svg: string;
    /** The URLs of the tiles of the view. Write them as `<link rel="preload" as="fetch" crossorigin>` so that the browser loads them early. */
    tiles: string[];
    /** The credits of the sources that a visible layer uses at the zoom of the view, as HTML. Show them with the render. */
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

/**
 * Renders the first frame of a map as SVG without a browser, for server-side rendering, a static export or a social image.
 * @returns A promise of the SVG, the URLs of the tiles and the credits. It rejects when the style or a limit of the options fails.
 */
export async function renderToSVG(o: RenderOptions): Promise<RenderResult> {
    const {view: _view, ...result} = await renderView(o);
    return result;
}

/** `renderToSVG`, with the view that the SVG shows (`renderFirstView` needs it for the scale and the compass). */
async function renderView(o: RenderOptions): Promise<RenderResult & {view: {lat: number; zoom: number; bearing: number}}> {
    // Wrapped, not passed by reference: Cloudflare Workers reject calls to a detached global `fetch`.
    const dz = o.tileZoomOffset ?? 0;
    if (!Number.isInteger(dz)) throw new Error(`[map-jr-gl] tileZoomOffset: ${dz} is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.`);
    const fetchFn = limitedFetch(o, o.fetch ?? ((...a) => fetch(...a)));
    // (`sources`, `layers` and `data` are added to the style. A style from a URL is fetched here, to add them to it and to read its images.)
    let given = styleFor(o.style, o.colorScheme === 'dark'), base: string | undefined;
    const adds = !!(o.sources || o.layers || o.terrain !== undefined || o.sprite?.length);
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
    builder.setContours(Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!])), promoteIds(style));
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
    // (Images inside `format` text are sized by `find`, and the SVG draws them as it draws icons.)
    const shaper = new EstimateShaper();
    shaper.images = find;
    const labels = placeLabels(tr, all, layers, shaper, grid, name => {
        const one = pickImage(name, find);
        if (one !== name) picked.set(name, one);
        return find(one);
    });
    for (const l of labels) if (l.icon) l.icon.name = picked.get(l.icon.name) ?? l.icon.name;
    const svg = renderSVG({
        tr, layers, items, labels, sprite, images, fontFamily: o.fontFamily ?? DEFAULT_FONT, label: o.label,
        rootAttrs: 'data-map-jr-ssr="" style="position:absolute;inset:0;width:100%;height:100%"',
    });
    // (The credits are those of `getAttributions` of the map: only the sources that a visible layer uses at this zoom, so that they do not change when the map takes over.)
    return {svg, tiles: urls, attribution: [...new Set(Object.entries(style.sources).filter(([id]) => layers.some(l => l.source === id && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)).map(([, s]) => s.attribution?.trim()).filter((a): a is string => !!a))], view: {lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing}};
}

/** The options of `renderFirstView`: those of `renderToSVG`, and the credits and the controls of the first view. */
export interface FirstViewOptions extends RenderOptions {
    /** The credits to show instead of those of the sources, as HTML. `false` shows none, and leaves out the attribution of the controls as well. */
    attribution?: string | string[] | false;
    /**
     * The controls of the description, for example `[navigation(), scale()]`. With this option (also `[]`), the first view has the
     * attribution and these controls as static markup, with the style sheet of the controls, as the map has them at its first frame.
     * A control from `custom()` is left out. Without the option, the first view has a plain element for the credits and no controls.
     */
    controls?: ControlSpec[];
    /** The texts of the controls, as `locale` of the description. It has an effect with `controls`. */
    locale?: Record<string, string> | null;
    /** The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the controls, as `nonce` of the description. It has an effect with `controls`. */
    nonce?: string | null;
    /** The limits of the zoom of the description, which disable a zoom button. They have an effect with `controls`. */
    minZoom?: number | null;
    maxZoom?: number | null;
    /** The projection of the description, which sets the state of the globe control. It has an effect with `controls`. */
    projection?: {type?: unknown} | null;
    /** The options of the attribution, as `attribution` of the description. They have an effect with `controls`. */
    attributionOptions?: {compact?: boolean; customAttribution?: string | string[]} | null;
}

/**
 * Renders the first view of a map as HTML for a page from a server: the SVG, with the credits over it. Put the HTML into
 * the element of the map; the map removes it when it has loaded the tiles of its first view, just before `load`.
 * With `controls`, the HTML also has the attribution and the controls of the map as static markup, with their style
 * sheet, in the positions and the look that the map gives them, so that the map takes over with no visible change.
 * @param o The options of `renderToSVG`. `attribution` sets the credits instead of those of the sources, and `false` shows none.
 * `colorScheme` sets the colors of the credits and the controls; `'auto'` follows the browser.
 * @returns A promise of the HTML. It rejects as `renderToSVG` does.
 */
export async function renderFirstView(o: FirstViewOptions): Promise<string> {
    const made = await renderView(o);
    const raw = o.attribution === false ? false : [o.attribution ?? made.attribution].flat();
    if (o.controls) {
        return made.svg + controlsMarkup({controls: o.controls, ...made.view, width: o.width, colorScheme: o.colorScheme ?? 'light', locale: o.locale, nonce: o.nonce, minZoom: o.minZoom, maxZoom: o.maxZoom,
            projection: o.projection, terrain: !!o.terrain, credits: raw, attribution: o.attributionOptions});
    }
    const credits = raw === false ? [] : raw.map(cleanCredits).filter(Boolean);
    const light = 'background:rgba(255,255,255,.75);color:#333', dark = 'background:rgba(30,30,30,.75);color:#ccc';
    const colors = o.colorScheme === 'dark' ? dark : o.colorScheme === 'auto' ? light + ';color-scheme:light dark;background:light-dark(rgba(255,255,255,.75),rgba(30,30,30,.75));color:light-dark(#333,#ccc)' : light;
    return made.svg + (credits.length ? `<div data-map-jr-ssr="" style="position:absolute;right:0;bottom:0;${colors};font:11px/1.4 sans-serif;padding:2px 6px">${credits.join(' ')}</div>` : '');
}

/** The options of `renderElement`: those of `renderToSVG` that the description does not give, and the attributes of the element. */
export interface ElementRenderOptions extends Omit<RenderOptions, 'style' | 'colorScheme' | 'center' | 'zoom' | 'bearing' | 'bounds' | 'padding' | 'width' | 'height' | 'images' | 'fontFamily' | 'sources' | 'layers' | 'sprite' | 'terrain' | 'data'> {
    /**
     * The width in CSS pixels that the element has on most screens.
     * @default 800
     */
    width?: number;
    /**
     * The height in CSS pixels that the element has on most screens.
     * @default 500
     */
    height?: number;
    /** The credits to show, when the server must not take them from the sources of the style. */
    attribution?: string | string[];
    /**
     * More attributes of the element, by name, for example `{id: 'map', class: 'map', style: 'height:400px'}`. The text of
     * `style` is appended to `display:block;position:relative;overflow:hidden`. A name that starts with `on` throws.
     */
    attributes?: Record<string, string>;
}

/**
 * Renders the element `<map-jr>` of `@map-jr/map-jr-gl/element` for a description, with the first view as its content.
 * A field that has an attribute of `<map-jr>` and a value that is not an object, such as `zoom` or the URL of a style,
 * becomes that attribute. Set the other fields, such as `layers`, `data` or a style object, as properties of the element in the page, with the same values.
 * @returns A promise of the HTML. When the render fails, the element has no first view and the error is written to the console.
 */
export async function renderElement(description: MapDescription, options: ElementRenderOptions = {}): Promise<string> {
    const d = unset(description) as Given & Record<string, unknown>, quote = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const view: Record<string, unknown> = {...d.initialView, ...d.view}, attrs: string[] = [];
    for (const [field, kind] of Object.entries(ATTRIBUTES)) {
        const v = VIEW_FIELDS.includes(field) ? view[field] : field === 'projection' ? (d.projection as {type?: string} | null)?.type
            : field === 'attributionCompact' ? (d.attribution as {compact?: boolean} | undefined)?.compact : d[field];
        const text = kind === 'o' ? (v === false ? '' : undefined) : v === undefined || v === null || v === false || typeof v === 'object' && !Array.isArray(v) ? undefined
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
        first = await renderFirstView({...rest, style: d.style, center: (view.center as LngLatLike) ?? [0, 0], zoom: (view.zoom as number) ?? 0, bearing: view.bearing as number, bounds: fit ? fit as LngLatBoundsInput : undefined, padding: d.initialView?.fitPadding,
            width, height, images: d.images as RenderOptions['images'], sources: d.sources, layers: d.layers as RenderOptions['layers'], terrain: d.terrain, sprite: d.sprite, data: d.data, fontFamily: d.fontFamily,
            attribution: d.attribution === false ? false : attribution, colorScheme: d.colorScheme ?? 'light',
            controls: (d.controls ?? []) as ControlSpec[], locale: d.locale, nonce: d.nonce, minZoom: d.minZoom, maxZoom: d.maxZoom, projection: d.projection as {type?: unknown} | null | undefined,
            attributionOptions: d.attribution === false ? undefined : d.attribution as {compact?: boolean; customAttribution?: string | string[]} | undefined});
    } catch (cause) {
        console.error(`[map-jr-gl] renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: ${(cause as Error)?.message ?? cause}`);
    }
    return `<map-jr ${attrs.join(' ')}>${first}</map-jr>`;
}

/**
 * The part of the `Renderer` of takumi that `renderToImage` uses: an instance from `@takumi-rs/core` (Node.js, Bun) or
 * `@takumi-rs/wasm` (Cloudflare Workers and other edge runtimes).
 */
export interface Rasteriser {
    /** Renders HTML to an image. */
    render(source: string, options: Record<string, unknown>): Promise<Uint8Array>;
}
/** The options of `renderToImage`: those of `renderToSVG`, and the options of the image. */
export interface ImageOptions extends RenderOptions {
    /** The renderer that converts the SVG to an image. */
    rasteriser: Rasteriser;
    /**
     * The format of the image. Lossy `'webp'` works only with `@takumi-rs/core`.
     * @default 'jpeg'
     */
    format?: 'jpeg' | 'webp' | 'png';
    /**
     * The quality of a `'jpeg'` or `'webp'` image, as the rasterizer reads it.
     * @default 75
     */
    quality?: number;
    /**
     * The number of image pixels for one CSS pixel. Above 1, the render uses `highDensity` unless the options set it to `false`.
     * @default 1
     */
    pixelRatio?: number;
}
/** The result of `renderToImage`: the bytes of the image, its MIME type (`image/jpeg` and others), and the URLs of the tiles. */
export interface ImageResult {
    /** The bytes of the image, in the format of `format`. */
    image: Uint8Array;
    /** The media type of the image, for example `image/jpeg`, for the `Content-Type` header. */
    contentType: string;
    /** The URLs of the tiles that the render used, as in `RenderResult`. */
    tiles: string[];
}

/**
 * Renders the first frame of a map as a raster image, whose size does not depend on how dense the data is.
 * @returns A promise of the image. It rejects as `renderToSVG` does.
 */
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

