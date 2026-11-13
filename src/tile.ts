import earcut from 'earcut';
import {EXTENT} from './geo.ts';
import {decodeVectorTile} from './mvt.ts';
import {GEOJSON_LAYER} from './geojson.ts';
import {parseFontName, type CompiledLayer} from './style.ts';
import {type Feature, type MapStates, type RGBA} from './expr.ts';
import {VARIANT} from './markers.ts';

/**
 * Renderer-neutral tile geometry: flat rings in tile units plus per-feature paint values.
 * The SVG backend turns this straight into paths; `tessellate` turns it into GPU buffers.
 */
export interface Geom {
    coords: Int16Array;
    /** Cumulative point count at the end of each ring. */
    ringEnds: Uint32Array;
    /** Cumulative ring count at the end of each feature. */
    featEnds: Uint32Array;
}
export interface Batch {
    type: 'fill' | 'line' | 'circle';
    geom: Geom;
    /** Per-feature straight-alpha RGBA, present only when colour or opacity is data-driven. */
    color?: Uint8Array;
    width?: Float32Array;
    radius?: Float32Array;
    /** The width or radius one zoom level further in, present when it is different: the size then changes smoothly with zoom. */
    width1?: Float32Array;
    radius1?: Float32Array;
    /** Lines with a gradient: for each feature, how far along the whole line it starts and ends (0 to 1). */
    progress?: Float32Array;
    cap?: string;
    join?: string;
    /** Fill layers with an explicit outline colour. */
    outline?: boolean;
    /** False when the style turns edge smoothing off for a fill layer. */
    antialias?: boolean;
    /** Building extrusions: per-feature top and bottom heights in metres. */
    height?: Float32Array;
    base?: Float32Array;
}
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
    size0: number; size1: number; color: RGBA; halo: RGBA; haloWidth: number; haloBlur: number;
    /** How the lines of a multi-line label align with each other: -1 left, 0 centre, 1 right. */
    justify: number;
    /** `text-rotate`, in radians clockwise. */
    rotate: number;
    /** Line height in ems, and a fixed shift on screen in pixels. */
    lineHeight: number; translate: [number, number];
    font: string; maxWidth: number; spacing: number; offset: [number, number]; anchor: string; padding: number; overlap: boolean;
    /** Text stays upright instead of following the line it is placed on (e.g. road shields). */
    upright: boolean;
    textOptional: boolean; ignore: boolean; varAnchor: string[] | null; radial: number;
    /** `text-variable-anchor-offset`: anchors to try in turn, each with its own offset in ems. */
    varOffset: (string | [number, number])[] | null;
    /** Text along a line: the largest turn between two characters, in degrees (`text-max-angle`). */
    maxAngle: number;
    /** `text-justify: auto`: lines align towards whichever anchor the label ends up with. */
    justifyAuto: boolean;
    icon?: {
        name: string; size: number; /** Size at the next zoom level, to interpolate towards. */ size1: number; offset: [number, number]; rotate: number; fit: string; fitPad: [number, number, number, number];
        opacity: number; anchor: string; color: RGBA; /** Distance-field icons: an outline in this colour, this many pixels wide. */ halo: RGBA; haloWidth: number; ignore: boolean; padding: number; translate: [number, number];
        overlap: boolean; optional: boolean; upright: boolean;
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
export interface TileIR { layers: Record<string, Batch>; labels: Record<string, LabelSrc[]>; icons?: Record<string, IconBatch> }

export type GLBatch =
    | {type: 'fill'; pos: Int16Array; idx: Uint32Array; color?: Uint8Array; /** Polygon edges as vertex index pairs, drawn as one-pixel antialiased lines. */ edges?: Uint32Array}
    | {type: 'extrusion'; v: Float32Array; idx: Uint32Array; color?: Uint8Array}
    | {type: 'line'; /** Packed vertices, LINE_VERTEX bytes each: see tessellateLine. */ v: Uint8Array; idx: Uint32Array; color?: Uint8Array; width?: Float32Array; width1?: Float32Array}
    | {type: 'circle'; /** x, y, cornerX, cornerY per vertex */ pos: Int16Array; idx: Uint32Array; color?: Uint8Array; radius?: Float32Array; radius1?: Float32Array};
export interface TileGL { layers: Record<string, GLBatch>; labels: Record<string, LabelSrc[]>; icons?: Record<string, IconBatch> }
/** A raster tile as the SVG backend sees it: just somewhere to load the image from. */
export interface TileImage { href: string }

/** "Open Sans Semibold Italic" -> "italic 600|Open Sans|Open Sans Semibold Italic": CSS style and weight, the family named by the style, and the font stack (for the glyph files of the style). */
function fontStyle(names: any): string {
    const f = parseFontName(String(Array.isArray(names) ? names[0] : names));
    return (f.style === 'italic' ? 'italic ' : '') + f.weight + '|' + f.family + '|' + (Array.isArray(names) ? names.join(',') : names);
}

function pushColor(out: number[], c: RGBA, alpha: number) {
    out.push(Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * alpha * 255));
}

const WHITE: RGBA = [1, 1, 1, 1];

/** A decoded tile: named layers of features. Vector tiles and sliced GeoJSON both take this shape. */
export type TileLayers = Record<string, {features: TileFeature[]}>;
export interface TileFeature extends Feature { geometry(extent: number, coords: number[], ringEnds: number[]): number }

export function buildTile(data: Uint8Array | TileLayers, z: number, layers: CompiledLayer[], overscaled: number | false, states?: MapStates['f'], templates?: Record<string, string[]>, /** Icons that need no place among the labels go to `icons` (see `IconBatch`). */ direct?: boolean): TileIR {
    const vt: TileLayers = data instanceof Uint8Array ? decodeVectorTile(data) : data;
    const geomCache = new Map<TileFeature, {coords: number[]; ringEnds: number[]}>();
    const geometry = (f: TileFeature) => {
        let g = geomCache.get(f);
        if (!g) { g = {coords: [], ringEnds: []}; f.geometry(EXTENT, g.coords, g.ringEnds); geomCache.set(f, g); }
        return g;
    };
    const out: TileIR = {layers: {}, labels: {}};
    const ctx = {zoom: z, f: null as Feature | null};
    // A size is found at this zoom and at the next, and the map mixes the two. A tile that is built for the zoom of the
    // map (see `buildZoom` in the engine) has the correct size already.
    const z1 = z % 1 ? z : z + 1;

    for (const L of layers) {
        if (L.type === 'background' || !L.visible && !L.keep) continue;
        // A tile is drawn from its own zoom up to the next one. A tile of the source's deepest level is drawn further: it has
        // all the shapes, and the labels of the layers that show up to one level above the zoom of the map.
        if (L.minzoom >= (overscaled === false ? z + 1 : L.type === 'symbol' ? overscaled + 2 : 99)) continue;
        if (L.maxzoom <= z) continue;
        const vl = vt[L.sourceLayer ?? GEOJSON_LAYER];
        if (!vl) continue;
        const p = L.p;

        if (L.type === 'symbol') {
            const labels: LabelSrc[] = [], keys: number[] = [], sorted = p.sortKey.dd || p.sortKey.eval(z) !== 0;
            type Piece = {base: any; ring: number[]; type: number; along: boolean; spacing: number; key: number};
            const pieces: Piece[] = [], starts = new Map<string, Piece>(), ends = new Map<string, Piece>();
            // (The icons of `IconBatch`. The layer gives them one anchor, offset, alignment and colour, and no order.)
            const plain = direct && !sorted && !p.iconAnchor.dd && !p.iconOffset.dd && !p.iconAlign.dd && !p.iconColor.dd;
            const iconNames = new Map<string, number>(), iconName: number[] = [], iconPos: number[] = [], iconRotate: number[] = [], iconSize: number[] = [], iconAlpha: number[] = [];
            let iconAvoid: boolean | undefined;
            for (const f of vl.features) {
                ctx.f = f;
                f.state = f.id === undefined ? undefined : states?.[L.source!]?.[`${L.sourceLayer ?? ''}|${f.id}`];
                if (L.filter && !L.filter(ctx)) continue;
                const tokens = (v: unknown) => String(v ?? '').replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '').trim();
                let text = tokens(p.field.eval(z, f));
                // An image that is an SVG template: the name gets the value of each slot of the template, from `params` of
                // the `image` expression, or else from the property of the feature that has the name of the slot.
                const icon = String(p.icon.eval(z, f) ?? ''), [image, ...given] = icon.includes(VARIANT) ? icon.split(VARIANT) : [tokens(icon)], slots = templates?.[image];
                const iconName = slots ? [image, ...slots.map(s => given.find(g => g.startsWith(s + '='))?.slice(s.length + 1) ?? String(f.properties[s] ?? '').replaceAll(VARIANT, ''))].join(VARIANT) : image;
                if (!text && !iconName) continue;
                const tt = p.transform.eval(z, f);
                if (tt === 'uppercase' || tt === 'lowercase') {
                    // (Image names inside the text are left as they are.)
                    const change = (t: string) => tt === 'uppercase' ? t.toUpperCase() : t.toLowerCase();
                    text = text.split(/(\uE000[^\uE001]*\uE001)/).map((part, i) => i % 2 ? part : change(part)).join('');
                }
                // An opacity or a size that is the same for the whole layer is found again when labels are placed, at the zoom
                // of the map: a tile is shown at zooms other than its own. Only a value for each feature is kept here.
                const color = p.color.eval(z, f) as RGBA, op = p.opacity.dd ? p.opacity.eval(z, f) : 1, haloColor = p.haloColor.eval(z, f) as RGBA;
                const placement = p.placement.eval(z, f), along = placement !== 'point';
                // `text-rotation-alignment` and `icon-rotation-alignment`: `auto` is `map` along a line and `viewport` at a point.
                // (The flag is named for the usual case at a point: the symbol stays upright when the map turns.)
                const turns = (alignment: unknown) => along ? alignment === 'viewport' : alignment !== 'map';
                const base = {
                    text, size0: p.size.eval(z, f), size1: p.size.eval(z1, f),
                    color: [color[0], color[1], color[2], color[3] * op] as RGBA,
                    halo: [haloColor[0], haloColor[1], haloColor[2], haloColor[3] * op] as RGBA, haloWidth: p.haloWidth.eval(z, f), haloBlur: p.haloBlur.eval(z, f), rotate: p.rotate.eval(z, f) * Math.PI / 180, justify: justification(p.justify.eval(z, f), p.anchor.eval(z, f)), font: fontStyle(p.font.eval(z, f)),
                    maxWidth: p.maxWidth.eval(z, f), spacing: p.spacing.eval(z, f), offset: p.offset.eval(z, f), anchor: p.anchor.eval(z, f),
                    padding: p.padding.eval(z, f), overlap: overlaps(p.overlapMode.eval(z, f), p.overlap.eval(z, f)), lineHeight: p.lineHeight.eval(z, f), translate: p.translate.eval(z, f),
                    upright: turns(p.textAlign.eval(z, f)), textOptional: !!p.textOptional.eval(z, f), ignore: !!p.ignore.eval(z, f),
                    varAnchor: p.varAnchor.eval(z, f), radial: p.radial.eval(z, f), varOffset: p.varOffset.eval(z, f), maxAngle: p.maxAngle.eval(z, f), justifyAuto: p.justify.eval(z, f) === 'auto',
                    icon: iconName ? {
                        name: iconName, size: p.iconSize.eval(z, f), size1: p.iconSize.eval(z1, f), opacity: p.iconOpacity.dd ? p.iconOpacity.eval(z, f) : 1, anchor: p.iconAnchor.eval(z, f), color: p.iconColor.eval(z, f), halo: p.iconHalo.eval(z, f), haloWidth: p.iconHaloWidth.eval(z, f), offset: p.iconOffset.eval(z, f), rotate: p.iconRotate.eval(z, f),
                        fit: p.iconFit.eval(z, f), fitPad: p.iconFitPad.eval(z, f), overlap: overlaps(p.iconOverlapMode.eval(z, f), p.iconOverlap.eval(z, f)), ignore: !!p.iconIgnore.eval(z, f), padding: p.iconPadding.eval(z, f), translate: p.iconTranslate.eval(z, f),
                        optional: !!p.iconOptional.eval(z, f), upright: turns(p.iconAlign.eval(z, f)),
                    } : undefined,
                };
                // symbol-spacing is in pixels; tiles are EXTENT units across TILE_SIZE pixels.
                const g = geometry(f), spacing = p.symbolSpacing.eval(z, f) * EXTENT / 512, key = sorted ? +p.sortKey.eval(z, f) || 0 : 0;
                let start = 0;
                for (const end of g.ringEnds) {
                    const piece: Piece = {base, ring: g.coords.slice(start * 2, end * 2), type: f.type, along, spacing, key};
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
                for (const a of anchors(ring, 0, ring.length / 2, type, along, spacing, !!text, window)) {
                    if (a[0] < 0 || a[0] >= EXTENT || a[1] < 0 || a[1] >= EXTENT) continue;
                    // Everything a feature's labels have in common lives on a shared object behind each label, so a
                    // road with twenty anchors does not carry twenty copies of its text, colours and fonts.
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
        const heights: number[] = [], bases: number[] = [];
        const want = kind === 'fill' ? 3 : kind === 'circle' ? 1 : 0;
        const coords: number[] = [], ringEnds: number[] = [], featEnds: number[] = [];
        const ddColor = p.color.dd || p.opacity.dd;
        const color: number[] = [], scalar: number[] = [], scalar1: number[] = [];
        let grows = false;
        const progress: number[] | null = L.type === 'line' && L.ramp ? [] : null;
        const scalarProp = L.type === 'line' ? p.width : heat ? p.weight : L.type === 'circle' ? p.radius : null;
        // A sort key puts the features of the layer in order: larger keys are drawn later, above the others.
        let features = vl.features;
        const sortKey = (L.type === 'fill' || L.type === 'line' || L.type === 'circle') && p.sortKey.dd ? p.sortKey : null;
        if (sortKey) {
            const keyed: {f: (typeof features)[number]; key: number; i: number}[] = [];
            for (let i = 0; i < features.length; i++) keyed.push({f: features[i], key: +sortKey.eval(z, features[i]) || 0, i});
            features = keyed.sort((a, b) => a.key - b.key || a.i - b.i).map(k => k.f);
        }
        for (const f of features) {
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
                if (L.type === 'line' && f.type === 3) coords.push(g.coords[start * 2], g.coords[start * 2 + 1]);
                ringEnds.push(coords.length / 2);
                start = end;
            }
            featEnds.push(ringEnds.length);
            if (ddColor) pushColor(color, p.color.dd ? p.color.eval(z, f) : WHITE, p.opacity.dd ? p.opacity.eval(z, f) : 1);
            if (scalarProp?.dd) {
                const now = scalarProp.eval(z, f), next = heat ? now : scalarProp.eval(z1, f);
                scalar.push(now); scalar1.push(next);
                if (next !== now) grows = true;
            }
            if (progress) progress.push(f.properties.mapbox_clip_start ?? 0, f.properties.mapbox_clip_end ?? 1);
            if (extrude) { heights.push(p.height.eval(z, f)); bases.push(p.base.eval(z, f)); }
        }
        if (!featEnds.length) continue;
        const batch: Batch = {
            type: kind as Batch['type'],
            geom: {coords: Int16Array.from(coords), ringEnds: Uint32Array.from(ringEnds), featEnds: Uint32Array.from(featEnds)},
        };
        if (ddColor && !progress) batch.color = Uint8Array.from(color);
        if (progress) batch.progress = Float32Array.from(progress);
        if (scalarProp?.dd) batch[L.type === 'line' ? 'width' : 'radius'] = Float32Array.from(scalar);
        if (scalarProp?.dd && grows) batch[L.type === 'line' ? 'width1' : 'radius1'] = Float32Array.from(scalar1);
        if (extrude) { batch.height = Float32Array.from(heights); batch.base = Float32Array.from(bases); }
        if (L.type === 'line') { batch.cap = p.cap.eval(z); batch.join = p.join.eval(z); }
        if (L.type === 'fill') { batch.outline = p.outline.eval(z)[3] > 0; batch.antialias = p.antialias.eval(z) !== false; }
        out.layers[L.id] = batch;
    }
    return out;
}

/** Yields [x, y, angle, length, (anchor index in path, ...path)] label anchors for one ring. */
function anchors(c: number[], start: number, end: number, type: number, along: boolean, spacing: number, hasText: boolean, window = 0): number[][] {
    if (type === 1) return [[c[start * 2], c[start * 2 + 1], 0, 0]];
    if (type === 3 && !along) {
        let a = 0, cx = 0, cy = 0;
        for (let i = start, j = end - 1; i < end; j = i++) {
            const x0 = c[j * 2], y0 = c[j * 2 + 1], x1 = c[i * 2], y1 = c[i * 2 + 1], k = x0 * y1 - x1 * y0;
            a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
        }
        return a ? [[cx / (3 * a), cy / (3 * a), 0, 0]] : [];
    }
    let len = 0;
    for (let i = start + 1; i < end; i++) len += Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]);
    if (!len) return [];
    const at = (d: number): [number, number] => {
        for (let i = start + 1; i < end; i++) {
            const seg = Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]);
            if (d <= seg && seg) { const t = d / seg; return [c[i * 2 - 2] + (c[i * 2] - c[i * 2 - 2]) * t, c[i * 2 - 1] + (c[i * 2 + 1] - c[i * 2 - 1]) * t]; }
            d -= seg;
        }
        return [c[end * 2 - 2], c[end * 2 - 1]];
    };
    // Named lines always get one label; icon-only symbols (one-way arrows) need a reasonable run of line.
    let n = along ? Math.floor(len / spacing) : 1;
    if (!n) { if (!hasText && len < spacing / 4) return []; n = 1; }
    const out: number[][] = [];
    for (let i = 0; i < n; i++) {
        const d = (i + 0.5) / n * len, span = Math.min(d, len - d, 250);
        const [x, y] = at(d), [ax, ay] = at(d - span), [bx, by] = at(d + span);
        const anchor = [x, y, Math.atan2(by - ay, bx - ax), len];
        if (along && window > 0) {
            // The stretch of line around the anchor, for text that follows the curve: its points, then the index of the anchor among them.
            const d0 = Math.max(0, d - window), d1 = Math.min(len, d + window), path = [...at(d0)];
            let run = 0, index = -1;
            for (let k = start + 1; k < end; k++) {
                const before = run;
                run += Math.hypot(c[k * 2] - c[k * 2 - 2], c[k * 2 + 1] - c[k * 2 - 1]);
                if (index < 0 && d <= run && d >= before) { index = path.length / 2; path.push(x, y); }
                if (run > d0 && run < d1 && run !== d) path.push(c[k * 2], c[k * 2 + 1]);
            }
            if (index < 0) { index = path.length / 2; path.push(x, y); }
            path.push(...at(d1));
            anchor.push(index, ...path.map(Math.round));
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
export function unpackLabels(packed: PackedLabels): Record<string, LabelSrc[]> {
    const out: Record<string, LabelSrc[]> = {};
    for (const id in packed) out[id] = packed[id].own.map(([i, own]) => (i < 0 ? own : Object.setPrototypeOf(own, packed[id].shared[i])) as LabelSrc);
    return out;
}

/** `text-overlap` / `icon-overlap` ('never', 'always', 'cooperative') take precedence over the older allow-overlap flags. */
const overlaps = (mode: string, allow: unknown) => mode ? mode !== 'never' : !!allow;

/** `text-justify` as a number; `auto` follows the side the text is anchored on. */
export function justification(justify: string, anchor: string): number {
    const side = justify === 'auto' ? anchor : justify;
    return side.includes('left') ? -1 : side.includes('right') ? 1 : 0;
}

/** Expands a neutral batch into vertex and index buffers for the GPU. */
export function tessellate(b: Batch): GLBatch | null {
    const {coords, ringEnds, featEnds} = b.geom;
    if (b.type === 'circle') {
        // Four vertices per point (position plus which corner), drawn as ordinary indexed triangles. Instancing would
        // be more compact but is many times slower on software renderers.
        const n = ringEnds.length, pos = new Int16Array(n * 16), idx = new Uint32Array(n * 6);
        const color = b.color ? new Uint8Array(n * 16) : undefined, radius = b.radius ? new Float32Array(n * 4) : undefined, radius1 = b.radius1 ? new Float32Array(n * 4) : undefined;
        for (let f = 0, r = 0; f < featEnds.length; f++) {
            for (; r < featEnds[f]; r++) {
                const i = ringEnds[r] - 1;
                for (let k = 0; k < 4; k++) {
                    pos.set([coords[i * 2], coords[i * 2 + 1], k & 1 ? 1 : -1, k & 2 ? 1 : -1], (r * 4 + k) * 4);
                    if (color) color.set(b.color!.subarray(f * 4, f * 4 + 4), (r * 4 + k) * 4);
                    if (radius) radius[r * 4 + k] = b.radius![f];
                    if (radius1) radius1[r * 4 + k] = b.radius1![f];
                }
                idx.set([r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 1, r * 4 + 3, r * 4 + 2], r * 6);
            }
        }
        return {type: 'circle', pos, idx, color, radius};
    }
    const idx: number[] = [];
    if (b.type === 'fill') {
        if (b.height) return tessellateExtrusion(b);
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
        // (and carries the outline colour when the style sets one). Edges created by clipping at the tile border are skipped.
        let edges: Uint32Array | undefined;
        if (b.antialias !== false || b.outline) {
            const list: number[] = [], out = (i: number, j: number, k: number) => (coords[i * 2 + k] <= 0 && coords[j * 2 + k] <= 0) || (coords[i * 2 + k] >= EXTENT && coords[j * 2 + k] >= EXTENT);
            for (let r = 0; r < ringEnds.length; r++) {
                const s = r ? ringEnds[r - 1] : 0, e = ringEnds[r];
                for (let i = s, j = e - 1; i < e; j = i++) if (!out(i, j, 0) && !out(i, j, 1)) list.push(j, i);
            }
            edges = Uint32Array.from(list);
        }
        return {type: 'fill', pos: coords, idx: Uint32Array.from(idx), color, edges};
    }

    return tessellateLine(b);
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
        const area = ringArea(coords, r ? ringEnds[r - 1] : 0, ringEnds[r]);
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
 * metres: the light on a wall depends on the base and the height together.
 */
export const ROOF = -1, WALL_TOP = 8, WALL_OTHER = 16;

/** Buildings: a roof at the feature's height and a wall under every edge. Each vertex says which way its face looks, for the light. */
function tessellateExtrusion(b: Batch): GLBatch | null {
    const {coords, featEnds} = b.geom, v: number[] = [], idx: number[] = [], color: number[] = [];
    let count = 0;
    for (let f = 0; f < featEnds.length; f++) {
        const top = b.height![f], bottom = Math.min(b.base ? b.base[f] : 0, top);
        const vert = (x: number, y: number, z: number, light: number) => {
            v.push(x, y, z, light);
            if (b.color) color.push(b.color[f * 4], b.color[f * 4 + 1], b.color[f * 4 + 2], b.color[f * 4 + 3]);
            return count++;
        };
        eachPolygon(b.geom, f, (p0, p1, holes) => {
            const roof = count, tris = earcut(coords.subarray(p0 * 2, p1 * 2) as any, holes);
            for (let i = p0; i < p1; i++) vert(coords[i * 2], coords[i * 2 + 1], top, ROOF);
            for (let i = 0; i < tris.length; i++) idx.push(roof + tris[i]);
            if (top <= bottom) return;
            const bounds = [0, ...holes, p1 - p0];
            // The side of an edge that is outside depends on the direction of the outer ring.
            let area = 0;
            for (let i = p0, j = p0 + bounds[1] - 1; i < p0 + bounds[1]; j = i++) area += coords[j * 2] * coords[i * 2 + 1] - coords[i * 2] * coords[j * 2 + 1];
            const out = area >= 0 ? 1 : -1;
            for (let r = 0; r + 1 < bounds.length; r++) {
                const s = p0 + bounds[r], e = p0 + bounds[r + 1];
                for (let i = s, j = e - 1; i < e; j = i++) {
                    const ax = coords[j * 2], ay = coords[j * 2 + 1], bx = coords[i * 2], by = coords[i * 2 + 1], len = Math.hypot(bx - ax, by - ay);
                    if (!len) continue;
                    const facing = Math.atan2(-(bx - ax) * out, (by - ay) * out) + Math.PI, other = (h: number) => WALL_OTHER * Math.floor(Math.min(60000, Math.max(0, h)));
                    const low = facing + other(top), high = facing + WALL_TOP + other(bottom);
                    const q = vert(ax, ay, bottom, low);
                    vert(bx, by, bottom, low); vert(bx, by, top, high); vert(ax, ay, top, high);
                    idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
                }
            }
        });
    }
    if (!idx.length) return null;
    const out: GLBatch = {type: 'extrusion', v: Float32Array.from(v), idx: Uint32Array.from(idx)};
    if (b.color) out.color = Uint8Array.from(color);
    return out;
}

const ARC_STEP = Math.PI / 5;

/**
 * Lines: each vertex becomes a pair extruded along its normal in the vertex shader. Vertex layout is
 * x, y, normalX, normalY, side (-1..1 across the line, for edge antialiasing), distance along the line (for dashes).
 */
/**
 * A line vertex is 16 bytes: position x, y (int16, tile units); the direction to push it sideways (int16, times
 * LINE_NORMAL; it is longer than 1 at a mitred corner); which side of the line it is on (int16: -1, 0, 1); two unused
 * bytes; and the distance along the line (float32, for dashes).
 */
export const LINE_VERTEX = 16, LINE_NORMAL = 8192;

function tessellateLine(b: Batch): GLBatch | null {
    const {coords, ringEnds, featEnds} = b.geom;
    const v: number[] = [], idx: number[] = [], color: number[] = [], width: number[] = [], width1: number[] = [];
    const round = b.join === 'round', miter = !round && b.join !== 'bevel';
    let count = 0, f = 0, ringLength = 1;
    const vert = (x: number, y: number, nx: number, ny: number, side: number, dist: number) => {
        if (b.progress) {
            // The place along the whole line goes in the colour's red and green bytes, as one 16-bit number.
            const from = b.progress[f * 2], part = Math.min(1, Math.max(0, from + (b.progress[f * 2 + 1] - from) * dist / ringLength)), t = Math.round(part * 65535);
            color.push(t >> 8, t & 255, 0, 255);
            // The dashes of a line with a gradient: MapLibre measures such a line as 16383 tile units from end to
            // end, whatever its length. The same is done here, so that the dashes are those of MapLibre.
            dist = part * 16383.5;
        }
        v.push(x, y, nx, ny, side, dist);
        if (b.color) color.push(b.color[f * 4], b.color[f * 4 + 1], b.color[f * 4 + 2], b.color[f * 4 + 3]);
        if (b.width) width.push(b.width[f]);
        if (b.width1) width1.push(b.width1[f]);
        return count++;
    };
    /** A fan around (x, y) sweeping `sweep` radians from angle `from`: used for round joins and caps. */
    const fan = (x: number, y: number, from: number, sweep: number, dist: number) => {
        const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP)), centre = vert(x, y, 0, 0, 0, dist);
        let prev = vert(x, y, Math.cos(from), Math.sin(from), 1, dist);
        for (let k = 1; k <= steps; k++) {
            const a = from + sweep * k / steps, cur = vert(x, y, Math.cos(a), Math.sin(a), 1, dist);
            idx.push(centre, prev, cur);
            prev = cur;
        }
    };
    for (let r = 0; f < featEnds.length; f++) {
        for (; r < featEnds[f]; r++) {
            // Drop repeated points, then walk the segments.
            const xs: number[] = [], ys: number[] = [];
            for (let i = r ? ringEnds[r - 1] : 0; i < ringEnds[r]; i++) {
                const x = coords[i * 2], y = coords[i * 2 + 1], n = xs.length;
                if (!n || x !== xs[n - 1] || y !== ys[n - 1]) { xs.push(x); ys.push(y); }
            }
            const n = xs.length;
            if (n < 2) continue;
            if (b.progress) { ringLength = 0; for (let i = 0; i < n - 1; i++) ringLength += Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]); }
            let last = -1, dist = 0, pdx = 0, pdy = 0;
            const pair = (x: number, y: number, nx: number, ny: number, ox = 0, oy = 0) => {
                const a = vert(x, y, nx + ox, ny + oy, 1, dist);
                vert(x, y, -nx + ox, -ny + oy, -1, dist);
                if (last >= 0) idx.push(last, last + 1, a, last + 1, a + 1, a);
                last = a;
            };
            for (let i = 0; i < n - 1; i++) {
                const x = xs[i], y = ys[i], ex = xs[i + 1] - x, ey = ys[i + 1] - y, len = Math.hypot(ex, ey);
                const dx = ex / len, dy = ey / len, nx = -dy, ny = dx;
                if (i === 0) {
                    if (b.cap === 'round') fan(x, y, Math.atan2(ny, nx), Math.PI, dist);
                    pair(x, y, nx, ny, ...(b.cap === 'square' ? [-dx, -dy] : [0, 0]));
                } else {
                    const pnx = -pdy, pny = pdx, mx = pnx + nx, my = pny + ny, ml = Math.hypot(mx, my);
                    const cos = ml ? (mx * pnx + my * pny) / ml : 0;
                    if (cos > (miter ? 0.5 : 0.98)) pair(x, y, mx / (ml * cos), my / (ml * cos));
                    else {
                        // Two pairs at the corner give a bevel; a fan on the outer side rounds it off.
                        pair(x, y, pnx, pny);
                        if (round) {
                            const outer = pnx * dx + pny * dy < 0 ? 1 : -1, a0 = Math.atan2(outer * pny, outer * pnx);
                            let sweep = Math.atan2(outer * ny, outer * nx) - a0;
                            if (sweep > Math.PI) sweep -= 2 * Math.PI; else if (sweep < -Math.PI) sweep += 2 * Math.PI;
                            fan(x, y, a0, sweep, dist);
                        }
                        pair(x, y, nx, ny);
                    }
                }
                dist += len;
                pdx = dx; pdy = dy;
                if (i === n - 2) {
                    const px = xs[n - 1], py = ys[n - 1];
                    pair(px, py, nx, ny, ...(b.cap === 'square' ? [dx, dy] : [0, 0]));
                    if (b.cap === 'round') fan(px, py, Math.atan2(ny, nx), -Math.PI, dist);
                }
            }
        }
    }
    if (!idx.length) return null;
    // Packed to 16 bytes a vertex (it was 24 as plain floats): lines are most of a tile, and every byte is uploaded.
    const packed = new ArrayBuffer(count * LINE_VERTEX), view = new DataView(packed);
    for (let i = 0, o = 0; i < count; i++, o += LINE_VERTEX) {
        view.setInt16(o, Math.round(v[i * 6]), true); view.setInt16(o + 2, Math.round(v[i * 6 + 1]), true);
        view.setInt16(o + 4, Math.round(v[i * 6 + 2] * LINE_NORMAL), true); view.setInt16(o + 6, Math.round(v[i * 6 + 3] * LINE_NORMAL), true);
        view.setInt16(o + 8, v[i * 6 + 4], true);
        view.setFloat32(o + 12, v[i * 6 + 5], true);
    }
    const out: GLBatch = {type: 'line', v: new Uint8Array(packed), idx: Uint32Array.from(idx)};
    if (b.color || b.progress) out.color = Uint8Array.from(color);
    if (b.width) out.width = Float32Array.from(width);
    if (b.width1) out.width1 = Float32Array.from(width1);
    return out;
}

export function toGL(ir: TileIR): {tile: TileGL; transfer: ArrayBuffer[]} {
    const tile: TileGL = {layers: {}, labels: ir.labels, icons: ir.icons}, transfer = new Set<ArrayBuffer>();
    for (const b of Object.values(ir.icons ?? {})) for (const a of Object.values(b)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    for (const id in ir.layers) {
        const b = ir.layers[id];
        const g = tessellate(b);
        if (!g) continue;
        tile.layers[id] = g;
        for (const a of Object.values(g)) if (ArrayBuffer.isView(a)) transfer.add(a.buffer as ArrayBuffer);
    }
    return {tile, transfer: [...transfer]};
}
