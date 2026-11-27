import {type Transform, EXTENT, apply} from './geo.ts';
import type {CompiledLayer} from './style.ts';
import type {Batch, TileImage, TileIR} from './tile.ts';
import type {Sprite} from './style.ts';
import type {Placed, RenderItem} from './placement.ts';
import {lineMiddle, BASELINE, EM} from './text.ts';
import {escapeXML, parseSVG, svgSize} from './markers.ts';
import {cssFamilies, splitFontKey} from './resolve.ts';
import type {RGBA} from './expr.ts';

/** Tile coordinates are written at half resolution: sub-pixel accuracy at native zoom for roughly a third less markup. */
const Q = 2;
const hex = (c: ArrayLike<number>, scale = 255) => '#' + [0, 1, 2].map(i => Math.round(c[i] * scale).toString(16).padStart(2, '0')).join('');
const num = (v: number) => String(Math.round(v * 100) / 100);
const alpha = (name: string, a: number) => a < 0.999 ? ` ${name}="${num(a)}"` : '';

/**
 * Path data for one feature, or '' when nothing of it would be visible. `box` is the viewport in tile units;
 * `minSize` and `tol` (quantized units) drop features and vertices too small to see at this scale.
 */
function pathData(b: Batch, f: number, close: boolean, box: number[], minSize: number, tol: number, cap?: Cap, off = 0): string {
    const {ringEnds, featEnds} = b.geom, k = b.geom.half ? 0.5 : 1;
    let coords: ArrayLike<number> = b.geom.coords;
    let d = '';
    for (let r = f ? featEnds[f - 1] : 0; r < featEnds[f]; r++) {
        const start = r ? ringEnds[r - 1] : 0, end = ringEnds[r];
        if (off) coords = offsetLine(b.geom.coords, start, end, k, off);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = start; i < end; i++) {
            const x = coords[i * 2] * k, y = coords[i * 2 + 1] * k;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 < box[0] || y1 < box[1] || x0 > box[2] || y0 > box[3]) continue;
        if ((x1 - x0) / Q < minSize && (y1 - y0) / Q < minSize) continue;
        let px = 0, py = 0, ring = '', n = 0, len = 0, sx = 0, sy = 0, ax = 0, ay = 0, bx = 0, by = 0;
        for (let i = start; i < end; i++) {
            const x = Math.round(coords[i * 2] * k / Q), y = Math.round(coords[i * 2 + 1] * k / Q);
            if (i === start) { ring = `M${x} ${y}`; n = 1; } else if (i === end - 1 ? (x !== px || y !== py) : Math.abs(x - px) + Math.abs(y - py) > tol) {
                const dx = x - px, dy = y - py;
                ring += dy === 0 ? `h${dx}` : dx === 0 ? `v${dy}` : `l${dx} ${dy}`;
                if (n++ === 1) { sx = px; sy = py; ax = x; ay = y; }
                len += Math.hypot(dx, dy); bx = px; by = py;
            } else continue;
            px = x; py = y;
        }
        if (n >= (close ? 3 : 2)) d += close ? ring + 'z' : ring;
        if (cap && n >= 2 && !close) cap.e += capEnds(cap, sx, sy, ax, ay, bx, by, px, py, len);
    }
    return d;
}

/**
 * `line-offset`: the points of a line moved by `off` (tile units after `k`; positive is to the right of the direction of
 * the line). A corner moves along its miter, which is shortened to the normal of the first segment where it would grow too long.
 * The result is indexed like `coords` (only from `start` to `end` is set).
 */
function offsetLine(coords: ArrayLike<number>, start: number, end: number, k: number, off: number): number[] {
    const out: number[] = [], nx: number[] = [], ny: number[] = [];
    const m = end - start;
    for (let i = 0; i < m - 1; i++) {
        const dx = coords[(start + i + 1) * 2] - coords[(start + i) * 2], dy = coords[(start + i + 1) * 2 + 1] - coords[(start + i) * 2 + 1], l = Math.hypot(dx, dy) || 1;
        nx.push(-dy / l); ny.push(dx / l);
    }
    for (let i = 0; i < m; i++) {
        const a = Math.max(i - 1, 0), c = Math.min(i, m - 2);
        let ox = nx[a], oy = ny[a];
        if (a !== c) {
            const d = 1 + nx[a] * nx[c] + ny[a] * ny[c];
            if (d > 0.25) { ox = (nx[a] + nx[c]) / d; oy = (ny[a] + ny[c]) / d; }
        }
        const j = (start + i) * 2;
        out[j] = (coords[j] * k + ox * off) / k; out[j + 1] = (coords[j + 1] * k + oy * off) / k;
    }
    return out;
}

/** The extra length of a square cap (path units), the dash pattern in pixels, pixels for each path unit, and the extension paths. */
interface Cap {half: number; pat: number[]; px: number; e: string}

/**
 * MapLibre GL JS extends the two ends of a line with a square cap by half the width, and draws the dashes with butt
 * ends: the start is always in a dash, and the end is in a dash when the length of the line ends inside one (#2177).
 * The extensions are butt-ended segments, drawn without a dash pattern.
 */
function capEnds(c: Cap, sx: number, sy: number, ax: number, ay: number, bx: number, by: number, ex: number, ey: number, len: number): string {
    const seg = (x: number, y: number, tx: number, ty: number) => {
        const l = Math.hypot(tx - x, ty - y) || 1;
        return `M${+(x + (x - tx) * c.half / l).toFixed(2)} ${+(y + (y - ty) * c.half / l).toFixed(2)}L${x} ${y}`;
    };
    const pat = c.pat.length % 2 ? [...c.pat, ...c.pat] : c.pat, period = pat.reduce((t, v) => t + v, 0);
    let at = period > 0 ? len * c.px % period : 0, i = 0;
    while (i < pat.length - 1 && at >= pat[i]) at -= pat[i++];
    return seg(sx, sy, ax, ay) + (i % 2 ? '' : seg(ex, ey, bx, by));
}

export interface SVGScene {
    tr: Transform;
    layers: CompiledLayer[];
    items: Map<string, RenderItem<TileIR | TileImage>[]>;
    labels: Placed[];
    /** Sprite sheet for icons; `image` may be a URL or a data URI. */
    sprite?: Sprite | null;
    /** Icons supplied as SVG by name (e.g. generated highway shields); emitted as vector symbols. */
    images?: Map<string, {svg: string; width: number; height: number}>;
    fontFamily: string;
    /** Extra attributes for the root element, e.g. a data attribute the client looks for when hydrating. */
    rootAttrs?: string;
    /** The name of the image for assistive technology (`aria-label`). The default is "Map". */
    label?: string;
    /** Called once for each layer that the SVG leaves out although it is visible at this zoom, with what the SVG does not draw. */
    skipped?: (layerId: string, kind: string) => void;
}

/**
 * Serializes one frame as a standalone SVG document. Pure string building: runs on any JavaScript server.
 * @internal Used by `renderToSVG` of `@map-jr/map-jr-gl/server`; not exported from any entry.
 */
/**
 * Raster tiles sit at fractional pixel positions, and each is clipped at its own edge, so the anti-aliased edges of two neighbors
 * add up to less than full coverage and a lighter line shows between them (#388). Each tile reaches half a pixel (in image units)
 * past its right and bottom edge, under the neighbor that is drawn later.
 */
const padOf = (m: number[]) => +(1 / (Math.hypot(m[0], m[1]) * Q || 1)).toFixed(3);

export function renderSVG(s: SVGScene): string {
    const {tr} = s, zoom = tr.zoom;
    const defs: string[] = [], body: string[] = [];
    // Lines drawn as [body index, attributes, path data]; path data written by two layers (a road and its casing) goes once into <defs>.
    const lines: [number, string, string][] = [], seen = new Map<string, number>();
    const clipIds = new Map<RenderItem<TileIR | TileImage>, string>();
    for (const list of s.items.values()) {
        for (const it of list) {
            const id = 'c' + clipIds.size, [x0, y0, x1, y1] = it.clip, pad = 'href' in it.tile ? padOf(it.matrix) : 0;
            clipIds.set(it, id);
            defs.push(`<clipPath id="${id}"><rect x="${x0 / Q}" y="${y0 / Q}" width="${(x1 - x0) / Q + pad}" height="${(y1 - y0) / Q + pad}"/></clipPath>`);
        }
    }

    const marks: [string, number][] = [];
    const hollow = new Set<string>();
    for (const L of s.layers) {
        marks.push([L.id, body.length]);
        if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
        if (L.type === 'hillshade' || L.type === 'heatmap' || L.type === 'color-relief') { s.skipped?.(L.id, L.type + ' layers'); continue; } // drawn by the client only for now
        const p = L.p, opacity = p.opacity.dd ? 1 : p.opacity.eval(zoom);
        const uniform = !p.color || p.color.dd ? null : p.color.eval(zoom) as RGBA;
        if (L.type === 'background' ? L.p.pattern.eval(zoom) != null : (L.type === 'fill' || L.type === 'line' || L.type === 'fill-extrusion') && L.p.pattern.eval(zoom)) { s.skipped?.(L.id, 'image patterns'); continue; } // image patterns are not drawn in SVG output
        if (L.type === 'background') {
            if (opacity > 0 && uniform![3] > 0) body.push(`<rect width="100%" height="100%" fill="${hex(uniform!)}"${alpha('fill-opacity', uniform![3] * opacity)}/>`);
            continue;
        }
        // A layer that draws nothing at this zoom writes nothing (a data-driven value is checked per feature below).
        if (opacity <= 0 && L.type !== 'circle' || L.type === 'line' && (!p.width.dd && p.width.eval(zoom) <= 0 || uniform && uniform[3] <= 0)) continue;
        if (L.type === 'fill' && uniform && uniform[3] <= 0 && !((p.outline?.eval(zoom) as RGBA | undefined)?.[3]! > 0)) continue;
        for (const it of s.items.get(L.source!) ?? []) {
            if ('href' in it.tile) {
                if (L.type === 'raster') {
                    const m = it.matrix.map((v, i) => i < 4 ? +(v * Q).toFixed(6) : +v.toFixed(2));
                    body.push(`<g transform="matrix(${m.join(' ')})" clip-path="url(#${clipIds.get(it)})"${alpha('opacity', opacity)}>` +
                        `<image href="${escapeXML(it.tile.href)}" width="${EXTENT / Q + padOf(it.matrix)}" height="${EXTENT / Q + padOf(it.matrix)}" preserveAspectRatio="none"${(p.resampling.eval(zoom) ?? p.rasterResampling.eval(zoom)) === 'nearest' ? ' style="image-rendering:pixelated"' : ''}/></g>`);
                }
                continue;
            }
            const b = it.tile.layers[L.id];
            if (!b) continue;
            const n = b.geom.featEnds.length;
            // Features that end up looking identical share one <path>.
            const groups = new Map<string, string>();
            const styleOf = (f: number) => {
                const col = b.color ? hex(b.color.subarray(f * 4, f * 4 + 3), 1) : hex(uniform!);
                const a = (b.color ? b.color[f * 4 + 3] / 255 : uniform![3]) * opacity;
                return [col, a] as const;
            };
            if (b.type === 'circle') {
                const sw = p.strokeWidth.eval(zoom), sc = p.strokeColor.eval(zoom) as RGBA;
                const stroke = sw > 0 ? ` stroke="${hex(sc)}" stroke-width="${num(sw)}"${alpha('stroke-opacity', sc[3] * (p.strokeOpacity.dd ? 1 : p.strokeOpacity.eval(zoom)))}` : '';
                const {coords, ringEnds, featEnds} = b.geom;
                for (let f = 0, r = 0; f < n; f++) {
                    const [col, a] = styleOf(f), radius = (b.radius ? b.radius[f] : p.radius.eval(zoom)) + sw / 2;
                    if (a <= 0 && !stroke) { r = featEnds[f]; continue; }
                    for (; r < featEnds[f]; r++) {
                        const i = ringEnds[r] - 1, tx = coords[i * 2], ty = coords[i * 2 + 1];
                        if (tx < it.clip[0] || ty < it.clip[1] || tx >= it.clip[2] || ty >= it.clip[3]) continue;
                        const [x, y] = apply(it.matrix, tx, ty);
                        body.push(`<circle cx="${num(x)}" cy="${num(y)}" r="${num(radius)}" fill="${col}"${alpha('fill-opacity', a)}${stroke}/>`);
                    }
                }
                continue;
            }
            const fill = b.type === 'fill';
            const gap = fill ? 0 : p.gap.eval(zoom), dash = fill ? null : p.dash.eval(zoom) as number[] | null;
            const oc = fill && p.outline ? p.outline.eval(zoom) as RGBA : null;
            const outline = oc && oc[3] > 0 ? ` stroke="${hex(oc)}" stroke-width="1"${alpha('stroke-opacity', oc[3] * opacity)}` : '';
            if (gap > 0) { if (!hollow.has(L.id)) { hollow.add(L.id); s.skipped?.(L.id, 'hollow lines (line-gap-width)'); } continue; } // a hollow stroke has no simple SVG equivalent; rare enough to leave to the client
            // The viewport in this tile's coordinates (plus a margin for stroke widths), to skip what is off screen.
            const [a, bb, c, dd, e, ff] = it.matrix, det = a * dd - bb * c, pad = 24 / it.scale;
            const corners = [[0, 0], [tr.width, 0], [0, tr.height], [tr.width, tr.height]].map(([x, y]) =>
                [(dd * (x - e) - c * (y - ff)) / det, (-bb * (x - e) + a * (y - ff)) / det]);
            const box = [Math.min(...corners.map(p => p[0])) - pad, Math.min(...corners.map(p => p[1])) - pad,
                Math.max(...corners.map(p => p[0])) + pad, Math.max(...corners.map(p => p[1])) + pad];
            const unitsPerPx = 1 / (it.scale * Q), minSize = (L.ssr?.minSize ?? 0.8) * unitsPerPx, tol = (L.ssr?.simplify ?? 0.6) * unitsPerPx;
            for (let f = 0; f < n; f++) {
                const [col, a] = styleOf(f), w = fill ? 0 : b.width ? b.width[f] : p.width.eval(zoom);
                if (fill ? a <= 0 && !outline : a <= 0 || w <= 0) continue;
                const key = fill ? `fill="${col}"${alpha('fill-opacity', a)}${outline}`
                    : `stroke="${col}" stroke-width="${num(w)}"${alpha('stroke-opacity', a * Math.min(1, w))}` +
                        (dash ? ` stroke-dasharray="${dash.map(d => num(d * Math.max(w, 0.5))).join(' ')}"` : '');
                const cap = dash && b.cap === 'square' ? {half: w / 2 * unitsPerPx, pat: dash.map(d => d * Math.max(w, 0.5)), px: it.scale * Q, e: ''} : undefined;
                const d = pathData(b, f, fill, box, minSize, tol, cap, fill ? 0 : (b.offset ? b.offset[f] : p.offset.eval(zoom)) / it.scale);
                if (d) groups.set(key, (groups.get(key) ?? '') + d);
                if (cap?.e) { const k2 = `stroke="${col}" stroke-width="${num(w)}"${alpha('stroke-opacity', a * Math.min(1, w))}`; groups.set(k2, (groups.get(k2) ?? '') + cap.e); }
            }
            if (!groups.size) continue;
            const m = it.matrix.map((v, i) => i < 4 ? +(v * Q).toFixed(6) : +v.toFixed(2));
            // SVG puts the cap on every dash. As in MapLibre GL JS, the dashes of a line with a square cap are butt dashes (#2175).
            body.push(`<g transform="matrix(${m.join(' ')})" clip-path="url(#${clipIds.get(it)})"${fill ? '' : ` fill="none"${b.cap === 'round' || b.cap === 'square' && !dash ? ` stroke-linecap="${b.cap}"` : ''}${b.join === 'round' || b.join === 'bevel' ? ` stroke-linejoin="${b.join}"` : ` stroke-miterlimit="${num(+(b.miterLimit ?? 2) || 2)}"`}`}>`);
            for (const [attrs, d] of groups) if (d && !fill) { lines.push([body.length, attrs, d]); seen.set(d, (seen.get(d) ?? 0) + 1); body.push(''); }
            else if (d) body.push(`<path ${attrs}${fill && !outline ? '' : ' vector-effect="non-scaling-stroke"'} d="${d}"/>`);
            body.push('</g>');
        }
    }

    const pathIds = new Map<string, string>();
    for (const [i, attrs, d] of lines) {
        if (seen.get(d)! < 2) { body[i] = `<path ${attrs} vector-effect="non-scaling-stroke" d="${d}"/>`; continue; }
        let id = pathIds.get(d);
        if (!id) { pathIds.set(d, id = 'p' + pathIds.size); defs.push(`<path id="${id}" vector-effect="non-scaling-stroke" d="${d}"/>`); }
        body[i] = `<use href="#${id}" ${attrs}/>`;
    }
    // Each style layer that drew something is a group with its id in `data-layer`. It is not an `id`: the ids of one
    // document must be unique, and the clip, path and icon ids above or a second SVG on the same page could repeat it.
    marks.push(['', body.length]);
    marks.forEach(([layer, at], k) => {
        const end = marks[k + 1]?.[1];
        if (end === undefined || end === at) return;
        body[at] = `<g data-layer="${escapeXML(layer)}">${body[at]}`;
        body[end - 1] += '</g>';
    });

    // A symbol on the ground of a tilted map (`Placed.frame`) is drawn with its frame about its center, and others turn by their angle.
    const turn = (x: number, y: number, a: number, f?: number[]) => f
        ? ` transform="matrix(${f.slice(0, 4).map(v => Math.round(v * 1e3) / 1e3).join(' ')} ${num(x - f[0] * x - f[2] * y)} ${num(y - f[1] * x - f[3] * y)})"`
        : a ? ` transform="rotate(${num(a * 180 / Math.PI)} ${num(x)} ${num(y)})"` : '';
    // An icon is the image of `images` as a vector symbol, or its part of a sheet of the sprite.
    const ids = new Map<string, string>(), sheets = new Set<number>();
    const put = (name: string, sprite: boolean, rect: number[] | undefined, x: number, y: number, w: number, h: number, rot: string) => {
        const img = s.images?.get(name), sp = s.sprite;
        const at = `x="${num(x - w / 2)}" y="${num(y - h / 2)}" width="${num(w)}" height="${num(h)}"`;
        if (img && !sprite) {
            let id = ids.get(name);
            if (!id) {
                ids.set(name, id = 'i' + ids.size);
                const {viewBox, inner} = parseSVG(img.svg);
                defs.push(`<symbol id="${id}" viewBox="${viewBox ?? '0 0 ' + svgSize(img.svg).join(' ')}" preserveAspectRatio="none">${inner}</symbol>`);
            }
            body.push(`<use href="#${id}" ${at}${rot}/>`);
        } else if (sp && (rect ??= sp.icons[name] && [sp.icons[name].x, sp.icons[name].y, sp.icons[name].width, sp.icons[name].height])) {
            // (One image for each sheet that an icon uses: `sprite`, and `sprite-1` and so on for the other sheets.)
            const n = sp.icons[name]?.sheet ?? 0, id = n ? 'sprite-' + n : 'sprite';
            if (!sheets.has(n)) { sheets.add(n); const sheet = sp.sheets?.[n] ?? sp; defs.push(`<image id="${id}" href="${escapeXML(sheet.image)}" width="${sheet.width}" height="${sheet.height}"/>`); }
            body.push(`<svg ${at} viewBox="${rect.join(' ')}" preserveAspectRatio="none"${rot}><use href="#${id}"/></svg>`);
        }
    };
    for (const {icon: i} of s.labels) if (i && (i.custom ? s.images?.has(i.name) : s.sprite)) put(i.name, !i.custom, i.custom ? undefined : i.rect, i.x, i.y, i.w, i.h, turn(i.x, i.y, i.angle, i.frame));

    if (s.labels.some(l => l.shaped)) {
        body.push(`<g font-family="${escapeXML(s.fontFamily)}" text-anchor="middle" paint-order="stroke" stroke-linejoin="round">`);
        for (const l of s.labels) {
            const shaped = l.shaped;
            if (!shaped) continue;
            const src = l.src, k = l.size / EM, [variant, family, stack] = splitFontKey(src.font), list = cssFamilies(stack ?? family);
            const [style, weight] = variant.includes(' ') ? variant.split(' ') : ['', variant];
            const halo = src.haloWidth > 0 && src.halo[3] > 0
                ? ` stroke="${hex(src.halo)}" stroke-width="${num(src.haloWidth * 2)}"${alpha('stroke-opacity', src.halo[3] * (l.alpha ?? 1))}` : '';
            const common = `font-size="${num(l.size)}"${list ? ` font-family="${escapeXML(`${list}, ${s.fontFamily}`)}"` : ''}${weight !== '400' ? ` font-weight="${weight}"` : ''}${style ? ` font-style="${style}"` : ''}` +
                `${src.spacing ? ` letter-spacing="${num(src.spacing * l.size)}"` : ''} fill="${hex(src.color)}"${alpha('fill-opacity', src.color[3] * (l.alpha ?? 1))}${halo}`;
            if (l.curve) {
                // Text along a line: one position and rotation per character, which SVG text supports directly.
                const c = l.curve, chars = shaped.lines[0].chars, at = (k: number) => chars.map((_, i) => num(c[i * 3 + k] + (k ? l.y : l.x))).join(' ');
                body.push(`<text text-anchor="start" xml:space="preserve" x="${at(0)}" y="${at(1)}" rotate="${chars.map((_, i) => num(c[i * 3 + 2] * 180 / Math.PI)).join(' ')}" ${common}>${escapeXML(chars.join(''))}</text>`);
                continue;
            }
            const rot = turn(l.x, l.y, l.angle, l.frame);
            shaped.lines.forEach((line, i) => {
                const y = l.y + (lineMiddle(shaped, i) + EM * BASELINE * (line.scale ?? 1)) * k;
                const x = l.x + (l.justify ?? src.justify) * (line.width - shaped.width) / 2 * k;
                // Images inside the text sit on the line where a glyph would, at their own size, as in the browser (see `iconQuads`).
                let pen = x - line.width / 2 * k;
                if (shaped.images) line.chars.forEach((ch, j) => {
                    const name = shaped.images![ch.charCodeAt(0) - 0xE100] ?? '', a = line.advances[j] * k, d = s.images?.get(name), r = s.sprite?.icons[name];
                    if (d || r) put(name, !d, undefined, pen + a / 2, l.y + lineMiddle(shaped, i) * k, a, d ? a * d.height / d.width : a * r!.height / r!.width, rot);
                    pen += a + src.spacing * l.size;
                });
                // Rich text: a line is drawn in the size of its largest section (sizes inside a line are not drawn).
                const own = line.scale && line.scale !== 1 ? common.replace(/^font-size="[^"]*"/, `font-size="${num(l.size * line.scale)}"`) : common;
                body.push(`<text x="${num(x)}" y="${num(y)}"${rot} ${own}>${escapeXML(line.text.replace(/[\uE000-\uF8FF]/g, ''))}</text>`);
            });
        }
        body.push('</g>');
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tr.width}" height="${tr.height}" viewBox="0 0 ${tr.width} ${tr.height}" role="img" aria-label="${escapeXML(s.label ?? 'Map')}"${s.rootAttrs ? ' ' + s.rootAttrs : ''}>` +
        `<defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

/**
 * Returns HTML of credits that is safe to put into a page: the text, escaped, and links to http and https URLs. Every other tag is removed.
 * @returns The cleaned HTML.
 * @internal Used by `renderToHTML` of `@map-jr/map-jr-gl/server`; not exported from any entry.
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
