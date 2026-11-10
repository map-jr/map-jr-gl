import {type Transform, apply} from './geo.ts';
import type {CompiledLayer} from './style.ts';
import type {Batch, TileIR} from './tile.ts';
import type {Placed, RenderItem} from './placement.ts';
import {EM} from './text.ts';
import {anchorOffset, escapeXML, parseSVG, resolveVariants, type MarkerLayerOptions} from './markers.ts';
import type {RGBA} from './expr.ts';

/** Tile coordinates are written at half resolution: sub-pixel accuracy at native zoom for roughly a third less markup. */
const Q = 2;
const hex = (c: ArrayLike<number>, scale = 255) => '#' + [0, 1, 2].map(i => Math.round(c[i] * scale).toString(16).padStart(2, '0')).join('');
const num = (v: number) => String(Math.round(v * 100) / 100);
const alpha = (name: string, a: number) => a < 0.999 ? ` ${name}="${num(a)}"` : '';

/**
 * Path data for one feature, or '' when nothing of it would be visible. `box` is the viewport in tile units;
 * `minSize` and `tol` (quantised units) drop features and vertices too small to see at this scale.
 */
function pathData(b: Batch, f: number, close: boolean, box: number[], minSize: number, tol: number): string {
    const {coords, ringEnds, featEnds} = b.geom;
    let d = '';
    for (let r = f ? featEnds[f - 1] : 0; r < featEnds[f]; r++) {
        const start = r ? ringEnds[r - 1] : 0, end = ringEnds[r];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = start; i < end; i++) {
            const x = coords[i * 2], y = coords[i * 2 + 1];
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 < box[0] || y1 < box[1] || x0 > box[2] || y0 > box[3]) continue;
        if ((x1 - x0) / Q < minSize && (y1 - y0) / Q < minSize) continue;
        let px = 0, py = 0, ring = '', n = 0;
        for (let i = start; i < end; i++) {
            const x = Math.round(coords[i * 2] / Q), y = Math.round(coords[i * 2 + 1] / Q);
            if (i === start) { ring = `M${x} ${y}`; n = 1; } else if (i === end - 1 ? (x !== px || y !== py) : Math.abs(x - px) + Math.abs(y - py) > tol) {
                const dx = x - px, dy = y - py;
                ring += dy === 0 ? `h${dx}` : dx === 0 ? `v${dy}` : `l${dx} ${dy}`;
                n++;
            } else continue;
            px = x; py = y;
        }
        if (n >= (close ? 3 : 2)) d += close ? ring + 'z' : ring;
    }
    return d;
}

export interface SVGScene {
    tr: Transform;
    layers: CompiledLayer[];
    items: Map<string, RenderItem<TileIR>[]>;
    labels: Placed[];
    markers: MarkerLayerOptions[];
    fontFamily: string;
    /** Extra attributes for the root element, e.g. a data attribute the client looks for when hydrating. */
    rootAttrs?: string;
}

/** Serialises one frame as a standalone SVG document. Pure string building: runs on any JavaScript server. */
export function renderSVG(s: SVGScene): string {
    const {tr} = s, zoom = tr.zoom;
    const defs: string[] = [], body: string[] = [];
    const clipIds = new Map<RenderItem<TileIR>, string>();
    for (const list of s.items.values()) {
        for (const it of list) {
            const id = 'c' + clipIds.size, [x0, y0, x1, y1] = it.clip;
            clipIds.set(it, id);
            defs.push(`<clipPath id="${id}"><rect x="${x0 / Q}" y="${y0 / Q}" width="${(x1 - x0) / Q}" height="${(y1 - y0) / Q}"/></clipPath>`);
        }
    }

    for (const L of s.layers) {
        if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
        const p = L.p, opacity = p.opacity.dd ? 1 : p.opacity.eval(zoom);
        const uniform = p.color.dd ? null : p.color.eval(zoom) as RGBA;
        if (L.type === 'background') {
            body.push(`<rect width="100%" height="100%" fill="${hex(uniform!)}"${alpha('fill-opacity', uniform![3] * opacity)}/>`);
            continue;
        }
        for (const it of s.items.get(L.source!) ?? []) {
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
                const stroke = sw > 0 ? ` stroke="${hex(sc)}" stroke-width="${num(sw)}"${alpha('stroke-opacity', sc[3] * opacity)}` : '';
                const {coords, ringEnds, featEnds} = b.geom;
                for (let f = 0, r = 0; f < n; f++) {
                    const [col, a] = styleOf(f), radius = (b.radius ? b.radius[f] : p.radius.eval(zoom)) + sw / 2;
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
            // The viewport in this tile's coordinates (plus a margin for stroke widths), to skip what is off screen.
            const [a, bb, c, dd, e, ff] = it.matrix, det = a * dd - bb * c, pad = 24 / it.scale;
            const corners = [[0, 0], [tr.width, 0], [0, tr.height], [tr.width, tr.height]].map(([x, y]) =>
                [(dd * (x - e) - c * (y - ff)) / det, (-bb * (x - e) + a * (y - ff)) / det]);
            const box = [Math.min(...corners.map(p => p[0])) - pad, Math.min(...corners.map(p => p[1])) - pad,
                Math.max(...corners.map(p => p[0])) + pad, Math.max(...corners.map(p => p[1])) + pad];
            const unitsPerPx = 1 / (it.scale * Q), minSize = 0.8 * unitsPerPx, tol = 0.6 * unitsPerPx;
            for (let f = 0; f < n; f++) {
                const [col, a] = styleOf(f), w = fill ? 0 : b.width ? b.width[f] : p.width.eval(zoom);
                const key = fill ? `fill="${col}"${alpha('fill-opacity', a)}`
                    : `stroke="${col}" stroke-width="${num(w)}"${alpha('stroke-opacity', a * Math.min(1, w))}`;
                const d = pathData(b, f, fill, box, minSize, tol);
                if (d) groups.set(key, (groups.get(key) ?? '') + d);
            }
            const m = it.matrix.map((v, i) => i < 4 ? +(v * Q).toFixed(6) : +v.toFixed(2));
            body.push(`<g transform="matrix(${m.join(' ')})" clip-path="url(#${clipIds.get(it)})"${fill ? '' : ' fill="none"'}>`);
            for (const [attrs, d] of groups) if (d) body.push(`<path ${attrs}${fill ? '' : ' vector-effect="non-scaling-stroke"'} d="${d}"/>`);
            body.push('</g>');
        }
    }

    if (s.labels.length) {
        body.push(`<g font-family="${escapeXML(s.fontFamily)}" text-anchor="middle" paint-order="stroke" stroke-linejoin="round">`);
        for (const l of s.labels) {
            const src = l.src, k = l.size / EM, [style, weight] = src.font.includes(' ') ? src.font.split(' ') : ['', src.font];
            const halo = src.haloWidth > 0 && src.halo[3] > 0
                ? ` stroke="${hex(src.halo)}" stroke-width="${num(src.haloWidth * 2)}"${alpha('stroke-opacity', src.halo[3])}` : '';
            const common = `font-size="${num(l.size)}"${weight !== '400' ? ` font-weight="${weight}"` : ''}${style ? ` font-style="${style}"` : ''}` +
                `${src.spacing ? ` letter-spacing="${num(src.spacing * l.size)}"` : ''} fill="${hex(src.color)}"${alpha('fill-opacity', src.color[3])}${halo}`;
            const rot = l.angle ? ` transform="rotate(${num(l.angle * 180 / Math.PI)} ${num(l.x)} ${num(l.y)})"` : '';
            l.shaped.lines.forEach((line, i) => {
                const y = l.y + (-l.shaped.height / 2 + i * l.shaped.lineHeight + l.shaped.lineHeight * 0.5 + EM * 0.34) * k;
                body.push(`<text x="${num(l.x)}" y="${num(y)}"${rot} ${common}>${escapeXML(line.text)}</text>`);
            });
        }
        body.push('</g>');
    }

    let symbols = 0;
    for (const layer of s.markers) {
        const {svgs, variant} = resolveVariants(layer), base = symbols, [ox, oy] = anchorOffset(layer.anchor, layer.width, layer.height);
        const used = new Set<number>(), uses: string[] = [];
        layer.data.forEach((m, i) => {
            const [px, py] = tr.project(m.lngLat[0], m.lngLat[1]), x = px + ox, y = py + oy;
            if (x > tr.width || y > tr.height || x + layer.width < 0 || y + layer.height < 0) return;
            used.add(variant[i]);
            uses.push(`<use href="#m${base + variant[i]}" x="${num(x)}" y="${num(y)}" width="${layer.width}" height="${layer.height}"/>`);
        });
        for (const v of used) {
            const {viewBox, inner} = parseSVG(svgs[v]);
            defs.push(`<symbol id="m${base + v}" viewBox="${viewBox ?? `0 0 ${layer.width} ${layer.height}`}">${inner}</symbol>`);
        }
        symbols += svgs.length;
        body.push(...uses);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tr.width}" height="${tr.height}" viewBox="0 0 ${tr.width} ${tr.height}"${s.rootAttrs ? ' ' + s.rootAttrs : ''}>` +
        `<defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}
