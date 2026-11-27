import type {LngLatBoundsInput} from './lnglat.ts';
import {Transform, fitBox, sides, toLngLat, type LngLatLike, type PaddingInput} from './geo.ts';
import {SSR_KEY, applySSROverrides, type SSROverrides, compileLayer, loadSprite, promoteIds, resolveStyle, tileURL, type CompiledLayer, type Sprite} from './style.ts';
import {TileBuilder} from './tiles.ts';
import type {TileImage, TileIR} from './tile.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {DEFAULT_FONT, EstimateShaper} from './text.ts';
import {dataTypeError, escapeXML, extended, styleFor, fillTemplate, svgSize, templateSlots, withData, VARIANT} from './markers.ts';
import {renderSVG, cleanCredits} from './svg.ts';
import {controlsMarkup} from './server-controls.ts';
import {ATTRIBUTES, VIEW_FIELDS, attributeOf, readAttribute} from './element-attributes.ts';
import type {AttributionOptions, ColorScheme, ControlSpec, MapDescription, SpriteInput} from './host.ts';
import {unset, type Given} from './unset.ts';
import {compileFor, pickImage, useColorNames} from './expr.ts';
import {NAMED} from './color-names.ts';
import {styleImages, STYLE_IMAGES} from './style-images.ts';
import type {ImageDecoder} from './exact-pixels.ts';
import {httpError} from './requests.ts';
import {decodeImage, decodePNG, decodeWebPLossless} from './webp.ts';
export {decodePNG, decodeWebPLossless, type ImageDecoder};
// The server has no canvas to ask for the value of a color name: it takes the table (#72).
useColorNames(NAMED);

/**
 * The view of `renderToSVG`, `renderFirstView` and `renderToImage`: `center` and `zoom`, or `bounds` to fit. With
 * `bounds`, `center` and `zoom` can be left out, and they have no effect.
 */
export type RenderView = {center: LngLatLike; zoom: number} | {bounds: LngLatBoundsInput};

/**
 * The options of `renderToSVG`: the members of `RenderOptionsBase` and a view (`RenderView`), which is `center` and
 * `zoom`, or `bounds`.
 */
export type RenderOptions = RenderOptionsBase & RenderView;

/** The members of `RenderOptions`, with `center` and `zoom` optional. `RenderOptions` adds that a view is required. */
export interface RenderOptionsBase {
    /**
     * The style: a style object, the URL of a style, or `{light, dark}` with one style or URL for each scheme, as
     * `style` of `MapDescription`. Of `{light, dark}`, the server renders `dark` when `colorScheme` is `'dark'`, and `light` otherwise.
     */
    style: unknown;
    /** The color scheme that selects the style of `{light, dark}` in `style`, and the colors of the credits of `renderFirstView`. */
    colorScheme?: ColorScheme;
    /**
     * Values for the `global-state` expressions of the style, by name, as `globalState` of `MapDescription`. A value here
     * overrides the default in `state` of the style; a name that is left out or set to `null` uses the default. Unless
     * `globalState` sets it, the global state `color-scheme` is the scheme, as in the map. The server has no browser, so
     * `'auto'` and no value are `'light'` here, while the map follows `prefers-color-scheme` for `'auto'`.
     */
    globalState?: Record<string, unknown> | null;
    /** The center of the view, `[lng, lat]`. Required without `bounds`; `bounds` overrides it. */
    center?: LngLatLike;
    /** The zoom level of the view. Required without `bounds`; `bounds` overrides it. */
    zoom?: number;
    /**
     * The bearing of the view in degrees.
     * @default 0
     */
    bearing?: number;
    /**
     * Has no effect, because the server render draws every view flat. A value other than 0 writes a warning.
     * @default 0
     */
    pitch?: number;
    /** A box `[west, south, east, north]` to fit into the view. It overrides `center` and `zoom`. */
    bounds?: LngLatBoundsInput;
    /**
     * Space in CSS pixels around `bounds` for the fit: one number, or `{top, right, bottom, left}`.
     * @default 0
     */
    padding?: PaddingInput;
    /**
     * The highest zoom of the fit to `bounds`, as `initialView.fitMaxZoom` of the description.
     * @default `maxZoom` of `renderFirstView`, else 22
     */
    fitMaxZoom?: number | null;
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
     * `renderToImage` always embeds them and does not take this option.
     * @default false
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
    sprite?: SpriteInput[];
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
function limitedFetch(o: RenderOptionsBase, fetchFn: typeof fetch): typeof fetch {
    const total = o.timeout ?? 30000, each = o.requestTimeout ?? 10000, max = o.maxBytes ?? 0;
    for (const [name, v] of [['timeout', total], ['requestTimeout', each], ['maxBytes', max]] as const)
        if (!(v >= 0)) throw new Error(`[map-jr-gl] E25 server render: "${name}" is ${v}. Pass a number that is 0 (no limit) or more.`);
    if (o.allowHosts && !(Array.isArray(o.allowHosts) && o.allowHosts.every(h => typeof h === 'string' && /^[^/:@\s]+$/.test(h))))
        throw new Error(`[map-jr-gl] E10025 server render: "allowHosts" is ${JSON.stringify(o.allowHosts)}. Pass a list of host names without a scheme, a port or a path, for example ["tiles.example.com"].`);
    const hosts = o.allowHosts?.map(h => h.toLowerCase());
    if (!total && !each && !max && !hosts) return fetchFn;
    const end = total ? Date.now() + total : Infinity;
    const check = (url: string) => {
        let host: string | undefined;
        try { host = new URL(url).hostname; } catch { /* not a complete URL: no host */ }
        if (hosts && (host === undefined || !hosts.includes(host))) throw new Error(`[map-jr-gl] E20025 server render: the host of ${url} is not in "allowHosts". Add "${host ?? ''}" to "allowHosts" if the render can request it.`);
    };
    return async (input, init) => {
        let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const first = url, ac = new AbortController(), left = end - Date.now(), whole = left < (each || Infinity);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<never>((_, reject) => {
            if (!whole && !each) return;
            timer = setTimeout(() => {
                reject(new Error(whole
                    ? `[map-jr-gl] E30025 server render: the requests took longer than the "timeout" of ${total} ms; the request to ${first} was not complete. Pass a larger "timeout", or 0 for no limit.`
                    : `[map-jr-gl] E40025 server render: the request to ${first} took longer than the "requestTimeout" of ${each} ms. Pass a larger "requestTimeout", or 0 for no limit.`));
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
                if (hop > 4) throw new Error(`[map-jr-gl] E50025 server render: the request to ${first} was redirected more than 5 times.`);
                void res.body?.cancel();
                url = new URL(to, url).href;
            }
            if (!res.body) return res;
            const large = () => new Error(`[map-jr-gl] E60025 server render: the response of ${first} is larger than "maxBytes" (${max} bytes). Pass a larger "maxBytes", or leave the source out of the style.`);
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

/** The center and the zoom that fit `bounds`, with `padding` around it, into a view of `width` by `height` CSS pixels, up to `maxZoom`. */
function fitBounds(bounds: LngLatBoundsInput, padding: PaddingInput | undefined, width: number, height: number, maxZoom = 22) {
    const p = sides(padding), b = (bounds as {toArray?(): unknown[]}).toArray?.() ?? bounds as unknown[];
    return fitBox(b.length > 2 ? b as number[] : [...toLngLat(b[0] as LngLatLike), ...toLngLat(b[1] as LngLatLike)], width, height, p, p, maxZoom);
}

// The warning about `pitch` is shown once per process; it holds no state of a map.
let warnedPitch = false;

/** `renderToSVG`, with the view that the SVG shows (`renderFirstView` needs it for the scale and the compass). */
async function renderView(o: RenderOptions, rootAttrs = 'data-map-jr-ssr="" style="position:absolute;inset:0;width:100%;height:100%"'): Promise<RenderResult & {view: {lat: number; zoom: number; bearing: number}}> {
    // Wrapped, not passed by reference: Cloudflare Workers reject calls to a detached global `fetch`.
    // Without a view, the render would be at an undefined center and zoom, with no message (#1640).
    if (!o.bounds && (o.center == null || o.zoom == null)) throw new Error(`[map-jr-gl] ${o.center == null && o.zoom == null ? 'E1640 server render: the options have no "center" and no "zoom"' : o.center == null ? 'E11640 server render: the options have "zoom" but no "center"' : 'E21640 server render: the options have "center" but no "zoom"'}, and no "bounds". Pass "center" and "zoom", for example center: [-74.0065, 40.7085], zoom: 14, or pass "bounds".`);
    if (o.pitch && !warnedPitch) { warnedPitch = true; console.warn(`[map-jr-gl] E2513 server render: the pitch is ${o.pitch}, and the server render draws the first view flat, as if the pitch were 0, until #395. The map in the browser uses the pitch. When that is intended, nothing needs to change.`); }
    // The size is written into the markup as it is: a string could add attributes, and NaN gives a size of NaN (#1668).
    for (const name of ['width', 'height'] as const) {
        const size: unknown = o[name];
        if (typeof size === 'number' && size > 0 && size < Infinity) continue;
        throw new Error(`[map-jr-gl] E1670 server render: "${name}" is ${typeof size === 'string' ? JSON.stringify(size) : String(size)}. Pass the ${name} in CSS pixels as a number greater than 0, for example ${name}: ${name === 'width' ? 800 : 500}.`);
    }
    const dz = o.tileZoomOffset ?? 0;
    if (!Number.isInteger(dz)) throw new Error(`[map-jr-gl] E985 tileZoomOffset: ${dz} is not a whole number. Write for example tileZoomOffset: 2 (tiles 2 zooms lower) or -1 (tiles 1 zoom higher), or leave it out for 0.`);
    const fetchFn = limitedFetch(o, o.fetch ?? ((...a) => fetch(...a)));
    // (`sources`, `layers` and `data` are added to the style. A style from a URL is fetched here, to add them to it and to read its images.)
    let given = styleFor(o.style, o.colorScheme === 'dark'), base: string | undefined;
    const adds = !!(o.sources || o.layers || o.terrain !== undefined || o.sprite?.length);
    if (typeof given === 'string') {
        const res = await fetchFn(base = given);
        if (!res.ok) throw httpError('style', given, res.status);
        given = await res.json();
    }
    // The same check and text as the map (E654, as E539 of the map); without it a style with no list "layers" fails with a TypeError.
    if (!Array.isArray((given as any)?.layers)) throw new Error('[map-jr-gl] E654 The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.');
    const full: any = withData(adds ? extended(given, o) : given, o.data, true, (id, type) => { throw dataTypeError(id, type); });
    const style = await resolveStyle(full, fetchFn, base);
    // A custom encoding with a factor that is not finite is read as `mapbox`, as in the map (E590 there), with one warning for each source.
    for (const [source, src] of Object.entries(style.sources)) {
        const bad = (e?: string | number[]) => typeof e == 'object' && !e.every(Number.isFinite);
        if (src.contour && bad(src.contour.encoding)) src.contour.encoding = 'mapbox';
        if (!bad(src.encoding)) continue;
        src.encoding = 'mapbox';
        console.warn(`[map-jr-gl] E10654 server render: the source "${source}": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).`);
    }
    const over = o.overrides;
    // (`false` also removes `map-jr:ssr` from the layers, because `compileLayer` reads `simplify` and `minSize` from it (#723).)
    style.layers = over === false ? style.layers.map(l => l.metadata?.[SSR_KEY] ? {...l, metadata: {...l.metadata, [SSR_KEY]: undefined}} : l)
        : applySSROverrides(over ? style.layers.map(l => over[l.id] ? {...l, metadata: {...l.metadata, [SSR_KEY]: {...(l.metadata?.[SSR_KEY] as object), ...over[l.id]}}} : l) : style.layers);
    if (o.layerFilter) style.layers = style.layers.filter(l => o.layerFilter!(l.id));
    // The description's global state over the style's defaults, and the color scheme as `color-scheme`, as the map sets them (#1426).
    const state: Record<string, unknown> = {...style.state};
    state['color-scheme'] = o.colorScheme === 'dark' ? 'dark' : 'light';
    for (const [k, v] of Object.entries(o.globalState ?? {})) if (v != null) state[k] = v;
    compileFor({g: state, f: {}});
    const layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
    const tr = new Transform();
    tr.width = o.width; tr.height = o.height;
    if (o.bounds) { const fit = fitBounds(o.bounds, o.padding, o.width, o.height, o.fitMaxZoom ?? (o as FirstViewOptionsBase).maxZoom ?? 22); tr.set(fit.center, fit.zoom, o.bearing ?? 0); }
    else tr.set(o.center!, o.zoom!, o.bearing ?? 0);

    const builder = new TileBuilder(fetchFn);
    builder.setStyle(style.layers, state);
    // The images of `images` that are SVG documents: the SVG and the size, and for a template its slots.
    // (The images of the style come first, and an image of `images` with the same name takes the place of one (#495).)
    const defined = Object.entries({...styleImages(given, message => console.warn(message)), ...o.images}).map(([name, v]) => [name, typeof v === 'string' ? {image: v} : v] as const);
    const documents = new Map(defined.filter(([, v]) => typeof v.image === 'string' && v.image.trimStart().startsWith('<')));
    // Every name that the style or `images` defines hides the sprite image of that name, also an image that is a URL or that is left
    // out, as in the map (#1300). An image that is a URL is drawn when a symbol layer names it and its size is known or it decodes.
    const owned = new Set([...defined.map(([name]) => name), ...(typeof (given as any)?.metadata?.[STYLE_IMAGES] === 'object' ? Object.keys((given as any).metadata[STYLE_IMAGES] ?? {}) : [])]);
    const linked = defined.filter(([name, v]) => typeof v.image === 'string' && !documents.has(name));
    builder.setTemplates(Object.fromEntries([...documents].map(([name, v]) => [name, templateSlots(v.image)] as const).filter(([, slots]) => slots.length)));
    builder.decodeImage = o.decodeImage ?? decodeImage;
    builder.setContours(Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!])), promoteIds(style));
    for (const [name, src] of Object.entries(style.sources)) if (src.type === 'geojson') builder.setGeoJSON(name, src.data, src.options, src.maxzoom);
    const items = new Map<string, RenderItem<TileIR | TileImage>[]>(), all: RenderItem<TileIR>[] = [], urls: string[] = [];
    const dataURI = async (url: string) => {
        const res = await fetchFn(url);
        if (!res.ok) throw httpError('image', url, res.status);
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
            loaded.set(id.key, await builder.loadIR({id: req++, source: name, url, at: [id.z, id.x, id.y], z: id.z, overscaled: (id.z >= maxzoom || dz < 0) && Math.floor(tr.zoom)}));
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
    const grid = new CollisionGrid(), images = new Map<string, {svg: string; width: number; height: number}>();
    const named = JSON.stringify(style.layers.filter(l => l.type === 'symbol').map(l => l.layout));
    for (const [imageName, v] of linked) if (named.includes(JSON.stringify(imageName))) jobs.push((async () => {
        try {
            let href = v.image, width = Number(v.width) || undefined, height = Number(v.height) || undefined;
            if (!width || !height || o.inlineImages) {
                href = await dataURI(v.image);
                if (!width || !height) {
                    const px = await builder.decodeImage!(Uint8Array.from(atob(href.slice(href.indexOf(',') + 1)), c => c.charCodeAt(0)));
                    width ??= px.width; height ??= px.height;
                }
                if (!o.inlineImages) href = v.image;
            }
            images.set(imageName, {svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="${escapeXML(href)}" width="${width}" height="${height}" preserveAspectRatio="none"/></svg>`, width: width!, height: height!});
        } catch (cause) {
            console.warn(`[map-jr-gl] E1300 the server render draws no image "${imageName}", because ${(cause as Error)?.message ?? cause}. The map loads it in the browser.`);
        }
    })());
    await Promise.all(jobs);

    const find = (name: string) => {
        // (An image of `images` or of the style takes the place of an image of the sprite with the same name.)
        const fromSprite = (sprite as Sprite | null)?.icons[name];
        if (fromSprite && !owned.has(name)) return fromSprite;
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
        rootAttrs,
        // Once for each layer and render: a server renders other styles in other calls, so no list of layers is kept between calls (#2434).
        skipped: (layerId, kind) => console.warn(`[map-jr-gl] E2434 server render: the layer "${layerId}" is not drawn, because the server render does not draw ${kind}. The map draws it in the browser. To leave it out of the server render without this warning, set overrides: {"${layerId}": {hidden: true}}.`),
    });
    // (The credits are those of `getAttributions` of the map: only the sources that a visible layer uses at this zoom, so that they do not change when the map takes over.)
    return {svg, tiles: urls, attribution: [...new Set(Object.entries(style.sources).filter(([id]) => layers.some(l => l.source === id && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)).map(([, s]) => s.attribution?.trim()).filter((a): a is string => !!a))], view: {lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing}};
}

/** The options of `renderFirstView`: those of `renderToSVG`, and the credits and the controls of the first view. */
export type FirstViewOptions = FirstViewOptionsBase & RenderView;

/** The members of `FirstViewOptions`, with `center` and `zoom` optional. `FirstViewOptions` adds that a view is required. */
export interface FirstViewOptionsBase extends RenderOptionsBase {
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
    /** The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the first view, as `nonce` of the description. Without it, the first view has `style` attributes. */
    nonce?: string | null;
    /** The limits of the zoom of the description, which disable a zoom button with `controls`. Without `fitMaxZoom`, `maxZoom` is the highest zoom of the fit to `bounds`. */
    minZoom?: number | null;
    maxZoom?: number | null;
    /** The projection of the description, which sets the state of the globe control. It has an effect with `controls`. */
    projection?: {type?: unknown} | null;
    /** The options of the attribution, as `attribution` of the description. They have an effect with `controls`. */
    attributionOptions?: AttributionOptions | null;
}

/** The result of `renderFirstView`. */
export interface FirstViewResult {
    /** The HTML of the first view: put it into the element of the map. */
    html: string;
    /** The URLs of the tiles of the view, as `tiles` of `RenderResult`. Write them as `<link rel="preload" as="fetch" crossorigin>` so that the browser loads them early. */
    tiles: string[];
}

/**
 * Renders the first view of a map as HTML for a page from a server: the SVG, with the credits over it. Put the HTML into
 * the element of the map; the map removes it when it has loaded the tiles of its first view, just before `load`.
 * With `controls`, the HTML also has the attribution and the controls of the map as static markup, with their style
 * sheet, in the positions and the look that the map gives them, so that the map takes over with no visible change.
 * @param o The options of `renderToSVG`. `attribution` sets the credits instead of those of the sources, and `false` shows none.
 * `colorScheme` sets the colors of the credits and the controls; `'auto'` follows the browser.
 * @returns A promise of the HTML and the URLs of the tiles. It rejects as `renderToSVG` does.
 */
export async function renderFirstView(o: FirstViewOptions): Promise<FirstViewResult> {
    // The map keeps the center and the zoom at any size of the element, so the picture is drawn at 1:1, centered and cropped
    // by a box of the element's size. An element that is wider or higher than the render is covered: the picture is scaled
    // up as little as covers it, and is not letterboxed (#1427). With `bounds` the map fits them to the element, so the
    // picture is scaled to the element as the fit is, and covers it.
    // With a `nonce` the sizes and positions are rules of a style sheet that carries it, and the markup has no `style` attribute, which
    // a Content Security Policy with `style-src 'nonce-…'` blocks (#466). Without a `nonce` they stay `style` attributes. A rule is named
    // by its content, so that two maps with different sizes on one page do not share a class.
    const sheet: string[] = [];
    const st = (key: string, css: string) => {
        if (!o.nonce) return `style="${css}"`;
        sheet.push(`.map-jr-ssr-${key}{${css}}`);
        return `class="map-jr-ssr-${key}"`;
    };
    const wh = `${o.width}x${o.height}`.replace(/\W/g, '_');
    const made = await renderView(o, `data-map-jr-ssr="" preserveAspectRatio="xMidYMid slice" ${st(o.bounds ? 'p' : 'p' + wh, `position:absolute;${o.bounds ? 'inset:0;width:100%;height:100%' : `left:50%;top:50%;width:max(100%,${o.width}px);height:max(100%,${o.height}px);transform:translate(-50%,-50%)`};max-width:none;max-height:none`)}`);
    made.svg = `<div data-map-jr-ssr="" ${st('w', 'position:absolute;inset:0;overflow:hidden')}>${made.svg}</div>`;
    const first = () => o.nonce ? `<style data-map-jr-ssr="" nonce="${escapeXML(o.nonce)}">${sheet.join('')}</style>` : '';
    const raw = o.attribution === false ? false : [o.attribution ?? made.attribution].flat();
    const {tiles} = made;
    if (o.controls) {
        return {tiles, html: first() + made.svg + controlsMarkup({controls: o.controls, ...made.view, width: o.width, colorScheme: o.colorScheme ?? 'light', locale: o.locale, nonce: o.nonce, minZoom: o.minZoom, maxZoom: o.maxZoom,
            projection: o.projection, terrain: !!o.terrain, credits: raw, attribution: o.attributionOptions})};
    }
    const credits = raw === false ? [] : raw.map(cleanCredits).filter(Boolean);
    const light = 'background:rgba(255,255,255,.75);color:#333', dark = 'background:rgba(30,30,30,.75);color:#ccc';
    const colors = o.colorScheme === 'dark' ? dark : o.colorScheme === 'auto' ? light + ';color-scheme:light dark;background:light-dark(rgba(255,255,255,.75),rgba(30,30,30,.75));color:light-dark(#333,#ccc)' : light;
    const box = credits.length ? `<div data-map-jr-ssr="" ${st(o.colorScheme === 'dark' ? 'cdark' : o.colorScheme === 'auto' ? 'cauto' : 'clight', `position:absolute;right:0;bottom:0;${colors};font:11px/1.4 sans-serif;padding:2px 6px`)}>${credits.join(' ')}</div>` : '';
    return {tiles, html: first() + made.svg + box};
}

/** The options of `renderElement`: those of `renderToSVG` that the description does not give, and the attributes of the element. */
export interface ElementRenderOptions extends Omit<RenderOptionsBase, 'style' | 'colorScheme' | 'globalState' | 'center' | 'zoom' | 'bearing' | 'pitch' | 'bounds' | 'padding' | 'fitMaxZoom' | 'width' | 'height' | 'images' | 'fontFamily' | 'sources' | 'layers' | 'sprite' | 'terrain' | 'data'> {
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
     * An entry whose name the element already has, from the description or from an earlier entry, is left out. Names are compared without letter case.
     */
    attributes?: Record<string, string>;
}

// The names that `renderElement` warned about, once per process; it holds no state of a map.
const warnedAttributes = new Set<string>();

/**
 * Turns a description into the options of `renderFirstView`, so that a page passes its description once:
 * `renderFirstView(firstViewOptions(description))`. The view, the style, the images, the sources, the layers, the data,
 * the controls and the other fields that the first view reads come from the description. The result is a plain object, so
 * a page can add or replace an option: `{...firstViewOptions(description), timeout: 3000}`.
 * @param description The description of the map, as for `createMap`. A field that is `null` counts as not set.
 * @param options What the description does not give: the size of the element (800 by 500 pixels when not set), the credits
 * to show, and the options of the render, such as `timeout` or `overrides`.
 */
export function firstViewOptions(description: MapDescription, options: DescriptionRenderOptions = {}): FirstViewOptions {
    if (!description || typeof description !== 'object' || Array.isArray(description)) throw new Error(`[map-jr-gl] E2358 firstViewOptions(): the description is missing or is not an object. Pass the description of the map, an object with a "style", for example firstViewOptions({style, initialView: {center: [0, 0], zoom: 2}}).`);
    const d = unset(description) as Given & Record<string, unknown>, view: Record<string, unknown> = {...d.initialView, ...d.view};
    const {width = 800, height = 500, attribution, ...rest} = options;
    // Like the map, a `view` takes the place of the `initialView`, bounds included.
    const fit = !d.view && d.initialView?.bounds;
    return {...rest, style: d.style as FirstViewOptions['style'], center: (view.center as LngLatLike) ?? [0, 0], zoom: (view.zoom as number) ?? 0, bearing: view.bearing as number, pitch: view.pitch as number,
        bounds: fit ? fit as LngLatBoundsInput : undefined, padding: d.initialView?.fitPadding, fitMaxZoom: d.initialView?.fitMaxZoom, width, height,
        images: d.images as RenderOptionsBase['images'], sources: d.sources, layers: d.layers as RenderOptionsBase['layers'], terrain: d.terrain, sprite: d.sprite, data: d.data, fontFamily: d.fontFamily,
        attribution: d.attribution === false ? false : attribution, colorScheme: d.colorScheme ?? 'light', globalState: d.globalState as Record<string, unknown> | null | undefined,
        controls: (d.controls ?? []) as ControlSpec[], locale: d.locale, label: rest.label ?? d.locale?.['Map.Title'], nonce: d.nonce, minZoom: d.minZoom, maxZoom: d.maxZoom, projection: d.projection as {type?: unknown} | null | undefined,
        attributionOptions: d.attribution === false ? undefined : d.attribution as AttributionOptions | undefined};
}

/** The options of `firstViewOptions`: those of `renderFirstView` that the description does not give. */
export type DescriptionRenderOptions = Omit<ElementRenderOptions, 'attributes'>;

/**
 * Renders the element `<map-jr>` of `@map-jr/map-jr-gl/element` for a description, with the first view as its content.
 * A field that has an attribute of `<map-jr>` and a value that is not an object, such as `zoom` or the URL of a style,
 * becomes that attribute. Set the other fields, such as `layers`, `data` or a style object, as properties of the element in the page, with the same values.
 * @returns A promise of the HTML. When the render fails, the element has no first view and the error is written to the console.
 */
export async function renderElement(description: MapDescription, options: ElementRenderOptions = {}): Promise<string> {
    const d = unset(description) as Given & Record<string, unknown>, quote = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const view: Record<string, unknown> = {...d.initialView, ...d.view}, attrs: string[] = [];
    const {attributes = {}, width = 800, height = 500, attribution, ...rest} = options;
    // The element has no attribute for `bounds`: it gets the center and the zoom of the fit, and the first view shows them (#1669).
    // (The map fits up to `fitMaxZoom`, else up to `maxZoom`. Bounds that cannot be read go to the render, which reports them.)
    let fit: unknown = !d.view && d.initialView?.bounds;
    if (fit) try { const {center, zoom} = fitBounds(fit as LngLatBoundsInput, d.initialView?.fitPadding, width, height, d.initialView?.fitMaxZoom ?? d.maxZoom ?? 22); Object.assign(view, {center: [center.lng, center.lat], zoom}); fit = undefined; } catch { /* see above */ }
    for (const [field, kind] of Object.entries(ATTRIBUTES)) {
        const v = VIEW_FIELDS.includes(field) ? view[field] : field === 'projection' ? (d.projection as {type?: string} | null)?.type
            : field === 'attributionCompact' ? (d.attribution as {compact?: boolean} | undefined)?.compact : d[field];
        const text = kind === 'o' ? (v === false ? '' : undefined) : v === undefined || v === null || v === false || typeof v === 'object' && !Array.isArray(v) ? undefined
            : kind === 'b' || v === true ? '' : Array.isArray(v) ? v.join(kind === 'l' ? ' ' : ',') : String(v);
        if (text !== undefined && readAttribute(kind, text) !== undefined) attrs.push(text ? `${attributeOf(field)}="${quote(text)}"` : attributeOf(field));
    }
    if (d.nonce) attrs.push(`nonce="${quote(d.nonce)}"`);
    let extra = '';
    for (const name in attributes) {
        if (!/^[a-z_:][\w:.-]*$/i.test(name) || /^on/i.test(name)) throw new Error(/^on/i.test(name) ? `[map-jr-gl] E50826 renderElement(): "${name}" is not the name of an attribute that the element can have: an event handler attribute runs script. Give names such as "id", "class" or "style".` : `[map-jr-gl] E30826 renderElement(): "${name}" is not the name of an attribute. Give names such as "id", "class" or "style".`);
        // (Names of attributes are not case sensitive: `Style` and `style` are one attribute, and a browser ignores the second.)
        // (An attribute that the description already writes, or that an earlier entry wrote, keeps its first value: a browser ignores the second one (#2404).)
        const lower = name.toLowerCase(), attribute = name;
        if (lower === 'style') extra += ';' + attributes[name]; else if (!attrs.some(a => a.split(/[=\s]/, 1)[0].toLowerCase() === lower)) attrs.push(`${name}="${quote(attributes[name])}"`);
        else if (!warnedAttributes.has(lower)) { warnedAttributes.add(lower); console.warn(`[map-jr-gl] E2404 renderElement(): attributes.${attribute} is dropped, because the element already has the attribute "${lower}" from the description or from an earlier entry. Remove it from attributes or change the description.`); }
    }
    attrs.push(`style="${quote('display:block;position:relative;overflow:hidden' + extra)}"`);
    let first = '';
    try {
        // (The options come from the description; the center, the zoom and the bounds are those that this function worked out above.)
        first = (await renderFirstView({...firstViewOptions(d, {...rest, width, height, attribution}), center: (view.center as LngLatLike) ?? [0, 0], zoom: (view.zoom as number) ?? 0, bounds: fit ? fit as LngLatBoundsInput : undefined})).html;
    } catch (cause) {
        console.error(`[map-jr-gl] E40826 renderElement(): the server render failed, and the element has no first view. The map draws in the browser. The cause: ${(cause as Error)?.message ?? cause}`);
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
/**
 * The options of `renderToImage`: those of `renderToSVG` except `inlineImages`, and the options of the image.
 * `renderToImage` always embeds images, because the rasterizer cannot load linked ones.
 */
export type ImageOptions = ImageOptionsBase & RenderView;

/** The members of `ImageOptions`, with `center` and `zoom` optional. `ImageOptions` adds that a view is required. */
export interface ImageOptionsBase extends Omit<RenderOptionsBase, 'inlineImages'> {
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

// The warning about `inlineImages` in `renderToImage` is shown once per process; it holds no state of a map.
let warnedInline = false;
/**
 * Renders the first frame of a map as a raster image, whose size does not depend on how dense the data is.
 * @returns A promise of the image. It rejects as `renderToSVG` does.
 */
export async function renderToImage(o: ImageOptions): Promise<ImageResult> {
    if ('inlineImages' in o && !warnedInline) {
        warnedInline = true;
        console.warn('[map-jr-gl] E1582 renderToImage(): "inlineImages" has no effect, because the image always embeds raster tiles and icons. Remove "inlineImages".');
    }
    const {svg, tiles} = await renderToSVG({highDensity: (o.pixelRatio ?? 1) > 1, ...o, inlineImages: true});
    const format = o.format ?? 'jpeg', ratio = o.pixelRatio ?? 1;
    const plain = svg.replace(/ data-map-jr-ssr="" style="[^"]*"/, '');
    const image = await o.rasteriser.render(`<div style="display:flex;width:${o.width}px;height:${o.height}px">${plain}</div>`, {
        width: o.width * ratio, height: o.height * ratio, format, devicePixelRatio: ratio, // output size is in device pixels
        ...(format === 'png' ? {} : {quality: o.quality ?? 75}),
    });
    return {image, contentType: 'image/' + format, tiles};
}

