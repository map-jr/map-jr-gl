// The part `query` of the library (src/parts.ts, #2342), which loads on demand: the queries of features
// (`queryRenderedFeatures`, `querySourceFeatures`). The tile workers use `queryTile` of query.ts, and the engine the
// functions below. The engine starts to load the part after the first `idle` of a map, so that it does not delay the
// first picture. A query that comes before the part has loaded waits for it. (The page's GeoJSON queries of the compat
// entry, sync-query.ts, use query.ts alone.)
//
// The functions below run as methods of the engine (src/engine.ts): each is called with `fn.call(this, ...)` and reads
// the members of the engine, as the functions of 3D terrain do (src/terrain.ts). The build gives each `this.name` the
// same short name in every file (scripts/private-names.mjs). They answer from tile data, independent of what is drawn.
import {EXTENT, clamp, latFromMerc, lngFromMerc, mercX, mercY} from './geo.ts';
import {pickImage, type Feature} from './expr.ts';
import {overlaps} from './tile.ts';
import {isGeometrySource, screenTranslate, tileURL, type CompiledLayer, type SourceInfo} from './style.ts';
import {VARIANT} from './markers.ts';
import {BASELINE, EM} from './text.ts';
import {boxAround, flatSize, perspective, quadBox} from './placement.ts';
import {circleCenters, circleRadius, circleTouches, featureKey, movedCenter, pitchedCircles, setBox, setReach, tilesUnderBox, type QueriedFeature} from './query.ts';
import type {Command} from './engine.ts';

export * from './query.ts';

/**
 * The tile worker that answers a query about a tile: the one that loaded the tile, because it has the bytes that
 * the map shows. A tile that the map does not have goes to the next worker in turn.
 */
function queryBackend(this: any, source: string, z: number, x: number, y: number) {
    return this.backends[this.tiles.get(`${source}|${z}/${x}/${y}`)?.backend ?? this.nextBackend++ % this.backends.length];
}

/** The features that the given style layers draw in a rectangle of the screen, from the tiles of the present zoom. */
export async function queryRendered(this: any, c: Extract<Command, {type: 'queryRendered'}>): Promise<QueriedFeature[]> {
    c = {...c, sets: c.sets.map(s => {
        if (!s.size) return s;
        const most = [0, 0, 0];
        for (const t of this.tiles.values()) this.most.get(t.gl!)?.[s.layer]?.forEach((v: number, i: number) => most[i] = Math.max(most[i], v));
        return {...s, most};
    })};
    const jobs: Promise<QueriedFeature[]>[] = [];
    // (The symbol layers of the question whose features are tested with their icon, and the distance in pixels for their text.)
    const radii = new Map<string, number>(), icons = new Map<string, {at: number[]; text: string[]}>(), shown = new Map<string, {x: number; y: number; ax?: number; ay?: number; box: number[]; line?: boolean; icon?: boolean; text?: string}[]>();
    // (The circle layers of a tilted map, whose features are tested on the screen with `circleTouches`.)
    const pitched = pitchedCircles(this.tr, c.box, c.sets), circles = new Map([...pitched?.circles ?? []].map(s => [s.layer, s]));
    for (const [name, src] of Object.entries<SourceInfo>(this.style.sources)) {
        const mine = c.sets.filter(s => s.source === name && this.layers.find((l: CompiledLayer) => l.id === s.layer)?.visible !== false);
        if (!mine.length || !isGeometrySource(src)) continue;
        // A feature of a symbol layer is found where its icon is drawn. The tiles are asked with a rectangle that
        // has grown by the farthest reach of an icon of the layer, in the other direction (an icon that reaches 30
        // pixels up from its point is under a pointer that is 30 pixels above the point). Each feature that
        // comes back is then tested with its own icon (`underIcon`). Sets with the same rectangle are asked together.
        const boxes = new Map<string, {box: number[]; pad: number; sets: typeof mine; exact: boolean}>();
        for (const s of mine) {
            const L = this.layers.find((l: CompiledLayer) => l.id === s.layer), r = s.radius;
            let reach: [number, number, number, number] | null = L?.type === 'symbol' ? iconReach.call(this, L) : null;
            // (The text of a label can reach farther than its icon: the reach covers both. A glyph of text on a line has its
            // box around its own point, so long text on a line does not widen the rectangle.)
            const texts = L?.type === 'symbol' ? textBoxes.call(this, L.id) : [];
            for (const t of texts) {
                const d = [t.box[0] - t.x, t.box[1] - t.y, t.box[2] - t.x, t.box[3] - t.y];
                reach = reach ? [Math.min(reach[0], d[0]), Math.min(reach[1], d[1]), Math.max(reach[2], d[2]), Math.max(reach[3], d[3])] : [d[0], d[1], d[2], d[3]];
            }
            // (A symbol layer with no icon and no shown text is still tested with `underIcon`, so that a line whose
            // label is hidden is not found along its geometry: #1916.)
            if (L?.type === 'symbol') reach ??= [0, 0, 0, 0];
            if (reach) radii.set(s.layer, r), shown.set(s.layer, texts), icons.set(s.layer, iconPoints.call(this, s.layer));
            const circle = circles.get(s.layer) === s;
            const box = reach ? [c.box[0] - Math.max(reach[2], r), c.box[1] - Math.max(reach[3], r), c.box[2] - Math.min(reach[0], -r), c.box[3] - Math.min(reach[1], -r)] : circle ? pitched!.box : setBox(c.box, s), pad = reach || circle ? 0 : setReach(s), key = box.join() + ',' + pad;
            const group = boxes.get(key) ?? {box, pad, sets: [], exact: !!reach || circle};
            // (A tilted circle whose size depends on the feature is asked with its size grown as `pitchedCircles` grows the rectangle.)
            group.sets.push(circle && s.size ? {...s, radius: 0, size: {...s.size, scale: pitched!.k}} : reach || circle ? {...s, radius: 0} : s);
            boxes.set(key, group);
        }
        for (const {box, pad, sets, exact} of boxes.values()) for (const t of tilesUnderBox(this.tr, box, src.minzoom, src.maxzoom, pad)) {
            jobs.push(queryBackend.call(this, name, t.z, t.x, t.y).query(tileURL(src, t.z, t.x, t.y, this.dpr), {
                source: name, z: t.z, zoom: Math.max(t.z, Math.floor(this.tr.zoom)), x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: c.geometry || exact,
                sets: sets.map(s => ({layer: s.layer, sourceLayer: s.sourceLayer, filter: s.filter, also: s.also, radius: s.radius * t.scale, ring: s.ring, size: s.size && (s.radius || s.size.scale) ? {...s.size, scale: t.scale * (s.size.scale ?? 1)} : undefined})),
            }));
        }
    }
    // A feature that is in two tiles is given one time, when it has an id or comes from a GeoJSON source.
    const seen = new Set<string>();
    return (await Promise.all(jobs)).flat().filter(f => {
        const L = radii.has(f.layer!) && this.layers.find((l: CompiledLayer) => l.id === f.layer);
        if (L && !underIcon.call(this, L, f, c.box, radii.get(f.layer!)!, shown.get(f.layer!)!, icons.get(f.layer!)!)) return false;
        const circle = circles.get(f.layer!);
        if (circle && !circleCenters(f.geometry!).some(([lng, lat]) => circleTouches(this.tr, ...movedCenter(this.tr, circle, mercX(lng), mercY(lat)), c.box, circleRadius(circle, f, this.states.f[f.source]), circle.pitch!))) return false;
        if ((L || circle) && !c.geometry) delete f.geometry;
        const key = featureKey(f);
        return !key || (seen.has(key) ? false : (seen.add(key), true));
    });
}

export async function queryFeatures(this: any, c: Extract<Command, {type: 'query'}>): Promise<QueriedFeature[]> {
    const zoom = c.zoom ?? this.tr.zoom;
    const jobs = Object.entries<SourceInfo>(this.style.sources).filter(([name, src]) => isGeometrySource(src) && (!c.sources || c.sources.includes(name))).map(([name, src]) => {
        const z = clamp(Math.floor(zoom), src.minzoom, src.maxzoom), t = this.tileAt(c.lng, c.lat, z);
        // The tolerance is given in screen pixels at the queried zoom.
        const radius = c.radius * EXTENT / (512 * 2 ** (zoom - z));
        return queryBackend.call(this, name, z, t.x, t.y).query(tileURL(src, z, t.x, t.y, this.dpr), {
            source: name, z, x: t.x, y: t.y, px: t.u * EXTENT, py: t.v * EXTENT, radius,
            sourceLayers: c.sourceLayers, filter: c.filter, geometry: c.geometry,
        });
    });
    return (await Promise.all(jobs)).flat();
}

/** The image with a name, or (for the name of a template) one of its variants: they all have one size. */
function imageNamed(this: any, name: string) {
    // An image of the style (`own`) takes the place of the sprite image of the same name: the page gives it on demand (#1199).
    const found = this.images.get(name) ?? (this.sprite && Object.hasOwn(this.sprite.icons, name) && !this.style?.own?.includes(name) ? this.sprite.icons[name] : undefined);
    if (found) return found;
    for (const [key, image] of this.images) if (key.startsWith(name + VARIANT)) return image;
}

/** The points in Mercator (x, y pairs, 0 to 1) of the shown labels of a layer that have their icon drawn. */
function iconPoints(this: any, layer: string) {
    const out: number[] = [], text: string[] = [];
    for (const [key, {placed: p, target}] of this.labels) {
        if (!target || !p.icon || !key.startsWith(layer + '|')) continue;
        const n = 2 ** p.tile.z;
        out.push((p.tile.x + p.src.x / EXTENT) / n, (p.tile.y + p.src.y / EXTENT) / n), text.push(p.src.text);
    }
    return {at: out, text};
}

/**
 * The boxes of the text of the shown labels of a layer at a point (the collision boxes, with `text-padding`), in
 * pixels of the screen, each with the point of its label on the screen now. Text along a line (`line`) has one box
 * for each glyph, around the piece of the line that the glyph covers.
 */
function textBoxes(this: any, layer: string) {
    const out: {x: number; y: number; ax?: number; ay?: number; box: number[]; line?: boolean; icon?: boolean; text?: string}[] = [], at: [number, number, number] = [0, 0, 0];
    for (const [key, {placed: p, target}] of this.labels) {
        if (!target || !p.shaped || !key.startsWith(layer + '|')) continue;
        const [x, y] = this.tr.projectTile(p.tile, p.src.x, p.src.y, undefined, at), s = p.size / EM, w = p.shaped.width * s, h = p.shaped.height * s;
        if (p.curve) {
            // (Each glyph starts at its point of `curve`, which lies `shift` pixels across the line, and its box is
            // centered on the line, as its collision box is. On a tilted map `ground` gives the length on the
            // screen of one pixel of text along the line, and the direction of one pixel across it.)
            const g = p.ground, r = h / 2 + p.src.padding, shift = (p.src.offset[1] + BASELINE) * p.size, advances = p.shaped.lines[0].advances;
            for (let i = 0; i < p.curve.length / 3; i++) {
                const a = p.curve[i * 3 + 2], len = advances[i] * s * (g ? g[i * 3] : 1) / 2;
                const cx = x + p.curve[i * 3] + Math.cos(a) * len - (g ? g[i * 3 + 1] : -Math.sin(a)) * shift, cy = y + p.curve[i * 3 + 1] + Math.sin(a) * len - (g ? g[i * 3 + 2] : Math.cos(a)) * shift;
                out.push({x: cx, y: cy, ax: x, ay: y, line: true, text: p.src.text, box: [cx - r, cy - r, cx + r, cy + r]});
            }
            continue;
        }
        // (The box of placement: `text-padding` is added before the box is turned, as in MapLibre GL JS. Text on the
        // ground has the size of its frame on the screen, as its collision box has.)
        // (Text of a layer with `icon-offset` is drawn without the perspective ratio, and its box keeps it: see `Placed.fixedSize`.)
        const r = p.fixedSize ? (p.frame ? flatSize(this.tr, at[2]) : perspective(this.tr, at[2])) : 1, f = p.frame, fw = (f ? w * Math.hypot(f[0], f[1]) : w) * r, fh = (f ? h * Math.hypot(f[2], f[3]) : h) * r;
        // (On the globe the frame has a second order, and the box is the bound of the text as it is drawn: see `quadBox`.)
        const cx = x + (p.x - p.ax) * r, cy = y + (p.y - p.ay) * r;
        out.push({x, y, line: p.src.angle !== null, icon: !!p.icon, text: p.src.text, box: f && f.length > 4 ? quadBox(f, cx, cy, w * r, h * r, p.src.padding)
            : boxAround(cx, cy, fw, fh, p.angle, p.src.padding, p.src.angle === null && !p.src.upright && !f ? -this.tr.bearing * Math.PI / 180 : 0)});
    }
    return out;
}

/**
 * Whether a feature of a symbol layer that a question found is drawn in the rectangle of the question (in pixels
 * of the screen): its own icon, with its image, size, anchor, offset and turn, is in the rectangle, or the box of
 * its shown text (see `textBoxes`) is in the rectangle. A feature whose text is hidden is not found by its text.
 * (A feature with no point, and a feature with no text and an icon whose image the map does not have, is found
 * within `radius` pixels of its geometry as before.)
 */
function underIcon(this: any, L: CompiledLayer, q: QueriedFeature, box: number[], radius: number, texts: {x: number; y: number; ax?: number; ay?: number; box: number[]; line?: boolean; icon?: boolean; text?: string}[], {at: icons, text: iconTexts}: {at: number[]; text: string[]}): boolean {
    const tr = this.tr, z = tr.zoom, g = q.geometry, f: Feature = {type: 1, id: q.id, properties: q.properties};
    const points = g?.type === 'Point' ? [g.coordinates as number[]] : g?.type === 'MultiPoint' ? g.coordinates as number[][] : null;
    // (A `{name}` token of the text is replaced as the tiles replace it, so that the text is the one that is drawn.)
    const untoken = (t: string) => L.p.field.tokens ? t.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : t;
    const name = pickImage(String(L.p.icon.eval(z, f) ?? ''), n => imageNamed.call(this, n.split(VARIANT)[0])).split(VARIANT)[0];
    const image = imageNamed.call(this, (L.p.icon.tokens ? name.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : name).trim());
    // Text on a line is found on the boxes of its glyphs (see `textBoxes`) when it is shown, and not found when it is
    // hidden. A glyph is the feature's when the place where it meets the line lies on the feature's line. A polygon
    // whose label is placed at a point is found on the box of that label, as in MapLibre GL JS (#1969): the label is
    // the polygon's when its point lies in the polygon and its text is the polygon's. (A line or a polygon with an
    // icon is found within `radius` pixels of its geometry as before.)
    if (!points) {
        const text = untoken(String(L.p.field.eval(z, f) ?? ''));
        if (!g || g.type === 'Point' || g.type === 'MultiPoint' || !image && !text) return true;
        // (A line with an icon is found where its shown labels are drawn, on their icons and the boxes of their glyphs, as in
        // MapLibre GL JS: an icon that collision hid is not found, #2243.)
        if (image && (g.type === 'LineString' || g.type === 'MultiLineString')) {
            const lines = (g.type === 'LineString' ? [g.coordinates] : g.coordinates) as number[][][], size = L.p.iconSize.eval(z, f), turn = L.p.iconRotate.eval(z, f) * Math.PI / 180;
            const [x0, y0, x1, y1] = this.iconBox(L, image.width / image.pixelRatio, image.height / image.pixelRatio, size, turn, L.p.iconPadding.eval(z, f), f);
            const screen = lines.map(l => l.map(([lng, lat]) => tr.project(lng, lat)));
            // (A label is the feature's when its text is the feature's text and its point, where its icon is, lies on the
            // feature's line, as in MapLibre GL JS, where each label belongs to the one feature that made it. A glyph of a
            // label can lie on another line that the label crosses, and the point of a label of another street can lie on
            // this line where the two meet.)
            const field = text.toLowerCase().replace(/\s/g, ''), mine = (t: string | undefined, x: number, y: number) => t?.toLowerCase().replace(/\s/g, '') === field && screen.some(l => {
                for (let k = 1; k < l.length; k++) {
                    const [ax, ay] = l[k - 1], [bx, by] = l[k], dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
                    if (Math.hypot(ax + u * dx - x, ay + u * dy - y) < 1.5) return true;
                }
                return false;
            });
            if (text && texts.some(t => t.line && t.box[0] <= box[2] && t.box[2] >= box[0] && t.box[1] <= box[3] && t.box[3] >= box[1] && mine(t.text, t.ax ?? t.x, t.ay ?? t.y))) return true;
            for (let i = 0; i < icons.length; i += 2) {
                const [x, y] = tr.project(lngFromMerc(icons[i]), latFromMerc(icons[i + 1]));
                if (x + x0 <= box[2] && x + x1 >= box[0] && y + y0 <= box[3] && y + y1 >= box[1] && mine(iconTexts[i / 2], x, y)) return true;
            }
            return false;
        }
        return image || !text ? true
            : textOnLine.call(this, g, box, texts) || labelInPolygon.call(this, g, box, texts, text.toLowerCase().replace(/\s/g, ''));
    }
    // (A label whose text is hidden by collision is not found at its point, as in MapLibre GL JS: #1968.)
    const text = untoken(String(L.p.field.eval(z, f) ?? '')), field = text.toLowerCase().replace(/\s/g, ''), near = !image && !text, turn = L.p.iconRotate.eval(z, f) * Math.PI / 180;
    return points.some(([lng, lat]) => {
        const [x, y] = tr.project(lng, lat);
        // A label that is shown at the point is found on the box of its text, and only there.
        const mine = texts.filter(t => Math.abs(t.x - x) < 1 && Math.abs(t.y - y) < 1);
        if (mine.some(t => t.box[0] <= box[2] && t.box[2] >= box[0] && t.box[1] <= box[3] && t.box[3] >= box[1])) return true;
        if (near && !mine.length && x >= box[0] - radius && x <= box[2] + radius && y >= box[1] - radius && y <= box[3] + radius) return true;
        // (A label whose text is shown and whose icon collision hid, with `icon-optional`, is not found on its icon: #2089.
        // The label's own text is told from another label at the same point by its text, without case and spaces, as
        // `text-transform` can change it. When no shown text is the feature's, its icon is tested.)
        const own = mine.filter(t => t.text?.toLowerCase().replace(/\s/g, '') === field);
        if (!image || own.length && !own.some(t => t.icon)) return false;
        // (An icon that collision hid is not found, as in MapLibre GL JS: a shown icon of the layer is at the point: #2181.
        // An icon without text that may overlap is always drawn, and the tiles can draw it apart from the labels.)
        let drawn = !text && overlaps(L.p.iconOverlapMode.eval(z, f), L.p.iconOverlap.eval(z, f));
        const mx = mercX(lng), my = mercY(lat), e = 1 / tr.worldSize;
        for (let i = 0; i < icons.length && !drawn; i += 2) drawn = Math.abs(icons[i] - mx) < e && Math.abs(icons[i + 1] - my) < e;
        if (!drawn) return false;
        // (On a tilted map or the globe a near icon is larger and a far icon is smaller, as it is drawn.)
        const depth = tr.pitch || tr.globeness ? tr.projectTile({z: 0, x: 0, y: 0, w: 0, key: ''}, mercX(lng) * EXTENT, mercY(lat) * EXTENT)[2] : 0;
        // (A layer with `icon-offset` has no perspective ratio: see `CompiledLayer.fixedSize`.)
        const size = L.p.iconSize.eval(z, f) * (depth > 0 && !L.fixedSize ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1);
        // (An icon is found on its collision box, with `icon-padding`, as in MapLibre GL JS.)
        const [x0, y0, x1, y1] = this.iconBox(L, image.width / image.pixelRatio, image.height / image.pixelRatio, size, turn, L.p.iconPadding.eval(z, f), f, this.iconMove(L, mercX(lng), mercY(lat), x, y));
        return x + x0 <= box[2] && x + x1 >= box[0] && y + y0 <= box[3] && y + y1 >= box[1];
    });
}

/**
 * Whether a shown label at a point, whose text without case and spaces is `field`, lies in the polygon `g` (a feature
 * that a question found) and has its box in the rectangle `box`. The point is tested on the screen, with the even-odd
 * rule over all rings.
 */
function labelInPolygon(this: any, g: NonNullable<QueriedFeature['geometry']>, box: number[], texts: {x: number; y: number; box: number[]; line?: boolean; text?: string}[], field: string): boolean {
    const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][];
    const hit = texts.filter(t => !t.line && t.text?.toLowerCase().replace(/\s/g, '') === field && t.box[0] <= box[2] && t.box[2] >= box[0] && t.box[1] <= box[3] && t.box[3] >= box[1]);
    if (!hit.length || !polygons.length) return false;
    return polygons.some(rings => {
        const screen = rings.map(ring => ring.map(([lng, lat]) => this.tr.project(lng, lat)));
        return hit.some(t => {
            let inside = false;
            for (const ring of screen) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [ax, ay] = ring[i], [bx, by] = ring[j];
                if ((ay > t.y) !== (by > t.y) && t.x < ax + (bx - ax) * (t.y - ay) / (by - ay)) inside = !inside;
            }
            return inside;
        });
    });
}

/** Whether a shown label on a line of `g` (a feature that a question found) has a box in the rectangle `box`. */
function textOnLine(this: any, g: NonNullable<QueriedFeature['geometry']>, box: number[], texts: {x: number; y: number; box: number[]; line?: boolean}[]): boolean {
    const hit = texts.filter(t => t.line && t.box[0] <= box[2] && t.box[2] >= box[0] && t.box[1] <= box[3] && t.box[3] >= box[1]);
    if (!hit.length) return false;
    const tr = this.tr, lines = (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]).flat() : []) as number[][][];
    for (const line of lines) {
        const pts = line.map(([lng, lat]) => tr.project(lng, lat));
        // On the globe a piece of the line is straight in Mercator and curved on the screen, and text that lies on the
        // ground has its glyphs on that curve (see `followLine`). The piece is cut into steps that are straight within
        // a tenth of a pixel (the arc of a step of length s on a sphere of radius R strays s² / 8R from its chord).
        // Text that faces the screen has its glyphs on the straight segments between the points, so both are tested.
        // (The steps go back from the last point to the first, after the points, so that the path stays joined.)
        if (tr.globeness) {
            const ws = tr.worldSize, step = Math.sqrt(0.8 * ws / (2 * Math.PI)) / ws;
            for (let i = line.length - 1; i > 0; i--) {
                const ax = mercX(line[i - 1][0]), ay = mercY(line[i - 1][1]), by = mercY(line[i][1]);
                // (The shorter way around: a segment across the antimeridian can have longitudes such as 179 and -179.)
                let bx = mercX(line[i][0]);
                bx += Math.round(ax - bx);
                const n = Math.min(4096, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
                for (let j = n - 1; j > 0; j--) pts.push(tr.mercToScreen(ax + (bx - ax) * j / n, ay + (by - ay) * j / n));
                pts.push(pts[i - 1]);
            }
        }
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
            for (const t of hit) {
                const k = d2 ? clamp(((t.x - ax) * dx + (t.y - ay) * dy) / d2, 0, 1) : 0;
                if (Math.hypot(ax + dx * k - t.x, ay + dy * k - t.y) < 1) return true;
            }
        }
    }
    return false;
}


/**
 * How far from the point of a feature the icons of a symbol layer can reach on the screen: to the left, up, to the
 * right and down, in pixels (left and up are negative). It is found from the images that the tiles of the layer use
 * now, and it is the reach of the largest one in each direction: a question asks the tiles with it, and tests each
 * feature that comes back with its own icon. Null: the tiles have no icon of the layer.
 */
function iconReach(this: any, L: CompiledLayer): [number, number, number, number] | null {
    // (The answer is kept while the tiles, the images and the view are the same: a question comes with each move of the pointer.)
    const tr = this.tr, z = tr.zoom, at = `${this.tilesVersion}|${this.tiles.size}|${this.styleVersion}|${this.iconsRev}|${z}|${tr.bearing}|${tr.pitch}`, kept = this.reaches.get(L.id);
    if (kept?.at === at) return kept.reach;
    const names = new Set<string>(), each = L.p.iconAnchor.dd || L.p.iconOffset.dd || L.p.iconRotate.dd || L.p.iconAlign.dd;
    // (`icon-padding` is taken as its largest side on every side.)
    let size = L.p.iconSize.dd ? 0 : L.p.iconSize.eval(z), pad = L.p.iconPadding.dd ? 0 : Math.max(...L.p.iconPadding.eval(z));
    for (const [key, t] of this.tiles) {
        if (!t.gl || !key.startsWith(L.source + '|')) continue;
        const b = t.gl.icons?.[L.id]?.src;
        if (b) { for (const name of b.names) names.add(name); if (b.size) for (const s of b.size) if (s > size) size = s; }
        for (const l of t.gl.labels[L.id] ?? []) if (l.icon) { names.add(l.icon.name); if (L.p.iconSize.dd) size = Math.max(size, l.icon.size, l.icon.size1); if (L.p.iconPadding.dd) pad = Math.max(pad, ...l.icon.padding); }
    }
    let w = 0, h = 0, reach: [number, number, number, number] | null = null;
    for (const name of names) { const m = imageNamed.call(this, name); if (m) { w = Math.max(w, m.width / m.pixelRatio); h = Math.max(h, m.height / m.pixelRatio); } }
    if (w) {
        // (A tilted map can draw an icon up to four times larger. With an anchor, an offset or a turn for each
        // feature, an icon can reach as far as its corner and its offset in each direction.)
        size *= tr.pitch ? 4 : 1;
        // (On the globe or a pitched map icon-translate moves each icon by its own amount on the screen (see
        // `iconMove`): the reach covers no move, twice the move in pixels and, on a pitched map, the move at the
        // bottom corners of the view, where the ground is nearest and a move is largest.)
        const move = screenTranslate(L.p.iconTranslate.eval(z), L.p.iconTranslateAnchor.eval(z), tr.bearing);
        const moves = !tr.globeness && !tr.pitch ? [move] : [[0, 0], move.map(v => 2 * v), ...(tr.globeness ? [] : [0, tr.width].map(px => this.iconMove(L, ...tr.screenToMerc(px, tr.height), px, tr.height)))];
        let far = 0, r = [Infinity, Infinity, -Infinity, -Infinity];
        for (const m of moves) {
            const [x0, y0, x1, y1] = this.iconBox(L, w, h, size, L.p.iconRotate.dd ? 0 : L.p.iconRotate.eval(z) * Math.PI / 180, pad, undefined, m as [number, number]);
            far = Math.max(far, Math.hypot(w, h) * size + Math.hypot(x0 + x1, y0 + y1) / 2 + 64 * size + 2 * pad);
            r = [Math.min(r[0], x0), Math.min(r[1], y0), Math.max(r[2], x1), Math.max(r[3], y1)];
        }
        reach = each ? [-far, -far, far, far] : r as [number, number, number, number];
    }
    this.reaches.set(L.id, {at, reach});
    return reach;
}
