import {Transform, mercX, mercY, type LngLatLike, type TileID} from './geo.ts';
import {compileLayer, loadSprite, tileURL, type CompiledLayer, type ResolvedStyle, type Sprite} from './style.ts';
import {GLRenderer, SPRITE_ATLAS, type GLTile} from './gl.ts';
import {CollisionGrid, placeLabels, renderItems, type RenderItem} from './placement.ts';
import {GlyphAtlas} from './text.ts';
import type {TileBackend} from './tiles.ts';

export interface CameraOptions { center?: LngLatLike; zoom?: number; bearing?: number }
export interface EngineOptions extends CameraOptions {
    style: ResolvedStyle; width: number; height: number; dpr: number; fontFamily: string;
}
export interface MarkerImage { variant: number; w: number; h: number; data: Uint8Array }
export type Command =
    | {type: 'resize'; width: number; height: number; dpr: number}
    | ({type: 'jump'} & CameraOptions)
    | ({type: 'ease'; duration: number; around?: [number, number]} & CameraOptions)
    | {type: 'pan'; dx: number; dy: number}
    | {type: 'zoom'; delta: number; x: number; y: number; smooth: boolean}
    | {type: 'rotate'; delta: number}
    | {type: 'fling'; vx: number; vy: number}
    | {type: 'stop'}
    | {type: 'style'; style: ResolvedStyle; reload: boolean}
    | {type: 'markers'; id: string; width: number; height: number; offset: [number, number]; collide: boolean;
        merc: Float64Array; variant: Uint32Array; images: MarkerImage[]}
    | {type: 'removeMarkers'; id: string}
    | {type: 'repaint'};
export type EngineEvent =
    | {type: 'camera'; lng: number; lat: number; zoom: number; bearing: number; moving: boolean}
    | {type: 'idle'}
    | {type: 'error'; message: string};

interface TileState { state: 'loading' | 'ok' | 'error'; gl?: GLTile; used: number; cancel(): void }
interface MarkerLayer { width: number; height: number; offset: [number, number]; collide: boolean; merc: Float64Array; variant: Uint32Array }

const raf: (cb: (t: number) => void) => unknown = globalThis.requestAnimationFrame
    ? cb => globalThis.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);
const MAX_TILES = 160;

/**
 * Everything that happens per frame: camera animation, tile selection, label placement and drawing.
 * It never touches the DOM, so it runs unchanged on the main thread or inside a worker with an OffscreenCanvas,
 * driven purely by `Command` messages and reporting back through `EngineEvent`s.
 */
export class Engine {
    tr = new Transform();
    private renderer: GLRenderer;
    private atlas: GlyphAtlas;
    private style!: ResolvedStyle;
    private layers: CompiledLayer[] = [];
    private tiles = new Map<string, TileState>();
    private frameNo = 0;
    private scheduled = false;
    private nextReq = 1;
    private nextBackend = 0;
    private lastCamera = '';
    private wasIdle = false;
    private moving = false;

    private ease: {from: number[]; to: number[]; start: number; duration: number; around?: [number, number]; anchor?: [number, number]} | null = null;
    private wheel: {target: number; x: number; y: number} | null = null;
    private fling: {vx: number; vy: number} | null = null;
    private lastTime = 0;

    private markers = new Map<string, MarkerLayer>();
    private spriteRects = new Map<number, [number, number, number, number]>();
    private spritePen = [1, 1, 0];
    private sprites = new Float32Array(24 * 256);
    private sprite: Sprite | null = null;
    private spriteUrl = '';
    private dpr = 1;

    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, o: EngineOptions, private backends: TileBackend[], private emit: (e: EngineEvent) => void) {
        this.renderer = new GLRenderer(canvas);
        this.atlas = new GlyphAtlas(o.fontFamily);
        this.tr.width = o.width;
        this.tr.height = o.height;
        this.dpr = o.dpr;
        this.renderer.resize(o.width, o.height, o.dpr);
        this.tr.set(o.center, o.zoom, o.bearing);
        this.setStyle(o.style, true);
    }

    private setStyle(style: ResolvedStyle, reload: boolean) {
        this.style = style;
        this.layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
        if (style.sprite && style.sprite !== this.spriteUrl) {
            this.spriteUrl = style.sprite;
            this.loadIcons(style.sprite).catch(err => this.emit({type: 'error', message: String(err.message)}));
        }
        if (reload) {
            for (const b of this.backends) b.setStyle(style.layers);
            for (const [key, t] of this.tiles) this.dropTile(key, t);
        }
        this.repaint();
    }

    private async loadIcons(url: string) {
        const sprite = await loadSprite(url, this.dpr > 1);
        const res = await fetch(sprite.image);
        if (!res.ok) throw new Error(`Failed to load sprite image ${sprite.image}: ${res.status}`);
        const image = await createImageBitmap(await res.blob());
        if (url !== this.spriteUrl) return;
        this.renderer.setIcons(image, image.width, image.height);
        this.sprite = sprite;
        this.repaint();
    }

    command(c: Command) {
        const tr = this.tr;
        switch (c.type) {
            case 'resize':
                tr.width = c.width; tr.height = c.height; this.dpr = c.dpr;
                this.renderer.resize(c.width, c.height, c.dpr);
                // Draw immediately: resizing clears the canvas, and waiting a frame would flash.
                this.frame(performance.now());
                return;
            case 'jump': this.stop(); tr.set(c.center, c.zoom, c.bearing); break;
            case 'ease': {
                this.stop();
                const to = new Transform();
                Object.assign(to, {lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, minZoom: tr.minZoom, maxZoom: tr.maxZoom});
                to.set(c.center, c.zoom, c.bearing);
                let db = to.bearing - tr.bearing;
                db = ((db + 180) % 360 + 360) % 360 - 180;
                this.ease = {
                    from: [mercX(tr.lng), mercY(tr.lat), tr.zoom, tr.bearing], to: [mercX(to.lng), mercY(to.lat), to.zoom, tr.bearing + db],
                    start: performance.now(), duration: Math.max(1, c.duration), around: c.around,
                    anchor: c.around ? tr.unproject(c.around[0], c.around[1]) : undefined,
                };
                break;
            }
            case 'pan': {
                this.fling = null; this.ease = null;
                const [lng, lat] = tr.unproject(tr.width / 2 - c.dx, tr.height / 2 - c.dy);
                tr.set([lng, lat]);
                break;
            }
            case 'zoom':
                this.fling = null; this.ease = null;
                if (c.smooth) {
                    const target = Math.min(tr.maxZoom, Math.max(tr.minZoom, (this.wheel?.target ?? tr.zoom) + c.delta));
                    this.wheel = {target, x: c.x, y: c.y};
                } else this.zoomAround(tr.zoom + c.delta, c.x, c.y);
                break;
            case 'rotate': tr.set(undefined, undefined, tr.bearing + c.delta); break;
            case 'fling': {
                // Cap the speed so a very fast flick cannot throw the map across the world.
                const k = Math.min(1, 3 / Math.hypot(c.vx, c.vy));
                this.fling = {vx: c.vx * k, vy: c.vy * k};
                break;
            }
            case 'stop': this.stop(); break;
            case 'style': this.setStyle(c.style, c.reload); break;
            case 'markers': {
                for (const img of c.images) this.addSprite(img);
                this.markers.set(c.id, c);
                break;
            }
            case 'removeMarkers': this.markers.delete(c.id); break;
            case 'repaint': break;
        }
        this.repaint();
    }

    private stop() { this.ease = null; this.wheel = null; this.fling = null; }

    private zoomAround(zoom: number, x: number, y: number) {
        const [lng, lat] = this.tr.unproject(x, y);
        this.tr.set(undefined, zoom);
        this.tr.setLocationAt(lng, lat, x, y);
    }

    private addSprite(img: MarkerImage) {
        const pen = this.spritePen;
        if (pen[0] + img.w + 1 > SPRITE_ATLAS) { pen[0] = 1; pen[1] += pen[2] + 1; pen[2] = 0; }
        if (pen[1] + img.h + 1 > SPRITE_ATLAS) { this.emit({type: 'error', message: 'Marker image atlas is full'}); return; }
        this.renderer.uploadSprite(pen[0], pen[1], img.w, img.h, img.data);
        this.spriteRects.set(img.variant, [pen[0], pen[1], img.w, img.h]);
        pen[0] += img.w + 1;
        pen[2] = Math.max(pen[2], img.h);
    }

    repaint() {
        if (this.scheduled) return;
        this.scheduled = true;
        raf(t => { this.scheduled = false; this.frame(t); });
    }

    /** Advances camera animations; returns true while any is still running. */
    private animate(now: number): boolean {
        const tr = this.tr, dt = Math.min(50, now - this.lastTime || 16);
        this.lastTime = now;
        if (this.ease) {
            const e = this.ease, t = Math.min(1, (now - e.start) / e.duration), k = 1 - (1 - t) ** 3;
            const v = e.from.map((f, i) => f + (e.to[i] - f) * k);
            tr.zoom = v[2];
            tr.set(undefined, undefined, v[3]);
            if (e.around && e.anchor) tr.setLocationAt(e.anchor[0], e.anchor[1], e.around[0], e.around[1]);
            else { tr.lng = v[0] * 360 - 180; tr.lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * v[1]))) * 180 / Math.PI; }
            if (t >= 1) this.ease = null;
        }
        if (this.wheel) {
            const w = this.wheel, d = w.target - tr.zoom;
            if (Math.abs(d) < 0.002) { this.zoomAround(w.target, w.x, w.y); this.wheel = null; } else this.zoomAround(tr.zoom + d * (1 - Math.exp(-dt / 70)), w.x, w.y);
        }
        if (this.fling) {
            const f = this.fling, decay = Math.exp(-dt / 180);
            const [lng, lat] = tr.unproject(tr.width / 2 - f.vx * dt, tr.height / 2 - f.vy * dt);
            tr.set([lng, lat]);
            f.vx *= decay; f.vy *= decay;
            if (Math.hypot(f.vx, f.vy) < 0.02) this.fling = null;
        }
        return !!(this.ease || this.wheel || this.fling);
    }

    private dropTile(key: string, t: TileState) {
        if (t.state === 'loading') t.cancel();
        if (t.gl) this.renderer.destroyTile(t.gl);
        this.tiles.delete(key);
    }

    private request(source: string, id: TileID, key: string) {
        const src = this.style.sources[source], url = tileURL(src, id.z, id.x, id.y);
        const t: TileState = {state: 'loading', used: this.frameNo, cancel() {}};
        this.tiles.set(key, t);
        let load: Promise<GLTile>;
        if (src.type === 'vector') {
            const backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++;
            t.cancel = () => backend.cancel(req);
            load = backend.load({id: req, source, url, z: id.z, overscaled: id.z >= src.maxzoom}).then(tile => this.renderer.createTile(tile));
        } else {
            // Image tiles need no parsing, so the engine fetches and decodes them itself.
            const ac = new AbortController(), dem = src.type === 'raster-dem';
            t.cancel = () => ac.abort();
            load = fetch(url, {signal: ac.signal}).then(async res => {
                if (res.status === 404 || res.status === 204) return {labels: {}, batches: {}};
                if (!res.ok) throw new Error(`Tile ${url}: HTTP ${res.status}`);
                const image = await createImageBitmap(await res.blob(), dem ? {premultiplyAlpha: 'none', colorSpaceConversion: 'none'} : {});
                if (this.tiles.get(key) !== t) { image.close(); return {labels: {}, batches: {}}; }
                const tile = this.renderer.createImageTile(image, dem, id);
                image.close();
                return tile;
            });
        }
        load.then(gl => {
            if (this.tiles.get(key) !== t) return;
            t.gl = gl;
            t.state = 'ok';
            this.repaint();
        }, err => {
            if (this.tiles.get(key) !== t) return;
            t.state = 'error';
            if (err.message !== 'aborted' && err.name !== 'AbortError') this.emit({type: 'error', message: err.message});
            this.repaint();
        });
    }

    private frame(now: number) {
        const tr = this.tr, frameNo = ++this.frameNo;
        if (!tr.width || !tr.height) return;
        const animating = this.animate(now);

        const items = new Map<string, RenderItem<GLTile>[]>(), all: RenderItem<GLTile>[] = [];
        let complete = true;
        const wanted = new Set<string>();
        for (const source in this.style.sources) {
            // Skip sources nothing visible draws from at this zoom (e.g. low-zoom relief imagery when zoomed in).
            if (!this.layers.some(l => l.source === source && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)) continue;
            const src = this.style.sources[source];
            const ideal = tr.coveringTiles(src.minzoom, src.maxzoom, src.tileSize);
            for (const id of ideal) {
                const key = source + '|' + id.key;
                wanted.add(key);
                const t = this.tiles.get(key);
                if (!t) this.request(source, id, key);
                if (!t || t.state === 'loading') complete = false;
            }
            const list = renderItems(tr, ideal, k => {
                const t = this.tiles.get(source + '|' + k);
                if (t?.state !== 'ok') return undefined;
                t.used = frameNo;
                return t.gl;
            });
            items.set(source, list);
            all.push(...list);
        }
        for (const [key, t] of this.tiles) {
            if (t.state === 'loading' && !wanted.has(key)) this.dropTile(key, t);
        }
        if (this.tiles.size > MAX_TILES) {
            const old = [...this.tiles].filter(([, t]) => t.used !== frameNo && t.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
            for (const [key, t] of old.slice(0, this.tiles.size - MAX_TILES)) this.dropTile(key, t);
        }

        const grid = new CollisionGrid();
        const spriteCount = this.buildSprites(grid);
        const labels = placeLabels(tr, all, this.layers, this.atlas, grid, this.sprite);
        this.renderer.render({tr, layers: this.layers, items, labels, atlas: this.atlas, sprites: this.sprites, spriteCount});

        const camera = `${tr.lng},${tr.lat},${tr.zoom},${tr.bearing}`;
        if (camera !== this.lastCamera || animating !== this.moving) {
            this.lastCamera = camera;
            this.moving = animating;
            this.emit({type: 'camera', lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, moving: animating});
        }
        const idle = complete && !animating;
        if (idle && !this.wasIdle) this.emit({type: 'idle'});
        this.wasIdle = idle;
        if (animating) this.repaint();
    }

    /** Projects visible markers into screen-space quads and, for colliding layers, reserves their boxes. */
    private buildSprites(grid: CollisionGrid): number {
        const tr = this.tr, ws = tr.worldSize, a = -tr.bearing * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        const cx = mercX(tr.lng), cy = mercY(tr.lat), hw = tr.width / 2, hh = tr.height / 2;
        let n = 0;
        for (const m of this.markers.values()) {
            const [ox, oy] = m.offset, w = m.width, h = m.height;
            for (let i = 0; i < m.variant.length; i++) {
                const rect = this.spriteRects.get(m.variant[i]);
                if (!rect) continue;
                let dx = m.merc[i * 2] - cx;
                dx -= Math.round(dx); // nearest world copy
                const wx = dx * ws, wy = (m.merc[i * 2 + 1] - cy) * ws;
                const x = cos * wx - sin * wy + hw + ox, y = sin * wx + cos * wy + hh + oy;
                if (x > tr.width || y > tr.height || x + w < 0 || y + h < 0) continue;
                if (m.collide) grid.insert(x, y, x + w, y + h);
                if ((n + 1) * 24 > this.sprites.length) {
                    const grown = new Float32Array(this.sprites.length * 2);
                    grown.set(this.sprites);
                    this.sprites = grown;
                }
                const s = this.sprites, o = n * 24, [u0, v0, uw, vh] = rect, x1 = x + w, y1 = y + h, u1 = u0 + uw, v1 = v0 + vh;
                s[o] = x; s[o + 1] = y; s[o + 2] = u0; s[o + 3] = v0;
                s[o + 4] = x1; s[o + 5] = y; s[o + 6] = u1; s[o + 7] = v0;
                s[o + 8] = x; s[o + 9] = y1; s[o + 10] = u0; s[o + 11] = v1;
                s[o + 12] = x1; s[o + 13] = y; s[o + 14] = u1; s[o + 15] = v0;
                s[o + 16] = x1; s[o + 17] = y1; s[o + 18] = u1; s[o + 19] = v1;
                s[o + 20] = x; s[o + 21] = y1; s[o + 22] = u0; s[o + 23] = v1;
                n++;
            }
        }
        return n;
    }
}
