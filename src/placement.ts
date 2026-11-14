import {type Mat, type Transform, type TileID, EXTENT} from './geo.ts';
import type {CompiledLayer, SpriteIcon} from './style.ts';
import {justification, type LabelSrc} from './tile.ts';
import {BASELINE, EM, type Shaped, type Shaper} from './text.ts';
import {CollisionGrid} from './collision.ts';

/** One tile (or part of one) scheduled for drawing this frame. */
export interface RenderItem<T> {
    id: TileID;
    /** Image sources: the picture's corners in this tile's units (x, y pairs, clockwise from top left). */
    corners?: number[];
    matrix: Mat;
    /** The same mapping with perspective, for the GPU. */
    matrix4: Float32Array;
    /** Pixels per tile unit. */
    scale: number;
    /** Visible sub-rectangle in tile units; smaller than the full tile when a parent stands in for a missing child. */
    clip: [number, number, number, number];
    tile: T;
}

export interface PlacedIcon {
    /** Centre, size and rotation on screen. */
    x: number; y: number; w: number; h: number; angle: number;
    /** Source rectangle in the sprite sheet, in its pixels. */
    rect: [number, number, number, number];
    /** For stretchable icons: (source pixel, screen pixel) pairs along each axis, measured from the icon's left/top edge. */
    gx?: number[]; gy?: number[];
    opacity: number;
    /** Distance-field icons with a halo: its colour, and how far it reaches as a part of the distance field (0 to 1). */
    halo?: number[]; haloReach?: number;
    /** Set for distance-field icons, which are drawn in this colour. */
    color?: number[];
    /** True for images added at runtime (drawn from the dynamic atlas) rather than the style's sprite sheet. */
    custom?: boolean;
    name: string;
}
export interface Placed {
    /** Centre of the text block in screen pixels. */
    x: number; y: number;
    angle: number; size: number; shaped: Shaped | null; src: LabelSrc; icon?: PlacedIcon;
    /** Line alignment chosen at placement (`text-justify: auto` with a list of anchors); otherwise the label's own. */
    justify?: number;
    /** The `text-opacity` of the layer at the zoom of the map (1 when it is a value for each feature, which is in the colours). */
    alpha?: number;
    /** Text following a line: for each glyph, where its baseline starts relative to the label's anchor, and its rotation (x, y, angle triples). */
    curve?: number[];
    /**
     * Text following a line on a tilted map lies on the ground. For each glyph: the length on the screen of one pixel of
     * text along the line, and the direction on the screen of one pixel of text across it (scale, x, y triples).
     */
    ground?: number[];
    /** Identity that survives between placements (and between a tile and its parent), for fading. */
    key: string;
    tile: TileID;
    /** Where the label's map anchor was on screen when placed, so it can be moved with the map between placements. */
    ax: number; ay: number;
    opacity: number;
}
/**
 * Sizes one axis of an icon so that its content range [c0, c1] (image pixels) becomes `target` screen pixels long,
 * growing only the stretch zones. Returns the icon's length, where its content starts, and the cut points.
 */
function fitAxis(size: number, zones: [number, number][] | undefined, c0: number, c1: number, target: number, unit: number) {
    const z = zones?.length ? zones : [[0, size] as [number, number]];
    const stretchIn = (a: number, b: number) => z.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(b, e) - Math.max(a, s)), 0);
    const sIn = stretchIn(c0, c1), k = sIn > 0 ? Math.max(0, (target / unit - (c1 - c0 - sIn)) / sIn) : 1;
    const map = (p: number) => { const st = stretchIn(0, p); return (p - st + st * k) * unit; };
    const cuts: number[] = [];
    for (const p of [...new Set([0, ...z.flat(), size])].sort((a, b) => a - b)) cuts.push(p, map(p));
    return {len: map(size), off: map(c0), cuts};
}

export type IconLookup = (name: string) => (SpriteIcon & {custom?: boolean}) | undefined;

export {CollisionGrid};


type Box = [number, number, number, number];
function boxAround(x: number, y: number, w: number, h: number, angle: number, pad: number): Box {
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const hw = (w * cos + h * sin) / 2 + pad, hh = (w * sin + h * cos) / 2 + pad;
    return [x - hw, y - hh, x + hw, y + hh];
}

/**
 * The anchors of the labels placed so far in a layer, by text. Each anchor is kept in two grids: one of cells of 16
 * pixels for the test of 1 pixel between point labels, and one of 300 pixels for the test of 300 pixels between line
 * labels. A test reads only the cells that its circle touches, so a text that repeats many times stays cheap (#332).
 */
class SameText {
    private grids: Map<string, Map<number, number[]>>[] = [new Map(), new Map()];
    clear() { for (const g of this.grids) g.clear(); }
    add(text: string, x: number, y: number, item: number) {
        for (let i = 0; i < 2; i++) {
            const size = i ? 300 : 16, g = this.grids[i];
            let cells = g.get(text);
            if (!cells) g.set(text, cells = new Map());
            // (A key that two cells share only adds anchors to test, which the distance test then rejects.)
            const k = Math.floor(x / size) * 65536 + Math.floor(y / size), c = cells.get(k);
            if (c) c.push(x, y, item); else cells.set(k, [x, y, item]);
        }
    }
    /** Whether a label with this text is closer than `r` pixels (at most 300), leaving out those of item `skip`. */
    near(text: string, x: number, y: number, r: number, skip: number) {
        const size = r > 16 ? 300 : 16, cells = this.grids[r > 16 ? 1 : 0].get(text);
        if (!cells) return false;
        for (let cx = Math.floor((x - r) / size); cx <= Math.floor((x + r) / size); cx++)
            for (let cy = Math.floor((y - r) / size); cy <= Math.floor((y + r) / size); cy++) {
                const c = cells.get(cx * 65536 + cy);
                if (c) for (let i = 0; i < c.length; i += 3) if (c[i + 2] !== skip && Math.hypot(c[i] - x, c[i + 1] - y) < r) return true;
            }
        return false;
    }
}

/**
 * Chooses which labels and icons to show. Layers later in the style win, matching MapLibre's priority order.
 * Runs fully from scratch each call; it is cheap enough for the label counts of a single viewport.
 */
/** The distance on each axis for a radial offset: a corner anchor shares it between both. */
const rx_ = (anchor: string, r: number) => anchor.includes('-') ? r / Math.SQRT2 : r;

export function placeLabels(
    tr: Transform, items: RenderItem<{labels: Record<string, LabelSrc[]>; z?: number}>[], layers: CompiledLayer[], shaper: Shaper, grid: CollisionGrid,
    icons?: IconLookup,
    /** Called when the placement comes to a symbol layer, before its labels: for what takes space with that layer and is not placed here. */
    before?: (layer: CompiledLayer) => void,
): Placed[] {
    const out: Placed[] = [], seen = new SameText();
    let itemNo = 0;
    const keys = new Map<string, number>();
    const twins = new Map<string, {layer: string; group?: string; box: Box; x: number; y: number; justify?: number}>();
    const margin = 100;
    const north = -tr.bearing * Math.PI / 180; // the angle on the screen of the direction that is up on the map
    for (let li = layers.length - 1; li >= 0; li--) {
        const L = layers[li];
        if (L.type !== 'symbol' || !L.visible || tr.zoom < L.minzoom || tr.zoom >= L.maxzoom) continue;
        before?.(L);
        // The same text is a duplicate only in its own layer (the same feature from two tiles, or a road name that
        // repeats). Two layers can show the same text at one point, as in MapLibre.
        seen.clear();
        // The labels of a layer with `symbol-sort-key` are placed in the order of the key over all tiles, as in MapLibre:
        // a label does not win only because its tile comes first.
        let runs: {it: typeof items[0]; labels: LabelSrc[]; no: number}[] = [];
        for (const it of items) { const labels = it.tile.labels?.[L.id]; itemNo++; if (labels) runs.push({it, labels, no: itemNo}); }
        if (runs.length > 1 && (L.p.sortKey.dd || L.p.sortKey.eval(tr.zoom) !== 0)) {
            const all: typeof runs = [];
            for (const r of runs) for (const l of r.labels) all.push({it: r.it, labels: [l], no: r.no});
            runs = all.sort((a, b) => a.labels[0].key! - b.labels[0].key!); // (the sort keeps the order of equal keys)
        }
        for (const {it, labels, no: itemNo} of runs) {
            const t = Math.min(1, Math.max(0, tr.zoom - (it.tile.z ?? it.id.z)));
            for (const l of labels) {
                if (l.x < it.clip[0] || l.y < it.clip[1] || l.x >= it.clip[2] || l.y >= it.clip[3]) continue;
                const [ax, ay, depth] = tr.projectTile(it.id, l.x, l.y);
                if (ax < -margin || ay < -margin || ax > tr.width + margin || ay > tr.height + margin) continue;
                if (tr.heightAt) { const n = 2 ** it.id.z; if (tr.occluded((it.id.x + it.id.w * n + l.x / EXTENT) / n, (it.id.y + l.y / EXTENT) / n)) continue; }
                // (A size that is the same for the layer is found at the zoom of the map. A size for each feature is known at
                // two levels only, and is mixed between them.)
                // On a tilted map, labels and icons far from the camera are smaller and near ones are larger, by half of what
                // the perspective does to the map itself (as in MapLibre).
                const persp = tr.pitch ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1;
                const size = (L.p.size.dd ? l.size0 + (l.size1 - l.size0) * t : L.p.size.eval(tr.zoom)) * persp, s = size / EM, line = l.angle !== null;
                const alpha = L.p.opacity.dd ? 1 : L.p.opacity.eval(tr.zoom);
                const meta = l.icon ? icons?.(l.icon.name) : undefined;
                const shaped = l.text ? shaper.shape(l.text, l.font, line ? 1e3 : l.maxWidth, l.spacing, l.lineHeight, l.size0) : null;
                if (shaped?.wait) continue; // its glyph file is on its way
                const w = shaped ? shaped.width * s : 0, h = shaped ? shaped.height * s : 0;
                const hasText = w > 0;
                if (!hasText && !meta) continue;
                // Direction of the line on screen, found by projecting a second point a little way along it.
                let lineAngle = 0;
                if (line) { const [bx, by] = tr.projectTile(it.id, l.x + Math.cos(l.angle!) * 64, l.y + Math.sin(l.angle!) * 64); lineAngle = Math.atan2(by - ay, bx - ax); }

                // Where the text could go: along the line, at one of several anchors, or at its fixed anchor.
                let twin: {layer: string; group?: string; box: Box; x: number; y: number; justify?: number} | undefined, twinKey = '';
                let textAngle = 0, candidates: [number, number][] = [];
                /** Text that follows its line (placed already). */
                let bent: Placed | undefined;
                const anchors: string[] = [];
                if (hasText) {
                    const shift = (anchor: string, r: number): [number, number] => [
                        anchor.includes('left') ? w / 2 + r : anchor.includes('right') ? -w / 2 - r : 0,
                        anchor.includes('top') ? h / 2 + r : anchor.includes('bottom') ? -h / 2 - r : 0];
                    if (line && !l.upright && l.path && shaped!.lines.length === 1 && shaped!.lines[0].chars.length > 1) {
                        // Follow the line: each glyph sits on the path at its own distance from the anchor, turned to the path's direction.
                        // (On a tilted map the text lies on the ground, and the ground gives it the whole perspective. As in MapLibre,
                        // its size on the ground takes half of that away again, so far text stays readable.)
                        const curved = followLine(tr, it, l, shaped!.lines[0], s, ax, ay, w, h, tr.pitch ? s / persp / persp : 0);
                        if (!curved) continue;
                        if (seen.near(l.text, ax, ay, 300, -1)) continue;
                        if (!l.overlap && curved.boxes.some(b => grid.hits(...b))) continue;
                        if (!l.ignore) for (const b of curved.boxes) grid.insert(...b);
                        seen.add(l.text, ax, ay, itemNo);
                        const n = 2 ** it.id.z, q = 2 ** 22;
                        const key = `${L.id}|${l.text}||${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                        bent = {x: ax, y: ay, angle: 0, size: curved.ground ? size / persp / persp : size, shaped, src: l, curve: curved.curve, ground: curved.ground, key, tile: it.id, ax, ay, opacity: 1, alpha};
                        // (No icon: the text is all. With an icon, the icon is found below, as for other text.)
                        if (!meta) { out.push(bent); continue; }
                    } else if (line && !l.upright) {
                        if (l.len * it.scale < w * 1.15) continue; // the road is shorter than its name at this zoom
                        textAngle = Math.atan2(Math.sin(lineAngle), Math.cos(lineAngle));
                        if (textAngle > Math.PI / 2) textAngle -= Math.PI; else if (textAngle <= -Math.PI / 2) textAngle += Math.PI;
                        const oy = l.offset[1] * size;
                        candidates = [[-Math.sin(textAngle) * oy, Math.cos(textAngle) * oy]];
                    } else if (!line && (l.varOffset?.length || l.varAnchor?.length)) {
                        // Several anchors to try in order. Each has its own offset: given with the anchor, pushed out
                        // from the point by the radial offset, or `text-offset` turned to point away from the anchor.
                        const side = (a: string, r: number): [number, number] => [
                            a.includes('left') ? r : a.includes('right') ? -r : 0, a.includes('top') ? r : a.includes('bottom') ? -r : 0];
                        // MapLibre moves text at a top or bottom anchor towards the point, to allow for the space above the letters.
                        const add = (a: string, ox: number, oy: number) => {
                            const [sx, sy] = shift(a, 0), near = a.includes('top') ? -0.15 : a.includes('bottom') ? 0.15 : 0;
                            anchors.push(a); candidates.push([sx + ox * size, sy + (oy + near) * size]);
                        };
                        if (l.varOffset?.length) {
                            for (let i = 0; i + 1 < l.varOffset.length; i += 2) { const o = l.varOffset[i + 1] as [number, number]; add(l.varOffset[i] as string, o[0], o[1]); }
                        } else for (const a of l.varAnchor!) {
                            if (l.radial) { const [rx, ry] = side(a, rx_(a, l.radial)); add(a, rx, ry); }
                            else add(a, side(a, Math.abs(l.offset[0]))[0], side(a, Math.abs(l.offset[1]))[1]);
                        }
                    }
                    else {
                        const [sx, sy] = line ? [0, 0] : shift(l.anchor, 0);
                        candidates = [[l.offset[0] * size + sx, l.offset[1] * size + sy]];
                    }
                    // At a point, text that is aligned with the map turns with the map (an arrow keeps its direction on the ground).
                    const turned = l.rotate + (l.upright ? 0 : north);
                    if (!line && turned) {
                        // text-rotate turns the label about its anchor point, so the offset from the anchor turns with it.
                        const c = Math.cos(turned), sn = Math.sin(turned);
                        textAngle = turned;
                        candidates = candidates.map(([dx, dy]) => [dx * c - dy * sn, dx * sn + dy * c]);
                    }
                    if (l.translate[0] || l.translate[1]) candidates = candidates.map(([dx, dy]) => [dx + l.translate[0], dy + l.translate[1]]);
                    // The same name often arrives from several tiles or road segments: keep them apart.
                    // The same label in a second layer (for example, to draw it twice for more weight) goes where the first is.
                    twin = line ? undefined : twins.get(twinKey = `${l.text}|${l.font}|${size}|${Math.round(ax)},${Math.round(ay)}`);
                    if (twin && (twin.layer === L.id || twin.group !== L.group)) twin = undefined;
                    // Point labels from one tile are separate features, also when they have the same position.
                    if (!twin && !bent && seen.near(l.text, ax, ay, line ? 300 : 1, line ? -1 : itemNo)) continue; // (text on its line has passed this test already)
                }
                let textBox: Box | null = null, tx = ax, ty = ay;
                let justify: number | undefined;
                if (twin) { textBox = twin.box; tx = twin.x; ty = twin.y; justify = twin.justify; }
                else for (let i = 0; i < candidates.length; i++) {
                    const [dx, dy] = candidates[i], box = boxAround(ax + dx, ay + dy, w, h, textAngle, l.padding);
                    if (l.overlap || !grid.hits(...box)) {
                        textBox = box; tx = ax + dx; ty = ay + dy;
                        if (l.justifyAuto && anchors[i]) justify = justification('auto', anchors[i]);
                        break;
                    }
                }
                if (hasText && !textBox && !bent && !(meta && l.textOptional)) continue;

                let icon: PlacedIcon | undefined, iconBox: Box | null = null;
                // (An icon that is fitted to text is not drawn where there is no text, as in MapLibre.)
                if (meta && l.icon && (hasText || l.icon.fit === 'none')) {
                    const ic = l.icon, fit = hasText && (textBox || bent) ? ic.fit : 'none', isize = (L.p.iconSize.dd ? ic.size + (ic.size1 - ic.size) * t : L.p.iconSize.eval(tr.zoom)) * persp;
                    let iw = meta.width / meta.pixelRatio * isize, ih = meta.height / meta.pixelRatio * isize;
                    // The anchor names the part of the icon that sits on the point.
                    let ix = ax + ic.offset[0] * isize + (ic.anchor.includes('left') ? iw / 2 : ic.anchor.includes('right') ? -iw / 2 : 0);
                    let iy = ay + ic.offset[1] * isize + (ic.anchor.includes('top') ? ih / 2 : ic.anchor.includes('bottom') ? -ih / 2 : 0);
                    let gx: number[] | undefined, gy: number[] | undefined;
                    if (fit !== 'none') {
                        // Stretch the icon around the text, e.g. a road shield around its number. Only the image's
                        // stretch ranges grow; its content box ends up around the padded text. As in MapLibre, the
                        // icon's own anchor is not used: an axis that is not fitted keeps its size, centred on the text.
                        const [pt, pr, pb, pl] = ic.fitPad.map(v => v * isize), unit = isize / meta.pixelRatio, c = meta.content;
                        const ox = ic.offset[0] * isize, oy = ic.offset[1] * isize;
                        // The box the content must fill, relative to the label's point.
                        let left = tx - ax - w / 2 - pl, top = ty - ay - h / 2 - pt, cw = w + pl + pr, ch = h + pt + pb;
                        if (c && fit === 'both') {
                            // Sprites can ask for the content box to keep its shape, or to grow only.
                            const ratio = (c[2] - c[0]) / (c[3] - c[1]), fw = meta.textFitWidth ?? 'stretchOrShrink', fh = meta.textFitHeight ?? 'stretchOrShrink';
                            if (fh === 'proportional') {
                                if (fw === 'proportional' || (fw === 'stretchOnly' && cw / ch < ratio)) { const n = Math.ceil(ch * ratio); left *= n / cw; cw = n; }
                            } else if (fw === 'proportional' && fh === 'stretchOnly' && ratio !== 0 && cw / ch > ratio) { const n = Math.ceil(cw / ratio); top *= n / ch; ch = n; }
                        }
                        if (fit !== 'height') {
                            const f = fitAxis(meta.width, meta.stretchX, c?.[0] ?? 0, c?.[2] ?? meta.width, cw, unit);
                            iw = f.len; ix = ax + left - f.off + iw / 2 + ox; gx = f.cuts;
                        } else ix = tx + ox;
                        if (fit !== 'width') {
                            const f = fitAxis(meta.height, meta.stretchY, c?.[1] ?? 0, c?.[3] ?? meta.height, ch, unit);
                            ih = f.len; iy = ay + top - f.off + ih / 2 + oy; gy = f.cuts;
                        } else iy = ty + oy;
                    }
                    // (An icon that is fitted to text on a line turns with the text, which reads from left to right.)
                    const along = fit !== 'none' && Math.abs(lineAngle) > Math.PI / 2 ? lineAngle + Math.PI : lineAngle;
                    const angle = (ic.upright ? 0 : line ? along : north) + ic.rotate * Math.PI / 180;
                    ix += ic.translate[0]; iy += ic.translate[1];
                    const box = boxAround(ix, iy, iw, ih, angle, ic.padding);
                    if (ic.overlap || !grid.hits(...box)) {
                        iconBox = box;
                        icon = {x: ix, y: iy, w: iw, h: ih, angle, rect: [meta.x, meta.y, meta.width, meta.height], custom: meta.custom, name: ic.name, gx, gy, opacity: ic.opacity * (L.p.iconOpacity.dd ? 1 : L.p.iconOpacity.eval(tr.zoom)), color: meta.sdf ? ic.color : undefined,
                            // (In the distance field of a sprite, one image pixel is one eighth of the range.)
                            halo: meta.sdf && ic.haloWidth > 0 && ic.halo[3] > 0 ? ic.halo : undefined, haloReach: Math.min(0.7, ic.haloWidth / (isize / meta.pixelRatio) / 8)};
                    } else if (!(hasText && (textBox || bent) && ic.optional)) { if (bent) out.push(bent); continue; }
                }
                if (bent) { bent.icon = icon; if (iconBox && !l.icon!.ignore) grid.insert(...iconBox); out.push(bent); continue; }
                if (!textBox && !icon) continue;
                if (textBox && twinKey && !twin) twins.set(twinKey, {layer: L.id, group: L.group, box: textBox, x: tx, y: ty, justify});
                if (textBox && !l.ignore && !twin) grid.insert(...textBox);
                if (iconBox && !l.icon!.ignore) grid.insert(...iconBox);
                if (textBox) seen.add(l.text, ax, ay, itemNo);
                const n = 2 ** it.id.z, q = 2 ** 22;
                const key = `${L.id}|${l.text}|${l.icon?.name ?? ''}|${Math.round((it.id.x + l.x / EXTENT) / n * q)},${Math.round((it.id.y + l.y / EXTENT) / n * q)},${it.id.w}`;
                // Features with the same text at the same position keep separate keys, in their order in the tile.
                const same = keys.get(key) ?? 0;
                keys.set(key, same + 1);
                out.push({x: tx, y: ty, angle: textAngle, size, shaped: textBox ? shaped : null, src: l, icon, key: same ? key + '#' + same : key, tile: it.id, ax, ay, opacity: 1, justify, alpha});
            }
        }
    }
    return out;
}

/**
 * Lays one line of text along a label's path. Returns each glyph's start point (relative to the anchor) and angle, plus
 * collision boxes, or null when the text does not fit or the line bends too sharply to read.
 */
function followLine(
    tr: Transform, it: RenderItem<unknown>, l: LabelSrc, line: {advances: number[]}, s: number, ax: number, ay: number, w: number, h: number, flat = 0,
): {curve: number[]; ground?: number[]; boxes: Box[]} | null {
    const path = l.path!, n = path.length / 2;
    // Most text that comes here does not fit its line at this zoom, so the length is tested first, before the points
    // are projected. The length on the screen (or on the ground, for a tilted map) is the length in the tile times
    // `it.scale`. (The exact test below decides the cases within a thousandth of a pixel.)
    let before = 0, total = 0;
    for (let i = 1; i < n; i++) { const d = Math.hypot(path[i * 2] - path[i * 2 - 2], path[i * 2 + 1] - path[i * 2 - 1]); total += d; if (i <= l.pathIndex!) before += d; }
    if (Math.min(before, total - before) * it.scale < w * (flat || s) / s / 2 - 1e-3) return null;
    // The points of the line: on the screen, and in the tile (for lengths on the ground).
    let xs: number[] = [], ys: number[] = [], us: number[] = [], vs: number[] = [];
    for (let i = 0; i < n; i++) { const u = path[i * 2], v = path[i * 2 + 1], [x, y] = tr.projectTile(it.id, u, v); xs.push(x); ys.push(y); us.push(u); vs.push(v); }
    let anchorIndex = l.pathIndex!;
    // Text should read left to right: run the path in whichever direction heads rightwards overall.
    if (xs[n - 1] < xs[0]) { xs = xs.reverse(); ys = ys.reverse(); us = us.reverse(); vs = vs.reverse(); anchorIndex = n - 1 - anchorIndex; }
    // Distances along the line. Flat text is measured on the ground, in pixels of the map without tilt: each glyph then
    // takes the length on the screen that its piece of ground has.
    const cum = [0], k = flat && it.scale, size = flat || s;
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + (k ? Math.hypot(us[i] - us[i - 1], vs[i] - vs[i - 1]) * k : Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1])));
    w *= size / s;
    const start = cum[anchorIndex] - w / 2;
    if (start < 0 || start + w > cum[n - 1]) return null; // not enough line for the text at this zoom
    const spacing = l.spacing * EM * size, shift = (l.offset[1] + BASELINE) * EM * size; // drop the baseline so the text is centred on the line
    const curve: number[] = [], boxes: Box[] = [], ground: number[] = [];
    let seg = 1, pen = start, last = NaN, bx = 0, by = 0;
    for (const advance of line.advances) {
        const a = advance * size, mid = pen + a / 2;
        while (seg < n - 1 && cum[seg] < mid) seg++;
        const len = cum[seg] - cum[seg - 1] || 1, t = mid - cum[seg - 1];
        let dx = (xs[seg] - xs[seg - 1]) / len, dy = (ys[seg] - ys[seg - 1]) / len, cx = xs[seg - 1] + dx * t, cy = ys[seg - 1] + dy * t;
        if (k) {
            // Text on the ground: the place of the glyph on the ground, and where one step along the line and one step
            // across it go on the screen from there. (The perspective changes along a piece of the line: one size for
            // the whole piece made the size of the letters jump at each point of the line.)
            const tu = (us[seg] - us[seg - 1]) / len, tv = (vs[seg] - vs[seg - 1]) / len, pu = us[seg - 1] + tu * t, pv = vs[seg - 1] + tv * t, e = 16;
            const [px, py] = tr.projectTile(it.id, pu, pv), [fx, fy] = tr.projectTile(it.id, pu + tu * e, pv + tv * e), [qx, qy] = tr.projectTile(it.id, pu - tv * e, pv + tu * e);
            cx = px; cy = py; dx = (fx - px) / e; dy = (fy - py) / e; bx = (qx - px) / e; by = (qy - py) / e;
        }
        const angle = Math.atan2(dy, dx);
        // A sharp bend inside the text makes it unreadable. The limit is `text-max-angle`: 45 degrees by default,
        // for which a turn of 0.6 radians between neighbours gives the results nearest to MapLibre's.
        if (!Number.isNaN(last)) { let d = angle - last; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.6 * (l.maxAngle ?? 45) / 45) return null; }
        last = angle;
        if (!k) { bx = -dy; by = dx; }
        curve.push(cx - dx * a / 2 + bx * shift - ax, cy - dy * a / 2 + by * shift - ay, angle);
        if (k) ground.push(Math.hypot(dx, dy), bx, by);
        const r = h / 2 + l.padding;
        boxes.push([cx - r, cy - r, cx + r, cy + r]);
        pen += a + spacing;
    }
    return {curve, ground: k ? ground : undefined, boxes};
}

export const FULL_CLIP: [number, number, number, number] = [0, 0, EXTENT, EXTENT];

/**
 * Picks what to draw for the ideal tile set: the tile itself when loaded, otherwise the matching part of a loaded
 * ancestor, otherwise any loaded children. Both the live map and server rendering use this.
 */
export function renderItems<T>(tr: Transform, ideal: TileID[], get: (key: string) => T | undefined): RenderItem<T>[] {
    const items: RenderItem<T>[] = [];
    const push = (id: TileID, clip: [number, number, number, number], tile: T) =>
        items.push({id, matrix: tr.tileMatrix(id), matrix4: tr.tileMatrix4(id), scale: tr.tileScale(id.z), clip, tile});
    for (const id of ideal) {
        const tile = get(id.key);
        if (tile) { push(id, FULL_CLIP, tile); continue; }
        let found = false;
        for (let dz = 1; dz <= id.z && !found; dz++) {
            const z = id.z - dz, x = id.x >> dz, y = id.y >> dz, parent = get(`${z}/${x}/${y}`);
            if (!parent) continue;
            const size = EXTENT / 2 ** dz, cx = (id.x - (x << dz)) * size, cy = (id.y - (y << dz)) * size;
            push({z, x, y, w: id.w, key: `${z}/${x}/${y}`}, [cx, cy, cx + size, cy + size], parent);
            found = true;
        }
        if (found) continue;
        // Zooming out: stand in with whatever deeper tiles are loaded, two levels down at most.
        const below = (z: number, x: number, y: number, depth: number) => {
            for (let i = 0; i < 4; i++) {
                const cz = z + 1, cx = x * 2 + (i & 1), cy = y * 2 + (i >> 1), key = `${cz}/${cx}/${cy}`, child = get(key);
                if (child) push({z: cz, x: cx, y: cy, w: id.w, key}, FULL_CLIP, child);
                else if (depth > 1) below(cz, cx, cy, depth - 1);
            }
        };
        below(id.z, id.x, id.y, 2);
    }
    return items;
}
