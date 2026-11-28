// The part `query` of the library (src/parts.ts, #2342), which loads on demand: the queries of features
// (`queryRenderedFeatures`, `querySourceFeatures`). The tile workers use `queryTile` of query.ts, and the engine the
// functions below. The engine starts to load the part after the first `idle` of a map, so that it does not delay the
// first picture. A query that comes before the part has loaded waits for it. (The page's GeoJSON queries of the compat
// entry, sync-query.ts, use query.ts alone.)
//
// The functions below run as methods of the engine (src/engine.ts): each is called with `fn.call(this, ...)` and reads
// the members of the engine, as the functions of 3D terrain do (src/terrain.ts). The build gives each `this.name` the
// same short name in every file (scripts/private-names.mjs). They answer from tile data, independent of what is drawn.
import {EXTENT, clamp, mercX, mercY} from './geo.ts';
import {pickImage, type Feature} from './expr.ts';
import {overlaps} from './tile.ts';
import {isGeometrySource, screenTranslate, tileURL, type CompiledLayer, type SourceInfo} from './style.ts';
import {VARIANT} from './markers.ts';
import {boxAround, flatSize} from './placement.ts';
import {circleCenters, circleRadius, circleTouches, featureKey, movedCenter, pitchedCircles, setBox, setReach, tilesUnderBox, type FoundFeature, type QueriedFeature} from './query.ts';
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
    const radii = new Map<string, number>(), shown = new Map<string, Shown[]>();
    // (The places in their tiles of the features whose labels are in the rectangle: see `QuerySet.at`.)
    const wants = new Map<string, Map<string, number[]>>();
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
            // (The text of a label can reach farther than its icon: the reach covers both. Text along a line is not
            // counted: its label names its feature below.)
            const texts = L?.type === 'symbol' ? labelBoxes.call(this, L.id) : [];
            for (const t of texts) {
                if (t.line) continue;
                const d = [t.box[0] - t.x, t.box[1] - t.y, t.box[2] - t.x, t.box[3] - t.y];
                reach = reach ? [Math.min(reach[0], d[0]), Math.min(reach[1], d[1]), Math.max(reach[2], d[2]), Math.max(reach[3], d[3])] : [d[0], d[1], d[2], d[3]];
            }
            // (A symbol layer with no icon and no shown text is still tested with `underIcon`, so that a line whose
            // label is hidden is not found along its geometry: #1916.)
            if (L?.type === 'symbol') reach ??= [0, 0, 0, 0];
            if (reach) {
                radii.set(s.layer, r), shown.set(s.layer, texts);
                // (A label with a box in the rectangle names its feature, as it does in MapLibre GL JS, and the tile gives that
                // feature whether or not its geometry is near.)
                const want = new Map<string, number[]>(), add = (of: string) => { const i = of.lastIndexOf('/'), k = of.slice(0, i); (want.get(k) ?? want.set(k, []).get(k)!).push(+of.slice(i + 1)); };
                for (const t of texts) if (touches(t.box, c.box)) add(t.of);
                wants.set(s.layer, want);
            }
            const circle = circles.get(s.layer) === s;
            const box = reach ? [c.box[0] - Math.max(reach[2], r), c.box[1] - Math.max(reach[3], r), c.box[2] - Math.min(reach[0], -r), c.box[3] - Math.min(reach[1], -r)] : circle ? pitched!.box : setBox(c.box, s), pad = reach || circle ? 0 : setReach(s), key = box.join() + ',' + pad;
            const group = boxes.get(key) ?? {box, pad, sets: [], exact: !!reach || circle};
            // (A tilted circle whose size depends on the feature is asked with its size grown as `pitchedCircles` grows the rectangle.)
            group.sets.push(circle && s.size ? {...s, radius: 0, size: {...s.size, scale: pitched!.k}} : reach || circle ? {...s, radius: 0} : s);
            boxes.set(key, group);
        }
        for (const {box, pad, sets, exact} of boxes.values()) {
            const asked = new Set<string>(), tiles = tilesUnderBox(this.tr, box, src.minzoom, src.maxzoom, pad);
            for (const t of tiles) asked.add(`${t.z}/${t.x}/${t.y}`);
            // (A label can belong to a tile of another zoom than the tiles under the rectangle, as on a tilted map or on the globe.
            // The features of that tile that the label names are asked from it, with a rectangle that touches nothing.)
            for (const s of sets) for (const [key, at] of wants.get(s.layer) ?? []) {
                if (asked.has(key)) continue;
                const [z, x, y] = key.split('/').map(Number);
                jobs.push(queryBackend.call(this, name, z, x, y).query(tileURL(src, z, x, y, this.dpr), {
                    source: name, z, zoom: Math.max(z, Math.floor(this.tr.zoom)), x, y, px: 0, py: 0, radius: 0, box: [-1e6, -1e6, -1e6 + 1, -1e6 + 1], geometry: true,
                    sets: [{at, layer: s.layer, sourceLayer: s.sourceLayer, filter: s.filter, also: s.also, radius: 0, ring: s.ring}],
                }));
            }
            for (const t of tiles) jobs.push(queryBackend.call(this, name, t.z, t.x, t.y).query(tileURL(src, t.z, t.x, t.y, this.dpr), {
                source: name, z: t.z, zoom: Math.max(t.z, Math.floor(this.tr.zoom)), x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: c.geometry || exact,
                sets: sets.map(s => ({at: wants.get(s.layer)?.get(`${t.z}/${t.x}/${t.y}`) ?? (wants.has(s.layer) ? [] : undefined), layer: s.layer, sourceLayer: s.sourceLayer, filter: s.filter, also: s.also, radius: s.radius * t.scale, ring: s.ring, size: s.size && (s.radius || s.size.scale) ? {...s.size, scale: t.scale * (s.size.scale ?? 1)} : undefined})),
            }));
        }
    }
    // A feature that is in two tiles is given one time, when it has an id or comes from a GeoJSON source.
    const seen = new Set<string>();
    return (await Promise.all(jobs)).flat().filter(f => {
        const L = radii.has(f.layer!) && this.layers.find((l: CompiledLayer) => l.id === f.layer);
        if (L && !underIcon.call(this, L, f, c.box, radii.get(f.layer!)!, shown.get(f.layer!)!)) return false;
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

/** The feature of a label, as `QueriedFeature.at` of a query tells it: the tile and the place of the feature in it. */
const labelOf = (p: {tile: {z: number; x: number; y: number}; src: {at: number}}) => `${p.tile.z}/${p.tile.x}/${p.tile.y}/${p.src.at}`;

/** A collision box of a shown label (see `labelBoxes`). */
type Shown = {x: number; y: number; box: number[]; line?: boolean; icon?: boolean; text?: string; of: string; m?: number[]};

/** Whether the box `b` and the rectangle `box` touch. */
const touches = (b: number[], box: number[]) => b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1];

/**
 * The collision boxes of the shown labels of a layer, in pixels of the screen, as MapLibre GL JS queries its collision
 * boxes: the box of the text (or of each circle of text along a line) and the box of the icon (`icon`), as placement
 * made them (`Placed.boxes`, `Placed.iconBox`), with `text-padding`, `icon-padding`, `icon-text-fit`, the translate
 * properties and the perspective. Between two placements each box moves with the point of its label, as the label
 * does. `x`, `y`: the point of the label on the screen now; `of`: its feature (see `labelOf`); `line`: a label along a line.
 */
function labelBoxes(this: any, layer: string) {
    const out: Shown[] = [], at: [number, number, number] = [0, 0, 0];
    for (const [key, {placed: p, target}] of this.labels) {
        if (!target || !key.startsWith(layer + '|')) continue;
        const [x, y] = this.tr.projectTile(p.tile, p.src.x, p.src.y, undefined, at), dx = x - p.ax, dy = y - p.ay, of = labelOf(p), line = p.src.angle !== null;
        const move = (b: number[]) => [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];
        if (p.shaped) for (const b of p.boxes ?? []) out.push({x, y, line, text: p.src.text, of, box: move(b)});
        if (p.iconBox) out.push({x, y, line, icon: true, of, box: move(p.iconBox), m: [(p.tile.x + p.src.x / EXTENT) / 2 ** p.tile.z, (p.tile.y + p.src.y / EXTENT) / 2 ** p.tile.z]});
    }
    return out;
}

/** Whether the icons of a layer lie on the ground for the query: `text-pitch-alignment` is `map`, or `auto` with `text-rotation-alignment` `map`. */
const groundIcon = (L: CompiledLayer, f: Feature, z: number) => { const pitch = L.p.textPitch.eval(z, f); return pitch === 'map' || pitch !== 'viewport' && L.p.textAlign.eval(z, f) === 'map'; };

/**
 * Whether a feature of a symbol layer that a question found is drawn in the rectangle of the question (in pixels of
 * the screen). A feature with a shown label is found on the collision boxes of its label (see `labelBoxes`) and only
 * there, as in MapLibre GL JS, where each box belongs to the one feature that made it: the tile and the place of the
 * feature in the tile are the same (`LabelSrc.at`). A feature without a shown label is not found, except in these cases:
 * - a polygon whose label lies in it with its text (#1969);
 * - a feature with no icon and no text, or with no point and an icon, within `radius` pixels of its geometry;
 * - an icon without text that may overlap, which the tiles can draw apart from the labels, on its own box.
 */
function underIcon(this: any, L: CompiledLayer, q: FoundFeature, box: number[], radius: number, shown: Shown[]): boolean {
    const own = shown.filter(t => t.of === q.at), tr = this.tr, z = tr.zoom, g = q.geometry, f: Feature = {type: 1, id: q.id, properties: q.properties};
    if (own.some(t => touches(t.box, box) && !(t.icon && !t.line && groundIcon(L, f, z)))) return true;
    // (The icon of a label at a point with `text-pitch-alignment` `map` is found on the box that MapLibre GL JS projects from the ground
    // (`groundIconBox`), which differs by a few pixels from the box that placement keeps: #2336.)
    for (const t of own) if (t.icon && !t.line && t.m && groundIcon(L, f, z)) {
        const img = imageNamed.call(this, String(L.p.icon.eval(z, f) ?? '').trim().split(VARIANT)[0]);
        if (!img) { if (touches(t.box, box)) return true; continue; }
        const depth = tr.pitch || tr.globeness ? tr.projectTile({z: 0, x: 0, y: 0, w: 0, key: ''}, t.m[0] * EXTENT, t.m[1] * EXTENT)[2] : 0;
        const [x0, y0, x1, y1] = groundIconBox.call(this, L, f, img.width / img.pixelRatio, img.height / img.pixelRatio, L.p.iconRotate.eval(z, f) * Math.PI / 180, t.m[0], t.m[1], depth, L.p.textAlign.eval(z, f) === 'map'), [mx, my] = this.iconMove(L, t.m[0], t.m[1], t.x, t.y);
        if (x0 + mx <= box[2] && x1 + mx >= box[0] && y0 + my <= box[3] && y1 + my >= box[1]) return true;
    }
    if (own.length) return false;
    const points = g?.type === 'Point' ? [g.coordinates as number[]] : g?.type === 'MultiPoint' ? g.coordinates as number[][] : null;
    // (A `{name}` token of the text is replaced as the tiles replace it, so that the text is the one that is drawn.)
    const field = String(L.p.field.eval(z, f) ?? ''), text = L.p.field.tokens ? field.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : field;
    const name = pickImage(String(L.p.icon.eval(z, f) ?? ''), n => imageNamed.call(this, n.split(VARIANT)[0])).split(VARIANT)[0];
    const image = imageNamed.call(this, (L.p.icon.tokens ? name.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : name).trim());
    if (!points) {
        // (A line with an icon is found only on its shown labels, as in MapLibre GL JS: #2243.)
        if (!g || !image && !text) return true;
        if (image && (g.type === 'LineString' || g.type === 'MultiLineString')) return false;
        return image || !text ? true : labelInPolygon.call(this, g, box, shown, text.toLowerCase().replace(/\s/g, ''));
    }
    // (A label that collision hid is not found, as in MapLibre GL JS: #1968, #2181.)
    const near = !image && !text;
    if (!near && (text || !overlaps(L.p.iconOverlapMode.eval(z, f), L.p.iconOverlap.eval(z, f)))) return false;
    const turn = L.p.iconRotate.eval(z, f) * Math.PI / 180;
    return points.some(([lng, lat]) => {
        const [x, y] = tr.project(lng, lat);
        if (near) return x >= box[0] - radius && x <= box[2] + radius && y >= box[1] - radius && y <= box[3] + radius;
        // (On a tilted map or the globe a near icon is larger and a far icon is smaller, as it is drawn.)
        const depth = tr.pitch || tr.globeness ? tr.projectTile({z: 0, x: 0, y: 0, w: 0, key: ''}, mercX(lng) * EXTENT, mercY(lat) * EXTENT)[2] : 0;
        const pitch = L.p.textPitch.eval(z, f), align = L.p.textAlign.eval(z, f);
        if (pitch === 'map' || pitch !== 'viewport' && align === 'map') {
            const [x0, y0, x1, y1] = groundIconBox.call(this, L, f, image.width / image.pixelRatio, image.height / image.pixelRatio, turn, mercX(lng), mercY(lat), depth, align === 'map'), [mx, my] = this.iconMove(L, mercX(lng), mercY(lat), x, y);
            return x0 + mx <= box[2] && x1 + mx >= box[0] && y0 + my <= box[3] && y1 + my >= box[1];
        }
        // (The box has the perspective ratio also for a layer with `icon-offset`, whose icon is drawn without it, as the
        // collision box of MapLibre GL JS has: see `CompiledLayer.fixedSize` (#2168).)
        const size = L.p.iconSize.eval(z, f) * (depth > 0 ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1);
        // (An icon is found on its collision box, with `icon-padding`, as in MapLibre GL JS.)
        const [x0, y0, x1, y1] = this.iconBox(L, image.width / image.pixelRatio, image.height / image.pixelRatio, size, turn, L.p.iconPadding.eval(z, f), f, this.iconMove(L, mercX(lng), mercY(lat), x, y));
        return x + x0 <= box[2] && x + x1 >= box[0] && y + y0 <= box[3] && y + y1 >= box[1];
    });
}

/**
 * The box on the screen of the icon of a symbol layer at a point whose `text-pitch-alignment` is `map`, as in MapLibre
 * GL JS (`_projectCollisionBox`): the box of the icon, with `icon-rotate` and `icon-padding`, lies on the ground at the
 * point (mx, my) in Mercator, at the distance `depth` from the camera, and the corners and the middles of its sides are
 * projected each on its own. The box turns with the map when `text-rotation-alignment` is `map` (`turns`), and is
 * upright on the screen otherwise. Its size on the ground is as in `flatSize`. Left, top, right and bottom in pixels.
 */
function groundIconBox(this: any, L: CompiledLayer, f: Feature, w: number, h: number, turn: number, mx: number, my: number, depth: number, turns: boolean): number[] {
    const tr = this.tr, z = tr.zoom, size = L.p.iconSize.eval(z, f), anchor = L.p.iconAnchor.eval(z, f) as string, offset = L.p.iconOffset.eval(z, f) as number[];
    const ox = (offset[0] + (anchor.includes('left') ? 0.5 : anchor.includes('right') ? -0.5 : 0) * w) * size, oy = (offset[1] + (anchor.includes('top') ? 0.5 : anchor.includes('bottom') ? -0.5 : 0) * h) * size;
    const [l, t, r, b] = boxAround(ox * Math.cos(turn) - oy * Math.sin(turn), ox * Math.sin(turn) + oy * Math.cos(turn), w * size, h * size, turn, L.p.iconPadding.eval(z, f));
    // (A pixel on the ground is longer on the globe away from the center, as in `groundFrame` of placement.ts.)
    const k = flatSize(tr, depth) / tr.worldSize * (1 + tr.globeness * (Math.cosh(Math.PI * (1 - 2 * my)) * Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * Math.PI / 180) - 1));
    const a = turns ? 0 : tr.bearing * Math.PI / 180, c = Math.cos(a) * k, s = Math.sin(a) * k, out = [Infinity, Infinity, -Infinity, -Infinity];
    for (const u of [l, (l + r) / 2, r]) for (const v of [t, (t + b) / 2, b]) {
        const [px, py] = tr.projectTile({z: 0, x: 0, y: 0, w: 0, key: ''}, (mx + u * c - v * s) * EXTENT, (my + u * s + v * c) * EXTENT);
        out[0] = Math.min(out[0], px); out[1] = Math.min(out[1], py); out[2] = Math.max(out[2], px); out[3] = Math.max(out[3], py);
    }
    return out;
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
        size *= tr.pitch || tr.globeness ? 4 : 1;
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
