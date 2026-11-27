import earcut from 'earcut';
export {earcut};
import {EXTENT} from './geo.ts';
import {decodeVectorTile} from './mvt.ts';
import {GEOJSON_LAYER} from './geojson.ts';
import {fontKey, type CompiledLayer} from './style.ts';
import {IMAGE_CLOSE, IMAGE_IN_TEXT, IMAGE_OPEN, IMAGE_OR, warnOnce, type Feature, type MapStates, type Prop, type RGBA} from './expr.ts';
import {VARIANT, variantName} from './markers.ts';

/**
 * Renderer-neutral tile geometry: flat rings in tile units plus per-feature paint values.
 * The SVG backend turns this straight into paths; `tessellate` turns it into GPU buffers.
 */
export interface Geom {
    /** In tile units, or in halves of a tile unit when `half` is set (lines, see `tessellateLine`). */
    coords: Int16Array | Float32Array;
    /** The coordinates are halves of a tile unit (the batches of lines), clamped to int16. */
    half?: boolean;
    /** Cumulative point count at the end of each ring. */
    ringEnds: Uint32Array;
    /** Cumulative ring count at the end of each feature. */
    featEnds: Uint32Array;
}
export interface Batch {
    type: 'fill' | 'line' | 'circle';
    geom: Geom;
    /** Per-feature straight-alpha RGBA, present only when color or opacity is data-driven. */
    color?: Uint8Array;
    width?: Float32Array;
    radius?: Float32Array;
    /** The width or radius one zoom level further in, present when it is different: the size then changes smoothly with zoom. */
    width1?: Float32Array;
    radius1?: Float32Array;
    /** `line-offset` for each feature (pixels), present only when it is data-driven. */
    offset?: Float32Array;
    /** Circles: straight-alpha RGBA of `circle-stroke-color` times `circle-stroke-opacity` for each feature, present only when one of them is data-driven. */
    stroke?: Uint8Array;
    /**
     * Circles: `circle-stroke-width` and `circle-blur` for each feature, present only when one of them is data-driven (0 for
     * the one that is not). Heatmaps: `heatmap-radius` and its change to the next zoom, present only when it is data-driven.
     */
    sb?: Float32Array;
    /**
     * Numbers of each feature that only some layers need, present when one of them is not 0 for some feature. For a line:
     * `line-blur` and `line-gap-width` in pixels (bits 1 and 2 of `featMask`), and how much `line-offset`, `line-blur`
     * and `line-gap-width` change from the zoom of the tile to the next (bits 4, 8 and 16). For a circle: how much
     * `circle-stroke-width` and `circle-blur` change to the next zoom (bits 1 and 2). Each feature has one number for
     * each bit of `featMask`, in the order of the bits, so that a property that is not needed takes no memory. The
     * shader adds `u_zt` times a change, as `width1` does for `line-width`, and a number that is not here reads 0.
     */
    feat?: Float32Array;
    /** See `feat`. */
    featMask?: number;
    /** Circles: `stroke` at the next zoom, present only when it changes; the shader mixes the two by `u_zt`. */
    stroke1?: Uint8Array;
    /** Lines whose `line-width`, `line-gap-width` or `line-offset` depends on the feature: the largest of each in pixels (the offset without its sign), for the choice of tiles of a query (`QuerySet.most`). */
    most?: number[];
    /** Lines with a gradient: for each feature, how far along the whole line it starts and ends (0 to 1). */
    progress?: Float32Array;
    cap?: string;
    join?: string;
    /** `line-miter-limit` and `line-round-limit`: the longest miter (in line widths) drawn as a miter or kept sharp instead of rounded. */
    miterLimit?: number;
    roundLimit?: number;
    /** Lines: how far from a sharp corner (tile units) each segment gets one more pair of vertices (see `tessellateLine`). */
    sharp?: number;
    /** Fill layers with an explicit outline color. */
    outline?: boolean;
    /** False when the style turns edge smoothing off for a fill layer. */
    antialias?: boolean;
    /** Building extrusions: per-feature top and bottom heights in meters. */
    height?: Float32Array;
    base?: Float32Array;
    /** The height and the base are the same for the whole layer: the page draws them at the zoom of the map, so that they transition (#972). The batch has height 1 and base 0. */
    lift?: boolean;
    /** Building extrusions with fill-extrusion-pattern: the walls carry the distance along their ring, for the image. */
    ed?: boolean;
    /** A pattern with a value for each feature: the image of the features of this batch (see `patternKey`). */
    pat?: string;
    /** The points of a heatmap layer. */
    heat?: boolean;
}
/** The key of the batch of a layer for its `k`th image, when its pattern has a value for each feature: one batch for each image. */
export const patternKey = (id: string, k: number) => k ? id + '\0' + k : id;
/** The most batches of one image after another that a layer with a sort key and a pattern for each feature has in a tile (#1445). */
export const MAX_RUNS = 64;
export interface LabelSrc {
    x: number; y: number; text: string;
    /** `symbol-sort-key`, when the layer has one. */
    key?: number;
    /** Direction of the line at the anchor in tile space (radians), or null for point labels. */
    angle: number | null;
    /** Length of the line the label sits on, in tile units. */
    len: number;
    /** For text that follows a line: the nearby stretch of line as flat tile coordinates, and which of its points is the anchor. */
    path?: number[];
    pathIndex?: number;
    /** `symbol-placement: line`: the whole line in tile units. The map finds the anchors along it when it places the
     * labels (see `lineLabels`), where the width of the text and of the icon is known; `x` and `y` are its first point. */
    line?: number[];
    /** With `line`: `symbol-spacing` in tile units, tile units per pixel, the over-scaling of the tile, the stretch of line kept for curved text, and the zoom of the tile. */
    lineSpacing?: number; tpr?: number; ov?: number; window?: number; tz?: number;
    size0: number; size1: number; color: RGBA; halo: RGBA; haloWidth: number; haloBlur: number;
    /** `text-opacity` when it has a value for each feature, else 1. It is in `color` and `halo` too; the page multiplies a color of the layer by it. */
    op: number;
    /** How the lines of a multi-line label align with each other: -1 left, 0 center, 1 right. */
    justify: number;
    /** `text-rotate`, in radians clockwise. */
    rotate: number;
    /** Line height in ems, and a fixed shift on screen in pixels. */
    lineHeight: number;
    font: string; maxWidth: number; spacing: number; offset: [number, number]; anchor: string; padding: number; overlap: boolean;
    /** Text stays upright instead of following the line it is placed on (e.g. road shields). */
    upright: boolean;
    /** The text lies flat on the ground of a tilted map (`text-pitch-alignment`). */
    flat: boolean;
    /** `text-keep-upright`: text along a line turns over when it would read upside down. */
    keepUpright: boolean;
    textOptional: boolean; ignore: boolean; varAnchor: string[] | null; radial: number;
    /** `text-variable-anchor-offset`: anchors to try in turn, each with its own offset in ems. */
    varOffset: (string | [number, number])[] | null;
    /** Text along a line: the largest turn between two characters, in degrees (`text-max-angle`). */
    maxAngle: number;
    /** `text-justify: auto`: lines align towards whichever anchor the label ends up with. */
    justifyAuto: boolean;
    icon?: {
        name: string; size: number; /** Size at the next zoom level, to interpolate towards. */ size1: number; offset: [number, number]; rotate: number; fit: string; fitPad: [number, number, number, number];
        opacity: number; anchor: string; color: RGBA; /** Distance-field icons: an outline in this color, this many pixels wide, blurred over this many pixels. */ halo: RGBA; haloWidth: number; haloBlur: number; ignore: boolean; /** `icon-padding`: top, right, bottom, left. */ padding: [number, number, number, number];
        overlap: boolean; optional: boolean; upright: boolean; /** `icon-pitch-alignment` */ flat: boolean; /** `icon-keep-upright` */ keepUpright: boolean;
    };
}
/**
 * The icons of a symbol layer that are always shown: no text, at a point, with `icon-allow-overlap`. They need no
 * place among the labels, so the GPU has them in a buffer of the tile, and a frame costs the same for ten of them and
 * for 100,000.
 */
export interface IconBatch {
    /** The names of the images, each one time. */
    names: string[];
    /** For each icon: the index of its image in `names`. */
    name: Uint32Array;
    /** For each icon: x and y in tile units. */
    pos: Float32Array;
    /** Present when the property has a value for each feature: `icon-rotate` in radians; `icon-size` at the zoom of the tile and at the next; `icon-opacity`. */
    rotate?: Float32Array; size?: Float32Array; alpha?: Float32Array;
    /** Labels keep away from these icons (`icon-ignore-placement` is not set): the map gives each one its space when it places the labels. */
    avoid?: boolean;
}
/** `z`: the zoom that the sizes of the tile were found at, when it is not the zoom of the tile (see `buildTile`). */
export interface TileIR { layers: Record<string, Batch>; labels: Record<string, LabelSrc[]>; icons?: Record<string, IconBatch>; z?: number; /** When the fetched tile is out of date, and its `ETag` (see `TileFetchState`). */ expires?: number; etag?: string }

export type GLBatch = {/** See `Batch.pat`. */ pat?: string} & (
    | {type: 'fill'; pos: Int16Array; idx: Uint32Array; color?: Uint8Array; /** Polygon edges as vertex index pairs, drawn as one-pixel antialiased lines. */ edges?: Uint32Array}
    | {type: 'extrusion'; v: Float32Array; idx: Uint32Array; color?: Uint8Array; /** Distance along the ring per vertex, for a pattern. */ ed?: Float32Array; /** See `Batch.lift`. */ lift?: boolean; /** The centroid of each vertex's polygon, in tile units: on 3D terrain the ground under it lifts the polygon. */ c: Int16Array}
    | {type: 'line'; /** Packed vertices, LINE_VERTEX bytes each: see tessellateLine. */ v: Uint8Array; idx: Uint32Array; color?: Uint8Array; width?: Float32Array; width1?: Float32Array; /** See `Batch.feat`, for each vertex. */ feat?: Float32Array; featMask?: number; /** See `Batch.most`. */ most?: number[]}
    | {type: 'circle'; /** x, y, cornerX, cornerY per vertex */ pos: Int16Array; idx: Uint32Array; color?: Uint8Array; radius?: Float32Array; radius1?: Float32Array; /** Each point is a grid of 4 × 4 corners, in sevenths (see `tessellate`). */ grid?: boolean; /** See `Batch.stroke`, `Batch.sb`, `Batch.feat` and `Batch.stroke1`, for each vertex. */ stroke?: Uint8Array; sb?: Float32Array; feat?: Float32Array; featMask?: number; stroke1?: Uint8Array});
export interface TileGL { layers: Record<string, GLBatch>; labels: Record<string, LabelSrc[]>; icons?: Record<string, IconBatch>; z?: number; expires?: number; etag?: string;
    /** A part that the tile could not use (the cut for the globe): the message of its failure. */ fault?: string }
/** A raster tile as the SVG backend sees it: just somewhere to load the image from. */
export interface TileImage { href: string }

function pushColor(out: number[], c: RGBA, alpha: number) {
    out.push(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * alpha * 255));
}

const WHITE: RGBA = [1, 1, 1, 1];

/** A decoded tile: named layers of features. Vector tiles and sliced GeoJSON both take this shape. */
export type TileLayers = Record<string, {features: TileFeature[]}>;
export interface TileFeature extends Feature { /** See `SlicedFeature`. */ index?: number; geometry(extent: number, coords: number[], ringEnds: number[]): number }

export function buildTile(data: Uint8Array | TileLayers, tz: number, layers: CompiledLayer[], overscaled: number | false, states?: MapStates['f'], templates?: Record<string, string[]>, /** Icons that need no place among the labels go to `icons` (see `IconBatch`). */ direct?: boolean): TileIR {
    const vt: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data;
    const geomCache = new Map<TileFeature, {coords: number[]; ringEnds: number[]}>();
    const geometry = (f: TileFeature) => {
        let g = geomCache.get(f);
        if (!g) { g = {coords: [], ringEnds: []}; f.geometry(EXTENT, g.coords, g.ringEnds); geomCache.set(f, g); }
        return g;
    };
    // A size is found at this zoom and at the next, and the map mixes the two. A tile that is built for the zoom of the
    // map (see `buildZoom` in the engine) has the correct size already. A tile of the deepest level that is shown at a
    // higher zoom finds its sizes at that zoom (`zs`), because the zoom part of a size that also reads the feature
    // continues past the level of the tile.
    // (An `overscaled` below the zoom of the tile comes from the server with `tileZoomOffset` < 0: the style is evaluated at that zoom, the zoom of the render.)
    const under = overscaled !== false && overscaled < tz, z = under ? overscaled : tz;
    const zs = overscaled && overscaled > z ? overscaled : z, z1 = zs % 1 ? zs : zs + 1;
    const out: TileIR = {layers: {}, labels: {}, z: zs};
    // The over-scaling of MapLibre GL JS: a tile shown deeper than its own zoom has its pixels that many times smaller.
    const ov = zs > tz ? 2 ** Math.max(0, Math.floor(zs) - tz) : 1;
    // A filter and each property see the zoom that the sizes are found at, as in MapLibre GL JS (the over-zoomed zoom of
    // the tile, #994).
    const ctx = {zoom: zs, f: null as Feature | null};

    for (const L of layers) {
        if (L.type === 'background' || !L.visible && !L.keep) continue;
        // A tile is drawn from its own zoom up to the next one. A tile of the source's deepest level is drawn further: it has
        // all the shapes, and the labels of the layers that show up to one level above the zoom of the map.
        if (L.minzoom >= (overscaled === false || under ? z + 1 : L.type === 'symbol' ? overscaled + 2 : 99)) continue;
        // (The `maxzoom` of a layer is checked at the zoom of the tile, not at the over-zoomed zoom: the map hides the layer
        // by its own zoom, and a tile built at zoom 16 is shown at 15.5 until it is built again, #994.)
        if (L.maxzoom <= z) continue;
        const vl = vt[L.sourceLayer ?? GEOJSON_LAYER];
        if (!vl) continue;
        const p = L.p;

        if (L.type === 'symbol') {
            const labels: LabelSrc[] = [], keys: number[] = [], sorted = p.sortKey.dd || p.sortKey.eval(zs) !== 0;
            type Piece = {base: any; ring: number[]; type: number; along: boolean | 'center'; spacing: number; key: number};
            const pieces: Piece[] = [], starts = new Map<string, Piece>(), ends = new Map<string, Piece>();
            // (The icons of `IconBatch`. The layer gives them one anchor, offset, alignment and color, and no order.)
            const plain = direct && !sorted && !p.iconAnchor.dd && !p.iconOffset.dd && !p.iconAlign.dd && !p.iconPitch.dd && p.iconPitch.eval(zs) !== 'map' && !(p.iconPitch.eval(zs) === 'auto' && p.iconAlign.eval(zs) === 'map') && !p.iconColor.dd && !p.iconPadding.dd;
            const iconNames = new Map<string, number>(), iconName: number[] = [], iconPos: number[] = [], iconRotate: number[] = [], iconSize: number[] = [], iconAlpha: number[] = [];
            let iconAvoid: boolean | undefined;
            for (const f of vl.features) {
                ctx.f = f;
                f.state = f.id === undefined ? undefined : states?.[L.source!]?.[`${L.sourceLayer ?? ''}|${f.id}`];
                if (L.filter && !L.filter(ctx)) continue;
                // A `{name}` token stands for a property of the feature only in a constant and in a zoom function, as in
                // MapLibre GL JS. The result of a property function or of an expression keeps its braces.
                const tokens = (q: Prop, x: unknown) => { const v = String(x ?? ''); return (q.tokens ? v.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : v).trim(); };
                let text = tokens(p.field, p.field.eval(zs, f));
                // An image that is an SVG template: the name gets the value of each slot of the template, from `params` of
                // the `image` expression, or else from the property of the feature that has the name of the slot.
                // (`coalesce` gives several names: each one is made in this way.)
                const icon = String(p.icon.eval(zs, f) ?? ''), iconName = icon.split(IMAGE_OR).map(n => variantName(n.includes(VARIANT) ? n : tokens(p.icon, n), templates, f.properties)).join(IMAGE_OR);
                // (The same for the images inside `format` text.)
                if (templates && text.includes(IMAGE_OPEN)) text = text.replace(IMAGE_IN_TEXT, (_, n) => IMAGE_OPEN + variantName(n, templates, f.properties) + IMAGE_CLOSE);
                if (!text && !iconName) continue;
                const tt = p.transform.eval(zs, f);
                if (tt === 'uppercase' || tt === 'lowercase') {
                    // (Image names inside the text are left as they are.)
                    const change = (t: string) => tt === 'uppercase' ? t.toUpperCase() : t.toLowerCase();
                    text = text.split(/(\uE000[^\uE001]*\uE001)/).map((part, i) => i % 2 ? part : change(part)).join('');
                }
                // An opacity or a size that is the same for the whole layer is found again when labels are placed, at the zoom
                // of the map: a tile is shown at zooms other than its own. Only a value for each feature is kept here.
                const color = p.color.eval(zs, f) as RGBA, op = p.opacity.dd ? p.opacity.eval(zs, f) : 1, haloColor = p.haloColor.eval(zs, f) as RGBA;
                const placement = p.placement.eval(zs, f), along = placement !== 'point';
                // `text-rotation-alignment` and `icon-rotation-alignment`: `auto` is `map` along a line and `viewport` at a point.
                // (The flag is named for the usual case at a point: the symbol stays upright when the map turns.)
                const turns = (alignment: unknown) => along ? alignment === 'viewport' : alignment !== 'map';
                // `text-pitch-alignment` and `icon-pitch-alignment`: `auto` follows the rotation alignment.
                const flat = (pitch: unknown, alignment: unknown) => pitch === 'map' || (pitch !== 'viewport' && !turns(alignment));
                const base = {
                    text, size0: p.size.eval(zs, f), size1: p.size.eval(z1, f), op,
                    color: [color[0], color[1], color[2], color[3] * op] as RGBA,
                    halo: [haloColor[0], haloColor[1], haloColor[2], haloColor[3] * op] as RGBA, haloWidth: p.haloWidth.eval(zs, f), haloBlur: p.haloBlur.eval(zs, f), rotate: p.rotate.eval(zs, f) * Math.PI / 180, justify: justification(p.justify.eval(zs, f), p.anchor.eval(zs, f)), font: fontKey(p.font.eval(zs, f)),
                    maxWidth: p.maxWidth.eval(zs, f), spacing: p.spacing.eval(zs, f), offset: p.offset.eval(zs, f), anchor: p.anchor.eval(zs, f),
                    padding: p.padding.eval(zs, f), overlap: overlaps(p.overlapMode.eval(zs, f), p.overlap.eval(zs, f)), lineHeight: p.lineHeight.eval(zs, f),
                    upright: turns(p.textAlign.eval(zs, f)), flat: flat(p.textPitch.eval(zs, f), p.textAlign.eval(zs, f)), keepUpright: p.keepUpright.eval(zs, f) !== false, textOptional: !!p.textOptional.eval(zs, f), ignore: !!p.ignore.eval(zs, f),
                    varAnchor: p.varAnchor.eval(zs, f), radial: p.radial.eval(zs, f), varOffset: p.varOffset.eval(zs, f), maxAngle: p.maxAngle.eval(zs, f), justifyAuto: p.justify.eval(zs, f) === 'auto',
                    icon: iconName ? {
                        name: iconName, size: p.iconSize.eval(zs, f), size1: p.iconSize.eval(z1, f), opacity: p.iconOpacity.dd ? p.iconOpacity.eval(zs, f) : 1, anchor: p.iconAnchor.eval(zs, f), color: p.iconColor.eval(zs, f), halo: p.iconHalo.eval(zs, f), haloWidth: p.iconHaloWidth.eval(zs, f), haloBlur: p.iconHaloBlur.eval(zs, f), offset: p.iconOffset.eval(zs, f), rotate: p.iconRotate.eval(zs, f),
                        fit: p.iconFit.eval(zs, f), fitPad: p.iconFitPad.eval(zs, f), overlap: overlaps(p.iconOverlapMode.eval(zs, f), p.iconOverlap.eval(zs, f)), ignore: !!p.iconIgnore.eval(zs, f), padding: p.iconPadding.eval(zs, f),
                        optional: !!p.iconOptional.eval(zs, f), upright: turns(p.iconAlign.eval(zs, f)), flat: flat(p.iconPitch.eval(zs, f), p.iconAlign.eval(zs, f)), keepUpright: p.iconKeepUpright.eval(zs, f) === true,
                    } : undefined,
                };
                // symbol-spacing is in pixels; tiles are EXTENT units across TILE_SIZE pixels.
                const g = geometry(f), spacing = p.symbolSpacing.eval(zs, f) * EXTENT / 512 * 2 ** (tz - z), key = sorted ? +p.sortKey.eval(zs, f) || 0 : 0;
                let start = 0;
                for (const end of g.ringEnds) {
                    const piece: Piece = {base, ring: g.coords.slice(start * 2, end * 2), type: f.type, along: along && (placement === 'line' || 'center'), spacing, key};
                    pieces.push(piece);
                    // A road often comes as several short lines, each too short for its name. As in MapLibre, lines with
                    // the same text that meet end to end are joined to one line before the labels are made.
                    if (placement === 'line' && text && f.type === 2 && piece.ring.length > 3) {
                        const r = piece.ring, n = r.length, from = `${text}|${r[0]},${r[1]}`, to = `${text}|${r[n - 2]},${r[n - 1]}`;
                        const before = ends.get(from), after = starts.get(to);
                        if (before && after && before !== after) {
                            before.ring = before.ring.concat(r.slice(2), after.ring.slice(2));
                            ends.delete(from); starts.delete(to);
                            const an = after.ring.length;
                            ends.set(`${text}|${after.ring[an - 2]},${after.ring[an - 1]}`, before);
                            piece.ring = after.ring = [];
                        } else if (before) {
                            before.ring = before.ring.concat(r.slice(2));
                            ends.delete(from); ends.set(to, before);
                            piece.ring = [];
                        } else if (after) {
                            after.ring = r.concat(after.ring.slice(2));
                            starts.delete(to); starts.set(from, after);
                            piece.ring = [];
                        } else { starts.set(from, piece); ends.set(to, piece); }
                    }
                    start = end;
                    if (f.type === 3 && !along) break; // one label per polygon: outer ring only
                }
            }
            for (const {base, ring, type, along, spacing, key} of pieces) {
                if (!ring.length) continue; // joined to another line
                const text = base.text;
                // Enough line either side of the anchor to lay the text along it at this tile's own zoom (8 tile units per pixel).
                const window = along && text && !base.upright ? text.length * Math.max(base.size0, base.size1) * 0.7 * 8 * 0.6 + 200 : 0;
                if (along === true && type !== 1) {
                    // (The anchors along the line are found when the labels are placed: see `lineLabels`.)
                    const label: LabelSrc = Object.assign(Object.create(base), {x: ring[0], y: ring[1], angle: 0, len: 0, line: ring, lineSpacing: spacing / ov, tpr: EXTENT / 512 * 2 ** (tz - z) / ov, ov, window: window / ov, tz});
                    labels.push(label);
                    if (sorted) keys.push(label.key = key);
                    continue;
                }
                // (The path of text along the line keeps `1 / ov` of a unit in an over-zoomed tile, as `lineLabels` does.)
                for (const a of anchors(ring, 0, ring.length / 2, type, !!along, window, along ? [] : null, ov)) {
                    if (a[0] < 0 || a[0] >= EXTENT || a[1] < 0 || a[1] >= EXTENT) continue;
                    // Everything a feature's labels have in common lives on a shared object behind each label, so a
                    // road with twenty anchors does not carry twenty copies of its text, colors and fonts.
                    const ic = base.icon;
                    if (plain && ic && !text && !along && ic.overlap && ic.fit === 'none' && !(ic.haloWidth > 0 && ic.halo[3] > 0) && (iconAvoid ??= !ic.ignore) === !ic.ignore) {
                        let n = iconNames.get(ic.name);
                        if (n === undefined) iconNames.set(ic.name, n = iconNames.size);
                        iconName.push(n); iconPos.push(a[0], a[1]); iconRotate.push(ic.rotate * Math.PI / 180); iconSize.push(ic.size, ic.size1); iconAlpha.push(ic.opacity);
                        continue;
                    }
                    const label: LabelSrc = Object.assign(Object.create(base), {x: a[0], y: a[1], angle: along ? a[2] : null, len: a[3]});
                    if (a.length > 4) { label.pathIndex = a[4]; label.path = a.slice(5); }
                    labels.push(label);
                    if (sorted) keys.push(label.key = key);
                }
            }
            // symbol-sort-key: lower keys are placed first, so they win when labels compete for space.
            if (iconName.length) (out.icons ??= {})[L.id] = {names: [...iconNames.keys()], name: Uint32Array.from(iconName), pos: Float32Array.from(iconPos),
                rotate: p.iconRotate.dd ? Float32Array.from(iconRotate) : undefined, size: p.iconSize.dd ? Float32Array.from(iconSize) : undefined, alpha: p.iconOpacity.dd ? Float32Array.from(iconAlpha) : undefined, avoid: iconAvoid};
            if (sorted) { const order = labels.map((_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b); out.labels[L.id] = order.map(i => labels[i]); continue; }
            if (labels.length) out.labels[L.id] = labels;
            continue;
        }

        // A heatmap is made of the same points as a circle layer; each carries a weight where a circle carries a radius.
        const extrude = L.type === 'fill-extrusion', heat = L.type === 'heatmap', kind = extrude ? 'fill' : heat ? 'circle' : L.type;
        // A sort key puts the features of the layer in order: larger keys are drawn later, above the others.
        let features = vl.features;
        const sortKey = (L.type === 'fill' || L.type === 'line' || L.type === 'circle') && p.sortKey.dd ? p.sortKey : null;
        if (sortKey) {
            const keyed: {f: (typeof features)[number]; key: number; i: number}[] = [];
            for (let i = 0; i < features.length; i++) keyed.push({f: features[i], key: +sortKey.eval(zs, features[i]) || 0, i});
            features = keyed.sort((a, b) => a.key - b.key || a.i - b.i).map(k => k.f);
        }
        // fill-pattern, line-pattern and fill-extrusion-pattern with a value for each feature: the features of each image
        // are a batch of their own, drawn with that image (a feature with no image is not drawn, as in MapLibre GL JS).
        // With a sort key, each run of features with the same image is a batch, so that the batches keep the order of the key.
        // Each batch is a draw call in each frame, so above MAX_RUNS runs in a tile the features of each image are one batch
        // again, and the key orders them only within the image (#1445).
        let groups: [string, typeof features][] = [];
        const byName = new Map<string, typeof features>();
        if ((L.type === 'fill' || L.type === 'line' || extrude) && p.pattern.dd) {
            for (const f of features) {
                ctx.f = f;
                const name = String(p.pattern.eval(zs, f) ?? ''), last = groups[groups.length - 1];
                if (!name) continue;
                byName.get(name)?.push(f) ?? byName.set(name, [f]);
                if (sortKey) last?.[0] === name ? last[1].push(f) : groups.push([name, [f]]);
            }
            if (groups.length > MAX_RUNS) warnOnce(`E2040 layer "${L.id}": in the order of "${L.type}-sort-key", the features of a tile form more than ${MAX_RUNS} runs with the same "${L.type}-pattern", so the key orders the features only within each image. Give the features of one image keys next to each other, or make a layer for each image.`);
            if (!sortKey || groups.length > MAX_RUNS) groups = [...byName];
        } else groups.push(['', features]);
        let k = 0;
        for (const [pat, fs] of groups) {
            const heights: number[] = [], bases: number[] = [], lift = extrude && !p.height.dd && !p.base.dd;
            const want = kind === 'fill' ? 3 : kind === 'circle' ? 1 : 0;
            const coords: number[] = [], ringEnds: number[] = [], featEnds: number[] = [];
            const ddColor = p.color.dd || p.opacity.dd;
            const color: number[] = [], scalar: number[] = [], scalar1: number[] = [], offset: number[] = [], stroke: number[] = [], sb: number[] = [];
            const circle = L.type === 'circle', ddStroke = circle && (p.strokeColor.dd || p.strokeOpacity.dd), ddSb = circle ? p.strokeWidth.dd || p.blur.dd : heat && p.radius.dd;
            // The numbers of `Batch.feat`: `line-blur` and `line-gap-width` of each feature, and the change to the next zoom
            // of the properties that depend on the zoom and the feature.
            const moves = (q: Prop) => z1 > zs && q.dd && q.zoom, line = L.type === 'line';
            const nextProps = line ? [p.offset, p.blur, p.gap] : circle ? [p.strokeWidth, p.blur] : [], deltas = nextProps.map(q => moves(q) ? [] as number[] : null);
            const feats = line ? [p.blur.dd ? [] as number[] : null, p.gap.dd ? [] as number[] : null, ...deltas] : deltas;
            const dz = (i: number, now: number, lo = -Infinity) => deltas[i]?.push(Math.max(lo, nextProps[i].eval(z1, ctx.f)) - now);
            const stroke1: number[] | null = ddStroke && (moves(p.strokeColor) || moves(p.strokeOpacity)) ? [] : null;
            let grows = false;
            const most = [0, 0, 0];
            const progress: number[] | null = line && L.ramp ? [] : null;
            const scalarProp = line ? p.width : heat ? p.weight : L.type === 'circle' ? p.radius : null;
            for (const f of fs) {
                // Circle and heatmap layers take any geometry: every vertex of a line or polygon is a point.
                if (kind === 'circle' ? false : want ? f.type !== want : f.type === 1) continue;
                ctx.f = f;
                    f.state = f.id === undefined ? undefined : states?.[L.source!]?.[`${L.sourceLayer ?? ''}|${f.id}`];
                if (L.filter && !L.filter(ctx)) continue;
                const g = geometry(f);
                let start = 0;
                for (const end of g.ringEnds) {
                    if (kind === 'circle') {
                        for (let i = start; i < end; i++) { coords.push(g.coords[i * 2], g.coords[i * 2 + 1]); ringEnds.push(coords.length / 2); }
                        // A polygon ring ends where it began, and MapLibre counts that corner twice.
                        if (f.type === 3) { coords.push(g.coords[start * 2], g.coords[start * 2 + 1]); ringEnds.push(coords.length / 2); }
                        start = end;
                        continue;
                    }
                    for (let i = start * 2; i < end * 2; i++) coords.push(g.coords[i]);
                    // Polygon rings drawn as lines need an explicit closing point.
                    if (line && f.type === 3) coords.push(g.coords[start * 2], g.coords[start * 2 + 1]);
                    ringEnds.push(coords.length / 2);
                    start = end;
                }
                featEnds.push(ringEnds.length);
                if (ddColor) pushColor(color, p.color.dd ? p.color.eval(zs, f) : WHITE, p.opacity.dd ? p.opacity.eval(zs, f) : 1);
                if (scalarProp?.dd) {
                    const now = scalarProp.eval(zs, f), then = scalarProp.eval(z1, f);
                    scalar.push(now); scalar1.push(then);
                    most[0] = Math.max(most[0], now, then);
                    if (then !== now) grows = true;
                }
                if (line) {
                    const o = p.offset.dd ? p.offset.eval(zs, f) : 0, bl = p.blur.dd ? Math.max(0, p.blur.eval(zs, f)) : 0, g = p.gap.dd ? Math.max(0, p.gap.eval(zs, f)) : 0;
                    if (p.offset.dd) offset.push(o);
                    most[1] = Math.max(most[1], g), most[2] = Math.max(most[2], Math.abs(o));
                    feats[0]?.push(bl); feats[1]?.push(g);
                    dz(0, o); dz(1, bl, 0); dz(2, g, 0);
                }
                if (ddStroke) pushColor(stroke, p.strokeColor.dd ? p.strokeColor.eval(zs, f) : WHITE, p.strokeOpacity.dd ? p.strokeOpacity.eval(zs, f) : 1);
                if (stroke1) pushColor(stroke1, p.strokeColor.dd ? p.strokeColor.eval(z1, f) : WHITE, p.strokeOpacity.dd ? p.strokeOpacity.eval(z1, f) : 1);
                // (A heatmap has `heatmap-radius` and its change to the next zoom, which is 0 when it depends on the feature alone.)
                const sw = circle && p.strokeWidth.dd ? p.strokeWidth.eval(zs, f) : 0, cb = circle && p.blur.dd ? p.blur.eval(zs, f) : 0, r = heat && p.radius.dd ? p.radius.eval(zs, f) : 0;
                if (ddSb) sb.push(heat ? r : sw, heat ? (moves(p.radius) ? p.radius.eval(z1, f) - r : 0) : cb);
                if (circle) { dz(0, sw); dz(1, cb); }
                if (progress) progress.push(f.properties.mapbox_clip_start ?? 0, f.properties.mapbox_clip_end ?? 1);
                // (As in MapLibre GL JS, a negative height or base is 0.)
                if (extrude) heights.push(lift ? 1 : Math.max(0, p.height.eval(zs, f))), bases.push(lift ? 0 : Math.max(0, p.base.eval(zs, f)));
            }
            if (!featEnds.length) continue;
            const batch: Batch = {
                type: kind as Batch['type'],
                geom: {coords: kind === 'line' ? halves(coords) : Int16Array.from(coords), ringEnds: Uint32Array.from(ringEnds), featEnds: Uint32Array.from(featEnds), half: kind === 'line' || undefined},
            };
            if (ddColor && !progress) batch.color = Uint8Array.from(color);
            if (progress) batch.progress = Float32Array.from(progress);
            if (scalarProp?.dd) batch[line ? 'width' : 'radius'] = Float32Array.from(scalar);
            if (scalarProp?.dd && grows) batch[line ? 'width1' : 'radius1'] = Float32Array.from(scalar1);
            if (line && (scalarProp!.dd || p.gap.dd || p.offset.dd)) batch.most = most;
            if (offset.length) batch.offset = Float32Array.from(offset);
            if (ddStroke) batch.stroke = Uint8Array.from(stroke);
            if (ddSb) batch.sb = Float32Array.from(sb);
            if (stroke1?.some((c, i) => c !== stroke[i])) batch.stroke1 = Uint8Array.from(stroke1);
            interleaveFeat(batch, feats);
            if (extrude) { batch.height = Float32Array.from(heights); batch.base = Float32Array.from(bases); batch.lift = lift; if (pat || p.pattern.zoom || p.pattern.eval(zs)) batch.ed = true; }
            if (line) { batch.cap = p.cap.eval(zs); batch.join = p.join.eval(zs); batch.miterLimit = p.miterLimit.eval(zs); batch.roundLimit = p.roundLimit.eval(zs); batch.sharp = ov > 16 ? 0 : 15 * EXTENT / 512 / ov; }
            if (L.type === 'fill') { batch.outline = p.outline.eval(zs)[3] > 0; batch.antialias = p.antialias.eval(zs) !== false; }
            if (pat) batch.pat = pat;
            if (heat) batch.heat = true;
            out.layers[patternKey(L.id, k++)] = batch;
        }
    }
    return out;
}

/**
 * Yields [x, y, angle, length, (anchor index in path, ...path)] label anchors for one ring. `ds` has the distances along
 * a line of its anchors: empty for the middle of the line, and null for a label that is not along the line. The points
 * of the path are rounded to `1 / grid` of a tile unit: an over-zoomed tile keeps the precision of the deeper tile that
 * MapLibre GL JS makes of it, or a gentle slope becomes flat steps.
 */
export function anchors(c: number[], start: number, end: number, type: number, along: boolean, window: number, ds: number[] | null, grid = 1): number[][] {
    if (type === 1) return [[c[start * 2], c[start * 2 + 1], 0, 0]];
    if (type === 3 && !along) {
        let a = 0, cx = 0, cy = 0;
        for (let i = start, j = end - 1; i < end; j = i++) {
            const x0 = c[j * 2], y0 = c[j * 2 + 1], x1 = c[i * 2], y1 = c[i * 2 + 1], k = x0 * y1 - x1 * y0;
            a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
        }
        return a ? [[cx / (3 * a), cy / (3 * a), 0, 0]] : [];
    }
    // (The distance along the line at each point, so that a place on a long line is found by a binary search.)
    const run = [0];
    for (let i = start + 1; i < end; i++) run.push(run[run.length - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
    const len = run[run.length - 1];
    if (!len) return [];
    /** The first point (index from `start`, at least 1) at or past the distance `d`. */
    const after = (d: number) => {
        let lo = 1, hi = run.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (run[m] < d) lo = m + 1; else hi = m; }
        return lo;
    };
    const at = (d: number): [number, number] => {
        const k = after(d), i = start + k, seg = run[k] - run[k - 1];
        if (d > len || !seg) return [c[i * 2], c[i * 2 + 1]];
        const t = (d - run[k - 1]) / seg;
        return [c[i * 2 - 2] + (c[i * 2] - c[i * 2 - 2]) * t, c[i * 2 - 1] + (c[i * 2 + 1] - c[i * 2 - 1]) * t];
    };
    // (An empty list of distances stands for the middle of the line: `line-center`, or a label at a point of a line.)
    if (!ds?.length) ds = [len / 2];
    const out: number[][] = [];
    for (const d of ds) {
        const span = Math.min(d, len - d, 250);
        const [x, y] = at(d), [ax, ay] = at(d - span), [bx, by] = at(d + span);
        const anchor = [x, y, Math.atan2(by - ay, bx - ax), len];
        if (along && window > 0) {
            // The stretch of line around the anchor, for text that follows the curve: its points, then the index of the anchor among them.
            const d0 = Math.max(0, d - window), d1 = Math.min(len, d + window), path = [...at(d0)];
            let index = -1;
            for (let k = Math.max(1, after(d0) - 1); k < run.length && run[k - 1] < d1; k++) {
                if (index < 0 && d <= run[k] && d >= run[k - 1]) { index = path.length / 2; path.push(x, y); }
                if (run[k] > d0 && run[k] < d1 && run[k] !== d) path.push(c[(start + k) * 2], c[(start + k) * 2 + 1]);
            }
            if (index < 0) { index = path.length / 2; path.push(x, y); }
            path.push(...at(d1));
            anchor.push(index, ...path.map(v => Math.round(v * grid) / grid));
        }
        out.push(anchor);
    }
    return out;
}

function ringArea(c: Int16Array, start: number, end: number) {
    let a = 0;
    for (let i = start, j = end - 1; i < end; j = i++) a += (c[j * 2] - c[i * 2]) * (c[i * 2 + 1] + c[j * 2 + 1]);
    return a;
}

/** Labels as sent between threads: the shared part of each feature's labels once, then each label's own values. */
export type PackedLabels = Record<string, {shared: object[]; own: [number, object][]}>;
/** Prepares labels for posting to another thread (which copies only an object's own values, not what is behind it). */
export function packLabels(labels: Record<string, LabelSrc[]>): PackedLabels {
    const out: PackedLabels = {};
    for (const id in labels) {
        const shared: object[] = [], index = new Map<object, number>();
        out[id] = {shared, own: labels[id].map(l => {
            const behind = Object.getPrototypeOf(l);
            if (behind === Object.prototype) return [-1, l];
            let i = index.get(behind);
            if (i === undefined) index.set(behind, i = shared.push(behind) - 1);
            return [i, {...l}];
        })};
    }
    return out;
}
/** Rebuilds each label as one plain object, because engines read an object whose prototype was set afterwards many times slower (#332). */
export function unpackLabels(packed: PackedLabels): Record<string, LabelSrc[]> {
    const out: Record<string, LabelSrc[]> = {};
    for (const id in packed) {
        const shared = packed[id].shared;
        out[id] = packed[id].own.map(([i, own]) => (i < 0 ? own : {...shared[i], ...own}) as LabelSrc);
    }
    return out;
}

/** `text-overlap` / `icon-overlap` ('never', 'always', 'cooperative') take precedence over the older allow-overlap flags. */
export const overlaps = (mode: string, allow: unknown) => mode ? mode !== 'never' : !!allow;

/** `text-justify` as a number; `auto` follows the side the text is anchored on. */
export function justification(justify: string, anchor: string): number {
    const side = justify === 'auto' ? anchor : justify;
    return side.includes('left') ? -1 : side.includes('right') ? 1 : 0;
}

/**
 * How a tile is built for the globe: cells a side, whether the tile touches the north or south edge of the world, and
 * whether a point of a heatmap is a grid of corners (see `tessellate`).
 */
export interface GlobeBuild { grid: number; north?: boolean; south?: boolean; heat?: boolean }
/** A `GlobeBuild` with the code of the cut, the part `subdivide` of the worker (see `toGL`). */
export type GlobeCut = GlobeBuild & Pick<typeof import('./subdivide.ts'), 'cutFill' | 'cutLine'>;

/**
 * Cells a side for a tile of zoom `tileZ` that is built for the zoom `zoom` (higher for an overzoomed tile), and 0 from
 * zoom 12, where the globe has turned into Mercator. One cell then spans 360° / (40 · √2^zoom), so its chord lies about
 * half a pixel under the sphere one zoom level past `zoom`: 40, 20, 10, 5, 3 and 1 cells at zoom 0, 2, 4, 6, 8 and 10.
 */
export function globeGrid(tileZ: number, zoom = tileZ): number {
    return zoom >= 12 ? 0 : Math.min(128, Math.max(1, Math.round(40 * 2 ** (zoom / 2 - tileZ))));
}

/**
 * The field `globe` of the request for a tile (`id`, built for `zoom`), or undefined when the tile needs no cut. A point
 * of a heatmap is a grid of corners below zoom 6 only: from there, the chord of one quad of the default radius (30
 * pixels) lies less than 0.15 pixel under the sphere, and the grid would cost 6 times the buffers for nothing (#1824).
 */
export function globeBuild(id: {z: number; y: number}, zoom = id.z): GlobeBuild | undefined {
    const grid = globeGrid(id.z, zoom), north = id.y === 0, south = id.y === 2 ** id.z - 1;
    // (A tile with one cell is still cut at its border: see `BORDER`.)
    return grid ? {grid, north, south, heat: zoom < 6} : undefined;
}

/**
 * Expands a neutral batch into vertex and index buffers for the GPU. With `globe` (a map that can show the globe),
 * fills and lines are cut along a grid first (see subdivide.ts); without it the result is what it always was.
 */
export function tessellate(b: Batch, globe?: GlobeCut): GLBatch | null {
    if (globe && b.type !== 'circle' && !b.height) return b.type === 'fill' ? tessellateGlobeFill(b, globe) : tessellateLine({...b, geom: cutRings(b.geom, globe, false)});
    const {coords, ringEnds, featEnds} = b.geom;
    if (b.type === 'circle') {
        // Four vertices per point (position plus which corner), drawn as ordinary indexed triangles. Instancing would
        // be more compact but is many times slower on software renderers (about 30 times in SwiftShader, #1824).
        // On a globe below zoom 6 (see `globeBuild`), a point of a heatmap is a grid of 4 × 4 corners, as in MapLibre GL JS
        // (granularity 3 of its CircleBucket): the corners lie on the sphere, and the four corners of one quad would cut
        // under it, which moves the bump toward the center of the globe. Its corners are in sevenths. (A grid of 3 × 3
        // is 1.3 % off the render test projection/globe/heatmap.)
        const grid = !!globe?.heat && b.heat, g = grid ? 4 : 2, v = g * g, e = grid ? [-7, -3, 3, 7] : [-1, 1];
        const n = ringEnds.length, pos = new Int16Array(n * v * 4), idx = new Uint32Array(n * (g - 1) ** 2 * 6), feats = new Uint32Array(n * v);
        for (let f = 0, r = 0; f < featEnds.length; f++) {
            for (; r < featEnds[f]; r++) {
                const i = ringEnds[r] - 1, o = r * v;
                feats.fill(f, o, o + v);
                for (let k = 0; k < v; k++) pos.set([coords[i * 2], coords[i * 2 + 1], e[k % g], e[k / g | 0]], (o + k) * 4);
                if (!grid) idx.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], r * 6);
                else for (let c = 0; c < 9; c++) { const q = o + (c / 3 | 0) * 4 + c % 3; idx.set([q, q + 5, q + 1, q, q + 4, q + 5], (r * 9 + c) * 6); }
            }
        }
        const each = <T extends Uint8Array | Float32Array>(a?: T) => perVertex(a, feats, featEnds.length);
        return {type: 'circle', pos, idx, color: each(b.color), radius: each(b.radius), radius1: each(b.radius1), stroke: each(b.stroke), sb: each(b.sb), feat: each(b.feat), featMask: b.featMask, stroke1: each(b.stroke1), ...grid && {grid}};
    }
    const idx: number[] = [];
    if (b.type === 'fill') {
        if (b.height) return tessellateExtrusion(b, globe);
        const color = b.color ? new Uint8Array(coords.length * 2) : undefined;
        for (let f = 0; f < featEnds.length; f++) {
            eachPolygon(b.geom, f, (p0, p1, holes) => {
                const tris = earcut(coords.subarray(p0 * 2, p1 * 2) as any, holes);
                for (let i = 0; i < tris.length; i++) idx.push(tris[i] + p0);
                if (color) for (let i = p0; i < p1; i++) color.set(b.color!.subarray(f * 4, f * 4 + 4), i * 4);
            });
        }
        if (!idx.length) return null;
        // Without multisampling, triangle edges are jagged; a one-pixel line along every polygon edge smooths them
        // (and carries the outline color when the style sets one). Edges created by clipping at the tile border are skipped.
        let edges: Uint32Array | undefined;
        if (b.antialias !== false || b.outline) {
            const list: number[] = [], out = (i: number, j: number, k: number) => (coords[i * 2 + k] <= 0 && coords[j * 2 + k] <= 0) || (coords[i * 2 + k] >= EXTENT && coords[j * 2 + k] >= EXTENT);
            for (let r = 0; r < ringEnds.length; r++) {
                const s = r ? ringEnds[r - 1] : 0, e = ringEnds[r];
                for (let i = s, j = e - 1; i < e; j = i++) if (!out(i, j, 0) && !out(i, j, 1)) list.push(j, i);
            }
            edges = Uint32Array.from(list);
        }
        return {type: 'fill', pos: coords as Int16Array, idx: Uint32Array.from(idx), color, edges};
    }

    return tessellateLine(b);
}

/**
 * Coordinates in halves of a tile unit, rounded and clamped to int16: 4 bytes a point, as whole units. A line needs no
 * more: MapLibre GL JS rounds every vertex of a GeoJSON tile, where a line is clipped too, to whole units of a tile 8192
 * wide.
 */
function halves(c: number[]): Int16Array {
    const out = new Int16Array(c.length);
    for (let i = 0; i < c.length; i++) { const t = Math.round(c[i] * 2); out[i] = t < -32768 ? -32768 : t > 32767 ? 32767 : t; }
    return out;
}

/** The rings of a geometry with a point added where they cross a line of the grid. `closed`: each ring is a polygon ring. */
function cutRings(g: Geom, {grid, cutLine}: GlobeCut, closed: boolean): Geom {
    if (grid <= 1 && !closed) return g;
    // (The result is in tile units: a line that is cut is a Float32Array.)
    const out: number[] = [], ringEnds = new Uint32Array(g.ringEnds.length), c = g.half ? g.coords.map(t => t / 2) : g.coords;
    for (let r = 0; r < g.ringEnds.length; r++) {
        cutLine(c, r ? g.ringEnds[r - 1] : 0, g.ringEnds[r], Math.max(1, grid), out, closed);
        ringEnds[r] = out.length / 2;
    }
    return {coords: closed ? Int16Array.from(out) : Float32Array.from(out), ringEnds, featEnds: g.featEnds};
}

/**
 * A fill for the globe: the triangles of the cut, and the edges for smoothing and outlines from the rings with the
 * points of the grid added (they keep the edges of the polygon, not those of the cut).
 */
function tessellateGlobeFill(b: Batch, globe: GlobeCut): GLBatch | null {
    const g = b.geom, features: {coords: Int16Array; holes: number[]}[][] = [];
    for (let f = 0; f < g.featEnds.length; f++) {
        const polygons: {coords: Int16Array; holes: number[]}[] = [];
        eachPolygon(g, f, (p0, p1, holes) => polygons.push({coords: (g.coords as Int16Array).subarray(p0 * 2, p1 * 2), holes}));
        features.push(polygons);
    }
    const cut = globe.cutFill(features, globe);
    if (!cut.idx.length) return null;
    const rings = b.antialias !== false || b.outline ? cutRings(g, globe, true) : undefined, base = cut.pos.length / 2;
    const pos = new Int16Array(cut.pos.length + (rings?.coords.length ?? 0));
    pos.set(cut.pos);
    let edges: Uint32Array | undefined;
    if (rings) {
        pos.set(rings.coords, cut.pos.length);
        // (As for a flat fill, an edge on the border of the tile is not drawn. Each ring ends with its first point.)
        const list: number[] = [], c = rings.coords, out = (i: number, j: number, k: number) => (c[i * 2 + k] <= 0 && c[j * 2 + k] <= 0) || (c[i * 2 + k] >= EXTENT && c[j * 2 + k] >= EXTENT);
        for (let r = 0; r < rings.ringEnds.length; r++) for (let i = (r ? rings.ringEnds[r - 1] : 0) + 1; i < rings.ringEnds[r]; i++) if (!out(i - 1, i, 0) && !out(i - 1, i, 1)) list.push(base + i - 1, base + i);
        edges = Uint32Array.from(list);
    }
    let color: Uint8Array | undefined;
    if (b.color) {
        color = new Uint8Array(pos.length * 2);
        for (let f = 0; f < g.featEnds.length; f++) {
            const c = b.color.subarray(f * 4, f * 4 + 4);
            for (let i = cut.featStarts[f], end = cut.featStarts[f + 1] ?? base; i < end; i++) color.set(c, i * 4);
            if (rings) for (let r = f ? g.featEnds[f - 1] : 0; r < g.featEnds[f]; r++) for (let i = r ? rings.ringEnds[r - 1] : 0; i < rings.ringEnds[r]; i++) color.set(c, (base + i) * 4);
        }
    }
    return {type: 'fill', pos, idx: Uint32Array.from(cut.idx), color, edges};
}

/**
 * Splits a feature's rings into polygons (an outer ring followed by its holes) and reports each as a point range
 * plus hole offsets, the form earcut wants. Ring direction relative to the first ring tells outers from holes.
 */
function eachPolygon(g: Geom, f: number, cb: (p0: number, p1: number, holes: number[]) => void) {
    const {coords, ringEnds, featEnds} = g, first = f ? featEnds[f - 1] : 0, last = featEnds[f];
    let polyStart = first, outerSign = 0;
    const flush = (endRing: number) => {
        if (endRing <= polyStart) return;
        const p0 = polyStart ? ringEnds[polyStart - 1] : 0, holes: number[] = [];
        for (let h = polyStart; h < endRing - 1; h++) holes.push(ringEnds[h] - p0);
        cb(p0, ringEnds[endRing - 1], holes);
    };
    for (let r = first; r < last; r++) {
        const area = ringArea(coords as Int16Array, r ? ringEnds[r - 1] : 0, ringEnds[r]);
        if (!area) continue;
        const sign = area > 0 ? 1 : -1;
        if (!outerSign) outerSign = sign;
        if (sign === outerSign && r > polyStart) { flush(r); polyStart = r; }
    }
    flush(last);
}

/**
 * The fourth value of a building vertex says which face it is on. A roof is ROOF. A wall is the angle of its normal
 * (0 to 2 pi), plus WALL_TOP at the top edge, plus WALL_OTHER times the height of the other end of the wall in whole
 * meters: the light on a wall depends on the base and the height together.
 */
export const ROOF = -1, WALL_TOP = 8, WALL_OTHER = 16;

/**
 * Whether the edge from point j to point i of a ring runs along the edge of the buffer of the tile, where the clip of the
 * source cut the polygon. Such an edge gets no wall, as in MapLibre GL JS (`isBoundaryEdge`): buildings are not cut at the
 * edge of the tile, so the wall would stand inside the building, in the part that the next tile draws.
 */
const buffer = (c: ArrayLike<number>, i: number, j: number) => c[i * 2] === c[j * 2] && (c[i * 2] < 0 || c[i * 2] > EXTENT) || c[i * 2 + 1] === c[j * 2 + 1] && (c[i * 2 + 1] < 0 || c[i * 2 + 1] > EXTENT);

/**
 * Whether the points s to e of a ring all lie on one side outside the tile, in its buffer. MapLibre GL JS draws no such
 * polygon and no walls of such a ring (`isEntirelyOutside`): the next tile draws them, and here their centroid would lie
 * past the elevation tile under this tile (#2287).
 */
const outside = (c: ArrayLike<number>, s: number, e: number) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = s; i < e; i++) x0 = Math.min(x0, c[i * 2]), x1 = Math.max(x1, c[i * 2]), y0 = Math.min(y0, c[i * 2 + 1]), y1 = Math.max(y1, c[i * 2 + 1]);
    return x1 < 0 || y1 < 0 || x0 > EXTENT || y0 > EXTENT;
};

/**
 * Buildings: a roof at the feature's height and a wall under every edge. Each vertex says which way its face looks, for
 * the light. With `globe`, the roof is cut as a fill is (without the caps at the poles) and each wall is cut where its
 * edge crosses a line of the grid, as MapLibre GL JS does, so that both follow the sphere.
 */
function tessellateExtrusion(b: Batch, globe?: GlobeCut): GLBatch | null {
    const {featEnds} = b.geom, v: number[] = [], idx: number[] = [], feats: number[] = [], ed: number[] = [], cen: number[] = [];
    let count = 0;
    for (let f = 0; f < featEnds.length; f++) {
        const top = b.height![f], bottom = Math.min(b.base ? b.base[f] : 0, top);
        const vert = (x: number, y: number, z: number, light: number, d = 0) => {
            v.push(x, y, z, light);
            if (b.ed) ed.push(d);
            feats.push(f);
            return count++;
        };
        eachPolygon(b.geom, f, (p0, p1, holes) => {
            let coords: ArrayLike<number> = b.geom.coords.subarray(p0 * 2, p1 * 2), bounds = [0, ...holes, p1 - p0];
            if (outside(coords, 0, bounds[1])) return;
            // On 3D terrain, MapLibre GL JS lifts each polygon by the ground at its centroid (the mean of its points,
            // without the closing point of a ring), so the roof stays flat and every part of a MultiPolygon has its own.
            // The centroid is that of the piece of the polygon in this tile, as in MapLibre GL JS, so it lies in the
            // elevation tile under this tile. The pieces of a building that crosses the edge of a tile can stand at
            // different heights; they overlap by the buffer, and the higher piece hides the step (#2287, #2314).
            const first = count;
            let cx = 0, cy = 0, cn = 0;
            for (let r = 0; r + 1 < bounds.length; r++) for (let i = bounds[r]; i < bounds[r + 1]; i++) {
                if (i === bounds[r + 1] - 1 && coords[i * 2] === coords[bounds[r] * 2] && coords[i * 2 + 1] === coords[bounds[r] * 2 + 1]) continue;
                cx += coords[i * 2]; cy += coords[i * 2 + 1]; cn++;
            }
            const centroid = () => { cen.push(first, count, Math.floor(cx / cn), Math.floor(cy / cn)); };
            const roof = count, cut = globe && globe.cutFill([[{coords, holes}]], {grid: globe.grid}), pos = cut ? cut.pos : coords, tris = cut ? cut.idx : earcut(coords as any, holes);
            for (let i = 0; i < pos.length; i += 2) vert(pos[i], pos[i + 1], top, ROOF);
            for (let i = 0; i < tris.length; i++) idx.push(roof + tris[i]);
            if (top <= bottom) return centroid();
            if (globe) {
                // (cutLine repeats the first point of a ring at its end: it is dropped.)
                const out: number[] = [], ends = [0];
                for (let r = 0; r + 1 < bounds.length; r++) { globe.cutLine(coords, bounds[r], bounds[r + 1], Math.max(1, globe.grid), out, true); out.length -= 2; ends.push(out.length / 2); }
                coords = out; bounds = ends;
            }
            p0 = 0;
            // The side of an edge that is outside depends on the direction of the outer ring.
            let area = 0;
            for (let i = p0, j = p0 + bounds[1] - 1; i < p0 + bounds[1]; j = i++) area += coords[j * 2] * coords[i * 2 + 1] - coords[i * 2] * coords[j * 2 + 1];
            const out = area >= 0 ? 1 : -1;
            for (let r = 0; r + 1 < bounds.length; r++) {
                const s = p0 + bounds[r], e = p0 + bounds[r + 1], n = e - s, dist: number[] = [];
                if (outside(coords, s, e)) continue;
                // For fill-extrusion-pattern: the distance along the ring where each wall starts, counted from the
                // corner where MapLibre GL JS starts, so that the image on the walls lines up as it does there.
                for (let k = 1, d = 0; b.ed && k <= n; k++) {
                    const i = s + k % n, j = s + k - 1, len = buffer(coords, i, j) ? 0 : Math.hypot(coords[i * 2] - coords[j * 2], coords[i * 2 + 1] - coords[j * 2 + 1]);
                    if (len && d + len > EXTENT * 4) d = 0; // (32768 units of MapLibre GL JS)
                    dist.push(d); d += len;
                }
                for (let i = s, j = e - 1; i < e; j = i++) {
                    const ax = coords[j * 2], ay = coords[j * 2 + 1], bx = coords[i * 2], by = coords[i * 2 + 1], len = Math.hypot(bx - ax, by - ay);
                    if (!len || buffer(coords, i, j)) continue;
                    const facing = Math.atan2(-(bx - ax) * out, (by - ay) * out) + Math.PI, other = (h: number) => WALL_OTHER * Math.floor(Math.min(60000, Math.max(0, h)));
                    const low = facing + other(top), high = facing + WALL_TOP + other(bottom);
                    const d = dist[(i - s + n - 1) % n] ?? 0;
                    const q = vert(ax, ay, bottom, low, d + len);
                    vert(bx, by, bottom, low, d); vert(bx, by, top, high, d); vert(ax, ay, top, high, d + len);
                    idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
                }
            }
            centroid();
        });
    }
    if (!idx.length) return null;
    // (cen has the first vertex, the end and the centroid of each polygon.)
    const c = new Int16Array(count * 2);
    for (let k = 0; k < cen.length; k += 4) for (let i = cen[k]; i < cen[k + 1]; i++) { c[i * 2] = cen[k + 2]; c[i * 2 + 1] = cen[k + 3]; }
    return {type: 'extrusion', v: Float32Array.from(v), idx: Uint32Array.from(idx), color: perVertex(b.color, feats, featEnds.length), ed: b.ed ? Float32Array.from(ed) : undefined, c, lift: b.lift};
}

const ARC_STEP = Math.PI / 5;

/**
 * Lines: each vertex becomes a pair extruded along its normal in the vertex shader. Vertex layout is
 * x, y, normalX, normalY, side (-1..1 across the line, for edge antialiasing), distance along the line (for dashes).
 */
/**
 * A line vertex is 16 bytes: position x, y (int16, halves of a tile unit, so that a vertex is as exact as in MapLibre GL
 * JS, whose tiles are 8192 units wide); the direction to push it sideways (int16, times
 * LINE_NORMAL; it is longer than 1 at a mitred corner); which side of the line it is on (int16: its sign;
 * 0 at the middle of a fan; see `pair` for the outer vertex of a bevel and `fan` for the outer vertices of a fan); the `line-offset` of the feature when it is data-driven (int16, eighths of a pixel; else 0); and the distance along the line (float32, for dashes).
 */
export const LINE_VERTEX = 16, LINE_NORMAL = 8192;
/** Keeps in `Batch.feat` the numbers of each feature of the lists that are not 0 for some feature. */
function interleaveFeat(batch: Batch, lists: (number[] | null)[]) {
    const kept = lists.filter(d => d?.some(x => x)) as number[][], k = kept.length;
    if (!k) return;
    const feat = batch.feat = new Float32Array(kept[0].length * k);
    for (let j = 0; j < k; j++) for (let f = 0; f < kept[j].length; f++) feat[f * k + j] = kept[j][f];
    batch.featMask = lists.reduce((m, d, i) => d?.some(x => x) ? m | 1 << i : m, 0);
}

/** The numbers of each feature in `a` (the same count for each of `features`), once for each vertex, whose feature is in `feats`. */
function perVertex<T extends Uint8Array | Float32Array>(a: T | undefined, feats: ArrayLike<number>, features: number): T | undefined {
    if (!a) return;
    const k = a.length / features, out = new (a.constructor as new (length: number) => T)(feats.length * k);
    for (let i = 0, o = 0; i < feats.length; i++) for (let j = feats[i] * k, end = j + k; j < end; j++) out[o++] = a[j];
    return out;
}

/** The cosine of half the turn above which a corner is sharp: a turn of 75 degrees, as in MapLibre GL JS. */
const COS_SHARP = Math.cos(75 / 2 * Math.PI / 180);

function tessellateLine(b: Batch): GLBatch | null {
    // (Positions are in halves of a tile unit throughout, so that they stay small integers, which is faster; lengths are
    // in tile units.)
    const {coords, ringEnds, featEnds} = b.geom, k = b.geom.half ? 1 : 2;
    // (`feats`: the feature of each vertex, for the numbers of each feature; see `perVertex`.)
    const v: number[] = [], idx: number[] = [], color: number[] = [], feats: number[] = [];
    const round = b.join === 'round';
    // As in MapLibre GL JS: a corner whose miter is longer than the limit (1 / cos of half the turn, in line widths)
    // gets a bevel or a round join; a bevel join keeps sharp the corners whose miter is shorter than 1.05.
    const limit = round ? b.roundLimit ?? 1.05 : b.join === 'bevel' ? 1.05 : b.miterLimit ?? 2, minCos = 1 / Math.max(1, limit);
    let count = 0, f = 0, ringLength = 1;
    const vert = (x: number, y: number, nx: number, ny: number, side: number, dist: number) => {
        if (b.progress) {
            // The place along the whole line goes in the color's red and green bytes, as one 16-bit number.
            const from = b.progress[f * 2], part = Math.min(1, Math.max(0, from + (b.progress[f * 2 + 1] - from) * dist / ringLength)), t = Math.round(part * 65535);
            color.push(t >> 8, t & 255, 0, 255);
            // The dashes of a line with a gradient: MapLibre measures such a line as 16383 tile units from end to
            // end, whatever its length. The same is done here, so that the dashes are those of MapLibre.
            dist = part * 16383.5;
        }
        v.push(x, y, nx, ny, side, dist);
        feats.push(f);
        return count++;
    };
    /**
     * A fan around (x, y) sweeping `sweep` radians from angle `from`: used for round joins and caps. `line-offset` moves
     * the whole fan along (ox, oy), as MapLibre GL JS does, so that it is centered on the offset corner: each vertex
     * stores that vector as its normal, and an outer vertex stores the angle of its direction in the side, as
     * 16384 + (angle / PI + 1) * 8191. The middle vertex has side 0. A cap passes `ends`: its middle vertex, and the pair
     * at the end of the line as its first and last outer vertex, so that the fan and the line share their edges (see `quad`).
     */
    const angle = (a: number) => 16384 + Math.round((Math.atan2(Math.sin(a), Math.cos(a)) / Math.PI + 1) * 8191);
    const fan = (x: number, y: number, from: number, sweep: number, dist: number, ox: number, oy: number, ends?: number[]) => {
        const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP)), centre = ends ? ends[0] : vert(x, y, ox, oy, 0, dist);
        const rim = (a: number) => vert(x, y, ox, oy, angle(a), dist);
        let prev = ends ? ends[1] : rim(from);
        for (let k = 1; k <= steps; k++) {
            const cur = ends && k === steps ? ends[2] : rim(from + sweep * k / steps);
            idx.push(centre, prev, cur);
            prev = cur;
        }
    };
    for (let r = 0; f < featEnds.length; f++) {
        for (; r < featEnds[f]; r++) {
            // Drop repeated points, then walk the segments.
            const xs: number[] = [], ys: number[] = [];
            for (let i = r ? ringEnds[r - 1] : 0; i < ringEnds[r]; i++) {
                const x = coords[i * 2] * k, y = coords[i * 2 + 1] * k, n = xs.length;
                if (!n || x !== xs[n - 1] || y !== ys[n - 1]) { xs.push(x); ys.push(y); }
            }
            const n = xs.length;
            if (n < 2) continue;
            if (b.progress) { ringLength = 0; for (let i = 0; i < n - 1; i++) ringLength += Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) / 2; }
            let last = -1, dist = 0, pdx = 0, pdy = 0, plen = 0, mid1 = -1, mid2 = -1;
            /**
             * The two triangles from the pair `last` to the pair `a`. The middle vertex of a round cap lies on the edge
             * between the two vertices of the pair at the end of the line (`mid1` on that of `last`, `mid2` on that of
             * `a`): the triangles then have it as a corner too, because a vertex in the middle of an edge of another
             * triangle leaves a crack of a pixel at some angles (#2318).
             */
            const quad = (a: number) => {
                if (last < 0) return;
                // (The middle splits the triangle that has that edge in two, so that the diagonal stays where it was.)
                if (mid1 < 0) idx.push(last, last + 1, a); else idx.push(last, mid1, a, mid1, last + 1, a);
                if (mid2 < 0) idx.push(last + 1, a + 1, a); else idx.push(last + 1, a + 1, mid2, last + 1, mid2, a);
                mid1 = mid2 = -1;
            };
            /**
             * (ox, oy) moves the vertices along the line: both of them, or with `only` (1 or -1) the one on that side.
             * `c` is for the other vertex of a bevel, whose partner is moved to the inner miter point: `line-offset` moves
             * it along the miter, as MapLibre GL JS does, and not along its normal. The shader adds c times the offset
             * along the line; c goes into the side as 2 + (c + 2) * 4096, so that a side of -1, 0 or 1 still has c = 0.
             */
            const pair = (x: number, y: number, nx: number, ny: number, ox = 0, oy = 0, only = 0, c = 0) => {
                const k = c ? 2 + Math.round((c + 2) * 4096) : 1;
                const a = vert(x, y, nx + (only < 0 ? 0 : ox), ny + (only < 0 ? 0 : oy), only < 0 ? k : 1, dist);
                vert(x, y, -nx + (only > 0 ? 0 : ox), -ny + (only > 0 ? 0 : oy), only > 0 ? -k : -1, dist);
                quad(a);
                last = a;
            };
            /** A pair at (x, y) across the normal (nx, ny) that `line-offset` moves along (ox, oy): stored as in `fan`. */
            const movedPair = (x: number, y: number, nx: number, ny: number, ox: number, oy: number) => {
                const a = vert(x, y, ox, oy, angle(Math.atan2(ny, nx)), dist);
                vert(x, y, -ox, -oy, -angle(Math.atan2(-ny, -nx)), dist);
                quad(a);
                last = a;
            };
            for (let i = 0; i < n - 1; i++) {
                const x = xs[i], y = ys[i], ex = xs[i + 1] - x, ey = ys[i + 1] - y, len2 = Math.hypot(ex, ey), len = len2 / 2;
                const dx = ex / len2, dy = ey / len2, nx = -dy, ny = dx;
                if (i === 0) {
                    pair(x, y, nx, ny, ...(b.cap === 'square' ? [-dx, -dy] : [0, 0]));
                    if (b.cap === 'round') fan(x, y, Math.atan2(ny, nx), Math.PI, dist, nx, ny, [mid1 = vert(x, y, nx, ny, 0, dist), last, last + 1]);
                } else {
                    const pnx = -pdy, pny = pdx, mx = pnx + nx, my = pny + ny, ml = Math.hypot(mx, my);
                    const cos = ml ? (mx * pnx + my * pny) / ml : 0;
                    // As in MapLibre GL JS, a corner sharper than 75 degrees has one more pair of vertices on each
                    // segment, 15 pixels from the corner, so that the join bends the dashes only near the corner.
                    // (MapLibre rounds the step to whole units of its tiles, which are the halves of a unit here.)
                    const sharp = cos < COS_SHARP && b.sharp ? b.sharp : 0;
                    if (sharp && plen > 2 * sharp) { dist -= sharp; pair(x - Math.round(pdx * sharp * 2), y - Math.round(pdy * sharp * 2), pnx, pny); dist += sharp; }
                    if (cos >= minCos) pair(x, y, mx / (ml * cos), my / (ml * cos));
                    else if (!round && cos < 0.5) {
                        // A miter or bevel join that turns more than 120 degrees is a "flipbevel", as in MapLibre GL JS:
                        // two pairs at the corner across the bisector, 1 / sin of half the turn long, in opposite order.
                        const s = pnx * ny - pny * nx > 0 ? -1 : 1, l = s / Math.sqrt(Math.max(1e-4, 1 - cos * cos));
                        const fx = cos < 0.01 ? -nx : -my / ml * l, fy = cos < 0.01 ? -ny : mx / ml * l;
                        // `line-offset` moves both pairs twice the offset along the bisector, and a miter from 3 to 8
                        // eases that to the normal of each pair (offsetFallback of MapLibre). The side stores the ease
                        // e as 15872 ± (1 + 510 e), its sign saying which way the bisector lies: see the shader of src/gl.ts.
                        const e = Math.min(1, Math.max(0, (1 / cos - 3) / 5)), k = 1 + Math.round(e * 510);
                        const flip = (jx: number, jy: number) => {
                            const q = jy * mx - jx * my < 0 ? -1 : 1, a = vert(x, y, jx, jy, 15872 + q * k, dist);
                            vert(x, y, -jx, -jy, -(15872 - q * k), dist);
                            quad(a);
                            last = a;
                        };
                        flip(fx, fy);
                        flip(-fx, -fy);
                    } else {
                        // Two pairs at the corner give a bevel; a fan on the outer side rounds it off. As in MapLibre GL
                        // JS, a corner of up to 120 degrees moves the inner vertices to where the inner edges meet, so
                        // that the two segments do not overlap and dashes fall where MapLibre draws them.
                        const outer = pnx * dx + pny * dy < 0 ? 1 : -1, back = cos >= 0.5 ? Math.sqrt(1 / (cos * cos) - 1) : 0;
                        // The offset moves a round join along the miter, at most twice the offset (MAX_OFFSET_MITER_LENGTH
                        // of MapLibre GL JS). Past a turn of 120 degrees the pairs at the corner move with the fan, and
                        // as in MapLibre a miter longer than 3 eases the vector back to the normal of each segment
                        // (fully at 8): one fan then goes with each pair.
                        const blunt = round && cos < 0.5, mc = ml * Math.max(cos, 0.5), bx = mc ? mx / mc : 0, by = mc ? my / mc : 0;
                        const ease = blunt ? Math.min(1, Math.max(0, (1 / cos - 3) / 5)) : 0;
                        const o1x = bx + (pnx - bx) * ease, o1y = by + (pny - by) * ease, o2x = bx + (nx - bx) * ease, o2y = by + (ny - by) * ease;
                        if (blunt) movedPair(x, y, pnx, pny, o1x, o1y); else pair(x, y, pnx, pny, -pdx * back, -pdy * back, -outer, back);
                        if (round) {
                            const a0 = Math.atan2(outer * pny, outer * pnx);
                            let sweep = Math.atan2(outer * ny, outer * nx) - a0;
                            if (sweep > Math.PI) sweep -= 2 * Math.PI; else if (sweep < -Math.PI) sweep += 2 * Math.PI;
                            fan(x, y, a0, sweep, dist, o1x, o1y);
                            if (ease) fan(x, y, a0, sweep, dist, o2x, o2y);
                        }
                        if (blunt) movedPair(x, y, nx, ny, o2x, o2y); else pair(x, y, nx, ny, dx * back, dy * back, -outer, -back);
                    }
                    if (sharp && len > 2 * sharp) { dist += sharp; pair(x + Math.round(dx * sharp * 2), y + Math.round(dy * sharp * 2), nx, ny); dist -= sharp; }
                }
                dist += len;
                pdx = dx; pdy = dy; plen = len;
                if (i === n - 2) {
                    const px = xs[n - 1], py = ys[n - 1];
                    const centre = b.cap === 'round' ? mid2 = vert(px, py, nx, ny, 0, dist) : -1;
                    pair(px, py, nx, ny, ...(b.cap === 'square' ? [dx, dy] : [0, 0]));
                    if (centre >= 0) fan(px, py, Math.atan2(ny, nx), -Math.PI, dist, nx, ny, [centre, last, last + 1]);
                }
            }
        }
    }
    if (!idx.length) return null;
    // Packed to 16 bytes a vertex (it was 24 as plain floats): lines are most of a tile, and every byte is uploaded.
    const packed = new ArrayBuffer(count * LINE_VERTEX), view = new DataView(packed), half = (t: number) => Math.max(-32768, Math.min(32767, Math.round(t)));
    for (let i = 0, o = 0; i < count; i++, o += LINE_VERTEX) {
        view.setInt16(o, half(v[i * 6]), true); view.setInt16(o + 2, half(v[i * 6 + 1]), true);
        view.setInt16(o + 4, Math.round(v[i * 6 + 2] * LINE_NORMAL), true); view.setInt16(o + 6, Math.round(v[i * 6 + 3] * LINE_NORMAL), true);
        view.setInt16(o + 8, v[i * 6 + 4], true);
        if (b.offset) view.setInt16(o + 10, Math.max(-32768, Math.min(32767, Math.round(b.offset[feats[i]] * 8))), true);
        view.setFloat32(o + 12, v[i * 6 + 5], true);
    }
    const each = <T extends Uint8Array | Float32Array>(a?: T) => perVertex(a, feats, featEnds.length);
    return {type: 'line', v: new Uint8Array(packed), idx: Uint32Array.from(idx), color: b.progress ? Uint8Array.from(color) : each(b.color), width: each(b.width), width1: each(b.width1), feat: each(b.feat), featMask: b.featMask, most: b.most};
}

/** `globe`: the tile is built for a map that can show the globe (see `tessellate`), with the code of the cut. */
export function toGL(ir: TileIR, globe?: GlobeCut): {tile: TileGL; transfer: ArrayBuffer[]} {
    const tile: TileGL = {layers: {}, labels: ir.labels, icons: ir.icons, z: ir.z, expires: ir.expires, etag: ir.etag}, transfer = new Set<ArrayBuffer>(), next: Record<string, number> = {};
    for (const b of Object.values(ir.icons ?? {})) for (const a of Object.values(b)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    for (const id in ir.layers) {
        const b = ir.layers[id];
        const g = tessellate(b, globe);
        if (!g) continue;
        if (b.pat) g.pat = b.pat;
        // (The batches of the images of a layer are numbered again without gaps: one that has no triangles is left out.)
        const base = id.split('\0')[0], k = next[base] ?? 0;
        next[base] = k + 1;
        tile.layers[patternKey(base, k)] = g;
        for (const a of Object.values(g)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    }
    return {tile, transfer: [...transfer]};
}
