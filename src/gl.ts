import {EXTENT, latFromMerc, mercX, mercY, type TileID, type Transform} from './geo.ts';
import type {CompiledLayer} from './style.ts';
import type {GLBatch, LabelSrc, TileGL} from './tile.ts';
import type {Placed, RenderItem} from './placement.ts';
import {EM, SDF_BUFFER, SDF_RADIUS, type GlyphAtlas} from './text.ts';

const HEAD = '#version 300 es\nprecision highp float;\n';
/** Shared by the map-space programs: u_matrix takes tile units (and metres of height) to clip space. */
const VS_COMMON = `uniform mat4 u_matrix; uniform vec2 u_view;
vec4 toClip(vec2 t) { return u_matrix * vec4(t, 0.0, 1.0); }
`;
const FS_CLIP = 'if (v_tile.x < u_clip.x || v_tile.y < u_clip.y || v_tile.x > u_clip.z || v_tile.y > u_clip.w) discard;';

const SHADERS = {
    fill: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
void main() { v_tile = a_pos; v_color = a_color; gl_Position = toClip(a_pos); }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; o = vec4(c.rgb * c.a, c.a); }`],

    // One-pixel antialiased lines along polygon edges: coverage falls off with distance from the ideal line.
    edge: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; uniform vec2 u_world; uniform float u_attr;
out vec4 v_color; out vec2 v_tile; out vec2 v_px;
void main() { v_tile = a_pos; v_color = mix(vec4(1.0), a_color, u_attr); gl_Position = toClip(a_pos); v_px = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world; }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; in vec2 v_px; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; float a = c.a * (1.0 - smoothstep(0.0, 1.0, length(v_px - gl_FragCoord.xy))); o = vec4(c.rgb * a, a); }`],

    line: [`${VS_COMMON}
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; layout(location=2) in vec2 a_sd; layout(location=3) in float a_width;
uniform float u_width; uniform float u_scale; uniform float u_gap;
uniform float u_cam;
out vec4 v_color; out vec2 v_tile; out float v_d; out float v_hw; out float v_w; out float v_dist; out float v_persp;
void main() {
  float w = a_width * u_width;
  // With a gap the line is two strokes of width w either side of an empty middle.
  v_hw = (u_gap > 0.0 ? u_gap * 0.5 + w : w * 0.5) + 0.5; v_d = a_sd.x * v_hw; v_w = w; v_dist = a_sd.y;
  v_color = vec4(a_color.rgb, a_color.a * min(1.0, w));
  v_tile = a_v.xy + a_v.zw * v_hw / u_scale;
  gl_Position = toClip(v_tile);
  // Lines lie on the map, so a tilted view draws distant ones thinner; edge antialiasing must shrink to match.
  v_persp = gl_Position.w / u_cam;
}`, `
uniform vec4 u_color; uniform vec4 u_clip; uniform float u_gap; uniform vec4 u_dash; uniform float u_dashScale;
in vec4 v_color; in vec2 v_tile; in float v_d; in float v_hw; in float v_w; in float v_dist; in float v_persp; out vec4 o;
void main() {
  ${FS_CLIP}
  vec4 c = v_color * u_color;
  float a = c.a * clamp((v_hw - abs(v_d)) / v_persp, 0.0, 1.0);
  if (u_gap > 0.0) a *= clamp((abs(v_d) - u_gap * 0.5 + 0.5) / v_persp, 0.0, 1.0);
  float period = u_dash.x + u_dash.y + u_dash.z + u_dash.w;
  if (period > 0.0) {
    // Dash lengths are in multiples of the line width; antialias each dash end over about a pixel.
    float w = max(v_w, 0.5), t = mod(v_dist * u_dashScale / w, period);
    float second = u_dash.x + u_dash.y;
    float inDash = t < second ? min(t, u_dash.x - t) : min(t - second, second + u_dash.z - t);
    a *= clamp(inDash * w + 0.5, 0.0, 1.0);
  }
  o = vec4(c.rgb * a, a);
}`],

    circle: [`${VS_COMMON}
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 a_color; layout(location=2) in vec2 a_pos; layout(location=3) in float a_radius;
uniform float u_radius; uniform float u_strokeWidth; uniform vec4 u_clip;
out vec4 v_color; out vec2 v_off; out float v_r;
void main() {
  v_r = a_radius * u_radius; v_color = a_color;
  float ext = v_r + u_strokeWidth + 1.0;
  v_off = a_corner * ext;
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
  vec4 c = toClip(a_pos);
  // Circles face the viewer: offset in screen pixels after projection.
  c.xy += v_off * vec2(2.0, -2.0) / u_view * c.w;
  gl_Position = inside ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform vec4 u_color; uniform vec4 u_stroke; uniform float u_strokeWidth; in vec4 v_color; in vec2 v_off; in float v_r; out vec4 o;
void main() {
  float d = length(v_off);
  float fa = clamp(v_r - d + 0.5, 0.0, 1.0), sa = clamp(v_r + u_strokeWidth - d + 0.5, 0.0, 1.0);
  vec4 c = v_color * u_color;
  o = vec4(c.rgb * c.a, c.a) * fa + u_stroke * (sa - fa);
}`],

    text: [`uniform vec2 u_view; uniform vec2 u_tex;
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; layout(location=2) in vec4 a_halo; layout(location=3) in vec2 a_params;
out vec2 v_uv; out vec4 v_color; out vec4 v_halo; out vec2 v_params;
void main() { v_uv = a_v.zw / u_tex; v_color = a_color; v_halo = a_halo; v_params = a_params;
  vec2 c = a_v.xy / u_view * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`, `
uniform sampler2D u_sdf; uniform bool u_pass; in vec2 v_uv; in vec4 v_color; in vec4 v_halo; in vec2 v_params; out vec4 o;
void main() {
  float d = texture(u_sdf, v_uv).r, g = v_params.y;
  float edge = u_pass ? v_params.x : 0.75;
  vec4 c = u_pass ? v_halo : v_color;
  float a = c.a * smoothstep(edge - g, edge + g, d);
  o = vec4(c.rgb * a, a);
}`],

    // Buildings: roofs and walls with a height in metres and a baked light level.
    extrusion: [`uniform mat4 u_matrix;
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
void main() { v_tile = a_v.xy; v_color = vec4(a_color.rgb * a_v.w, a_color.a); gl_Position = u_matrix * vec4(a_v.xyz, 1.0); }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; o = vec4(c.rgb * c.a, c.a); }`],

    raster: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; out vec2 v_uv; out vec2 v_tile;
void main() { v_uv = a_pos; v_tile = a_pos * ${EXTENT}.0; gl_Position = toClip(v_tile); }`, `
uniform sampler2D u_image; uniform vec4 u_clip; uniform vec3 u_adjust; in vec2 v_uv; in vec2 v_tile; out vec4 o;
void main() {
  ${FS_CLIP}
  vec4 c = texture(u_image, v_uv);
  vec3 rgb = c.rgb;
  rgb += ((rgb.r + rgb.g + rgb.b) / 3.0 - rgb) * u_adjust.y;
  rgb = (rgb - 0.5) * u_adjust.z + 0.5;
  o = vec4(rgb, c.a) * u_adjust.x;
}`],

    // Turns encoded elevation into slope (dz/dx, dz/dy), once per tile, so shading can sample it smoothly.
    demPrepare: [`layout(location=0) in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_dem; uniform float u_zoom; uniform vec4 u_unpack; in vec2 v_uv; out vec4 o;
float elev(ivec2 p, ivec2 size) {
  vec4 c = texelFetch(u_dem, clamp(p, ivec2(0), size - 1), 0) * 255.0;
  c.a = -1.0;
  return dot(c, u_unpack);
}
void main() {
  ivec2 size = textureSize(u_dem, 0), p = ivec2(v_uv * vec2(size));
  float a = elev(p + ivec2(-1, -1), size), b = elev(p + ivec2(0, -1), size), c = elev(p + ivec2(1, -1), size);
  float d = elev(p + ivec2(-1, 0), size), f = elev(p + ivec2(1, 0), size);
  float g = elev(p + ivec2(-1, 1), size), h = elev(p + ivec2(0, 1), size), i = elev(p + ivec2(1, 1), size);
  float factor = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;
  float exaggeration = u_zoom < 15.0 ? (u_zoom - 15.0) * factor : 0.0;
  // Elevation differences over 8 pixel widths; the mercator world is 2^25.2562 metres wide.
  vec2 deriv = vec2((c + f + f + i) - (a + d + d + g), (g + h + h + i) - (a + b + b + c)) * float(size.x) / pow(2.0, exaggeration + (28.2562 - u_zoom));
  // Flat ground is stored as 128/255, which 8 bits hold exactly.
  o = clamp(vec4(deriv / 8.0 + 128.0 / 255.0, 1.0, 1.0), 0.0, 1.0);
}`],

    hillshade: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; out vec2 v_uv; out vec2 v_tile;
void main() { v_uv = a_pos; v_tile = a_pos * ${EXTENT}.0; gl_Position = toClip(v_tile); }`, `
uniform sampler2D u_image; uniform vec4 u_clip; uniform vec2 u_latrange; uniform vec2 u_light;
uniform vec4 u_shadow; uniform vec4 u_highlight; uniform vec4 u_accent; in vec2 v_uv; in vec2 v_tile; out vec4 o;
const float PI = 3.141592653589793;
void main() {
  ${FS_CLIP}
  // Slopes are divided by cos(latitude) to undo the mercator projection's stretching.
  float scaleFactor = cos(radians((u_latrange.x - u_latrange.y) * (1.0 - v_uv.y) + u_latrange.y));
  vec2 deriv = (texture(u_image, v_uv).rg - 128.0 / 255.0) * 8.0 / scaleFactor;
  float slope = atan(0.625 * length(deriv));
  float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);
  float intensity = u_light.x, azimuth = u_light.y + PI;
  float base = 1.875 - intensity * 1.75, maxValue = 0.5 * PI;
  float scaledSlope = intensity != 0.5 ? ((pow(base, slope) - 1.0) / (pow(base, maxValue) - 1.0)) * maxValue : slope;
  vec4 accent = (1.0 - cos(scaledSlope)) * u_accent * clamp(intensity * 2.0, 0.0, 1.0);
  float shade = abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
  vec4 shadeColor = mix(u_shadow, u_highlight, shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);
  o = accent * (1.0 - shadeColor.a) + shadeColor;
}`],

    // Instanced markers. Mercator positions arrive as high + low float pairs and are subtracted from the centre
    // (split the same way) before anything else, which keeps sub-pixel precision at any zoom.
    marker: [`uniform vec2 u_view; uniform vec4 u_center; uniform float u_world; uniform vec2 u_rot; uniform vec3 u_pitch;
uniform vec2 u_size; uniform vec2 u_offset; uniform vec2 u_tex;
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 a_merc; layout(location=2) in vec4 a_rect; layout(location=3) in vec2 a_scale;
uniform float u_opacity; out vec2 v_uv; out float v_alpha; // a_corner is 0 or 1 on each axis out vec2 v_uv; out float v_alpha;
void main() {
  float dx = (a_merc.x - u_center.x) + (a_merc.y - u_center.y);
  dx -= floor(dx + 0.5); // nearest copy of the world
  float dy = (a_merc.z - u_center.z) + (a_merc.w - u_center.w);
  vec2 w = vec2(dx, dy) * u_world;
  float rx = u_rot.x * w.x - u_rot.y * w.y, ry = u_rot.y * w.x + u_rot.x * w.y;
  float k = u_pitch.z / (u_pitch.z - ry * u_pitch.y);
  vec2 corner = a_corner;
  // Markers stay upright and keep their size; a scale other than 1 grows them about their anchor point.
  vec2 px = vec2(rx * k, ry * u_pitch.x * k) + u_view * 0.5 + (u_offset + corner * u_size) * a_scale.x;
  v_alpha = a_scale.y * u_opacity;
  v_uv = (a_rect.xy + corner * a_rect.zw) / u_tex;
  vec2 c = px / u_view * 2.0 - 1.0;
  gl_Position = a_scale.x > 0.0 && v_alpha > 0.0 ? vec4(c.x, -c.y, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform sampler2D u_img; in vec2 v_uv; in float v_alpha; out vec4 o; void main() { o = texture(u_img, v_uv) * v_alpha; }`],

    sprite: [`uniform vec2 u_view; uniform vec2 u_tex; layout(location=0) in vec4 a_v; layout(location=1) in float a_alpha; out vec2 v_uv; out float v_alpha;
void main() { v_uv = a_v.zw / u_tex; v_alpha = a_alpha; vec2 c = a_v.xy / u_view * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`, `
uniform sampler2D u_img; in vec2 v_uv; in float v_alpha; out vec4 o; void main() { o = texture(u_img, v_uv) * v_alpha; }`],
};

interface Program { prog: WebGLProgram; u: Record<string, WebGLUniformLocation> }
interface GLBuffers {
    type: GLBatch['type']; vao: WebGLVertexArrayObject; count: number; color: boolean; scalar: boolean; bufs: WebGLBuffer[];
    edgeVao?: WebGLVertexArrayObject; edgeCount?: number;
}
export interface GLTile {
    labels: Record<string, LabelSrc[]>; batches: Record<string, GLBuffers>;
    /** Raster tiles: the image. Elevation tiles: slopes derived from it. */
    tex?: WebGLTexture;
    /** Latitude of the tile's top and bottom edges, for hillshade. */
    lat?: [number, number];
}

export interface Scene {
    tr: Transform;
    layers: CompiledLayer[];
    items: Map<string, RenderItem<GLTile>[]>;
    labels: Placed[];
    atlas: GlyphAtlas;
    markers: MarkerBuffers[];
}

export const SPRITE_ATLAS = 2048;

/** Floats per marker vertex: mercator x and y each split into high and low parts, atlas rectangle, corner, scale, opacity. */
export const MARKER_STRIDE = 12;
/** Each marker is four such vertices. */
export const MARKER_FLOATS = MARKER_STRIDE * 4;
export interface MarkerBuffers { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; index: WebGLBuffer; count: number; width: number; height: number; offset: [number, number]; /** Whole-layer opacity, used to fade a layer in and out at the ends of its zoom range. */ opacity: number }

export class GLRenderer {
    gl: WebGL2RenderingContext;
    private programs = {} as Record<keyof typeof SHADERS, Program>;
    private quad: WebGLVertexArrayObject;
    private corners: WebGLBuffer;
    private textVao: WebGLVertexArrayObject;
    private textBuf: WebGLBuffer;
    private spriteVao: WebGLVertexArrayObject;
    private spriteBuf: WebGLBuffer;
    private sdfTex: WebGLTexture;
    private sdfVersion = -1;
    private spriteTex: WebGLTexture;
    private iconTex: WebGLTexture;
    private iconSize: [number, number] = [1, 1];
    private newTexture: () => WebGLTexture;
    private fbo: WebGLFramebuffer;
    private dpr = 1;

    constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, antialias = false) {
        const gl = canvas.getContext('webgl2', {antialias, alpha: true, premultipliedAlpha: true, stencil: true, depth: true}) as WebGL2RenderingContext | null;
        if (!gl) throw new Error('WebGL2 is not available');
        this.gl = gl;
        for (const name in SHADERS) {
            const [vs, fs] = SHADERS[name as keyof typeof SHADERS];
            this.programs[name as keyof typeof SHADERS] = this.link(vs, fs, name);
        }
        const buf = (data: BufferSource | null, usage: number = gl.STATIC_DRAW) => {
            const b = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage);
            return b;
        };
        // Unit quad: background fills use it as positions, circles use it as instance corners.
        this.quad = gl.createVertexArray()!;
        gl.bindVertexArray(this.quad);
        buf(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.corners = buf(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));

        this.textVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.textVao);
        this.textBuf = buf(null);
        for (const [loc, size, type, norm, off] of [[0, 4, gl.FLOAT, false, 0], [1, 4, gl.UNSIGNED_BYTE, true, 16], [2, 4, gl.UNSIGNED_BYTE, true, 20], [3, 2, gl.FLOAT, false, 24]] as const) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, type, norm, 32, off);
        }
        this.spriteVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.spriteVao);
        this.spriteBuf = buf(null);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
        gl.bindVertexArray(null);

        const tex = () => {
            const t = gl.createTexture()!;
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            return t;
        };
        this.newTexture = tex;
        this.fbo = gl.createFramebuffer()!;
        this.iconTex = tex();
        this.sdfTex = tex();
        this.spriteTex = tex();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SPRITE_ATLAS, SPRITE_ATLAS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    }

    private link(vs: string, fs: string, name: string): Program {
        const gl = this.gl, prog = gl.createProgram()!;
        for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
            const s = gl.createShader(type)!;
            gl.shaderSource(s, HEAD + src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Shader "${name}": ${gl.getShaderInfoLog(s)}`);
            gl.attachShader(prog, s);
        }
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Program "${name}": ${gl.getProgramInfoLog(prog)}`);
        const u: Record<string, WebGLUniformLocation> = {};
        for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
            const info = gl.getActiveUniform(prog, i)!;
            u[info.name] = gl.getUniformLocation(prog, info.name)!;
        }
        return {prog, u};
    }

    resize(width: number, height: number, dpr: number) {
        this.dpr = dpr;
        this.canvas.width = Math.max(1, Math.round(width * dpr));
        this.canvas.height = Math.max(1, Math.round(height * dpr));
    }

    createTile(t: TileGL): GLTile {
        const gl = this.gl, batches: Record<string, GLBuffers> = {};
        for (const id in t.layers) {
            const b = t.layers[id], bufs: WebGLBuffer[] = [];
            const vao = gl.createVertexArray()!;
            gl.bindVertexArray(vao);
            const attr = (loc: number, data: ArrayBufferView, size: number, type: number, norm = false, stride = 0, offset = 0, instanced = false, reuse = false) => {
                if (!reuse) {
                    const buffer = gl.createBuffer()!;
                    bufs.push(buffer);
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                }
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, size, type, norm, stride, offset);
                if (instanced) gl.vertexAttribDivisor(loc, 1);
            };
            const index = (data: Uint32Array) => {
                const buffer = gl.createBuffer()!;
                bufs.push(buffer);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
            };
            let count = 0, scalar = false, edgeVao: WebGLVertexArrayObject | undefined;
            if (b.type === 'fill') {
                attr(0, b.pos, 2, gl.SHORT);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                index(b.idx);
                count = b.idx.length;
                if (b.edges?.length) {
                    // Same vertices, a second index list: edges cost no extra vertex memory.
                    const [posBuf, colorBuf] = bufs;
                    edgeVao = gl.createVertexArray()!;
                    gl.bindVertexArray(edgeVao);
                    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
                    gl.enableVertexAttribArray(0);
                    gl.vertexAttribPointer(0, 2, gl.SHORT, false, 0, 0);
                    if (b.color) { gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0); }
                    index(b.edges);
                    gl.bindVertexArray(vao);
                }
            } else if (b.type === 'extrusion') {
                attr(0, b.v, 4, gl.FLOAT);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                index(b.idx);
                count = b.idx.length;
            } else if (b.type === 'line') {
                attr(0, b.v, 4, gl.FLOAT, false, 24, 0);
                attr(2, b.v, 2, gl.FLOAT, false, 24, 16, false, true);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.width) { attr(3, b.width, 1, gl.FLOAT); scalar = true; }
                index(b.idx);
                count = b.idx.length;
            } else {
                attr(2, b.pos, 2, gl.SHORT, false, 8, 0);
                attr(0, b.pos, 2, gl.SHORT, false, 8, 4, false, true);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.radius) { attr(3, b.radius, 1, gl.FLOAT); scalar = true; }
                index(b.idx);
                count = b.idx.length;
            }
            batches[id] = {type: b.type, vao, count, color: !!b.color, scalar, bufs, edgeVao, edgeCount: b.type === 'fill' ? b.edges?.length : undefined};
        }
        gl.bindVertexArray(null);
        return {labels: t.labels, batches};
    }

    /** The style's sprite sheet (icons for symbol layers). `scale` is its pixel density. */
    setIcons(image: TexImageSource, width: number, height: number) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.iconTex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this.iconSize = [width, height];
    }

    /** Wraps a decoded raster or elevation tile image as a drawable tile. */
    createImageTile(image: ImageBitmap, encoding: string | undefined, id: TileID): GLTile {
        const dem = !!encoding;
        const gl = this.gl, tex = this.newTexture();
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !dem);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        const tile: GLTile = {labels: {}, batches: {}, tex};
        if (dem) {
            const n = 2 ** id.z, slopes = this.newTexture(), u = this.programs.demPrepare;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, slopes, 0);
            gl.viewport(0, 0, image.width, image.height);
            gl.disable(gl.BLEND);
            gl.useProgram(u.prog);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.uniform1i(u.u.u_dem, 0);
            gl.uniform1f(u.u.u_zoom, id.z);
            gl.uniform4fv(u.u.u_unpack, encoding === 'terrarium' ? [256, 1, 1 / 256, 32768] : [6553.6, 25.6, 0.1, 10000]);
            gl.bindVertexArray(this.quad);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteTexture(tex);
            tile.tex = slopes;
            tile.lat = [latFromMerc(id.y / n), latFromMerc((id.y + 1) / n)];
        }
        return tile;
    }

    destroyTile(t: GLTile) {
        if (t.tex) this.gl.deleteTexture(t.tex);
        for (const b of Object.values(t.batches)) {
            this.gl.deleteVertexArray(b.vao);
            if (b.edgeVao) this.gl.deleteVertexArray(b.edgeVao);
            for (const buf of b.bufs) this.gl.deleteBuffer(buf);
        }
    }

    /** Creates or replaces the GPU buffers for a marker layer. `data` holds MARKER_FLOATS floats per marker. */
    setMarkers(old: MarkerBuffers | undefined, data: Float32Array, count: number, width: number, height: number, offset: [number, number]): MarkerBuffers {
        const gl = this.gl;
        if (old) this.removeMarkers(old);
        const vao = gl.createVertexArray()!, buffer = gl.createBuffer()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        for (const [loc, size, at] of [[1, 4, 0], [2, 4, 4], [0, 2, 8], [3, 2, 10]]) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, MARKER_STRIDE * 4, at * 4);
        }
        // Plain indexed quads rather than instancing, which software renderers execute very slowly.
        const idx = new Uint32Array(count * 6), index = gl.createBuffer()!;
        for (let i = 0; i < count; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return {vao, buffer, index, count, width, height, offset, opacity: 1};
    }
    removeMarkers(m: MarkerBuffers) { this.gl.deleteVertexArray(m.vao); this.gl.deleteBuffer(m.buffer); this.gl.deleteBuffer(m.index); }
    /** Rewrites every marker's instance data in place, e.g. after overlap hiding re-decides what shows. */
    updateMarkers(m: MarkerBuffers, data: Float32Array) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, m.buffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, data);
    }
    /** Rewrites one marker's instance data, e.g. while its scale animates. */
    updateMarker(m: MarkerBuffers, index: number, values: Float32Array) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, m.buffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, index * MARKER_FLOATS * 4, values);
    }

    /** Copies premultiplied RGBA pixels for one marker image into the sprite atlas. */
    uploadSprite(x: number, y: number, w: number, h: number, pixels: Uint8Array) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.spriteTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }

    render(s: Scene) {
        const gl = this.gl, tr = s.tr, zoom = tr.zoom;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        let current: Program | null = null;
        const use = (name: keyof typeof SHADERS) => {
            const p = this.programs[name];
            if (p !== current) {
                gl.useProgram(p.prog);
                gl.uniform2f(p.u.u_view, tr.width, tr.height);
                current = p;
            }
            return p.u;
        };
        const color = (L: CompiledLayer) => {
            const c = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom), op = L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom);
            return [c[0], c[1], c[2], c[3] * op];
        };

        for (const L of s.layers) {
            if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
            if (L.type === 'background') {
                const u = use('fill');
                gl.bindVertexArray(this.quad);
                gl.vertexAttrib4f(1, 1, 1, 1, 1);
                gl.uniformMatrix4fv(u.u_matrix, false, [2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]); // unit square -> whole screen
                gl.uniform4f(u.u_clip, -1, -1, 2, 2);
                gl.uniform4fv(u.u_color, color(L));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                continue;
            }
            const items = s.items.get(L.source!);
            if (!items) continue;
            if (L.type === 'raster' || L.type === 'hillshade') {
                const u = use(L.type), p = L.p;
                gl.activeTexture(gl.TEXTURE0);
                gl.uniform1i(u.u_image, 0);
                gl.bindVertexArray(this.quad);
                if (L.type === 'raster') {
                    const sat = p.saturation.eval(zoom), con = p.contrast.eval(zoom);
                    gl.uniform3f(u.u_adjust, p.opacity.eval(zoom), sat > 0 ? 1 - 1 / (1.001 - sat) : -sat, con > 0 ? 1 / (1 - con) : 1 + con);
                } else {
                    const pre = (c: number[]) => [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
                    const azimuth = p.direction.eval(zoom) * Math.PI / 180 + (p.anchor.eval(zoom) === 'viewport' ? tr.bearing * Math.PI / 180 : 0);
                    gl.uniform2f(u.u_light, p.exaggeration.eval(zoom), azimuth);
                    gl.uniform4fv(u.u_shadow, pre(p.shadow.eval(zoom)));
                    gl.uniform4fv(u.u_highlight, pre(p.highlight.eval(zoom)));
                    gl.uniform4fv(u.u_accent, pre(p.accent.eval(zoom)));
                }
                for (const it of items) {
                    if (!it.tile.tex) continue;
                    const m = it.matrix4;
                    gl.uniformMatrix4fv(u.u_matrix, false, m);
                    gl.uniform4fv(u.u_clip, it.clip);
                    if (it.tile.lat) gl.uniform2fv(u.u_latrange, it.tile.lat);
                    gl.bindTexture(gl.TEXTURE_2D, it.tile.tex);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
                continue;
            }
            let first = true;
            // Buildings are the one layer that needs depth sorting; everything else is painted back to front.
            const extrude = L.type === 'fill-extrusion', pending: (() => void)[] = [];
            if (extrude) { gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); }
            for (const it of items) {
                const b = it.tile.batches[L.id];
                if (!b) continue;
                const u = use(b.type), m = it.matrix4;
                if (first) {
                    first = false;
                    gl.uniform4fv(u.u_color, color(L));
                    if (b.type === 'line') {
                        const dash = L.p.dash.eval(zoom) as number[] | null;
                        gl.uniform1f(u.u_width, L.p.width.dd ? 1 : L.p.width.eval(zoom));
                        gl.uniform1f(u.u_gap, L.p.gap.eval(zoom));
                        gl.uniform4f(u.u_dash, dash?.[0] ?? 0, dash?.[1] ?? 0, dash?.[2] ?? 0, dash?.[3] ?? 0);
                    }
                    if (b.type === 'circle') {
                        const sc = L.p.strokeColor.eval(zoom), a = sc[3] * (L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                        gl.uniform1f(u.u_radius, L.p.radius.dd ? 1 : L.p.radius.eval(zoom));
                        gl.uniform1f(u.u_strokeWidth, L.p.strokeWidth.eval(zoom));
                        gl.uniform4f(u.u_stroke, sc[0] * a, sc[1] * a, sc[2] * a, a);
                    }
                }
                gl.uniformMatrix4fv(u.u_matrix, false, m);
                gl.uniform4fv(u.u_clip, it.clip);
                gl.bindVertexArray(b.vao);
                // Attributes without a buffer read these constants, so shaders need no variants.
                if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                if (!b.scalar) gl.vertexAttrib1f(3, 1);
                if (b.type === 'line') {
                    gl.uniform1f(u.u_scale, it.scale);
                    gl.uniform1f(u.u_cam, tr.cameraDistance);
                    // Dashes are sized at whole zoom levels so they stretch, rather than crawl, while zooming.
                    gl.uniform1f(u.u_dashScale, it.scale / 2 ** (zoom - Math.floor(zoom)));
                }
                if (extrude) {
                    // Depth first, colour second: translucent buildings then blend once, with the nearest surface only.
                    gl.colorMask(false, false, false, false);
                    gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
                    gl.colorMask(true, true, true, true);
                    pending.push(() => {
                        gl.uniformMatrix4fv(u.u_matrix, false, m);
                        gl.uniform4fv(u.u_clip, it.clip);
                        gl.bindVertexArray(b.vao);
                        if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                        gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
                    });
                } else gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
            }
            if (L.type === 'fill') {
                // Edge pass: the style's outline colour if it has one, otherwise the fill's own colour as antialiasing.
                const oc = L.p.outline.eval(zoom), explicit = oc[3] > 0, op = L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom);
                const col = explicit ? [oc[0], oc[1], oc[2], oc[3] * op] : color(L);
                for (const it of items) {
                    const b = it.tile.batches[L.id];
                    if (!b?.edgeVao) continue;
                    const u = use('edge');
                    gl.uniform4fv(u.u_color, col);
                    gl.uniform2f(u.u_world, this.canvas.width, this.canvas.height);
                    gl.uniform1f(u.u_attr, b.color && !explicit ? 1 : 0);
                    gl.uniformMatrix4fv(u.u_matrix, false, it.matrix4);
                    gl.uniform4fv(u.u_clip, it.clip);
                    gl.bindVertexArray(b.edgeVao);
                    gl.drawElements(gl.LINES, b.edgeCount!, gl.UNSIGNED_INT, 0);
                }
            }
            if (extrude) {
                // Colour pass: only the nearest surface, and each pixel once. Touching walls and stacked building parts
                // share depths exactly; without the stencil they would blend twice in a speckled pattern.
                gl.enable(gl.STENCIL_TEST);
                gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.depthMask(false);
                for (const draw of pending) draw();
                gl.depthMask(true);
                gl.disable(gl.STENCIL_TEST);
                gl.disable(gl.DEPTH_TEST);
            }
        }

        // Style-sheet icons and images added at runtime live in different textures.
        for (const custom of [false, true]) {
            const icons = this.iconQuads(s.labels, custom);
            if (!icons.length) continue;
            const u = use('sprite');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, custom ? this.spriteTex : this.iconTex);
            gl.uniform2f(u.u_tex, custom ? SPRITE_ATLAS : this.iconSize[0], custom ? SPRITE_ATLAS : this.iconSize[1]);
            gl.uniform1i(u.u_img, 0);
            gl.bindVertexArray(this.spriteVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
            gl.bufferData(gl.ARRAY_BUFFER, icons, gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, icons.length / 5);
        }

        if (s.labels.length) {
            const quads = this.textQuads(s.labels); // shaping may add glyphs, so build quads before uploading the atlas
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.sdfTex);
            if (this.sdfVersion !== s.atlas.version) {
                const a = s.atlas, d = a.dirty;
                // Usually only a few rows of new glyphs changed; send just those.
                if (d && d[1] > d[0]) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, d[0], a.width, d[1] - d[0], gl.RED, gl.UNSIGNED_BYTE, a.data.subarray(d[0] * a.width, d[1] * a.width));
                else if (!d) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, a.width, a.height, 0, gl.RED, gl.UNSIGNED_BYTE, a.data);
                a.dirty = [a.height, 0];
                this.sdfVersion = a.version;
            }
            const u = use('text');
            gl.uniform2f(u.u_tex, s.atlas.width, s.atlas.height);
            gl.uniform1i(u.u_sdf, 0);
            gl.bindVertexArray(this.textVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuf);
            gl.bufferData(gl.ARRAY_BUFFER, quads, gl.DYNAMIC_DRAW);
            const n = quads.byteLength / 32;
            gl.uniform1i(u.u_pass, 1);
            gl.drawArrays(gl.TRIANGLES, 0, n);
            gl.uniform1i(u.u_pass, 0);
            gl.drawArrays(gl.TRIANGLES, 0, n);
        }

        if (s.markers.length) {
            // Markers are positioned by the GPU from their map coordinates: nothing is recomputed per marker per frame.
            const u = use('marker'), split = (v: number) => { const hi = Math.fround(v); return [hi, v - hi]; };
            const a = -tr.bearing * Math.PI / 180, p = tr.pitch * Math.PI / 180;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.spriteTex);
            gl.uniform1i(u.u_img, 0);
            gl.uniform2f(u.u_tex, SPRITE_ATLAS, SPRITE_ATLAS);
            gl.uniform4f(u.u_center, ...split(mercX(tr.lng)) as [number, number], ...split(mercY(tr.lat)) as [number, number]);
            gl.uniform1f(u.u_world, tr.worldSize);
            gl.uniform2f(u.u_rot, Math.cos(a), Math.sin(a));
            gl.uniform3f(u.u_pitch, Math.cos(p), Math.sin(p), tr.cameraDistance);
            for (const m of s.markers) {
                gl.uniform2f(u.u_size, m.width, m.height);
                gl.uniform2f(u.u_offset, m.offset[0], m.offset[1]);
                gl.uniform1f(u.u_opacity, m.opacity);
                gl.bindVertexArray(m.vao);
                gl.drawElements(gl.TRIANGLES, m.count * 6, gl.UNSIGNED_INT, 0);
            }
        }
        gl.bindVertexArray(null);
    }

    private iconQuads(labels: Placed[], custom: boolean): Float32Array {
        const mine = labels.filter(l => l.icon && !!l.icon.custom === custom && l.opacity > 0);
        const out = new Float32Array(mine.length * 30);
        let o = 0;
        for (const {icon, opacity} of mine) {
            const i = icon!, cos = Math.cos(i.angle), sin = Math.sin(i.angle), hw = i.w / 2, hh = i.h / 2, [sx, sy, sw, sh] = i.rect;
            for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, -1], [1, 1], [-1, 1]]) {
                out[o++] = i.x + cx * hw * cos - cy * hh * sin;
                out[o++] = i.y + cx * hw * sin + cy * hh * cos;
                out[o++] = sx + (cx + 1) / 2 * sw;
                out[o++] = sy + (cy + 1) / 2 * sh;
                out[o++] = opacity;
            }
        }
        return out;
    }

    private textQuads(labels: Placed[]): ArrayBuffer {
        let glyphCount = 0;
        for (const l of labels) if (l.shaped) for (const line of l.shaped.lines) glyphCount += line.glyphs!.length;
        const buf = new ArrayBuffer(glyphCount * 6 * 32), f = new Float32Array(buf), b = new Uint8Array(buf);
        let o = 0;
        const B = SDF_BUFFER;
        for (const l of labels) {
            if (!l.shaped) continue;
            const shaped = l.shaped;
            const s = l.size / EM, cos = Math.cos(l.angle), sin = Math.sin(l.angle), src = l.src;
            // Where the halo's outer edge sits in distance-field units, limited by how far the field extends.
            const hedge = src.haloWidth > 0 && src.halo[3] > 0 ? Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - src.haloWidth / s / SDF_RADIUS) : 2;
            const gamma = 0.7 / (SDF_RADIUS * s * this.dpr);
            const fade = (c: number[]) => [c[0] * 255, c[1] * 255, c[2] * 255, c[3] * 255 * l.opacity].map(Math.round);
            const col = fade(src.color), halo = fade(src.halo);
            if (l.curve) {
                // Text along a line: every glyph has its own origin and rotation.
                shaped.lines[0].glyphs!.forEach((g, i) => {
                    if (!g.w) return;
                    const gx = l.x + l.curve![i * 3], gy = l.y + l.curve![i * 3 + 1], ga = l.curve![i * 3 + 2], gc = Math.cos(ga), gs = Math.sin(ga);
                    const x0 = (g.left - B) * s, y0 = (-g.top - B) * s, x1 = x0 + g.w * s, y1 = y0 + g.h * s;
                    for (const [cx, cy, u, v] of [[x0, y0, 0, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y1, 1, 1], [x0, y1, 0, 1]]) {
                        const fi = o / 4;
                        f[fi] = gx + cx * gc - cy * gs;
                        f[fi + 1] = gy + cx * gs + cy * gc;
                        f[fi + 2] = g.x + u * g.w;
                        f[fi + 3] = g.y + v * g.h;
                        b.set(col, o + 16);
                        b.set(halo, o + 20);
                        f[fi + 6] = hedge;
                        f[fi + 7] = gamma;
                        o += 32;
                    }
                });
                continue;
            }
            shaped.lines.forEach((line, i) => {
                let pen = -line.width / 2;
                const baseline = -shaped.height / 2 + i * shaped.lineHeight + shaped.lineHeight * 0.5 + EM * 0.34;
                for (const g of line.glyphs!) {
                    if (g.w) {
                        const x0 = (pen + g.left - B) * s, y0 = (baseline - g.top - B) * s, x1 = x0 + g.w * s, y1 = y0 + g.h * s;
                        for (const [cx, cy, u, v] of [[x0, y0, 0, 0], [x1, y0, 1, 0], [x0, y1, 0, 1], [x1, y0, 1, 0], [x1, y1, 1, 1], [x0, y1, 0, 1]]) {
                            const fi = o / 4;
                            f[fi] = l.x + cx * cos - cy * sin;
                            f[fi + 1] = l.y + cx * sin + cy * cos;
                            f[fi + 2] = g.x + u * g.w;
                            f[fi + 3] = g.y + v * g.h;
                            b.set(col, o + 16);
                            b.set(halo, o + 20);
                            f[fi + 6] = hedge;
                            f[fi + 7] = gamma;
                            o += 32;
                        }
                    }
                    pen += g.advance + src.spacing * EM;
                }
            });
        }
        return buf.slice(0, o);
    }
}
