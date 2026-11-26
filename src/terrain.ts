// 3D terrain (#1849): the code that only a map with `terrain` in its style needs. It is in the part of the library that
// loads on demand for elevation data, with the contour lines (see dem.ts and parts.ts). The functions run as methods:
// `terrainTiles` and the functions it calls of the engine, which choose the ground tiles and their heights, and the
// others of the renderer, which make the pictures of the ground tiles and draw the mesh. Each is called with
// `fn.call(this, ...)` and reads the members of its class: the build gives each `this.name` the same short name in
// every file (scripts/private-names.mjs).
import {EXTENT, HEIGHT_GRID, TILE_SIZE, Transform, clamp, latFromMerc, lngFromMerc, touches, type TileID} from './geo.ts';
import {SHADERS, VS_COMMON, opaque, skyValues, type GLTile, type Scene, type TerrainTile} from './gl.ts';
import {renderItems, type RenderItem} from './placement.ts';
import type {CompiledLayer} from './style.ts';

/** The shaders of the mesh of 3D terrain (the program `terrain`). */
// 3D terrain: a grid over the tile, raised to the ground height and textured with the tile's flat layers.
// `u_part` picks the part of the picture to show: all of it, or the tile's share of an ancestor's while its own is drawn.
// On the globe the mesh is put on the sphere as buildings are (toClip3D), and the far side is hidden by horizonSide.
export const TERRAIN_SHADERS: [string, string] = [`${VS_COMMON} uniform float u_skirt; uniform float u_exag;
layout(location=0) in vec3 a_pos; layout(location=1) in float a_height; uniform vec3 u_part; uniform vec2 u_fogRange; out vec2 v_uv; out float v_fog; out float v_side;
void main() { vec2 p = u_part.xy + clamp(a_pos.xy, 0.0, 1.0) * u_part.z, t = a_pos.xy * ${EXTENT}.0; v_uv = vec2(p.x, 1.0 - p.y); v_side = horizonSide(t); gl_Position = toClip3D(t, a_height * u_exag - a_pos.z * u_skirt);
  float w = gl_Position.w; v_fog = clamp(u_fogRange.y * (w - u_fogRange.x) / ((u_fogRange.y - u_fogRange.x) * w), 0.0, 1.0); }`, `
uniform sampler2D u_drape; in vec2 v_uv; in float v_side; out vec4 o;
// Fog (the sky of the style, as in MapLibre GL JS): v_fog is the depth of MapLibre's fog matrix, 0 at its near and 1 at its far plane. u_fog has
// fog-ground-blend, horizon-fog-blend and the opacity of the fog (from the pitch); u_fogColor and u_horizonColor are opaque.
uniform vec3 u_fog; uniform vec4 u_fogColor; uniform vec4 u_horizonColor; in float v_fog;
void main() {
  if (v_side < 0.0) discard;
  o = texture(u_drape, v_uv);
  float f = max(v_fog - u_fog.x, 0.0) / (1.0 - u_fog.x), k = f * f * u_fog.z;
  if (k <= 0.0) return;
  vec3 c = mix(u_fogColor.rgb, u_horizonColor.rgb, smoothstep(0.0, 1.0, (v_fog - u_fog.y) / (1.0 - u_fog.y)));
  // The mix is in linear space (gamma 2.2), on all four channels of the premultiplied color, as in MapLibre GL JS:
  // fog covers ground whose picture is transparent too.
  o = pow(mix(pow(o, vec4(2.2)), pow(vec4(c, 1.0), vec4(2.2)), k), vec4(1.0 / 2.2));
}`];

SHADERS.terrain = TERRAIN_SHADERS;

/** True if elevation data that touches a ground tile arrived after `version`. */
export function groundChanged(this: any, id: TileID, version: number) {
    if (version === this.demVersion) return false;
    const a = this.demArrivals, n = 2 ** id.z, x0 = id.x / n, y0 = id.y / n, x1 = (id.x + 1) / n, y1 = (id.y + 1) / n;
    if (!a.length || a[0].version > version + 1) return true; // older than what is remembered
    // (Tiles that only touch count: the heights on an edge of a tile come from its neighbor.)
    for (const d of a) if (d.version > version && d.x0 <= x1 && d.x1 >= x0 && d.y0 <= y1 && d.y1 >= y0) return true;
    return false;
}

/**
 * Heights at the 65 x 65 corners of a ground tile's mesh. Nearly all of them lie inside one elevation tile's grid
 * and are read straight from it; only points on the far edges (which belong to the neighboring tiles) and tiles
 * with no single grid under them go through the general lookup.
 */
export function fillMesh(this: any, data: Float32Array, id: TileID) {
    const n = 2 ** id.z, G = HEIGHT_GRID, src = this.style.sources[this.style.terrain!.source];
    let grid: Float32Array | undefined, gz = Math.min(id.z, src.maxzoom);
    for (; gz >= src.minzoom && !grid; gz--) grid = this.heights.get(`${gz}/${id.x >> (id.z - gz)}/${id.y >> (id.z - gz)}`);
    gz++;
    // The grid found is the deepest that is loaded at or above the level of this tile, which is also what the general
    // lookup finds for the points inside the tile. So the points inside are read straight from it.
    const direct = !!grid, k = 2 ** (id.z - gz), ox = (id.x % k) / k, oy = (id.y % k) / k;
    for (let j = 0; j <= 64; j++) {
        for (let i = 0; i <= 64; i++) {
            if (direct && i < 64 && j < 64) {
                const fx = clamp((ox + i / 64 / k) * G - 0.5, 0, G - 1), fy = clamp((oy + j / 64 / k) * G - 0.5, 0, G - 1);
                const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
                data[j * 65 + i] = (grid![y0 * G + x0] * (1 - tx) + grid![y0 * G + x1] * tx) * (1 - ty) + (grid![y1 * G + x0] * (1 - tx) + grid![y1 * G + x1] * tx) * ty;
            } else data[j * 65 + i] = this.rawHeightAt((id.x + i / 64) / n, Math.min((id.y + j / 64) / n, 1 - 1e-12));
        }
    }
}


/** 3D terrain: the straight-down view of one ground tile, and the source tiles that are drawn into its picture. */
export function groundSources(this: any, id: TileID, zt: number, stamp: string) {
    const n = 2 ** id.z, view = new Transform(), keys: string[] = [];
    // The picture is drawn once, at a fixed scale a little above the tile's own (it is shown at up to twice its size
    // before finer tiles take over), and stretched as the map zooms. Zooming therefore redraws nothing.
    view.width = view.height = TILE_SIZE * 2 ** (zt - id.z);
    view.lng = lngFromMerc((id.x + 0.5) / n); view.lat = latFromMerc((id.y + 0.5) / n); view.zoom = zt;
    const cover = new Transform();
    Object.assign(cover, {lng: view.lng, lat: view.lat});
    const items = new Map<string, RenderItem<GLTile>[]>();
    let complete = true;
    let signature = `${zt}|${this.styleVersion}`;
    for (const source in this.style.sources) {
        const src = this.style.sources[source];
        if (!this.layers.some((l: CompiledLayer) => l.source === source && l.type !== 'symbol' && l.type !== 'fill-extrusion' && l.type !== 'circle' && l.visible && zt >= l.minzoom && zt < l.maxzoom)) continue;
        if (src.coordinates) { const list = this.pictureItems(source, view); items.set(source, list); signature += `,${source}:${list[0]?.tile.uid ?? ''}`; continue; }
        // Vector tiles are of the level of the ground tile. Image tiles (raster, elevation) are those that the view
        // itself selects, by the rule of MapLibre for each image tile: the ones that touch this ground tile are drawn
        // into it. (Near the camera they are finer than the ground tile, far away they can be coarser.)
        const image = src.type === 'raster' || src.type === 'raster-dem';
        cover.zoom = id.z;
        // (A little less than the tile: a view that ends exactly on the tile's edge would take the tiles beyond it too.)
        cover.width = cover.height = TILE_SIZE - 2;
        const ideal = image ? this.viewCover(source).filter((t: TileID) => touches(t, id)) : cover.tileCover(src.minzoom, src.maxzoom, src.tileSize);
        for (const t of ideal) {
            const key = source + '|' + t.key, have = this.tiles.get(key);
            keys.push(key);
            if (!have) this.request(source, t, key);
            else this.refresh(source, t, key, have);
            if (this.tiles.get(key)?.state === 'loading') complete = false;
        }
        const list = renderItems(view, ideal, k => {
            const key = source + '|' + k, t = this.tiles.get(key);
            if (t?.state !== 'ok' || t.missing) return undefined;
            keys.push(key); // a stand-in tile of another level: it is in use too
            return t.gl;
        });
        items.set(source, list);
        // The picture depends on exactly these tiles (and which build of each), so that is what identifies it.
        for (const it of list) signature += `,${it.id.key}:${it.tile.uid}`;
    }
    // (A tile that waits to be requested, as contour tiles do while the zoom changes, is not there yet: the picture is not complete.)
    let revs = 0;
    for (const k of keys) { const t = this.tiles.get(k); if (t) { t.used = this.frameNo; revs += t.rev!; } else { revs = NaN; complete = false; } }
    return {stamp, view, items, signature, complete, keys, revs, version: this.tilesVersion};
}

/** 3D terrain: the ground tiles in view, each with a straight-down view of itself for drawing its picture. */
export function terrainTiles(this: any, wanted: Set<string>): TerrainTile[] {
    const tr = this.tr, terrain = this.style.terrain!, demSrc = this.style.sources[terrain.source], out: TerrainTile[] = [];
    let meshBudget = 4;
    this.meshBehind = false;
    this.groundWaits = false;
    this.demLoading = false;
    for (const [k, m] of this.meshHeights) if (this.frameNo - m.used > 120) this.meshHeights.delete(k);
    for (const [k, m] of this.groundCache) if (this.frameNo - (m.used ?? 0) > 120) this.groundCache.delete(k);
    const viewLit = this.layers.some((l: CompiledLayer) => l.type === 'hillshade' && l.visible && l.p.anchor.eval(tr.zoom) === 'viewport');
    for (const id of tr.tileCover(0, 22, TILE_SIZE).slice(0, 96)) { // nearest first; a cap keeps odd views affordable
        // Each tile's picture is drawn once for a whole level of zoom: with the style as it is three quarters of the way
        // through the level of the map, and stretched as the map zooms inside that level. A ground tile can be of a
        // coarser level than the map (far ground, and with a steep tilt also the ground at the center) or of a finer one
        // (ground near the camera). Its picture still uses the style of the map's level, as in MapLibre: the same layers
        // show, and lines have the same width.
        const zt = Math.floor(tr.zoom) + 0.75, tkey = `${id.key}|${id.w}`;
        // Which source tiles make the picture of this ground tile is much work for each of up to 96 tiles. The answer
        // changes only when a tile arrives or goes, the style changes, the map zooms to another level of tiles, or (for
        // relief that is lit from the viewer's side) the map turns. Until then the last answer is used.
        let stamp = `${this.styleVersion}|${zt}`;
        for (const source of this.imageSources) for (const t of this.viewCover(source)) if (touches(t, id)) stamp += '|' + t.key;
        let made = this.groundCache.get(tkey), revs = 0;
        if (made) for (const k of made.keys) { const t = this.tiles.get(k); if (t) { t.used = this.frameNo; revs += t.rev!; } else revs = NaN; }
        // A picture that has all its tiles depends on those tiles only. One that still waits for tiles can also get a
        // stand-in from any other tile, so it is worked out again when any tile changes.
        if (!made || made.stamp !== stamp || (made.complete ? revs !== made.revs : this.tilesVersion !== made.version)) {
            made = groundSources.call(this, id, zt, stamp);
            this.groundCache.set(tkey, made);
        }
        made.used = this.frameNo;
        for (const k of made.keys) wanted.add(k);
        if (!made.complete) this.groundWaits = true;
        const {view, items, signature, complete} = made;
        // The heights themselves: make sure the elevation tiles for this ground tile are on their way. They are the
        // tiles that the view selects for the source, which are also the ones that relief shading of the same source
        // draws: the two then load one set of tiles, also when the relief layer is added after the terrain. Where the
        // source has no tile at a level (the request failed), the nearest level above that does have one is used.
        for (const t of this.viewCover(terrain.source)) if (touches(t, id)) for (let dz = t.z; dz >= demSrc.minzoom; dz--) {
            const x = t.x >> t.z - dz, y = t.y >> t.z - dz, dk = `${dz}/${x}/${y}`, demKey = terrain.source + '|' + dk;
            wanted.add(demKey);
            const dem = this.tiles.get(demKey);
            if (!dem) { this.request(terrain.source, {z: dz, x, y, w: 0, key: dk}, demKey); this.demLoading = true; break; }
            dem.used = this.frameNo;
            // (An elevation tile whose response has expired is requested again, and keeps its heights until then; #1988.)
            if (dem.state === 'ok') this.refresh(terrain.source, {z: dz, x, y, w: 0, key: dk}, demKey, dem);
            // (A loading elevation tile holds `idle` back: no layer may draw the source, and then nothing else waits for it, #820.)
            if (dem.state === 'loading') this.demLoading = true;
            if (dem.state === 'loading' || dem.range) break; // otherwise it failed or came back empty: try the level above
        }
        // A coarse elevation tile of the surroundings stays loaded as well (one tile covers many ground tiles). Ground
        // that comes into view next to the camera then has its shape and a soft relief at once, not a flat slab
        // until its own tiles arrive.
        const oz = Math.max(demSrc.minzoom, Math.min(demSrc.maxzoom, Math.floor(tr.zoom)) - 3);
        if (id.z > oz) {
            const x = id.x >> id.z - oz, y = id.y >> id.z - oz, dk = `${oz}/${x}/${y}`, demKey = terrain.source + '|' + dk, dem = this.tiles.get(demKey);
            wanted.add(demKey);
            if (dem) { dem.used = this.frameNo; if (dem.state === 'ok') this.refresh(terrain.source, {z: oz, x, y, w: 0, key: dk}, demKey, dem); } else this.request(terrain.source, {z: oz, x, y, w: 0, key: dk}, demKey);
            if (!dem || dem.state === 'loading') this.demLoading = true;
        }
        // Heights for the tile's mesh, looked up by position in data all tiles share (so edges meet exactly), and
        // refreshed a few tiles per frame when new elevation data arrives.
        let mesh = this.meshHeights.get(tkey);
        // A mesh that the new elevation data does not touch is up to date as it is.
        if (mesh && mesh.checked !== this.demVersion && !groundChanged.call(this, id, mesh.checked)) mesh.checked = this.demVersion;
        if (!mesh || (mesh.checked !== this.demVersion && meshBudget-- > 0)) {
            const data = mesh?.data ?? new Float32Array(65 * 65);
            fillMesh.call(this, data, id);
            this.meshHeights.set(tkey, mesh = {data, version: this.demVersion, checked: this.demVersion, used: 0});
        }
        if (mesh.checked !== this.demVersion) this.meshBehind = true;
        mesh.used = this.frameNo;
        // Relief shading that is lit from the viewer's side turns with the map: the picture is drawn again when the
        // map has turned a dozen degrees (the renderer waits until the map is still, see updateDrapes).
        out.push({id, key: tkey, matrix: tr.tileMatrix4(id), view, items, signature, light: viewLit ? Math.round(tr.bearing / 12) : 0, complete, dem: this.demRef(id), heights: mesh.data, heightsVersion: mesh.version});
    }
    return out;
}

/** A 64 x 64 grid over a tile plus a skirt hanging from its edges, which hides the cracks between neighboring tiles. */
export function terrainGrid(this: any) {
    if (this.grid) return this.grid;
    const gl = this.gl, N = 64, pos: number[] = [], idx: number[] = [];
    for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) pos.push(x / N, y / N, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * (N + 1) + x; idx.push(i, i + 1, i + N + 1, i + 1, i + N + 2, i + N + 1); }
    const skirt: number[] = [];
    const edge = (at: (k: number) => number) => {
        for (let k = 0; k <= N; k++) {
            const i = at(k), j = pos.length / 3;
            skirt.push(i);
            pos.push(pos[i * 3], pos[i * 3 + 1], 1);
            if (k < N) idx.push(i, at(k + 1), j, at(k + 1), j + 1, j);
        }
    };
    edge(k => k); edge(k => N * (N + 1) + k); edge(k => k * (N + 1)); edge(k => k * (N + 1) + N);
    const count = idx.length;
    // On the globe, a row of triangles from the top edge to the north pole and from the bottom edge to the south pole
    // (y -32768 and 32767 in tile units, see GLOBE_GLSL), drawn for a tile at the edge of the world. A pole vertex
    // takes the color of the edge vertex under it and the height 0, as in MapLibre GL JS (its get_elevation), so that
    // all of them meet at one point.
    for (const [row, y] of [[0, -32768], [N, 32767]]) for (let k = 0; k <= N; k++) {
        const i = row * (N + 1) + k, j = pos.length / 3;
        skirt.push(-1);
        pos.push(k / N, y / EXTENT, 0);
        if (k < N) idx.push(i, i + 1, j, i + 1, j + 1, j);
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return this.grid = {vao, count, pole: N * 6, skirt};
}


export function freeDrape(this: any, d: {tex: WebGLTexture; size: number}) {
    const list = this.sparePictures.get(d.size) ?? [];
    this.sparePictures.set(d.size, list);
    if (list.length < 8) list.push(d.tex); else this.gl.deleteTexture(d.tex);
}

/** How many levels up the nearest coarser tile with a picture is (0: there is none). */
export function coarserDrape(this: any, id: TileID) {
    for (let up = 1; up <= 5 && up <= id.z; up++) if (this.drapes.has(`${id.z - up}/${id.x >> up}/${id.y >> up}|${id.w}`)) return up;
    return 0;
}

/**
 * 3D terrain, step one: bring each ground tile's picture up to date. The flat layers are drawn straight down into
 * a texture per tile, which is kept until what it shows changes; panning and tilting then cost almost nothing.
 */
export function updateDrapes(this: any, s: Scene) {
    const gl = this.gl;
    // Per frame: a couple of out-of-date pictures are redrawn and a few missing ones drawn (all of them when starting
    // from nothing). A missing one shows its ancestor's picture meanwhile, so spreading the work costs no holes.
    // While the camera moves, less of this work is done in one frame: a smooth movement is more important than
    // pictures that are complete a moment sooner.
    // One picture is a pass over all the layers of the style: as many WebGL calls as the frame itself. So while the
    // camera moves, a picture is made only in each third frame. The picture of a coarser tile shows meanwhile.
    const now = performance.now();
    // (A device that keeps up with the display while the camera moves does all the work in each frame, at the full
    // size: the map then stays sharp during a zoom. `gap`: the usual time between frames of a movement.)
    if (s.moving && now - this.drapedAt < 100) this.gap += (now - this.drapedAt - this.gap) * 0.2;
    this.drapedAt = now;
    const quick = this.gap < 20;
    const turn = !s.moving || quick || this.frame % 3 === 0;
    for (const [key, since] of this.drapeWaits) if (now - since > 2000) this.drapeWaits.delete(key);
    let budget = !turn ? 0 : s.moving && !quick ? 1 : 2, fresh = !this.drapes.size ? Infinity : !turn ? 0 : s.moving && !quick ? 1 : 3, behind = false;
    for (const t of s.terrain!.tiles) {
        let d = this.drapes.get(t.key);
        // 1024 pixels a side at most (what MapLibre uses): larger pictures cost high-density phones frames for little gain.
        const full = Math.min(1024, Math.max(64, Math.round(t.view.width * this.dpr)));
        // A picture that is first made while the camera moves is made at half the size: a quarter of the work for the
        // GPU, which is what limits a zoom on a phone. It is made again at the full size when the camera is still.
        // A picture is also made again when the light in it is out of date. That waits until the camera is still: while
        // the map turns, each step of the light would make every picture again, which phones cannot keep up with.
        const sharpen = !!d && !s.moving && (!!d.rough || d.light !== t.light);
        if (d && (d.rough || d.light !== t.light) && s.moving) behind = true; // more frames must come, to make this picture sharp after the movement
        if (d && d.signature === t.signature && !sharpen) { d.used = this.frame; continue; }
        // A picture whose data is not complete is made again as more of its data arrives, but at most two times in a
        // second: the ground fills in step by step (the map, then the relief, then the contour lines), and a tile
        // does not wait for its slowest part. (On a slow device the contour lines can take seconds.)
        if (d && !t.complete && now - d.at! < 500 && !sharpen) { d.used = this.frame; behind = true; continue; }
        const rough = !!s.moving && !quick && (!d || !!d.rough) && full > 256, size = rough ? full >> 1 : full;
        if (d && budget-- <= 0) { d.used = this.frame; behind = true; continue; }
        if (!d && !t.complete && fresh < Infinity) {
            // A new tile whose data is still on its way: for a short time, the picture of a coarser tile shows in its
            // place. Most tiles are complete in that time, and their picture is then made once, not twice.
            const since = this.drapeWaits.get(t.key) ?? now;
            this.drapeWaits.set(t.key, since);
            if (now - since < 300 && coarserDrape.call(this, t.id)) { behind = true; continue; }
        }
        // (Ground with no picture of its own and none of a coarser tile is a hole in the map: it does not wait its turn.)
        if (!d && coarserDrape.call(this, t.id) && fresh-- <= 0) { behind = true; continue; }
        if (!d || d.size !== size) {
            if (d) freeDrape.call(this, d);
            // A texture of this size that is not in use is taken again: to make and delete large textures in each
            // frame of a movement is slow, and on a phone it uses up the memory of the GPU.
            let tex = this.sparePictures.get(size)?.pop();
            if (!tex) {
                tex = this.newTexture();
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            }
            d = {tex, size, signature: '', used: this.frame};
            this.drapes.set(t.key, d);
        }
        d.rough = rough;
        d.signature = t.signature; d.light = t.light; d.used = this.frame; d.at = now;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
        gl.viewport(0, 0, size, size);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.drawLayers(s, t.view, t.items, [size, size], 'ground');
        gl.bindTexture(gl.TEXTURE_2D, d.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Pictures that are out of view are kept for a short time (the view often comes back), but not many of them:
    // each one is some megabytes on the GPU.
    const spare = this.drapes.size - s.terrain!.tiles.length, age = spare > 24 ? 10 : 90;
    for (const [key, d] of this.drapes) if (this.frame - d.used > age) { freeDrape.call(this, d); this.drapes.delete(key); }
    return behind;
}

/** 3D terrain, step two: draw the ground tiles as raised meshes, with depth so near slopes hide far ones. */
export function drawTerrain(this: any, s: Scene) {
    const gl = this.gl, grid = terrainGrid.call(this), u = this.use('terrain', s.tr);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(grid.vao);
    gl.enableVertexAttribArray(1);
    gl.uniform1i(u.u_drape, 0);
    gl.uniform1f(u.u_exag, s.terrain!.exaggeration);
    // Fog only where the style has a sky, and not on the globe.
    const fog = s.sky && !this.globe ? skyValues(s.sky, s.tr.zoom, s.tr.pitch) : undefined;
    gl.uniform2f(u.u_fogRange, ...s.tr.fogRange());
    gl.uniform3f(u.u_fog, Math.min(fog?.ground ?? 0, 0.999), Math.min(fog?.horizonFog ?? 0, 0.999), fog?.opacity ?? 0);
    if (fog) { gl.uniform4fv(u.u_fogColor, opaque(fog.fog)); gl.uniform4fv(u.u_horizonColor, opaque(fog.horizon)); }
    for (const t of s.terrain!.tiles) {
        let d = this.drapes.get(t.key), part = [0, 0, 1];
        // No picture of its own yet: show its share of the nearest ancestor's rather than a hole.
        if (!d) {
            const up = coarserDrape.call(this, t.id), k = 2 ** up;
            d = up ? this.drapes.get(`${t.id.z - up}/${t.id.x >> up}/${t.id.y >> up}|${t.id.w}`) : undefined;
            if (d) { part = [(t.id.x % k) / k, (t.id.y % k) / k, 1 / k]; d.used = this.frame; }
        }
        if (!d) continue;
        gl.uniform3f(u.u_part, part[0], part[1], part[2]);
        // The tile's heights, uploaded when they change.
        let mh = this.meshHeights.get(t.key);
        if (!mh) this.meshHeights.set(t.key, mh = {buffer: gl.createBuffer()!, version: -1, used: 0});
        mh.used = this.frame;
        gl.bindBuffer(gl.ARRAY_BUFFER, mh.buffer);
        if (mh.version !== t.heightsVersion) {
            const all = new Float32Array(t.heights.length + grid.skirt.length);
            all.set(t.heights);
            grid.skirt.forEach((from: number, k: number) => { all[t.heights.length + k] = from < 0 ? 0 : t.heights[from]; });
            gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);
            mh.version = t.heightsVersion;
        }
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, d.tex);
        this.placeTile(u, t.id, t.matrix);
        gl.uniform1f(u.u_skirt, 40075016.686 / 2 ** t.id.z / 16 * Math.max(1, s.terrain!.exaggeration));
        gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_SHORT, 0);
        if (this.globe && t.id.y === 0) gl.drawElements(gl.TRIANGLES, grid.pole, gl.UNSIGNED_SHORT, grid.count * 2);
        if (this.globe && t.id.y === 2 ** t.id.z - 1) gl.drawElements(gl.TRIANGLES, grid.pole, gl.UNSIGNED_SHORT, (grid.count + grid.pole) * 2);
    }
    for (const [key, mh] of this.meshHeights) if (this.frame - mh.used > 90) { gl.deleteBuffer(mh.buffer); this.meshHeights.delete(key); }
    gl.disable(gl.DEPTH_TEST);
}

/**
 * 3D terrain with circle layers: the depth of the terrain on the screen, in a texture that the circles read (a pass of
 * the mesh into a framebuffer with only a depth texture; the depth of the canvas cannot be read).
 */
export function terrainDepth(this: any, s: Scene) {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height, z = s.tr.zoom;
    if (!s.layers.some(L => L.type === 'circle' && L.visible && z >= L.minzoom && z < L.maxzoom)) return;
    if (!this.depthTex || this.depthSize !== w + 'x' + h) {
        if (this.depthTex) gl.deleteTexture(this.depthTex);
        this.depthTex = this.newTexture(); this.depthSize = w + 'x' + h;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFbo ??= gl.createFramebuffer()!);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthFbo!);
    drawTerrain.call(this, s);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
