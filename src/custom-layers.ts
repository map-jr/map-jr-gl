// The layers of the type "custom" of the entry `@map-jr/map-jr-gl/maplibre-compat` (`CustomLayerInterface` of
// MapLibre GL JS). The compat map loads this file with its first custom layer, and only for a map made with
// `renderer: 'main'`, because the code of the user draws into the WebGL context of the map.
import {mercX, mercY, type Transform} from './geo.ts';
import type {Scene} from './gl.ts';
import type {Map} from './compat-map.ts';
import type {CustomLayerInterface, CustomRenderMethodInput, ProjectionData} from './compat-types.ts';

/** The circumference of the earth at the equator in metres, from the radius that MapLibre GL JS uses (as `MercatorCoordinate`). */
const EARTH = 2 * Math.PI * 6371008.8;
/** The vertical field of view of the camera in radians (36.87°, as in geo.ts). */
const FOV = 0.6435011087932844;
/** The units of a tile in MapLibre GL JS (`getProjectionData`) for each unit of a tile here (`tileMatrix4`). */
const UNIT = 4096 / 8192;
// The prelude of MapLibre GL JS for the Mercator projection has these functions under these names; the code is new.
// (Strings and not a template: scripts/private-names.mjs reads the words of a template as names.)
const PRELUDE = 'const float PI = 3.141592653589793;\n' +
    'uniform mat4 u_projection_matrix;\n' +
    'float projectLineThickness(float tileY) { return 1.0; }\n' +
    'float projectCircleRadius(float tileY) { return 1.0; }\n' +
    'vec4 projectTileWithElevation(vec2 p, float elevation) { return u_projection_matrix * vec4(p, elevation, 1.0); }\n' +
    'vec4 projectTileFor3D(vec2 p, float elevation) { return projectTileWithElevation(p, elevation); }\n' +
    'vec4 projectTile(vec2 p) { return projectTileWithElevation(p, 0.0); }\n' +
    'vec4 projectTile(vec2 p, vec2 rawPos) { return projectTileWithElevation(p, 0.0); }\n';

/** a × b of two column-major 4×4 matrices, in 64 bits. */
function multiply(a: ArrayLike<number>, b: ArrayLike<number>) {
    const m = new Float64Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return m;
}
const scale = (x: number, y: number, z: number) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
const projection = (mainMatrix: Float32Array | Float64Array, tileMercatorCoords: ProjectionData['tileMercatorCoords']): ProjectionData =>
    ({mainMatrix, fallbackMatrix: mainMatrix, tileMercatorCoords, clippingPlane: [0, 0, 0, 0], projectionTransition: 0, clipAntimeridian: false});

/**
 * What `render` gets, from the transform of the frame. `mainMatrix` is the matrix of the tile under the map centre at
 * the zoom below (whose values are small, so they are exact in 32 bits), times the step from Mercator coordinates to
 * the units of that tile in 64 bits: a model the size of a building does not shake at a high zoom.
 */
function inputs(tr: Transform): CustomRenderMethodInput {
    const z = Math.max(0, Math.floor(tr.zoom)), n = 2 ** z, ws = tr.worldSize, metres = EARTH * Math.cos(tr.lat * Math.PI / 180);
    const x = Math.min(n - 1, Math.floor(mercX(tr.lng) * n)), y = Math.min(n - 1, Math.floor(mercY(tr.lat) * n)), k = n * 4096;
    const tile = tr.tileMatrix4({z, x, y, w: 0, key: ''});
    // (x and y: Mercator to tile units; z: Mercator units to metres, as MapLibre GL JS reckons them at the map centre.)
    const main = multiply(tile, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, metres, 0, -x * 4096, -y * 4096, 0, 1]);
    // The depth runs from -1 to 1 between the near and the far plane: Z = A·W + B. (Read from the tile matrix, whose
    // translation is small: in `main` it is large, and the rounding of its 32-bit values would show.)
    const A = tile[10] / tile[11], B = tile[14] - A * tile[15], near = -B / (1 + A), far = B / (1 - A), f = 1 / Math.tan(FOV / 2);
    return {
        nearZ: near, farZ: far, fov: FOV,
        modelViewProjectionMatrix: multiply(main, scale(1 / ws, 1 / ws, 1 / metres)),
        // (The padding moves the centre of the perspective, as `m[8]` and `m[9]` do in MapLibre GL JS.)
        projectionMatrix: Float64Array.from([f * tr.height / tr.width, 0, 0, 0, 0, f, 0, 0, (tr.width - 2 * tr.cx) / tr.width, (2 * tr.cy - tr.height) / tr.height, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]),
        shaderData: {variantName: 'mercator', vertexShaderPrelude: PRELUDE, define: '#define PROJECTION_MERCATOR'},
        defaultProjectionData: projection(main, [0, 0, 1, 1]),
        getProjectionData: ({tileID: {canonical: c, wrap}}) => {
            const n = 2 ** c.z;
            return projection(Float32Array.from(multiply(tr.tileMatrix4({z: c.z, x: c.x, y: c.y, w: wrap ?? 0, key: ''}), scale(UNIT, UNIT, 1))), [c.x / n, c.y / n, 1 / n / 8192, 1 / n / 8192]);
        },
    };
}

/**
 * Sets the GL state that the renderer relies on (gl.ts), with `UNPACK_ALIGNMENT` set to `align`. Before the code of a
 * custom layer it also gives the defaults that MapLibre GL JS gives (`setCustomLayerDefaults`): no vertex array,
 * `TEXTURE0`, no culling, an alignment of 4, and images that are not flipped and not premultiplied.
 */
function base(gl: WebGL2RenderingContext, align: number) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.bindVertexArray(null);
    gl.useProgram(null);
    for (const cap of [gl.DEPTH_TEST, gl.STENCIL_TEST, gl.CULL_FACE, gl.SCISSOR_TEST, gl.POLYGON_OFFSET_FILL, gl.SAMPLE_ALPHA_TO_COVERAGE, gl.SAMPLE_COVERAGE, gl.RASTERIZER_DISCARD]) gl.disable(cap);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.depthRange(0, 1);
    gl.stencilMask(255);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.BACK);
    gl.clearDepth(1);
    gl.clearStencil(0);
    for (let i = 0; i < 4; i++) gl.bindSampler(i, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, align);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    for (const name of [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_IMAGES, gl.PACK_ROW_LENGTH, gl.PACK_SKIP_ROWS, gl.PACK_SKIP_PIXELS]) gl.pixelStorei(name, 0);
}

/**
 * Starts the custom layers of one map. `connect` gives the engine the function that draws them and answers with the
 * WebGL context; it is called again after the map has restored a lost context.
 */
export function customLayers(map: Map, connect: (draw: (id: string, s: Scene) => void) => Promise<WebGL2RenderingContext>) {
    let gl: WebGL2RenderingContext | undefined, removed = false, added = new globalThis.Map<string, CustomLayerInterface>();
    let scene: Scene | undefined, args: CustomRenderMethodInput, cleared = false;
    const report = (error: unknown) => map.fire('error', {error});
    /** Calls `onAdd` for the custom layers that are new in the style, and `onRemove` for those that left it. */
    const sync = () => {
        if (!gl) return;
        const now = new globalThis.Map<string, CustomLayerInterface>();
        if (!removed) for (const id of map.getLayersOrder()) { const layer = (map.getLayer(id) as {implementation?: CustomLayerInterface} | undefined)?.implementation; if (layer) now.set(id, layer); }
        for (const [id, layer] of added) if (now.get(id) !== layer) try { layer.onRemove?.(map, gl); } catch (error) { report(error); }
        const before = added;
        added = now;
        for (const [id, layer] of now) if (before.get(id) !== layer) try { layer.onAdd?.(map, gl); } catch (error) { report(error); }
    };
    const draw = (id: string, s: Scene) => {
        const layer = added.get(id);
        if (!layer || !gl) return;
        // (The layers of one frame share the values of that frame.)
        if (s !== scene) { scene = s; args = inputs(s.tr); cleared = false; }
        try {
            base(gl, 4);
            if (layer.prerender) { layer.prerender(gl, args); base(gl, 4); }
            if (layer.renderingMode === '3d') {
                gl.enable(gl.DEPTH_TEST);
                // The depth buffer holds the depth of the 3D terrain, or of the fill-extrusion layers below this layer.
                // Otherwise it is cleared before the first 3D custom layer of the frame.
                const below = s.layers.slice(0, s.layers.findIndex(L => L.id === id));
                if (!cleared && !s.terrain && !below.some(L => L.type === 'fill-extrusion' && L.visible && s.tr.zoom >= L.minzoom && s.tr.zoom < L.maxzoom)) gl.clear(gl.DEPTH_BUFFER_BIT);
                cleared = true;
            }
            layer.render(gl, args);
        } catch (error) { report(error); } finally { base(gl, 1); }
    };
    // (A map that is removed or loses its context rejects the question.) After a restored context, the layers get
    // `onAdd` again with the new context: what they made in the old one is gone.
    const start = (again?: unknown) => connect(draw).then(context => {
        gl = context;
        if (again) for (const layer of added.values()) try { layer.onAdd?.(map, context); } catch (error) { report(error); }
        sync();
    }, () => {});
    map.on('styledataloading', sync);
    map.on('remove', () => { removed = true; sync(); });
    map.on('webglcontextrestored', start);
    start();
    /** `setStyle` with `diff: false`: the layers leave the map without `onRemove`, as in MapLibre GL JS. */
    return {forget() { added = new globalThis.Map(); }};
}
