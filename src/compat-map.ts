// The map of the entry `map-jr-gl/maplibre-compat`: the core map (map.ts) with the rest of the API of MapLibre GL JS.
// These methods are here, and not in the core, because the main entry does not need them: other names for a camera
// change, values that are fixed in this library, methods that only frameworks for MapLibre GL JS read, and query
// results that are arrays and promises at the same time.
import {Map as CoreMap, type CameraInput, type PointLike, type RenderedFeature, type RenderedQueryOptions, type PaddingInput, type ImageOptions} from './map.ts';
import type {QueriedFeature} from './query.ts';
import type {LngLatLike} from './geo.ts';

export class Map extends CoreMap {
    // ---- Accepted, with no effect ----
    // Frameworks for MapLibre GL JS call these methods when an application sets the option, often with the default
    // value. They are here so that such code does not stop. A value that this library cannot do gives one warning.
    private unsupported(name: string, isDefault: boolean) {
        if (!isDefault && !this.warned.has(name)) { this.warned.add(name); console.warn(`[map-jr-gl] ${name} has no effect: this library does not have that feature.`); }
        return this;
    }
    private warned = new Set<string>();
    setProjection(projection?: {type?: unknown} | null) { return this.unsupported('setProjection', !projection || projection.type === 'mercator'); }
    setSky(sky?: object | null) { return this.unsupported('setSky', !sky || !Object.keys(sky).length); }
    setRenderWorldCopies(copies?: boolean | null) { return this.unsupported('setRenderWorldCopies(false)', copies !== false); }
    setRoll(roll?: number) { return this.unsupported('setRoll', !roll); }
    setVerticalFieldOfView(fov?: number) { return this.unsupported('setVerticalFieldOfView', fov === undefined || Math.abs(fov - 36.87) < 0.01); }
    getVerticalFieldOfView() { return 36.87; }
    setZoomSnap(snap?: number) { return this.unsupported('setZoomSnap', !snap); }
    getZoomSnap() { return 0; }
    setCenterClampedToGround(clamped?: boolean) { return this.unsupported('setCenterClampedToGround(false)', clamped !== false); }
    getCenterClampedToGround() { return true; }
    setCenterElevation(elevation?: number) { return this.unsupported('setCenterElevation', !elevation); }
    setAnisotropicFilterPitch(_pitch?: number | null) { return this; }
    getAnisotropicFilterPitch() { return 20; }
    setSourceTileLodParams(..._args: unknown[]) { return this; }
    setTransformCameraUpdate(fn?: unknown) { return this.unsupported('setTransformCameraUpdate', !fn); }
    setTransformConstrain(fn?: unknown) { return this.unsupported('setTransformConstrain', !fn); }
    setEventedParent(..._args: unknown[]) { return this; }

    flyTo(o: CameraInput & {duration?: number}) { return this.easeTo({duration: 1200, ...o}); }
    /** Space at the edges covered by other things (a side panel, a header). The map centre moves to the middle of what is left. */
    setPadding(padding: PaddingInput) { return this.jumpTo({padding}); }
    getPadding() { const [top, right, bottom, left] = this.tr.padding; return {top, right, bottom, left}; }
    setCenter(center: LngLatLike) { return this.jumpTo({center}); }
    setZoom(zoom: number) { return this.jumpTo({zoom}); }
    setBearing(bearing: number) { return this.jumpTo({bearing}); }
    setPitch(pitch: number) { return this.jumpTo({pitch}); }
    resetNorth(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, ...o}); }
    resetNorthPitch(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, pitch: 0, ...o}); }
    panTo(center: LngLatLike, o: {duration?: number} = {}) { return this.easeTo({center, ...o}); }
    panBy(offset: [number, number], o: {duration?: number} = {}) {
        return this.easeTo({center: this.unproject([this.tr.cx + offset[0], this.tr.cy + offset[1]]), ...o});
    }
    zoomTo(zoom: number, o: {duration?: number} = {}) { return this.easeTo({zoom, ...o}); }
    rotateTo(bearing: number, o: {duration?: number} = {}) { return this.easeTo({bearing, ...o}); }
    snapToNorth(o: {duration?: number} = {}) { return Math.abs(this.tr.bearing) < 7 ? this.resetNorth(o) : this; }
    getProjection() { return {type: 'mercator'}; }
    getRenderWorldCopies() { return true; }
    getRoll() { return 0; }
    /** With 3D terrain: the (exaggerated) height of the ground at the map centre in metres; otherwise 0. */
    getCenterElevation() { return this.tr.elevation; }
    getCameraTargetElevation() { return this.tr.elevation; }
    isZooming() { return this.zooming; }
    isRotating() { return this.rotating; }
    isPitching() { return this.pitching; }
    getCanvasContainer() { return this.container; }
    redraw() { this.triggerRepaint(); return this; }
    // react-map-gl and other wrappers read these private members of the MapLibre map. They are here only so that
    // those wrappers work: `style._loaded` tells them that sources and layers can be added.
    get style() { return this.resolved ? {_loaded: this.ready} : undefined; }
    _render() { this.triggerRepaint(); }
    _update() { this.triggerRepaint(); }
    /** There is no sky in this library. (react-map-gl reads the value when a style has loaded.) */
    getSky() { return undefined; }
    getLight() { return {anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5, ...this.rawStyle?.light}; }
    getLayersOrder(): string[] { return this.rawStyle?.layers.map((l: any) => l.id) ?? []; }
    getPaintProperty(layerId: string, name: string) { return this.getLayer(layerId)?.paint?.[name]; }
    getLayoutProperty(layerId: string, name: string) { return this.getLayer(layerId)?.layout?.[name]; }
    getFilter(layerId: string) { return this.getLayer(layerId)?.filter; }
    moveLayer(id: string, beforeId?: string) {
        return this.editStyle(s => {
            const [layer] = s.layers.splice(this.layerIndex(s, id), 1);
            s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer);
        });
    }
    setLayerZoomRange(id: string, minzoom: number, maxzoom: number) { return this.editStyle(s => Object.assign(s.layers[this.layerIndex(s, id)], {minzoom, maxzoom})); }
    getSprite() { const s = this.rawStyle?.sprite; return typeof s === 'string' ? [{id: 'default', url: s}] : s ?? []; }
    setSprite(url: string | {id: string; url: string}[] | null) { return this.editStyle(s => { if (url) s.sprite = url; else delete s.sprite; }); }
    /** Adds a sprite sheet. Its icons have the names `id:name`. */
    addSprite(id: string, url: string) { return this.setSprite([...this.getSprite().filter((s: {id: string}) => s.id !== id), {id, url}]); }
    removeSprite(id: string) { const rest = this.getSprite().filter((s: {id: string}) => s.id !== id); return this.setSprite(rest.length ? rest : null); }
    getGlyphs() { return this.rawStyle?.glyphs ?? null; }
    /** Stored with the style for compatibility. Text is drawn with web fonts, so glyph files are never fetched. */
    setGlyphs(url: string | null) { return this.editStyle(s => { if (url) s.glyphs = url; else delete s.glyphs; }); }
    getFontFaces() { return this.rawStyle?.['font-faces'] ?? {}; }
    setFontFaces(faces: Record<string, unknown> | null) { return this.editStyle(s => { if (faces) s['font-faces'] = faces; else delete s['font-faces']; }); }
    /** The image that addImage was given, with its options, or undefined. (MapLibre returns the decoded pixels.) */
    getImage(name: string) { const i = this.imageInputs.get(name); return i && {data: i[0], pixelRatio: i[1].pixelRatio ?? 1, sdf: false, ...i[1]}; }
    listImages() { return [...this.imageNames]; }
    /** Fetches and decodes an image, in the shape MapLibre returns it. */
    async loadImage(url: string) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load image ${url}: ${res.status}`);
        return {data: await createImageBitmap(await res.blob())};
    }
    /** The code for queries on the page, loaded when the style has a GeoJSON source with its data in the style. */
    private syncQuery?: typeof import('./sync-query.ts');
    /**
     * The data of a GeoJSON source, when the page has it: the data is in the style, or the page has fetched it for a
     * query before. If not, the page fetches it now (the browser has it in its cache already) and then fires the data
     * events of the source, so that code that listens for them asks again.
     */
    private geoData(id: string): object | undefined {
        const spec = this.rawStyle?.sources[id], kept = this.geoKept.get(id);
        if (!spec?.data || typeof spec.data === 'object') return spec?.data;
        if (kept?.from === spec.data) return kept!.data;
        const entry: {from: string; data?: object} = {from: spec.data};
        this.geoKept.set(id, entry);
        Promise.all([this.fetchAs('Source')(new URL(spec.data, this.styleBase)).then(r => r.json()), import('./sync-query.ts')]).then(([data, m]) => {
            entry.data = data; this.syncQuery = m;
            for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId: id, isSourceLoaded: true, sourceDataType: 'content'});
        }, () => {});
    }
    private geoKept = new globalThis.Map<string, {from: string; data?: object}>();
    /**
     * The features of a source in the tiles of the present view. As with `queryRenderedFeatures`, the result is an array
     * that can also be awaited: at once it has the features of a GeoJSON source whose data the page has (clusters too);
     * awaited, it has the features of each kind of source.
     */
    querySourceFeatures(sourceId: string, options: {sourceLayer?: string; filter?: unknown} = {}): RenderedFeature[] & PromiseLike<RenderedFeature[]> {
        const sets = [{layer: '', source: sourceId, sourceLayer: options.sourceLayer, filter: options.filter, radius: 0}], box: [number, number, number, number] = [0, 0, this.tr.width, this.tr.height];
        const features = (found: QueriedFeature[]): RenderedFeature[] => found.map(f => ({type: 'Feature', id: f.id, geometry: f.geometry!, properties: f.properties, source: f.source, sourceLayer: f.sourceLayer || undefined,
            state: f.id === undefined ? {} : this.getFeatureState({source: f.source, sourceLayer: f.sourceLayer || undefined, id: f.id})}));
        const spec = this.rawStyle?.sources[sourceId], data = spec?.type === 'geojson' && this.geoData(sourceId);
        let now: QueriedFeature[] = [];
        if (data && this.syncQuery) try { now = this.syncQuery.queryGeoJSON(sourceId, {...spec, data}, this.tr, box, sets); } catch { /* the promise has the complete result or the error */ }
        const result = features(now), all = this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(features);
        Object.defineProperty(result, 'then', {value: (done?: (v: RenderedFeature[]) => unknown, failed?: (e: unknown) => unknown) => all.then(done, failed)});
        return result as RenderedFeature[] & PromiseLike<RenderedFeature[]>;
    }

    protected override styleChanged() {
        if (!this.syncQuery && Object.values<any>(this.rawStyle.sources ?? {}).some(src => src.type === 'geojson' && src.data && typeof src.data === 'object')) import('./sync-query.ts').then(m => { this.syncQuery = m; });
    }

    /**
     * The features that the style layers draw at a point or in a rectangle of the screen (the whole map when no
     * geometry is given), from the top layer down. The arguments and the features are those of MapLibre GL JS.
     *
     * The tile data is in a worker, so the complete result is a promise: `await map.queryRenderedFeatures(...)`.
     * The value is also an array, for code that uses the result at once as MapLibre permits. As an array it has the
     * features of the GeoJSON sources whose data is in the style (which the page can read itself), and not those of
     * tile sources. Plugins that draw and edit on the map query their own GeoJSON sources in this way.
     */
    queryRenderedFeatures(geometry?: PointLike | [PointLike, PointLike] | RenderedQueryOptions, options?: RenderedQueryOptions): RenderedFeature[] & PromiseLike<RenderedFeature[]> {
        const {box, sets, features} = this.rendered(geometry, options);
        // At once: the answer of the engine to the same question before, if there is one (see `answers`).
        const key = this.questionKey(box, sets), all = this.questionKey(box), kept = this.answers.get(key);
        const wide = !kept && sets.every(s => !s.also) ? this.answers.get(all) : undefined, wanted = new Set(sets.map(s => s.layer));
        let now: QueriedFeature[] = kept?.found ?? wide?.found.filter(f => wanted.has(f.layer!)) ?? [];
        // If not: the GeoJSON sources that the page has the data of.
        const sync = this.syncQuery;
        if (!kept && !wide && sync) for (const [id, spec] of Object.entries<any>(this.rawStyle?.sources ?? {})) {
            const mine = sets.filter(s => s.source === id);
            const data = mine.length && spec.type === 'geojson' && this.geoData(id);
            if (data) try { now.push(...sync.queryGeoJSON(id, {...spec, data}, this.tr, box, mine)); } catch { /* the promise has the complete result or the error */ }
        }
        const result = features([...now]), given = this.summary(now);
        // Later: all the sources, from the engine.
        const later = sets.length ? this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(found => {
            this.keep(key, found);
            // The array that the caller got at once was not the complete result. Code that reads the array asks again
            // on `idle` (and the map is idle, or will be): tell it, and the same question then has the answer at once.
            if (this.summary(found) !== given && !this.again) {
                this.again = true;
                setTimeout(() => { this.again = false; if (this.areTilesLoaded() && !this.isMoving()) this.fire('idle'); });
            }
            return features([...found]);
        }) : Promise.resolve([]);
        Object.defineProperty(result, 'then', {value: (done?: (v: RenderedFeature[]) => unknown, failed?: (e: unknown) => unknown) => later.then(done, failed)});
        return result as RenderedFeature[] & PromiseLike<RenderedFeature[]>;
    }
    /**
     * The last answers of the engine to `queryRenderedFeatures`, by question (the view, the place on the screen, the
     * layers). MapLibre code reads the result of a query at once, but the tile data is in a worker. So the array has
     * the answer to the same question before. Two things make that answer present when the code asks:
     * the map asks the engine before it sends `click`, `dblclick` and `contextmenu`; and after a first answer that the
     * caller did not get, the map fires `idle` again.
     */
    private answers = new globalThis.Map<string, {found: QueriedFeature[]}>();
    private again = false;
    private questionKey(box: number[], sets?: {layer: string; also?: unknown}[]) {
        const t = this.tr;
        return JSON.stringify([t.lng, t.lat, t.zoom, t.bearing, t.pitch, t.width, t.height, box, sets ? sets.map(s => [s.layer, s.also]) : 0]);
    }
    private keep(key: string, found: QueriedFeature[]) {
        this.answers.delete(key);
        this.answers.set(key, {found});
        if (this.answers.size > 24) this.answers.delete(this.answers.keys().next().value!);
    }
    private summary(found: QueriedFeature[]) { return JSON.stringify(found.map(f => [f.layer, f.id, f.properties])); }
    /** (A click waits for the features at its place, so that a listener can read them at once.) */
    override fire(type: string, data: Record<string, unknown> = {}) {
        const point = data.point as {x: number; y: number} | undefined;
        if (!point || !/^(click|dblclick|contextmenu)$/.test(type) || data.asked || !this.rawStyle) return super.fire(type, data);
        const {box, sets} = this.rendered([point.x, point.y]), key = this.questionKey(box);
        const send = () => super.fire(type, {...data, asked: true});
        if (!sets.length) return send();
        this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(found => this.keep(key, found), () => {}).then(send);
    }
}
