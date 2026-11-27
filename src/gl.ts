import {EXTENT, clamp, latFromMerc, mercX, mercY, type TileID, type Transform} from './geo.ts';
import {withFilter, mapTranslate, type CompiledLayer, type Light} from './style.ts';
import {compileProp, type Prop} from './expr.ts';
import type {Sky} from './resolve.ts';
import {LOSE_CONTEXT} from './gl-names.ts';
import {LINE_VERTEX, WALL_OTHER, WALL_TOP, patternKey, type GLBatch, type IconBatch, type LabelSrc, type TileGL} from './tile.ts';
import type {Placed, RenderItem} from './placement.ts';
import {demUnpack, type DemEncoding} from './elevation.ts';
import {lineMiddle, BASELINE, EM, SDF_BUFFER, SDF_RADIUS, type GlyphAtlas} from './text.ts';

// (The build writes `L(0)` for `layout(location=0) in`: scripts/minify-shaders.mjs.)
const HEAD = '#version 300 es\n#define L(n) layout(location=n) in\nprecision highp float;\n';
/** Shared by the map-space programs: u_matrix takes tile units (and meters of height) to clip space. */
export const VS_COMMON = `uniform mat4 u_matrix; uniform vec2 u_view;
#ifdef GLOBE
GLOBE_GLSL
#else
vec4 toClip(vec2 t) { return u_matrix * vec4(t, 0.0, 1.0); }
#define toClip3(t, h) (u_matrix * vec4(t, h, 1.0))
#define toClip3D(t, h) (u_matrix * vec4(t, h, 1.0))
#define toClipTurn(t, o, h) (u_matrix * vec4((t) + (o), h, 1.0))
#define horizonSide(t) 1.0
#define lineScale(t) 1.0
#define unpole(t) (t)
#define shown(c) true
#endif
`;
export const FS_CLIP = 'if (v_tile.x < u_clip.x || v_tile.y < u_clip.y || v_tile.x > u_clip.z || v_tile.y > u_clip.w) discard;';

// Ground height from an elevation tile, for vertex shaders. `u_demRect` is the part of the elevation image under this
// tile (offset x, y and scale, then the image size in pixels, without the border); `u_exag` of zero means "no heights
// here (yet)", and the ground is then taken to be level at `u_level`. The texture has a border of 2 pixels from the
// neighbor tiles (see `padDem`), as in MapLibre GL JS, so the heights near an edge and up to 1.5 pixels past it (the
// centroid of a building in the buffer of a tile) are those of the neighbor (#2319).
const TERRAIN_GLSL = `uniform highp sampler2D u_dem; uniform vec4 u_demRect; uniform vec4 u_unpack; uniform float u_exag; uniform float u_level;
float demAt(ivec2 p) { vec4 c = texelFetch(u_dem, clamp(p, ivec2(0), ivec2(int(u_demRect.w) + 3)), 0) * 255.0; return dot(c.rgb, u_unpack.rgb) - u_unpack.a; }
float ground(vec2 uv) {
  if (u_exag == 0.0) return u_level;
  vec2 p = (u_demRect.xy + uv * u_demRect.z) * u_demRect.w + 1.5, f = fract(p); ivec2 i = ivec2(floor(p));
  return mix(mix(demAt(i), demAt(i + ivec2(1, 0)), f.x), mix(demAt(i + ivec2(0, 1)), demAt(i + ivec2(1, 1)), f.x), f.y) * u_exag;
}
`;

/**
 * An elevation image (`w` by `h` pixels) with a border of 2 pixels on each side, as MapLibre GL JS keeps it (`DEMData`).
 * The border repeats the edge until the loaded neighbor tiles fill it (`backfillDem`).
 */
function padDem(w: number, h: number, data: Uint8Array): Uint8Array {
    const W = w + 4, out = new Uint8Array(W * (h + 4) * 4), px = new Uint32Array(out.buffer);
    for (let y = 0; y < h + 4; y++) {
        const r = clamp(y - 2, 0, h - 1) * w * 4, o = y * W;
        out.set(data.subarray(r, r + w * 4), (o + 2) * 4);
        px.fill(px[o + 2], o, o + 2);
        px.fill(px[o + w + 1], o + w + 2, o + W);
    }
    return out;
}

/**
 * The column-major 3x3 matrix that takes a pixel of the target (`gl_FragCoord`) to the flat ground, in the units of the
 * tile whose matrix is `m`: the inverse of the tile matrix at height 0, followed by the viewport.
 */
export function screenToTile(m: ArrayLike<number>, [w, h]: number[]): number[] {
    // The rows of the pixel (x, y) and of the depth w, times w, for the tile point (u, v, 1).
    const r = [0, 1, 3].map(c => [w / 2 * (m[c * 4] + m[c * 4 + 3]), h / 2 * (m[c * 4 + 1] + m[c * 4 + 3]), m[c * 4 + 3]]);
    const [[a, d, g], [b, e, k], [c, f, i]] = r, A = e * i - f * k, B = f * g - d * i, C = d * k - e * g, det = a * A + b * B + c * C;
    return [A, B, C, c * k - b * i, a * i - c * g, b * g - a * k, b * f - c * e, c * d - a * f, a * e - b * d].map(v => v / det);
}

/** The rectangle `clip` of the tile `id` in the units of the tile `ref` (exact, so that neighbor tiles share their edges). */
export function clipIn(ref: TileID, id: TileID, clip: number[]): number[] {
    const k = 2 ** (ref.z - id.z), ox = ((id.x + id.w * 2 ** id.z) * k - ref.x - ref.w * 2 ** ref.z) * EXTENT, oy = (id.y * k - ref.y) * EXTENT;
    return clip.map((v, i) => v * k + (i % 2 ? oy : ox));
}

const SQUARE = [0, 0, EXTENT, 0, EXTENT, EXTENT, 0, EXTENT], ONES = [1, 1, 1, 1, 0];
/**
 * Perspective weights for a quadrilateral's corners, from where its diagonals cross (all equal for a parallelogram).
 * A quadrilateral that is not convex (concave, or crossing itself) has none, because no perspective view gives it.
 * The fifth number is how far the picture is blended toward the bilinear stretch, as in MapLibre GL JS
 * (`calculateImageWarp`): 0 up to a foreshortening (the largest weight over the smallest) of 4, rising to 1 at 512.
 */
export function cornerWeights(c: number[]): number[] | undefined {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = c, den = (x2 - x0) * (y3 - y1) - (y2 - y0) * (x3 - x1);
    // t and s are where the diagonals cross, on the diagonal 0-2 and on the diagonal 1-3: the shape is convex when both are inside.
    const t = ((x1 - x0) * (y3 - y1) - (y1 - y0) * (x3 - x1)) / den, s = ((x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)) / den;
    if (Math.abs(den) < 1e-9 || !(t > 0 && t < 1 && s > 0 && s < 1)) return;
    const ix = x0 + (x2 - x0) * t, iy = y0 + (y2 - y0) * t, d = [0, 1, 2, 3].map(i => Math.hypot(c[i * 2] - ix, c[i * 2 + 1] - iy));
    const q = [(d[0] + d[2]) / d[2], (d[1] + d[3]) / d[3], (d[0] + d[2]) / d[0], (d[1] + d[3]) / d[1]];
    return [...q, Math.min(1, Math.max(0, (1 - 4 * Math.min(...q) / Math.max(...q)) / (1 - 4 / 512)))];
}
/**
 * A quadrilateral that is not convex is drawn as MapLibre GL JS 6.17 draws it (`calculateImageWarp`): the picture is
 * stretched bilinearly between the corners on a grid of 16 x 16 cells, and the parts where that stretch turns the
 * picture over are not drawn (back faces are culled, with the turn of the corners 0, 1, 2 as the front). The turn at a
 * point (u, v) of the picture is the determinant of the stretch there, j0 + j1 u + j2 v, which is linear in u and v;
 * this gives j0, j1 and j2 with the sign of the front, scaled to at most 1. The fragment shader discards where it is negative.
 * Corners 0, 1, 2 on one line count as not turned over, as in `hasWrongWindingOrder`.
 */
function foldOf(c: number[]): number[] {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = c, bx = x1 - x0, by = y1 - y0, cx = x3 - x0, cy = y3 - y0, dx = x0 - x1 + x2 - x3, dy = y0 - y1 + y2 - y3;
    const j = [bx * cy - by * cx, bx * dy - by * dx, dx * cy - dy * cx], k = (bx * (y2 - y0) - by * (x2 - x0) < 0 ? -1 : 1) / Math.max(...j.map(Math.abs));
    return j.map(v => v * k);
}
const FLAT = [1, 0, 0];

/** Samples a repeating image of the icon atlas at a position in units of the image. */
const PATTERN_GLSL = `uniform sampler2D u_img; uniform vec4 u_rect; uniform vec2 u_tex;
vec4 tile(vec2 p) { return texture(u_img, (u_rect.xy + clamp(fract(p) * u_rect.zw, vec2(0.5), u_rect.zw - 0.5)) / u_tex); }`;

const BUILTIN = {
    // Draws a whole layer, rendered separately, onto the map in one go (layer-wide opacity and blending).
    composite: [`layout(location=0) in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_layer; uniform sampler2D u_below; uniform float u_opacity; uniform int u_mode; in vec2 v_uv; out vec4 o;
// Blend modes that cannot be expressed as a GPU blend function work from a copy of what is underneath
// (formulas from the W3C Compositing specification). 1: overlay, 2: color, 3: luminosity.
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 setLum(vec3 c, float l) {
  c += l - lum(c);
  float lo = min(c.r, min(c.g, c.b)), hi = max(c.r, max(c.g, c.b)), m = lum(c);
  if (lo < 0.0) c = m + (c - m) * m / (m - lo);
  if (hi > 1.0) c = m + (c - m) * (1.0 - m) / (hi - m);
  return c;
}
vec3 overlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
void main() {
  vec4 s = texture(u_layer, v_uv) * u_opacity;
  if (u_mode == 0) { o = s; return; }
  vec4 b = texture(u_below, v_uv);
  vec3 sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0), bc = b.a > 0.0 ? b.rgb / b.a : vec3(0.0);
  vec3 mixed = u_mode == 1 ? overlay(bc, sc) : u_mode == 2 ? setLum(sc, lum(bc)) : setLum(bc, lum(sc));
  o = vec4((1.0 - s.a) * b.rgb + (1.0 - b.a) * s.rgb + s.a * b.a * mixed, s.a + b.a - s.a * b.a);
}`],
    // The sky (the `sky` of the style): a quad over the screen. u_sky has the horizon line in device pixels from the
    // bottom and the height of the band in which sky-color turns into horizon-color; below the line nothing is drawn.
    // On the globe (u_globeSky.x, the change to the globe, above 0) it follows MapLibre's sky.fragment.glsl: the
    // distance to the horizon is the angle of the ray of the pixel past the edge of the sphere times the distance of the
    // camera (u_globeSky.y), and the sky fades where the ray misses the atmosphere and as the camera leaves it, times
    // 1 - atmosphere-blend (u_globeSky.z). u_rays, u_cam and u_halo.y are those of the halo (`HALO` in globe.ts).
    sky: [`layout(location=0) in vec2 a_pos; void main() { gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform vec2 u_sky; uniform vec4 u_skyColor; uniform vec4 u_horizonColor; uniform vec3 u_globeSky; uniform mat3 u_rays; uniform vec3 u_cam; uniform vec2 u_halo; uniform vec2 u_view; out vec4 o;
void main() {
  float b = gl_FragCoord.y - u_sky.x, a = 1.0;
  if (u_globeSky.x > 0.0) {
    vec3 r = normalize(u_rays * vec3(gl_FragCoord.x / u_halo.y, u_view.y - gl_FragCoord.y / u_halo.y, 1.0));
    float d = length(u_cam), c = max(dot(r, -u_cam), 0.0), h = 100.0 / 6371.0;
    b = mix(b, ((acos(clamp(dot(r, -u_cam) / d, -1.0, 1.0)) - asin(min(1.0 / d, 1.0))) * u_globeSky.y + 1.0) * u_halo.y, u_globeSky.x);
    a = mix(1.0, (1.0 - smoothstep(h, 10.0 * h, d - 1.0)) * (1.0 - smoothstep(0.0, h, sqrt(max(d * d - c * c, 0.0)) - 1.0)) * u_globeSky.z, u_globeSky.x);
  }
  if (b <= 0.0) discard;
  o = (b < u_sky.y ? mix(u_skyColor, u_horizonColor, pow(1.0 - b / u_sky.y, 2.0)) : u_skyColor) * a;
}`],
    fill: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
void main() { v_tile = unpole(a_pos); v_color = a_color; gl_Position = toClip(a_pos); }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; o = vec4(c.rgb * c.a, c.a); }`],

    // Repeating image fill. The image is tiled in world pixels at whole zoom levels, so it stays put while panning
    // and grows with the map between levels, as in MapLibre.
    // A distance-field image (`sdf: true`, fill-pattern only) is drawn in the color of the layer (u_color) and of the
    // feature (a_color), with its edge at 0.75 of the alpha, as in MapLibre GL JS.
    pattern: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; uniform mat3 u_pat; uniform vec2 u_world; out vec2 v_p; out vec2 v_tile; out vec4 v_color; out vec2 v_px;
void main() { v_tile = unpole(a_pos); v_color = a_color; v_p = (u_pat * vec3(unpole(a_pos), 1.0)).xy; gl_Position = toClip(a_pos); v_px = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world; }`, `
uniform vec2 u_fade; uniform vec4 u_clip; uniform float u_sdf; uniform vec4 u_color; uniform vec2 u_world; in vec2 v_p; in vec2 v_tile; in vec4 v_color; in vec2 v_px; out vec4 o;
${PATTERN_GLSL}
float edge(float a) { float g = max(fwidth(a) * 0.5, 1.0 / 255.0 / 16.0); return smoothstep(0.75 - g, 0.75 + g, a); }
void main() {
  ${FS_CLIP} vec4 a = tile(v_p), b = tile(v_p * 2.0);
  if (u_sdf < 0.5) o = mix(a, b, u_fade.x) * u_fade.y;
  else { vec4 c = v_color * u_color; float k = mix(edge(a.a), edge(b.a), u_fade.x) * c.a * u_fade.y; o = vec4(c.rgb * k, k); }
  // With u_world set, these are the edges of a fill drawn as lines (fill-antialias without fill-outline-color), as in MapLibre GL JS.
  if (u_world.x > 0.0) o *= 1.0 - smoothstep(0.0, 1.0, length(v_px - gl_FragCoord.xy));
}`],

    // One-pixel antialiased lines along polygon edges: coverage falls off with distance from the ideal line.
    edge: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; uniform vec2 u_world; uniform float u_attr;
out vec4 v_color; out vec2 v_tile; out vec2 v_px;
void main() { v_tile = a_pos; v_color = mix(vec4(1.0), a_color, u_attr); gl_Position = toClip(a_pos); v_px = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world; }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; in vec2 v_px; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; float a = c.a * (1.0 - smoothstep(0.0, 1.0, length(v_px - gl_FragCoord.xy))); o = vec4(c.rgb * a, a); }`],

    line: [`${VS_COMMON}
layout(location=0) in vec4 a_packed; layout(location=1) in vec4 a_color; layout(location=2) in float a_side; layout(location=3) in float a_width; layout(location=4) in float a_dist; layout(location=5) in float a_width1; layout(location=6) in float a_offset; layout(location=7) in float a_blur; layout(location=8) in float a_gap;
layout(location=9) in float a_offset1; layout(location=10) in float a_blur1; layout(location=11) in float a_gap1;
uniform float u_width; uniform float u_scale; uniform float u_gap; uniform float u_offset; uniform float u_zt; uniform float u_floorWidth;
uniform float u_dpr;
out vec4 v_color; out vec2 v_tile; out float v_d; out float v_hw; out float v_w; out float v_dist; out float v_persp; out float v_fw; out float v_blur; out float v_gap; out float v_aa;
void main() {
  vec4 a_v = vec4(a_packed.xy * 0.5, a_packed.zw / 8192.0); /* positions in halves of a tile unit: see tessellateLine */ vec2 a_sd = vec2(a_side, a_dist);
  float w = mix(a_width, a_width1, u_zt) * u_width; // a width for each feature changes smoothly between zoom levels
  v_blur = a_blur + u_zt * a_blur1; v_fw = a_width * u_floorWidth; // dashes are sized by the width at the whole zoom level, as in MapLibre
  // With a gap the line is two strokes of width w either side of an empty middle. A gap for each feature is a_gap.
  // As in MapLibre GL JS (ANTIALIASING), the soft edge is one device pixel wide and reaches half a device pixel out.
  v_aa = 1.0 / u_dpr;
  v_gap = u_gap + a_gap + u_zt * a_gap1; v_hw = (v_gap > 0.0 ? v_gap * 0.5 + w : w * 0.5) + 0.5 * v_aa; float sa = abs(a_sd.x), side = sign(a_sd.x), c = sa > 1.5 && sa < 15360.5 ? (sa - 2.0) / 4096.0 - 2.0 : 0.0, k = 2.0 / max(length(a_v.zw), 2.0), t = (sa - 24575.0) / 8191.0 * 3.1415927; v_d = side * v_hw; v_w = w; v_dist = a_sd.y;
  // (As in MapLibre, a line thinner than a pixel is not made fainter for its width: the soft edge does that. A line of no width is not drawn.)
  v_color = vec4(a_color.rgb, w > 0.0 ? a_color.a : 0.0);
  // line-offset moves the whole stroke sideways: along the same normal, whichever side of the line this vertex is on.
  // (The outer vertex of a bevel also moves c times the offset along the line, so that it moves along the miter. A
  // vertex of a fan moves along its normal, and an outer one is pushed out along the angle t: see \`fan\` in tile.ts.)
  // A vertex of a miter longer than 2 moves twice the offset along the miter, as with MAX_OFFSET_MITER_LENGTH of MapLibre GL JS (#2217).
  // A vertex of a flipbevel moves k times the offset along its normal, and 1 - k times twice the offset along the
  // bisector: see the flipbevel of tessellateLine.
  float off = u_offset + a_offset / 8.0 + u_zt * a_offset1;
  if (sa > 15360.5 && sa < 16383.5) { float u = sa - 15872.0; k = (abs(u) - 1.0) / 510.0; c = sign(u) * (1.0 - k) * 2.0 / length(a_v.zw); }
  float ls = lineScale(a_v.xy) / u_scale;
  vec2 e = sa > 16383.5 ? vec2(cos(t), sin(t)) : a_v.zw * abs(side), o = a_v.xy + (a_v.zw * (side == 0.0 ? k : side * k) + c * vec2(a_v.w, -a_v.z)) * off * ls;
  v_tile = o + e * v_hw * ls;
  gl_Position = toClip(v_tile);
  // As v_gamma_scale of MapLibre GL JS: the pixels of the width that one pixel of the screen spans across the line here,
  // so that the soft edge stays one screen pixel wide where a tilted view draws the line thinner (far, or seen edge on)
  // or wider. (The middle of a fan measures along its normal.)
  e = (side == 0.0 ? a_v.zw : e) * v_hw; vec4 q = toClip(o + e * ls);
  v_persp = length(e) / length((q.xy - toClip(o).xy) / q.w * u_view * 0.5);
}`, `
uniform vec4 u_color; uniform vec4 u_clip; uniform vec4 u_dash; uniform float u_dashScale; uniform float u_blur; uniform mat3 u_screen;
in float v_blur; in float v_gap; in float v_aa;
uniform sampler2D u_img; uniform vec4 u_rect; uniform vec2 u_tex; uniform vec2 u_patSize; uniform highp sampler2D u_stops;
uniform int u_cap;
float outside(float t, float from, float to) { return max(max(from - t, t - to), 0.0); }
// How far t is outside the part from..to of a period p, which repeats. A part of length 0 is far, unless keep.
float span(float t, float from, float to, float p, bool keep) { return keep || to > from ? min(outside(t, from, to), min(outside(t, from - p, to - p), outside(t, from + p, to + p))) : 99.0; }
in vec4 v_color; in vec2 v_tile; in float v_d; in float v_hw; in float v_w; in float v_dist; in float v_persp; in float v_fw; out vec4 o;
void main() {
  // On a flat map the tile of a pixel comes from its place on the screen (u_screen takes it to the units of one tile
  // of the layer, and u_clip is in those units), as the stencil of MapLibre GL JS does: each pixel then belongs to one
  // tile exactly. Two neighbor tiles that both draw a line across their edge would otherwise both keep or both drop
  // some pixels of the edge, because each interpolates its v_tile with its own error (#2443). On the globe u_screen is
  // zero, and v_tile decides.
  vec3 g = u_screen * vec3(gl_FragCoord.xy, 1.0); vec2 p = g.xy / g.z;
  if (u_screen[2] == vec3(0.0)) { ${FS_CLIP} } else if (p.x < u_clip.x || p.y < u_clip.y || p.x >= u_clip.z || p.y >= u_clip.w) discard;
  vec4 c = v_color * u_color;
  if (u_patSize.x != 0.0) c = vec4(1.0, 1.0, 1.0, c.a);
  float bl = v_persp * (v_aa + u_blur + v_blur), a = c.a * clamp((v_hw - abs(v_d)) / bl, 0.0, 1.0); // line-blur widens the soft edge
  // The inner edge of a gap fades over the same width, into the gap, as in MapLibre GL JS.
  if (v_gap > 0.0) a *= clamp((abs(v_d) - v_gap * 0.5 - 0.5 * v_aa + bl) / bl, 0.0, 1.0);
  float period = u_dash.x + u_dash.y + u_dash.z + u_dash.w;
  if (period > 0.0 && u_patSize.x <= 0.0) { // a pattern replaces the dashes
    // Dash lengths are in multiples of the line width. D is how far this point is outside the nearest dash, and G how
    // far it is outside the nearest gap. As in MapLibre GL JS, a gap of length 0 joins two dashes, and a dash of length
    // 0 draws nothing with butt caps and a dot with round caps.
    // (h is half a texel of MapLibre's dash texture, 256 texels for each period: where it samples and the 128 / 255 of
    // its middle each move the end of a dash by h, so that a dash is one texel longer.)
    bool r = u_cap == 1;
    float fw = max(v_fw, 0.5), h = period / 512.0, t = mod(v_dist * u_dashScale / fw - h, period), s = u_dash.x + u_dash.y, e = s + u_dash.z, n = v_d / v_hw * 0.5;
    float D = min(span(t, 0.0, u_dash.x, period, r), span(t, s, e, period, r)), G = min(span(t, u_dash.x, s, period, false), span(t, e, period, period, false));
    // As the dash texture of MapLibre GL JS: d is the signed distance to the end of the dash in pixels of the width at
    // the whole zoom level (inside > 0), and the end is soft over one device pixel to each side of it (sdfgamma).
    // A round cap ends each dash in half an ellipse, which reaches half the width at the whole zoom level along the
    // line and the edge of the line across it. As in MapLibre, a square cap does not: its dashes end as butt dashes.
    float d = fw * (h + (!r ? G - D : D > 0.0 ? 0.5 - length(vec2(D, n)) : length(vec2(G, 0.5 - abs(n)))));
    a *= smoothstep(-v_aa, v_aa, d);
  }
  if (u_patSize.x > 0.0) {
    // line-pattern: the image repeats along the line, scaled so that its height is the line width.
    float w = max(v_w, 0.5);
    vec2 p = vec2(fract(v_dist * u_dashScale * u_patSize.y / (u_patSize.x * w)), clamp(v_d / w + 0.5, 0.0, 1.0));
    o = texture(u_img, (u_rect.xy + clamp(p * u_rect.zw, vec2(0.5), u_rect.zw - 0.5)) / u_tex) * a;
    return;
  }
  if (u_patSize.x < 0.0) {
    // line-gradient: the color comes from a ramp, by the place along the whole line (see tessellateLine). A step
    // gradient (u_patSize.x is -2) takes the color of the last of its stops at or below that place (see \`steps\`).
    float t = dot(v_color.rgb, vec3(16711680.0, 65280.0, 255.0)) / 16777215.0;
    if (u_patSize.x > -1.5) { o = texture(u_img, vec2(t, 0.5)) * a; return; }
    int l = 0, r = textureSize(u_stops, 0).x;
    while (r - l > 1) { int m = (l + r) / 2; if (t < texelFetch(u_stops, ivec2(m, 0), 0).r) r = m; else l = m; }
    o = texelFetch(u_img, ivec2(l, 0), 0) * a;
    return;
  }
  o = vec4(c.rgb * a, a);
}`],

    // (With 3D terrain circles are drawn on the screen and stand on the ground, as in MapLibre GL JS: they are not in the ground pictures.)
    circle: [`${VS_COMMON}${TERRAIN_GLSL}
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 a_color; layout(location=2) in vec2 a_pos; layout(location=3) in float a_radius; layout(location=5) in float a_radius1;
layout(location=4) in vec4 a_stroke; layout(location=6) in vec2 a_sb; layout(location=9) in float a_strokeWidth1; layout(location=10) in vec4 a_stroke1; layout(location=11) in float a_blur1;
uniform float u_zt; uniform float u_radius; uniform float u_strokeWidth; uniform float u_blur; uniform vec4 u_stroke; uniform vec4 u_clip; uniform vec2 u_translate;
uniform float u_scale; uniform float u_cam; uniform vec2 u_pitch; uniform float u_lift; uniform highp sampler2D u_depth;
out vec4 v_color; out vec4 v_stroke; out vec2 v_off; out float v_r; out vec2 v_sb;
void main() {
  // A stroke and blur for each feature (a_stroke, a_sb) combine with the values of the layer: a property that is the
  // same for every feature has its value in the uniform, and the attribute reads 1 for the color and 0 for the rest.
  // Their change to the next zoom is a_strokeWidth1, a_blur1 and a_stroke1 (the color at the next zoom), mixed by u_zt.
  v_r = mix(a_radius, a_radius1, u_zt) * u_radius; v_color = a_color; v_stroke = mix(a_stroke, a_stroke1, u_zt) * u_stroke; v_sb = a_sb + u_zt * vec2(a_strokeWidth1, a_blur1) + vec2(u_strokeWidth, u_blur);
  float ext = v_r + v_sb.x + 1.0;
  v_off = a_corner * ext;
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
  // circle-translate (u_translate, in pixels along the axes of the map) moves the center in tile units before the
  // projection, as in MapLibre GL JS: on a pitched map the move lies in the plane of the map for both anchors.
  vec2 at = a_pos + u_translate / u_scale;
  float h = ground(at / ${EXTENT}.0);
  vec4 c = toClip3(at, h);
  // u_pitch.x: circle-pitch-alignment is 'map', and the circle lies on the map: the offset is in tile units.
  // Otherwise the circle faces the viewer, and the offset is in screen pixels after projection.
  // u_pitch.y: circle-pitch-scale is 'map' (the default), and a distant circle is smaller, as the map under it is.
  // With 'viewport' every circle has the size that it has at the center of the view (as in MapLibre).
  float w = c.w;
  if (u_pitch.x > 0.0) c = toClipTurn(at, v_off * (u_pitch.y > 0.0 ? 1.0 : w / u_cam) / u_scale, h);
  else c.xy += v_off * (u_pitch.y > 0.0 ? u_cam / w : 1.0) * vec2(2.0, -2.0) / u_view * c.w;
  // With 3D terrain a circle is hidden when the ground in front covers its center (lifted by u_lift), as in MapLibre GL
  // JS: u_depth has the depth of the terrain on the screen.
  if (u_lift > 0.0) {
    vec4 d = toClip3D(at, h + u_lift); vec3 n = d.xyz / d.w;
    if (d.w <= 0.0 || n.z * 0.5 + 0.5 > texture(u_depth, n.xy * 0.5 + 0.5).r) inside = false;
  }
  gl_Position = inside ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform vec4 u_color; in vec4 v_color; in vec4 v_stroke; in vec2 v_off; in float v_r; in vec2 v_sb; out vec4 o;
void main() {
  float d = length(v_off), outer = v_r + v_sb.x;
  // As in MapLibre, the antialiased (or blurred) edge sits inside the radius.
  float w = max(v_sb.y * outer, 1.0);
  float a = smoothstep(0.0, w, outer - d), st = v_sb.x < 0.01 ? 0.0 : smoothstep(-w, 0.0, d - v_r);
  vec4 c = v_color * u_color;
  o = a * mix(vec4(c.rgb * c.a, c.a), vec4(v_stroke.rgb * v_stroke.a, v_stroke.a), st);
}`],

    text: [`uniform vec2 u_view; uniform vec2 u_tex;
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; layout(location=2) in vec4 a_halo; layout(location=3) in vec3 a_params;
out vec2 v_uv; out vec4 v_color; out vec4 v_halo; out vec3 v_params;
void main() { v_uv = a_v.zw / u_tex; v_color = a_color; v_halo = a_halo; v_params = a_params;
  vec2 c = a_v.xy / u_view * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`, `
uniform sampler2D u_sdf; uniform bool u_pass; in vec2 v_uv; in vec4 v_color; in vec4 v_halo; in vec3 v_params; out vec4 o;
void main() {
  float d = texture(u_sdf, v_uv).r, g = u_pass ? v_params.z : v_params.y;
  float edge = u_pass ? v_params.x : 0.75;
  vec4 c = u_pass ? v_halo : v_color;
  float a = c.a * smoothstep(edge - g, edge + g, d);
  o = vec4(c.rgb * a, a);
}`],

    // The distance field of glyphs that the canvas drew (#1841), into the texture of the glyph atlas: the same field as
    // a distance transform of the coverage on both sides of the edge (Felzenszwalb and Huttenlocher), found here by a
    // search of the pixels nearby, within the place of the glyph on the canvas (v_box). A pixel 6 or more pixels out,
    // or 2 or more pixels in, has the value 0 or 255, so the search goes no farther. A pixel that is less than half
    // covered looks for the nearest ink, ring by ring, and stops at a ring that cannot be nearer; the others look for
    // the nearest pixel that is not covered.
    glyphSdf: [`uniform vec2 u_size; layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_box; out vec2 v_src; flat out vec4 v_box;
void main() { v_src = a_v.zw; v_box = a_box; gl_Position = vec4(a_v.xy / u_size * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_cov; in vec2 v_src; flat in vec4 v_box; out vec4 o;
ivec2 lo, hi;
float cov(ivec2 q) { return any(lessThan(q, lo)) || any(greaterThan(q, hi)) ? -1.0 : texelFetch(u_cov, q, 0).a; }
void main() {
  ivec2 p = ivec2(floor(v_src));
  lo = ivec2(v_box.xy); hi = ivec2(v_box.zw) - 1;
  float a = cov(p), best = 1e20, dist;
  if (a <= 0.5) {
    if (a > 0.0) best = pow(0.5 - a, 2.0);
    for (int r = 1; r <= 6 && best > float(r * r); r++) for (int i = 0; i < 8 * r; i++) {
      int t = i % (2 * r) - r, side = i / (2 * r);
      ivec2 d = side == 0 ? ivec2(t, -r) : side == 1 ? ivec2(r, t) : side == 2 ? ivec2(-t, r) : ivec2(-r, -t);
      float c = cov(p + d);
      if (c > 0.0) best = min(best, float(d.x * d.x + d.y * d.y) + (c < 1.0 ? pow(max(0.0, 0.5 - c), 2.0) : 0.0));
    }
    dist = sqrt(best);
  } else {
    if (a < 1.0) best = pow(a - 0.5, 2.0);
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
      float c = cov(p + ivec2(x, y));
      if (c >= 0.0 && c < 1.0) best = min(best, float(x * x + y * y) + (c > 0.0 ? pow(max(0.0, c - 0.5), 2.0) : 0.0));
    }
    dist = -sqrt(best);
  }
  o = vec4(clamp(floor(255.5 - 255.0 * (dist / ${SDF_RADIUS}.0 + 0.25)), 0.0, 255.0) / 255.0, 0.0, 0.0, 1.0);
}`],

    // Buildings: roofs and walls with a height in meters and a baked light level.
    extrusion: [`${VS_COMMON} ${TERRAIN_GLSL}
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; layout(location=2) in float a_ed; layout(location=3) in vec2 a_centroid; out vec4 v_color; out vec2 v_p; out float v_side;
uniform mat3 u_pat; uniform float u_hf; uniform float u_pattern; uniform vec3 u_hb; uniform vec4 u_color; uniform vec3 u_lightPos; uniform vec3 u_lightColor; uniform float u_lightIntensity; uniform float u_gradient;
void main() {
  // The light model of MapLibre. A face is brighter when it looks at the light; a dark color is made brighter by
  // more than a light color. Walls are darker near the ground (the vertical gradient).
  bool roof = a_v.w < 0.0; float other = floor(a_v.w / ${WALL_OTHER}.0), rest = a_v.w - other * ${WALL_OTHER}.0, t = rest >= ${WALL_TOP}.0 ? 1.0 : 0.0, angle = rest - t * ${WALL_TOP}.0 - ${Math.PI};
  float base = t > 0.5 ? other : max(a_v.z, 0.0), height = t > 0.5 ? max(a_v.z, 0.0) : other, z = a_v.z;
  // (The height and the base of the layer, when the tile has 1 and 0 for them: see Batch.lift.)
  if (u_hb.x > 0.5) { height = u_hb.y; base = min(u_hb.z, height); z = roof || t > 0.5 ? height : base; }
  vec3 normal = roof ? vec3(0.0, 0.0, 1.0) : vec3(cos(angle), sin(angle), 0.0);
  // fill-extrusion-pattern: the image lies flat on the roof and runs along the ring on the walls, as in MapLibre,
  // and the light alone sets the shade.
  v_p = (u_pat * vec3(roof ? a_v.xy : vec2(a_ed, max(z, 0.0) * u_hf), 1.0)).xy;
  // (As in MapLibre, a translucent color is multiplied by its alpha and then drawn solid; only the opacity of the layer shows through.)
  vec4 c = u_pattern > 0.5 ? vec4(1.0, 1.0, 1.0, u_color.a) : vec4(a_color.rgb * a_color.a * u_color.rgb, u_color.a);
  float value = u_pattern > 0.5 ? 0.5 : dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 rgb = c.rgb + 0.03 * (1.0 - u_pattern);
  float lit = clamp(dot(normal, u_lightPos), 0.0, 1.0);
  lit = mix(1.0 - u_lightIntensity, max(1.0 - value + u_lightIntensity, 1.0), lit);
  if (!roof) lit *= (1.0 - u_gradient) + u_gradient * clamp((t + base) * sqrt(height / 150.0), mix(0.7, 0.98, 1.0 - u_lightIntensity), 1.0);
  v_color = vec4(clamp(rgb * lit * u_lightColor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightColor), vec3(1.0)), c.a);
  v_side = horizonSide(a_v.xy);
  // On 3D terrain the whole polygon stands on the ground at its centroid, and a base of 0 reaches 10 m lower, so that
  // the walls go into a slope (as in MapLibre GL JS).
  gl_Position = toClip3D(a_v.xy, z + ground(a_centroid / ${EXTENT}.0) - (u_exag != 0.0 && !roof && t < 0.5 && z <= 0.0 ? 10.0 : 0.0));
}`, `
uniform float u_pattern; in vec4 v_color; in vec2 v_p; in float v_side; out vec4 o; ${PATTERN_GLSL}
// (Buildings are not cut at the edge of the tile, as in MapLibre GL JS. The piece of a building in the buffer of a tile
// overlaps the piece of the next tile, so where the two pieces stand at different heights on 3D terrain (see the centroid
// in tessellateExtrusion), the higher one hides the step. The depth pass and the stencil draw each pixel once.)
void main() { if (v_side < 0.0) discard; o = u_pattern > 0.5 ? tile(v_p) * vec4(v_color.rgb, 1.0) * v_color.a : vec4(v_color.rgb * v_color.a, v_color.a); }`],

    raster: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; uniform vec2 u_corners[4]; uniform vec4 u_q; uniform float u_blend; uniform vec3 u_fold; out vec3 v_uvq; out vec2 v_tile; out float v_fold;
// A tile fills its square; an image source's picture is stretched between four given corners instead. For a shape
// that is not a parallelogram the picture must be foreshortened as if seen in perspective: each corner carries a
// weight q, and dividing by the interpolated weight in the fragment shader gives the right texture position.
// (On the globe a_pos is in tile units, on the grid of the globe with rows to the poles; see globeGrid.)
void main() {
#ifdef GLOBE
  vec2 ap = clamp(unpole(a_pos) / ${EXTENT}.0, 0.0, 1.0);
#else
#define ap a_pos
#endif
  // A point of the picture is the mix of the corners divided by their weights, so that the grid of the globe follows the
  // perspective too: a straight line of the picture stays straight in Mercator, as in MapLibre GL JS.
  // A strongly foreshortened picture is blended toward the bilinear stretch (u_blend, see cornerWeights). The weight is
  // mixed with the constant u_q.x, the weight of the first corner, so that an unblended picture keeps the exact weight q.
  vec4 w = vec4((1.0 - ap.x) * (1.0 - ap.y), ap.x * (1.0 - ap.y), ap.x * ap.y, (1.0 - ap.x) * ap.y), b = w / u_q;
  float q = 1.0 / (b.x + b.y + b.z + b.w), r = mix(q, u_q.x, u_blend);
  v_uvq = vec3(ap * r, r);
  v_tile = mix((b.x * u_corners[0] + b.y * u_corners[1] + b.z * u_corners[2] + b.w * u_corners[3]) * q,
    w.x * u_corners[0] + w.y * u_corners[1] + w.z * u_corners[2] + w.w * u_corners[3], u_blend);
  v_fold = dot(u_fold, vec3(1.0, ap)); // (see foldOf)
#ifdef GLOBE
  gl_Position = toClip(isPole(a_pos) ? vec2(v_tile.x, a_pos.y) : v_tile);
#else
  gl_Position = toClip(v_tile);
#endif
}`, `
uniform sampler2D u_image; uniform vec4 u_clip; uniform vec3 u_adjust; uniform vec2 u_bright; uniform vec3 u_spin; in vec3 v_uvq; in vec2 v_tile; in float v_fold; out vec4 o;
void main() {
  ${FS_CLIP}
  if (v_fold < 0.0) discard;
  vec4 c = texture(u_image, v_uvq.xy / v_uvq.z);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : c.rgb;
  rgb = vec3(dot(rgb, u_spin.xyz), dot(rgb, u_spin.zxy), dot(rgb, u_spin.yzx));
  rgb += ((rgb.r + rgb.g + rgb.b) / 3.0 - rgb) * u_adjust.y;
  rgb = (rgb - 0.5) * u_adjust.z + 0.5;
  rgb = mix(vec3(u_bright.x), vec3(u_bright.y), rgb);
  o = vec4(rgb * c.a, c.a) * u_adjust.x;
}`],

    // Turns encoded elevation into slope (dz/dx, dz/dy), once per tile, so shading can sample it smoothly.
    demPrepare: [`layout(location=0) in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_dem; uniform float u_zoom; uniform vec4 u_unpack; in vec2 v_uv; out vec4 o;
float elev(ivec2 p, ivec2 size) {
  vec4 c = texelFetch(u_dem, clamp(p, ivec2(0), size - 1) + 2, 0) * 255.0;
  c.a = -1.0;
  return dot(c, u_unpack);
}
void main() {
  // (The slopes are those of the image without its border, which the neighbor tiles fill later.)
  ivec2 size = textureSize(u_dem, 0) - 4, p = ivec2(v_uv * vec2(size));
  float a = elev(p + ivec2(-1, -1), size), b = elev(p + ivec2(0, -1), size), c = elev(p + ivec2(1, -1), size);
  float d = elev(p + ivec2(-1, 0), size), f = elev(p + ivec2(1, 0), size);
  float g = elev(p + ivec2(-1, 1), size), h = elev(p + ivec2(0, 1), size), i = elev(p + ivec2(1, 1), size);
  float factor = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;
  float exaggeration = u_zoom < 15.0 ? (u_zoom - 15.0) * factor : 0.0;
  // Elevation differences over 8 pixel widths; the mercator world is 2^25.2562 meters wide.
  vec2 deriv = vec2((c + f + f + i) - (a + d + d + g), (g + h + h + i) - (a + b + b + c)) * float(size.x) / pow(2.0, exaggeration + (28.2562 - u_zoom));
  // Flat ground is stored as 128/255, which 8 bits hold exactly.
  o = clamp(vec4(deriv / 8.0 + 128.0 / 255.0, 1.0, 1.0), 0.0, 1.0);
}`],

    // The icons of a tile that need no place among the labels (see `IconBatch`). The GPU finds the place of each one
    // from its point in the tile, as for circles. `a_v`: the point, and the corner in the texture. `a_d`: the corner
    // from the center of the icon in pixels at size 1, and 1 for a distance-field icon.
    icon: [`${VS_COMMON}${TERRAIN_GLSL}
layout(location=0) in vec4 a_v; layout(location=1) in vec3 a_d; layout(location=2) in float a_angle; layout(location=3) in vec2 a_size; layout(location=4) in float a_alpha;
uniform float u_zt; uniform float u_size; uniform float u_north; uniform float u_persp; uniform float u_dpr; uniform float u_opacity;
uniform vec2 u_offset; uniform vec2 u_anchor; uniform vec2 u_translate; uniform vec2 u_tex; uniform vec4 u_clip;
out vec2 v_uv; out float v_alpha; out float v_sdf;
void main() {
  vec4 c = toClip3(a_v.xy, ground(a_v.xy / ${EXTENT}.0));
  float s = mix(a_size.x, a_size.y, u_zt) * u_size, a = u_north + a_angle;
  // On a tilted map or the globe, far icons are smaller and near icons are larger, by half of what the perspective does (as for labels).
  if (u_persp > 0.0) s *= min(4.0, 0.5 + 0.5 * u_persp / c.w);
  // (icon-offset and the shift of icon-anchor turn with the icon, as in placeLabels.)
  mat2 turn = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 ext = abs(a_d.xy) * s, centre = (c.xy / c.w * vec2(0.5, -0.5) + 0.5) * u_view + turn * (u_offset + u_anchor * abs(a_d.xy) * 2.0) * s + u_translate;
  // An upright icon is put on whole device pixels: between pixels, the texture filter smears fine detail.
  if (a == 0.0) { vec2 corner = centre - ext; centre += floor(corner * u_dpr + 0.5) / u_dpr - corner; }
  vec2 p = centre + turn * a_d.xy * s;
  v_uv = a_v.zw / u_tex; v_alpha = clamp(a_alpha * u_opacity, 0.0, 1.0); v_sdf = a_d.z;
  bool inside = a_v.x >= u_clip.x && a_v.y >= u_clip.y && a_v.x < u_clip.z && a_v.y < u_clip.w;
  gl_Position = inside && c.w > 0.0 && shown(c) ? vec4((p / u_view * 2.0 - 1.0) * vec2(1.0, -1.0), 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform sampler2D u_img; uniform vec4 u_color; in vec2 v_uv; in float v_alpha; in float v_sdf; out vec4 o;
void main() {
  vec4 t = texture(u_img, v_uv);
  if (v_sdf < 0.5) { o = t * v_alpha; return; }
  float g = max(fwidth(t.a) * 0.7, 0.01), a = smoothstep(0.75 - g, 0.75 + g, t.a) * u_color.a * v_alpha;
  o = vec4(u_color.rgb * a, a);
}`],

    // Icons. A color with alpha >= 0 marks a distance-field icon, drawn in that color with an edge that stays sharp.
    sprite: [`uniform vec2 u_view; uniform vec2 u_tex; layout(location=0) in vec4 a_v; layout(location=1) in float a_alpha; layout(location=2) in vec4 a_color;
out vec2 v_uv; out float v_alpha; out vec4 v_color;
void main() { v_uv = a_v.zw / u_tex; v_alpha = a_alpha; v_color = a_color; vec2 c = a_v.xy / u_view * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`, `
uniform sampler2D u_img; in vec2 v_uv; in float v_alpha; in vec4 v_color; out vec4 o;
void main() {
  vec4 t = texture(u_img, v_uv);
  if (v_color.a < 0.0) { o = t * fract(v_alpha) / 0.999; return; }
  // The whole part of the alpha value is the blur (above 100) and the reach (below 100) of a halo, in hundredths of
  // the distance field; the rest is the opacity.
  float w = floor(v_alpha), reach = mod(w, 100.0) / 100.0, alpha = fract(v_alpha) / 0.999, edge = 0.75 - reach;
  float g = max(fwidth(t.a) * 0.7, 0.01) + floor(w / 100.0) / 100.0, a = smoothstep(edge - g, edge + g, t.a) * v_color.a * alpha;
  o = vec4(v_color.rgb * a, a);
}`],
};

/**
 * The name of a program: a built-in one, `terrain`, which the part for elevation data adds (see terrain.ts), `halo`,
 * the atmosphere of the globe, which the renderer adds from the part of the globe (see `render`), or one of the
 * layer types that the part `layers` adds (see layers-more.ts).
 */
type ProgramName = keyof typeof BUILTIN | 'terrain' | 'halo' | 'heat' | 'heatColor' | 'hillshade' | 'color-relief';
/**
 * The second order of a frame on the globe (see `groundFrame` in placement.ts) at the point (u, v) of a symbol: for
 * x on the screen with k = 0, for y with k = 1. Without it (Mercator, a frame of four numbers, no frame) it is 0.
 */
const second = (q: number[] | undefined, k: number, u: number, v: number) => q && q.length > 4 ? q[4 + k] * u * u + q[6 + k] * u * v + q[8 + k] * v * v : 0;
/** The shaders of each program. The part for elevation data adds the program `terrain` when it loads (#1849), the globe adds `halo`, and the part `layers` adds the programs of its layer types (#2215). */
export const SHADERS: Partial<Record<ProgramName, string[]>> & typeof BUILTIN = BUILTIN;

/** `u` is empty until the program is first used: see `link`. */
/** The matrix of a tile moved by (tx, ty) pixels along the axes of the map (`*-translate`; see `mapTranslate`). */
const moveTile = (it: RenderItem<GLTile>, tx: number, ty: number) => {
    if (!tx && !ty) return it.matrix4;
    const m = Float32Array.from(it.matrix4), x = tx / it.scale, y = ty / it.scale;
    for (let i = 0; i < 4; i++) m[12 + i] += m[i] * x + m[4 + i] * y;
    return m;
};

interface Program { prog: WebGLProgram; u: Record<string, WebGLUniformLocation>; shaders?: WebGLShader[]; /** The globe variant: the frame whose globe it has. */ frame?: number }
/** The programs that have a globe variant (see `GLOBE_GLSL`). */
const GLOBE_PROGRAMS = new Set(['fill', 'pattern', 'edge', 'line', 'circle', 'heat', 'raster', 'hillshade', 'color-relief', 'icon', 'extrusion', 'terrain']);
/** Floats for one corner of an icon: see `a_v` and `a_d` of the `icon` program. */
const ICON_VERTEX = 7;
interface IconBuffers {
    src: IconBatch; vao: WebGLVertexArrayObject; vertices: WebGLBuffer; index: WebGLBuffer; bufs: WebGLBuffer[];
    /** How many indices are for images that were added at runtime, and how many for images of the sprite of the style. They are in that order. */
    counts: [number, number];
    /** An image of an icon was not there when the vertices were made. */
    waits?: boolean;
    /** For each icon: 1 for an image added at runtime, 2 for an image of the sprite, 0 for none. */
    group?: Uint8Array;
    /** The angle of the map for which the indices are sorted from the top of the screen down (`symbol-z-order`), or NaN for the order of the source. */
    angle: number;
    /** The angle of the map in the last frame that drew these icons, and whether no frame has drawn them yet. */
    seen?: number; fresh?: boolean;
}
interface GLBuffers {
    type: GLBatch['type']; vao: WebGLVertexArrayObject; count: number; /** UNSIGNED_SHORT or UNSIGNED_INT. */ indexType: number; color: boolean; scalar: boolean; /** A circle with a buffer of the stroke color (1) or of the stroke width and blur (2) for each feature. */ stroke?: number; bufs: WebGLBuffer[];
    edgeVao?: WebGLVertexArrayObject; edgeCount?: number; pat?: string; /** See `Batch.lift`. */ lift?: boolean;
    /** A heatmap on a globe below zoom 6: each point is a grid of corners in sevenths (see `tessellate`). */ grid?: boolean;
}
export interface GLTile {
    /** Distinguishes this tile's contents from any other's, including an earlier build of the same tile. */
    uid?: number;
    labels: Record<string, LabelSrc[]>; batches: Record<string, GLBuffers>;
    /** The icons that are drawn from buffers of the tile, by layer (see `IconBatch`). */
    icons?: Record<string, IconBuffers>;
    /** The zoom that the sizes of the tile were found at (see `TileIR`). */
    z?: number;
    /** Raster tiles: the image. Elevation tiles: slopes derived from it. */
    tex?: WebGLTexture;
    /** Raster tiles of a tile source: `tex` has mipmaps, and is filtered anisotropically on a pitched map (see `Transform.aniso`). */
    mip?: boolean;
    /** Latitude of the tile's top and bottom edges, for hillshade. */
    lat?: [number, number];
    /** Elevation tiles: the encoded heights as downloaded, their size in pixels and how to decode them. */
    raw?: WebGLTexture; rawSize?: number; unpack?: number[]; /** The elevation image is square, so neighbor tiles can fill its border (see `backfillDem`). */ square?: boolean;
}

/** The part of an elevation tile that lies under some other tile. */
export interface DemRef { tex: WebGLTexture; rect: [number, number, number, number]; unpack: number[] }
/** One tile of the 3D ground: where it is, the flat map view drawn onto it, and the heights that shape it. */
export interface TerrainTile {
    id: TileID; key: string; matrix: Float32Array;
    /** A straight-down view of exactly this tile, and what each source contributes to it. */
    view: Transform; items: Map<string, RenderItem<GLTile>[]>;
    /** Changes whenever the picture on this tile would. */
    signature: string;
    /** The direction of the light in the picture (a step of the map's bearing), for relief that is lit from the viewer's side. */
    light: number;
    /** Whether everything the picture needs has loaded; a finished picture is not replaced by a partial one. */
    complete: boolean;
    /**
     * Ground heights in meters at the corners of a 64 x 64 grid over the tile (65 x 65 values, row by row), and a
     * number that changes when they do. They come from data shared between tiles, so neighbors agree along their edges.
     */
    heights: Float32Array; heightsVersion: number;
    dem: DemRef | null;
}

export interface Scene {
    tr: Transform;
    layers: CompiledLayer[];
    items: Map<string, RenderItem<GLTile>[]>;
    labels: Placed[];
    atlas: GlyphAtlas;
    /** The code of the layer types heatmap, hillshade and color-relief, which loads on demand (layers-more.ts). */
    layerCode?: typeof import('./layers-more.ts');
    /** 3D terrain: the ground tiles to draw, and a lookup of the heights under any tile (for buildings). */
    terrain?: {exaggeration: number; tiles: TerrainTile[]; dem(id: TileID): DemRef | null; /** The code of 3D terrain, which loads on demand (terrain.ts). */ code: typeof import('./terrain.ts')};
    /** The light on buildings. */
    light?: Light;
    /** The sky above the horizon, and the fog on 3D terrain. */
    sky?: Sky;
    /** True while the camera moves. */
    moving?: boolean;
    /** Looks up a sprite or runtime image by name, for patterns. */
    icon?: IconOf;
    /**
     * The globe (#463), when the projection draws one at this zoom: the matrix from the unit sphere to clip space, the
     * plane of the horizon, how much of a globe (1) or of Mercator (0) is drawn, the cosine of the latitude of the
     * center, and the tiles of the background.
     */
    globe?: {m: Float32Array; horizon: number[]; cam: number[]; rays: number[]; t: number; cosLat: number; tiles: TileID[]};
}

/**
 * The values of the `sky` of a style at a zoom, with the defaults of the specification: the colors (premultiplied
 * RGBA) and the blends. Fog has an opacity of 0 below a pitch of 60 that rises to 1 at 70, as in MapLibre GL JS.
 */
/** Whether the light of the style turns with the map (`anchor` is `map`) at a zoom. `anchor` can be a zoom expression (#1699). */
export const lightOnMap = (light: {anchor?: unknown}, zoom: number) => compileProp(light.anchor, 'string', 'viewport').eval(zoom) === 'map';

export function skyValues(sky: Sky, zoom: number, pitch: number) {
    const at = (k: keyof Sky, kind: 'number' | 'color', def: unknown) => compileProp(sky[k], kind, def).eval(zoom) as any;
    return {sky: at('sky-color', 'color', '#88c6fc') as number[], horizon: at('horizon-color', 'color', '#ffffff') as number[], fog: at('fog-color', 'color', '#ffffff') as number[],
        skyBlend: at('sky-horizon-blend', 'number', 0.8) as number, horizonFog: at('horizon-fog-blend', 'number', 0.8) as number, ground: at('fog-ground-blend', 'number', 0.5) as number, atmosphere: at('atmosphere-blend', 'number', 0.8) as number,
        opacity: Math.min(1, Math.max(0, (pitch - 60) / 10))};
}

/** A color without its alpha. */
export const opaque = (c: number[]) => { const a = c[3] || 1; return [c[0] / a, c[1] / a, c[2] / a, 1]; };

export const SPRITE_ATLAS = 2048;
// How the light's direction maps to tile coordinates (y points south) and turns with the bearing.
const LIGHT_X = -1, LIGHT_Y = -1, LIGHT_TURN = 1;

type IconOf = (name: string) => {x: number; y: number; width: number; height: number; pixelRatio: number; custom?: boolean; sdf?: boolean} | undefined;

export class GLRenderer {
    gl: WebGL2RenderingContext;
    /** Empty until the first program is used: see `ready`. */
    private programs: Partial<Record<ProgramName, Program>> = {};
    /** The globe variants of the programs, linked at their first use (a Mercator map never links them). */
    private globePrograms: Partial<Record<ProgramName, Program>> = {};
    /** The globe of the frame that is being drawn, if any (see `Scene.globe`). */
    private globe?: Scene['globe'];
    /** The part of the globe (globe.ts), once a frame has shown the globe: the renderer takes the code of its shaders from it. */
    private globeCode?: typeof import('./globe.ts');
    /** The grid that raster, hillshade and background tiles are drawn on with the globe, in tile units: see `globeGrid`. */
    private globeMesh?: {vao: WebGLVertexArrayObject; main: number; pole: number};
    private quad: WebGLVertexArrayObject;
    /** The grid of an image source that is not convex, in Mercator: see `drawSheet`. */
    private sheet?: WebGLVertexArrayObject;
    private textVao: WebGLVertexArrayObject;
    private textBuf: WebGLBuffer;
    private spriteVao: WebGLVertexArrayObject;
    private spriteBuf: WebGLBuffer;
    private sdfTex: WebGLTexture;
    private sdfVersion = -1;
    /** The resets and the height of the glyph atlas that the texture has (see `glyphs`). */
    private sdfResets = -1;
    private sdfHeight = 0;
    /** The canvas of the glyph atlas as a texture, and the quads that take its glyphs into the atlas. */
    private coverageTex?: WebGLTexture;
    private coverageSize = [0, 0];
    private sdfVao?: WebGLVertexArrayObject;
    private sdfBuf?: WebGLBuffer;
    private spriteTex: WebGLTexture;
    private spriteSized = false;
    /** The width and height of the texture of the images that are added at runtime. */
    private spriteSize = 256;
    private iconTex: WebGLTexture;
    private iconSize: [number, number] = [1, 1];
    private newTexture: () => WebGLTexture;
    private fbo: WebGLFramebuffer;
    private dpr = 1;
    /** The largest anisotropy of a texture filter (EXT_texture_filter_anisotropic), or 0 without the extension. */
    private aniso: number;

    constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, antialias = false) {
        const gl = canvas.getContext('webgl2', {antialias, alpha: true, premultipliedAlpha: true, stencil: true, depth: true}) as WebGL2RenderingContext | null;
        if (!gl) throw new Error('WebGL2 is not available');
        this.gl = gl;
        // (0x84FF is MAX_TEXTURE_MAX_ANISOTROPY_EXT.)
        this.aniso = gl.getExtension('EXT_texture_filter_anisotropic') ? gl.getParameter(0x84FF) : 0;
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

        this.textVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.textVao);
        this.textBuf = buf(null);
        for (const [loc, size, type, norm, off] of [[0, 4, gl.FLOAT, false, 0], [1, 4, gl.UNSIGNED_BYTE, true, 16], [2, 4, gl.UNSIGNED_BYTE, true, 20], [3, 3, gl.FLOAT, false, 24]] as const) {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, type, norm, 36, off);
        }
        this.spriteVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.spriteVao);
        this.spriteBuf = buf(null);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 36, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 36, 16);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
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
        // (The texture of the images that are added at runtime is made with the first image, at 256² (256 KB), and grows: see `moveSprites`.)
        this.spriteTex = tex();
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    }

    /** Starts the compile and the link of a program. Nothing reads its state here, because that would wait for the compile: `ready` does that at the first use of the program. */
    /** `globe`: the code of the globe (`GLOBE_GLSL` of globe.ts), for the variant of a program for the globe. */
    private link(vs: string, fs: string, globe?: string): Program {
        const gl = this.gl, prog = gl.createProgram()!;
        const shaders = ([[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const).map(([type, src]) => {
            const s = gl.createShader(type)!;
            gl.shaderSource(s, HEAD + (globe ? '#define GLOBE\n' + src.replace('GLOBE_GLSL', () => globe) : src));
            gl.compileShader(s);
            gl.attachShader(prog, s);
            return s;
        });
        gl.linkProgram(prog);
        return {prog, u: {}, shaders};
    }

    /** The program `name`, linked, with the locations of its uniforms. */
    private ready(name: ProgramName): Program {
        const gl = this.gl;
        // The shaders compile at the first use of any program, in the first frame, after that frame has requested its
        // tiles (#390): in some browsers (Safari) `compileShader` itself takes time on this thread. All of them start
        // at once, so that the driver can compile them in parallel (KHR_parallel_shader_compile, where it exists).
        if (!this.programs.fill) {
            gl.getExtension('KHR_parallel_shader_compile');
            for (const n in SHADERS) this.programs[n as ProgramName] = this.link(...SHADERS[n as ProgramName]! as [string, string]);
        }
        let p = this.programs[name] ??= this.link(...SHADERS[name]! as [string, string]);
        if (this.globe && GLOBE_PROGRAMS.has(name)) p = this.globePrograms[name] ??= this.link(SHADERS[name]![0], SHADERS[name]![1], this.globeCode!.GLOBE_GLSL);
        const {prog, shaders} = p;
        if (shaders) {
            p.shaders = undefined;
            // (A fault in a shader shows when the program is linked.)
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`Program "${name}": ${gl.getProgramInfoLog(prog)} ${shaders.map(s => gl.getShaderInfoLog(s))}`);
            for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
                const info = gl.getActiveUniform(prog, i)!;
                p.u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name)!; // arrays are reported as "name[0]"
            }
        }
        return p;
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
            // Indices are sent as 16-bit numbers whenever the batch has few enough vertices: half the bytes.
            let vertices = Infinity, indexType: number = gl.UNSIGNED_INT;
            const index = (data: Uint32Array) => {
                const buffer = gl.createBuffer()!;
                bufs.push(buffer);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
                indexType = vertices <= 65536 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, vertices <= 65536 ? new Uint16Array(data) : data, gl.STATIC_DRAW);
            };
            // `Batch.feat`: one float for each bit of `mask`, each at its location of `locs`.
            const feat = (data: Float32Array | undefined, mask = 0, locs: number[]) => {
                if (!data) return;
                const k = locs.filter((_, i) => mask & 1 << i).length;
                let j = 0;
                locs.forEach((loc, i) => { if (mask & 1 << i) attr(loc, data, 1, gl.FLOAT, false, k * 4, j * 4, false, j++ > 0); });
            };
            let count = 0, scalar = false, edgeVao: WebGLVertexArrayObject | undefined;
            if (b.type === 'fill') {
                vertices = b.pos.length / 2;
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
                vertices = b.v.length / 4;
                attr(0, b.v, 4, gl.FLOAT);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.ed) attr(2, b.ed, 1, gl.FLOAT);
                attr(3, b.c, 2, gl.SHORT);
                index(b.idx);
                count = b.idx.length;
            } else if (b.type === 'line') {
                attr(0, b.v, 4, gl.SHORT, false, LINE_VERTEX, 0);
                attr(2, b.v, 1, gl.SHORT, false, LINE_VERTEX, 8, false, true);
                attr(4, b.v, 1, gl.FLOAT, false, LINE_VERTEX, 12, false, true);
                attr(6, b.v, 1, gl.SHORT, false, LINE_VERTEX, 10, false, true);
                vertices = b.v.length / LINE_VERTEX;
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.width) { attr(3, b.width, 1, gl.FLOAT); scalar = true; if (b.width1) attr(5, b.width1, 1, gl.FLOAT); else attr(5, b.width, 1, gl.FLOAT, false, 0, 0, false, true); }
                // line-blur and line-gap-width for each feature (without them the attribute is off and reads 0, and the
                // uniforms u_blur and u_gap have the values), and the changes to the next zoom.
                feat(b.feat, b.featMask, [7, 8, 9, 10, 11]);
                index(b.idx);
                count = b.idx.length;
            } else {
                vertices = b.pos.length / 4;
                attr(2, b.pos, 2, gl.SHORT, false, 8, 0);
                attr(0, b.pos, 2, gl.SHORT, false, 8, 4, false, true);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.radius) { attr(3, b.radius, 1, gl.FLOAT); scalar = true; if (b.radius1) attr(5, b.radius1, 1, gl.FLOAT); else attr(5, b.radius, 1, gl.FLOAT, false, 0, 0, false, true); }
                // The stroke at the next zoom is the same buffer when it does not change.
                if (b.stroke) { attr(4, b.stroke, 4, gl.UNSIGNED_BYTE, true); attr(10, b.stroke1 ?? b.stroke, 4, gl.UNSIGNED_BYTE, true, 0, 0, false, !b.stroke1); }
                if (b.sb) attr(6, b.sb, 2, gl.FLOAT);
                feat(b.feat, b.featMask, [9, 11]);
                index(b.idx);
                count = b.idx.length;
            }
            batches[id] = {type: b.type, vao, count, indexType, color: !!b.color, scalar, stroke: b.type === 'circle' ? (b.stroke ? 1 : 0) | (b.sb ? 2 : 0) : 0, bufs, edgeVao, edgeCount: b.type === 'fill' ? b.edges?.length : undefined, pat: b.pat, grid: b.type === 'circle' && b.grid, lift: b.type === 'extrusion' && b.lift};
        }
        let icons: Record<string, IconBuffers> | undefined;
        for (const id in t.icons) {
            const src = t.icons[id], vao = gl.createVertexArray()!, vertices = gl.createBuffer()!, index = gl.createBuffer()!, bufs = [vertices, index];
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
            gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, ICON_VERTEX * 4, 0);
            gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, ICON_VERTEX * 4, 16);
            // A value for each feature: the same for the four corners of its icon.
            [src.rotate, src.size, src.alpha].forEach((values, i) => {
                if (!values) return;
                const size = i === 1 ? 2 : 1, data = new Float32Array(values.length * 4), buffer = gl.createBuffer()!;
                for (let k = 0; k < data.length; k++) data[k] = values[Math.floor(k / (size * 4)) * size + k % size];
                bufs.push(buffer);
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(2 + i); gl.vertexAttribPointer(2 + i, size, gl.FLOAT, false, 0, 0);
            });
            (icons ??= {})[id] = {src, vao, vertices, index, bufs, counts: [0, 0], angle: NaN, fresh: true};
            this.fillIcons(icons[id]);
        }
        gl.bindVertexArray(null);
        return {uid: ++this.uids, labels: t.labels, batches, icons, z: t.z};
    }

    /** Finds an image by name when the icons of a tile are made. The engine sets it. */
    iconOf?: IconOf;
    /** Icons of a buffer kept their old order in the last frame, because the map turned: the next frame sorts them (see `drawIcons`). */
    iconsBehind = false;
    /** A raster tile was drawn while it fades in (`raster-fade-duration`): the frame after it is wanted. */
    private fading = false;
    /** The icons of a tile again, after the images of the map changed: an image came, went or has another place in its texture. */
    refreshIcons(t: GLTile, all: boolean) { for (const b of Object.values(t.icons ?? {})) if (all || b.waits) this.fillIcons(b); this.gl.bindVertexArray(null); }
    /** Writes the corners of each icon for the images that the map has now. An icon whose image is not there is not drawn. */
    private fillIcons(b: IconBuffers) {
        const gl = this.gl, {names, name, pos} = b.src, n = name.length, images = names.map(nm => this.iconOf?.(nm));
        const v = new Float32Array(n * 4 * ICON_VERTEX), group = b.group = new Uint8Array(n);
        b.waits = images.includes(undefined);
        for (let i = 0; i < n; i++) {
            const m = images[name[i]];
            if (!m) continue;
            group[i] = m.custom ? 1 : 2;
            const w = m.width / m.pixelRatio, h = m.height / m.pixelRatio, o = i * 4;
            for (let k = 0; k < 4; k++) {
                const cx = k & 1, cy = k >> 1;
                v.set([pos[i * 2], pos[i * 2 + 1], m.x + cx * m.width, m.y + cy * m.height, (cx - 0.5) * w, (cy - 0.5) * h, m.sdf ? 1 : 0], (o + k) * ICON_VERTEX);
            }
        }
        gl.bindVertexArray(b.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
        this.indexIcons(b, b.angle);
    }
    /**
     * Writes the indices of the icons: in the order of the source, or (for a number `angle`, the angle of the map in
     * radians) from the top of the screen down, so that a lower icon covers a higher one, as `symbol-z-order` asks
     * (as in MapLibre GL JS, by the turned y in the tile; equal ones with the later feature first).
     */
    private indexIcons(b: IconBuffers, angle: number) {
        const gl = this.gl, {pos} = b.src, group = b.group!, n = group.length, idx = new Uint32Array(n * 6);
        let order = Uint32Array.from({length: n}, (_, i) => i);
        if (!Number.isNaN(angle)) {
            // (One number for each icon, its turned y and then its index backwards, sorts fast: the map turns 100,000 icons.)
            const sin = Math.sin(angle), cos = Math.cos(angle), keys = new Float64Array(n);
            for (let i = 0; i < n; i++) keys[i] = Math.round(sin * pos[i * 2] + cos * pos[i * 2 + 1]) * 2 ** 21 + (2 ** 21 - 1 - i);
            keys.sort();
            order = Uint32Array.from(keys, k => 2 ** 21 - 1 - (k - Math.floor(k / 2 ** 21) * 2 ** 21));
        }
        let count = 0;
        b.counts = [0, 0];
        b.angle = angle;
        for (const g of [1, 2]) {
            for (const i of order) {
                if (group[i] !== g) continue;
                const o = i * 4;
                idx.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], count);
                count += 6;
            }
            if (g === 1) b.counts[0] = count; else b.counts[1] = count - b.counts[0];
        }
        gl.bindVertexArray(b.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, count), gl.DYNAMIC_DRAW);
    }

    /**
     * Draws the icons of the layers `from` to `to` (not `to` itself) that the tiles have in buffers. With 3D terrain an
     * icon stands on the ground, and ground in front of it does not hide it.
     */
    private drawIcons(s: Scene, tr: Transform, from: number, to: number) {
        const gl = this.gl, zoom = tr.zoom;
        for (let li = from; li < to; li++) {
            const L = s.layers[li];
            if (L.type !== 'symbol' || !L.visible || zoom < L.minzoom || zoom >= L.maxzoom) continue;
            let u: Record<string, WebGLUniformLocation> | undefined;
            // icon-translate moves the point by tile units before it is projected, as in MapLibre GL JS (#2021).
            const move = mapTranslate(L.p.iconTranslate.eval(zoom), L.p.iconTranslateAnchor.eval(zoom), tr.bearing);
            for (const it of s.items.get(L.source!) ?? []) {
                const b = it.tile.icons?.[L.id];
                if (!b || !(b.counts[0] + b.counts[1])) continue;
                const p = L.p;
                // (`symbol-z-order`: these icons may overlap and the layer has no `symbol-sort-key`, so `auto` and
                // `viewport-y` draw them from the top of the screen down, as `placeLabels` does for placed symbols.)
                const angle = p.zOrder.eval(zoom) === 'source' ? NaN : -tr.bearing * Math.PI / 180;
                // (While the map turns, the icons keep their order: it is found again in the first frame in which the
                // angle is the same as in the frame before, so that a frame of a turn does not sort 100,000 icons.)
                const differs = Number.isNaN(angle) !== Number.isNaN(b.angle) || Math.abs(angle - b.angle) > 1e-6;
                if (differs && (b.fresh || Object.is(angle, b.seen))) this.indexIcons(b, angle); else if (differs) this.iconsBehind = true;
                b.fresh = false; b.seen = angle;
                if (!u) {
                    u = this.use('icon', tr);
                    const anchor = p.iconAnchor.eval(zoom) as string, offset = p.iconOffset.eval(zoom) as number[], translate = [0, 0], color = p.iconColor.eval(zoom) as number[];
                    gl.uniform1f(u.u_size, p.iconSize.dd ? 1 : p.iconSize.eval(zoom));
                    gl.uniform1f(u.u_opacity, p.iconOpacity.dd ? 1 : p.iconOpacity.eval(zoom));
                    // (`icon-rotation-alignment`: an icon that is aligned with the map turns with the map.)
                    gl.uniform1f(u.u_north, p.iconAlign.eval(zoom) === 'map' ? -tr.bearing * Math.PI / 180 : 0);
                    // (A layer with `icon-offset` has no perspective ratio: see `CompiledLayer.fixedSize`.)
                    gl.uniform1f(u.u_persp, (tr.pitch || tr.globeness) && !L.fixedSize ? tr.cameraDistance : 0);
                    gl.uniform1f(u.u_dpr, this.dpr);
                    gl.uniform2f(u.u_offset, offset[0], offset[1]);
                    gl.uniform2f(u.u_anchor, anchor.includes('left') ? 0.5 : anchor.includes('right') ? -0.5 : 0, anchor.includes('top') ? 0.5 : anchor.includes('bottom') ? -0.5 : 0);
                    gl.uniform2f(u.u_translate, translate[0], translate[1]);
                    gl.uniform4f(u.u_color, color[0], color[1], color[2], color[3]);
                    gl.uniform1i(u.u_img, 0);
                }
                this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                this.placeTile(u, it.id, moveTile(it, move[0], move[1]), [move[0] / it.scale, move[1] / it.scale]);
                gl.uniform4fv(u.u_clip, it.clip);
                gl.uniform1f(u.u_zt, Math.min(1, Math.max(0, zoom - (it.tile.z ?? it.id.z))));
                gl.bindVertexArray(b.vao);
                // (An attribute without a buffer reads these values: the layer has one value for all its icons.)
                if (!b.src.rotate) gl.vertexAttrib1f(2, p.iconRotate.eval(zoom) * Math.PI / 180);
                if (!b.src.size) gl.vertexAttrib2f(3, 1, 1);
                if (!b.src.alpha) gl.vertexAttrib1f(4, 1);
                gl.activeTexture(gl.TEXTURE0);
                // Images that were added at runtime and images of the sprite of the style are in two textures.
                [[this.spriteTex, this.spriteSize, this.spriteSize], [this.iconTex, this.iconSize[0], this.iconSize[1]]].forEach(([tex, w, h], g) => {
                    if (!b.counts[g]) return;
                    gl.bindTexture(gl.TEXTURE_2D, tex as WebGLTexture);
                    gl.uniform2f(u!.u_tex, w as number, h as number);
                    gl.drawElements(gl.TRIANGLES, b.counts[g], gl.UNSIGNED_INT, g ? b.counts[0] * 4 : 0);
                });
            }
        }
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

    /**
     * Wraps a decoded raster or elevation tile image as a drawable tile. With `into` (a tile of a video or canvas source),
     * the image is a new frame that replaces the picture of that tile in its own texture. With `mip` (the tiles of a raster
     * source, as in MapLibre GL JS) the texture gets mipmaps.
     */
    createImageTile(image: ImageBitmap | {width: number; height: number; data: Uint8Array}, encoding: DemEncoding | undefined, id: TileID, into?: GLTile, mip?: boolean): GLTile {
        const dem = !!encoding;
        const gl = this.gl, tex = into ? into.tex! : this.newTexture();
        if (into) gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !dem);
        // (Elevation tiles arrive as plain pixels, which a tile worker decoded. They get a border, see `padDem`.)
        if (dem && 'data' in image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width + 4, image.height + 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, padDem(image.width, image.height, image.data));
        else if ('data' in image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (into) return into;
        if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST); }
        const tile: GLTile = {uid: ++this.uids, labels: {}, batches: {}, tex, mip};
        if (dem) {
            const n = 2 ** id.z, slopes = this.newTexture(), u = this.ready('demPrepare');
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
            gl.uniform4fv(u.u.u_unpack, tile.unpack = demUnpack(encoding!));
            gl.bindVertexArray(this.quad);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            tile.raw = tex; tile.rawSize = image.width; tile.square = image.width === image.height;
            tile.tex = slopes;
            tile.lat = [latFromMerc(id.y / n), latFromMerc((id.y + 1) / n)];
        }
        return tile;
    }

    /**
     * Copies the edge of the elevation tile `from`, the neighbor at (dx, dy) of `to` (each -1, 0 or 1), into the border
     * of `to`, as MapLibre GL JS does (`backfillBorder`). The heights of `to` then go on past its edge.
     */
    backfillDem(to: GLTile, from: GLTile, dx: number, dy: number) {
        const gl = this.gl, d = to.rawSize!;
        if (!to.square || !from.square || from.rawSize !== d) return;
        const x = dx < 0 ? 0 : dx ? d + 2 : 2, y = dy < 0 ? 0 : dy ? d + 2 : 2;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, from.raw!, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, to.raw!);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, x, y, x - dx * d, y - dy * d, dx ? 2 : d, dy ? 2 : d);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    destroyTile(t: GLTile) {
        if (t.tex) this.gl.deleteTexture(t.tex);
        if (t.raw) this.gl.deleteTexture(t.raw);
        for (const b of Object.values(t.batches)) {
            this.gl.deleteVertexArray(b.vao);
            if (b.edgeVao) this.gl.deleteVertexArray(b.edgeVao);
            for (const buf of b.bufs) this.gl.deleteBuffer(buf);
        }
        for (const b of Object.values(t.icons ?? {})) { this.gl.deleteVertexArray(b.vao); for (const buf of b.bufs) this.gl.deleteBuffer(buf); }
    }

    /** Copies premultiplied RGBA pixels for one image into the texture of the images that are added at runtime. */
    uploadSprite(x: number, y: number, w: number, h: number, pixels: Uint8Array, edges = true) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.spriteTex);
        if (!this.spriteSized) { this.spriteSized = true; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.spriteSize, this.spriteSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        // (The empty pixel to the right and below may hold an image that was there before: a filtered edge must not read it.
        // An image that is updated in its own place cleared it when it was added.)
        if (!edges) return;
        const zero = new Uint8Array(4 * (Math.max(w, h) + 1));
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x + w, y, 1, h + 1, gl.RGBA, gl.UNSIGNED_BYTE, zero);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y + h, w, 1, gl.RGBA, gl.UNSIGNED_BYTE, zero);
    }

    /** Moves images to new places in a new texture of the runtime images, each move [x, y, new x, new y, w, h], on the GPU. */
    moveSprites(moves: number[][], size: number) {
        const gl = this.gl, old = this.spriteTex, fb = gl.createFramebuffer(), back = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        this.spriteTex = this.newTexture();
        this.spriteSized = true;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.spriteSize = size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, old, 0);
        for (const [x, y, nx, ny, w, h] of moves) gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, nx, ny, x, y, w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, back);
        gl.deleteFramebuffer(fb);
        gl.deleteTexture(old);
    }

    /**
     * Draws the style's layers (not labels) for one view: the whole map, or with 3D terrain either the flat layers
     * of one ground tile ('ground') or just the buildings standing on it ('buildings').
     */
    private layerTarget?: {fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number};
    private belowTex?: WebGLTexture;
    /** Draws a layer of the type "custom" of the compat entry, and restores the GL state after it (custom-layers.ts sets it). */
    custom?: (id: string, s: Scene) => void;

    /** Draws the layers other than symbol layers, or only `only`, or the layers `from` to `to` (not `to` itself). */
    private drawLayers(s: Scene, tr: Transform, bySource: Map<string, RenderItem<GLTile>[]>, target: [number, number], pass: 'all' | 'ground' | 'buildings', only?: CompiledLayer, from = 0, to = s.layers.length) {
        const gl = this.gl, zoom = tr.zoom;
        this.current = null;
        const use = (name: ProgramName) => this.use(name, tr);
        const color = (L: CompiledLayer) => {
            const c = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom), op = L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom);
            return [c[0], c[1], c[2], c[3] * op];
        };

        // Selects the pattern program for an image; returns a function that positions the pattern, or null if the image is missing.
        const Z = Math.floor(zoom), fade = zoom - Z;
        const pattern = (name: string, opacity: number, sdfColor?: number[]) => {
            const img = s.icon?.(name);
            if (!img) return null;
            const u = use('pattern');
            bindImage(u, img);
            gl.uniform2f(u.u_fade, 0, opacity);
            gl.uniform1f(u.u_sdf, sdfColor && img.sdf ? 1 : 0);
            gl.uniform2f(u.u_world, 0, 0);
            if (sdfColor) gl.uniform4fv(u.u_color, sdfColor);
            gl.vertexAttrib4f(1, 1, 1, 1, 1);
            /** `m` maps the drawn coordinates to world pixels at zoom Z (column-major 3x3). */
            return (m: number[]) => {
                gl.uniformMatrix3fv(u.u_pat, false, patMatrix(img, m));
                return u;
            };
        };
        const bindImage = (u: Record<string, WebGLUniformLocation>, img: NonNullable<ReturnType<NonNullable<typeof s.icon>>>) => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, img.custom ? this.spriteTex : this.iconTex);
            gl.uniform1i(u.u_img, 0);
            gl.uniform2f(u.u_tex, img.custom ? this.spriteSize : this.iconSize[0], img.custom ? this.spriteSize : this.iconSize[1]);
            gl.uniform4f(u.u_rect, img.x, img.y, img.width, img.height);
        };
        /** Maps tile coordinates to units of the image; `m` maps them to world pixels at zoom Z (column-major 3x3). */
        const patMatrix = (img: {width: number; height: number; pixelRatio: number}, m: number[]) => {
            const pw = img.width / img.pixelRatio, ph = img.height / img.pixelRatio, fr = (v: number) => v - Math.floor(v);
            return [m[0] / pw, m[1] / ph, 0, m[3] / pw, m[4] / ph, 0, fr(m[6] / pw), fr(m[7] / ph), 1];
        };
        const tilePixels = (id: {x: number; y: number; z: number}) => {
            const px = 512 * 2 ** (Z - id.z);
            return [px / EXTENT, 0, 0, 0, px / EXTENT, 0, id.x * px, id.y * px, 1];
        };

        /** The batches of a layer in a tile: more than one when its pattern has a value for each feature (see `patternKey`). */
        const parts = (it: RenderItem<GLTile>, id: string) => {
            const r: GLBuffers[] = [];
            for (let k = 0, b; (b = it.tile.batches[patternKey(id, k)]); k++) r.push(b);
            return r;
        };

        for (const L of only ? [only] : s.layers.slice(from, to)) {
            if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
            // (A custom layer draws on the screen, also with 3D terrain and on the globe, and not on the pictures of the
            // terrain tiles. On the globe it gets the matrices of the globe, #1431.)
            if (L.type === 'custom') { if (pass !== 'ground') { this.custom?.(L.id, s); this.current = null; } continue; }
            // (The code of the layer types heatmap, hillshade and color-relief loads on demand: until it is there, they are not drawn.)
            if (L.type === 'heatmap') { if (pass !== 'buildings') s.layerCode?.drawHeatmap.call(this, L, tr, bySource.get(L.source!) ?? [], target); continue; }
            if (!only && (L.type === 'fill' || L.type === 'line' || L.type === 'raster') && pass !== 'buildings') {
                // Layer-wide opacity and blending: the layer is drawn on its own first, so that overlapping features
                // form one surface, and that surface is then put onto the map once.
                const opacity = L.p.layerOpacity?.eval(zoom) ?? 1, blend = L.p.layerBlend.eval(zoom) as string;
                if (opacity < 1 || blend !== 'normal') {
                    if (opacity > 0) this.compositeLayer(s, tr, bySource, target, pass, L, opacity, blend);
                    continue;
                }
            }
            if ((L.type === 'fill-extrusion' || L.type === 'circle' && !!s.terrain) !== (pass === 'buildings') && pass !== 'all') continue;
            if (L.type === 'background' && this.globe && pass === 'all') {
                // On the globe the background covers the sphere, tile by tile, and not the whole canvas.
                const name = L.p.pattern.eval(zoom), place = name != null ? pattern(name, L.p.opacity.eval(zoom)) : null;
                if (name != null && !place) continue;
                const u = place ? undefined : use('fill');
                if (u) { gl.vertexAttrib4f(1, 1, 1, 1, 1); gl.uniform4fv(u.u_color, color(L)); }
                gl.bindVertexArray(this.globeGrid().vao);
                for (const id of this.globe.tiles) {
                    const px = 512 * 2 ** (Z - id.z), uu = u ?? place!([px / EXTENT, 0, 0, 0, px / EXTENT, 0, id.x * px, id.y * px, 1]);
                    this.placeTile(uu, id, tr.tileMatrix4(id));
                    gl.uniform4f(uu.u_clip, 0, 0, EXTENT, EXTENT);
                    this.drawGrid(id);
                }
                continue;
            }
            // A background-pattern that is set but names no image (also "") draws nothing; only an unset one draws the color.
            if (L.type === 'background' && L.p.pattern.eval(zoom) != null) {
                const place = pattern(L.p.pattern.eval(zoom), L.p.opacity.eval(zoom));
                if (!place) continue;
                // Screen position -> world pixels at zoom Z, about the map center (pitch is ignored for backgrounds).
                const k = 2 ** -fade, b = tr.bearing * Math.PI / 180, cos = Math.cos(b) * k, sin = Math.sin(b) * k, w = tr.width, h = tr.height;
                const cx = mercX(tr.lng) * 512 * 2 ** Z, cy = mercY(tr.lat) * 512 * 2 ** Z;
                const u = place([cos * w, sin * w, 0, -sin * h, cos * h, 0, cx - (cos * w - sin * h) / 2, cy - (sin * w + cos * h) / 2, 1]);
                gl.bindVertexArray(this.quad);
                gl.uniformMatrix4fv(u.u_matrix, false, [2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]);
                gl.uniform4f(u.u_clip, -1, -1, 2, 2);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                continue;
            }
            if (L.type === 'background') {
                const u = use('fill');
                gl.bindVertexArray(this.quad);
                gl.vertexAttrib4f(1, 1, 1, 1, 1);
                // Unit square -> the screen below the horizon (all of it unless the pitch is high), or above the line of
                // `underside` when the camera is below the ground.
                const under = tr.globeness ? null : tr.underside();
                const top = under !== null ? 1 : tr.globeness ? 1 : Math.min(1, 1 - 2 * (tr.cy - tr.groundTop()) / tr.height);
                const bottom = under !== null ? Math.max(-1, 1 - 2 * (tr.cy + under) / tr.height) : -1;
                gl.uniformMatrix4fv(u.u_matrix, false, [2, 0, 0, 0, 0, bottom - top, 0, 0, 0, 0, 1, 0, -1, top, 0, 1]);
                gl.uniform4f(u.u_clip, -1, -1, 2, 2);
                gl.uniform4fv(u.u_color, color(L));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                continue;
            }
            const items = bySource.get(L.source!);
            if (!items) continue;
            if (L.type === 'raster' || L.type === 'hillshade' || L.type === 'color-relief') {
                if (L.type !== 'raster' && !s.layerCode) continue;
                const u = use(L.type), p = L.p;
                gl.activeTexture(gl.TEXTURE0);
                gl.uniform1i(u.u_image, 0);
                gl.bindVertexArray(this.globe ? this.globeGrid().vao : this.quad);
                // `raster-resampling` (or `resampling`): the filter of the texture, set before each tile is drawn.
                const filter = (p.resampling.eval(zoom) ?? p.rasterResampling?.eval(zoom)) === 'nearest' ? gl.NEAREST : gl.LINEAR;
                // `raster-fade-duration`: a tile that has just arrived fades in over the tiles that stand in below it (see `fadeIn` in engine.ts).
                const fadeMs = L.type === 'raster' ? p.fadeDuration.eval(zoom) : 0, now = fadeMs > 0 ? performance.now() : 0;
                let adjust: ((o: number) => void) | undefined, last = 1;
                if (L.type === 'raster') {
                    const sat = p.saturation.eval(zoom), con = p.contrast.eval(zoom), op = p.opacity.eval(zoom);
                    adjust = o => gl.uniform3f(u.u_adjust, op * o, sat > 0 ? 1 - 1 / (1.001 - sat) : -sat, con > 0 ? 1 / (1 - con) : 1 + con);
                    adjust(1);
                    gl.uniform2f(u.u_bright, p.brightnessMin.eval(zoom), p.brightnessMax.eval(zoom));
                    const h = p.hueRotate.eval(zoom) * Math.PI / 180, sn = Math.sin(h), cs = Math.cos(h);
                    gl.uniform3f(u.u_spin, (2 * cs + 1) / 3, (-Math.sqrt(3) * sn - cs + 1) / 3, (Math.sqrt(3) * sn - cs + 1) / 3);
                } else s.layerCode!.demUniforms.call(this, L, u, zoom, s.tr.bearing);
                // A map at rest, at any pitch: the image (raster, hillshade or color-relief) moves by less than a pixel, so that its pixels are on the pixels of
                // the screen. An image between the pixels is blurred. The rule is that of MapLibre GL JS: the center of the
                // map goes to a whole pixel of the world (to a half pixel when the size of the map is odd).
                let snap: number[] | undefined;
                for (const it of items) {
                    if (!it.tile.tex || it.under && !(fadeMs > 0)) continue;
                    const o = it.born !== undefined && fadeMs > 0 ? Math.min(1, Math.max(0, (now - it.born) / fadeMs)) : 1;
                    if (o < 1) this.fading = true;
                    if (o !== last) { adjust!(o); last = o; }
                    let m = it.matrix4;
                    if (pass === 'all' && !s.moving && !this.globe) {
                        const a = -tr.bearing * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), xs = tr.width % 2 / 2, ys = tr.height % 2 / 2;
                        snap ??= [mercX(tr.lng) * tr.worldSize + cos * xs + sin * ys, mercY(tr.lat) * tr.worldSize + cos * ys + sin * xs].map(v => (v -= Math.round(v)) > 0.5 ? v - 1 : v);
                        const x = snap[0] / it.scale, y = snap[1] / it.scale;
                        m = m.slice(); m[12] += m[0] * x + m[4] * y; m[13] += m[1] * x + m[5] * y;
                    }
                    this.placeTile(u, it.id, m);
                    gl.uniform4fv(u.u_clip, it.clip);
                    if (it.tile.lat) gl.uniform2fv(u.u_latrange, it.tile.lat);
                    const q = it.corners ? cornerWeights(it.corners) : ONES;
                    if (L.type === 'raster') { gl.uniform2fv(u.u_corners, it.corners ?? SQUARE); gl.uniform4fv(u.u_q, (q ?? ONES).slice(0, 4)); gl.uniform1f(u.u_blend, (q ?? ONES)[4]); gl.uniform3fv(u.u_fold, q ? FLAT : foldOf(it.corners!)); }
                    if (L.relief) gl.uniform4fv(u.u_unpack, it.tile.unpack!);
                    gl.bindTexture(gl.TEXTURE_2D, L.relief ? it.tile.raw! : it.tile.tex);
                    // Above the pitch of `setAnisotropicFilterPitch` (20 by default), a tile of a raster source is filtered
                    // anisotropically, as in MapLibre GL JS: the far part of the map is sharper. (0x84FE is TEXTURE_MAX_ANISOTROPY_EXT.)
                    if (it.tile.mip && this.aniso) gl.texParameterf(gl.TEXTURE_2D, 0x84FE, tr.pitch > tr.aniso ? this.aniso : 1);
                    withFilter(gl, filter, () => this.globe ? this.drawGrid(it.id, !it.corners) : q && !q[4] ? gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4) : this.drawSheet(), it.tile.mip ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR);
                }
                continue;
            }
            // fill-translate, line-translate and fill-extrusion-translate move the layer by screen pixels. The anchor
            // says if the direction turns with the map (the default) or stays fixed on the screen.
            const [tx, ty] = L.type === 'fill' || L.type === 'line' || L.type === 'fill-extrusion' ? mapTranslate(L.p.translate.eval(zoom), L.p.translateAnchor.eval(zoom), tr.bearing) : [0, 0];
            const moved = (it: RenderItem<GLTile>) => moveTile(it, tx, ty);
            // On the globe the shaders take the point on the sphere from the tile position, so the tile is moved there
            // too, by the same tile units (MapLibre GL JS adds the translation to the position before projectTile).
            const shift = (it: RenderItem<GLTile>) => tx || ty ? [tx / it.scale, ty / it.scale] : undefined;
            const patterned = L.type === 'fill' && !!(L.p.pattern.dd || L.p.pattern.eval(zoom));
            if (patterned) {
                // The fills of all batches first, then the edges in the pattern, unless the style has an outline color
                // (drawn by the edge pass below). As in MapLibre GL JS, a later batch does not cover the edges of an earlier one.
                const own = L.p.outline.eval(zoom)[3] <= 0;
                for (const edges of own ? [false, true] : [false]) for (const it of items) for (const b of parts(it, L.id)) {
                    if (edges && !b.edgeVao) continue;
                    // (fill-opacity is in u_fade.y; fill-color colors a distance-field image.)
                    const c = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom);
                    const place = pattern(b.pat ?? L.p.pattern.eval(zoom), L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom), c);
                    if (!place) continue;
                    const u = place(tilePixels(it.id));
                    this.placeTile(u, it.id, moved(it), shift(it));
                    gl.uniform4fv(u.u_clip, it.clip);
                    if (edges) gl.uniform2f(u.u_world, target[0], target[1]);
                    gl.bindVertexArray(edges ? b.edgeVao! : b.vao);
                    gl.drawElements(edges ? gl.LINES : gl.TRIANGLES, edges ? b.edgeCount! : b.count, b.indexType, 0);
                }
                if (own) continue;
            }
            let first = true, screen: number[] | undefined;
            // Buildings are the one layer that needs depth sorting; everything else is painted back to front.
            const extrude = L.type === 'fill-extrusion', pending: (() => void)[] = [], hb = extrude ? [L.p.height, L.p.base].map(q => q.dd ? 0 : Math.max(0, q.eval(zoom))) : [];
            let patImg: Parameters<typeof bindImage>[1] | undefined;
            if (extrude) {
                // The fill-extrusion layers of a frame share one depth buffer, as in MapLibre GL JS, so the roof of one
                // layer hides the lower part of a building in a later layer. On 3D terrain the ground's depth is kept
                // too, so hills hide the buildings behind them.
                gl.clear(s.terrain || this.extrusionDepth ? gl.STENCIL_BUFFER_BIT : gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
                this.extrusionDepth = true;
                gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
                // Only the front faces are drawn, as in MapLibre GL JS: the inside of a wall that floats above the ground
                // of 3D terrain does not show (#2341). The roof and the outside of each wall wind clockwise on the screen
                // (see tessellateExtrusion), so the faces that WebGL calls front faces are the ones left out.
                gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
            }
            draw: for (const it of patterned ? [] : items) for (const b of parts(it, L.id)) {
                const u = use(b.type), m = moved(it), sh = shift(it);
                if (extrude || b.type === 'circle' && s.terrain) this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                if (first) {
                    first = false;
                    gl.uniform4fv(u.u_color, color(L));
                    if (extrude) {
                        // The position of the light is a distance, an azimuth and a polar angle. With the `viewport`
                        // anchor (the default) the light turns with the view; with `map` it stays at one compass direction.
                        // (The values of the light can be functions of zoom.)
                        const light = s.light ?? {}, at = (v: unknown, kind: 'number' | 'color' | 'string', def: unknown) => compileProp(v, kind, def).eval(zoom);
                        const [r, az, polar] = at(light.position, 'string', [1.15, 210, 30]) as number[], lc = at(light.color, 'color', '#fff') as number[];
                        const a = (az + 90) * Math.PI / 180 + (lightOnMap(light, zoom) ? 0 : LIGHT_TURN * tr.bearing * Math.PI / 180), p = polar * Math.PI / 180;
                        gl.uniform3f(u.u_lightPos, LIGHT_X * r * Math.cos(a) * Math.sin(p), LIGHT_Y * r * Math.sin(a) * Math.sin(p), r * Math.cos(p));
                        gl.uniform3f(u.u_lightColor, lc[0], lc[1], lc[2]);
                        gl.uniform1f(u.u_lightIntensity, at(light.intensity, 'number', 0.5) as number);
                        gl.uniform1f(u.u_gradient, L.p.gradient.eval(zoom) === false ? 0 : 1);
                        const base = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom);
                        gl.uniform4f(u.u_color, base[0] * base[3], base[1] * base[3], base[2] * base[3], L.p.opacity.eval(zoom));
                        // fill-extrusion-pattern: nothing is drawn while the image is not available. A pattern for each
                        // feature has a batch for each image (see `patternKey`).
                        const name = L.p.pattern.dd ? '' : L.p.pattern.eval(zoom), img = name ? s.icon?.(name) : undefined;
                        if (name && !img) { first = true; break draw; }
                        gl.uniform1f(u.u_pattern, img || L.p.pattern.dd ? 1 : 0);
                        if (img) { bindImage(u, img); patImg = img; }
                    }
                    if (b.type === 'line') {
                        const dash = L.p.dash.eval(zoom) as number[] | null;
                        gl.uniform1f(u.u_width, L.p.width.dd ? 1 : L.p.width.eval(zoom));
                        gl.uniform1f(u.u_dpr, this.dpr);
                        gl.uniform1f(u.u_floorWidth, L.p.width.dd ? 1 : L.p.width.eval(Math.floor(zoom)));
                        gl.uniform1f(u.u_gap, L.p.gap.dd ? 0 : L.p.gap.eval(zoom));
                        gl.uniform1f(u.u_offset, L.p.offset.dd ? 0 : L.p.offset.eval(zoom));
                        gl.uniform1f(u.u_blur, L.p.blur.dd ? 0 : L.p.blur.eval(zoom));
                        gl.uniform4f(u.u_dash, dash?.[0] ?? 0, dash?.[1] ?? 0, dash?.[2] ?? 0, dash?.[3] ?? 0);
                        const cap = L.p.cap.dd ? 'butt' : L.p.cap.eval(zoom);
                        gl.uniform1i(u.u_cap, cap === 'round' ? 1 : 0);
                        const name = L.p.pattern.dd ? '' : L.p.pattern.eval(zoom), img = name ? s.icon?.(name) : undefined;
                        gl.uniform2f(u.u_patSize, L.ramp ? L.steps ? -2 : -1 : img ? img.width / img.pixelRatio : 0, img ? img.height / img.pixelRatio : 1);
                        if (L.ramp) {
                            if (L.steps) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.steps)); gl.uniform1i(u.u_stops, 3); }
                            gl.activeTexture(gl.TEXTURE0);
                            gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.ramp));
                            gl.uniform1i(u.u_img, 0);
                            gl.uniform4f(u.u_color, 1, 1, 1, L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                        }
                        // Draw nothing while the image is not available. A pattern for each feature has a batch for each image.
                        if (name && !img) { first = true; break draw; }
                        if (img) bindImage(u, img);
                        if (img || L.p.pattern.dd) gl.uniform4f(u.u_color, 1, 1, 1, L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                    }
                    if (b.type === 'circle') {
                        // (A property with a value for each feature is in the vertices: its uniform is 1 for a color and 0 for the rest.)
                        const sc = L.p.strokeColor.dd ? [1, 1, 1, 1] : L.p.strokeColor.eval(zoom), a = sc[3] * (L.p.strokeOpacity.dd ? 1 : L.p.strokeOpacity.eval(zoom));
                        const tl = mapTranslate(L.p.translate.eval(zoom), L.p.translateAnchor.eval(zoom), tr.bearing);
                        gl.uniform1f(u.u_blur, L.p.blur.dd ? 0 : L.p.blur.eval(zoom));
                        gl.uniform2f(u.u_translate, tl[0], tl[1]);
                        gl.uniform1f(u.u_radius, L.p.radius.dd ? 1 : L.p.radius.eval(zoom));
                        gl.uniform1f(u.u_strokeWidth, L.p.strokeWidth.dd ? 0 : L.p.strokeWidth.eval(zoom));
                        gl.uniform4f(u.u_stroke, sc[0], sc[1], sc[2], a);
                        gl.uniform2f(u.u_pitch, +(L.p.pitchAlign.eval(zoom) === 'map'), +(L.p.pitchScale.eval(zoom) !== 'viewport'));
                        // (Two cells of the terrain mesh, 64 a side, at this zoom: between its corners the mesh can be well above the ground at the center on a steep slope.)
                        gl.uniform1f(u.u_lift, s.terrain && this.depthTex ? 40075016.686 / 2 ** zoom / 32 * Math.max(1, s.terrain.exaggeration) : 0);
                        gl.uniform1i(u.u_depth, 2);
                        if (s.terrain && this.depthTex) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.depthTex); gl.activeTexture(gl.TEXTURE0); }
                    }
                }
                // The image of a batch of a pattern with a value for each feature (a missing one is not drawn).
                const img = b.pat ? s.icon?.(b.pat) : patImg;
                if (b.pat) {
                    if (!img) continue;
                    bindImage(u, img);
                    if (b.type === 'line') gl.uniform2f(u.u_patSize, img.width / img.pixelRatio, img.height / img.pixelRatio);
                }
                this.placeTile(u, it.id, m, sh);
                gl.uniform4fv(u.u_clip, it.clip);
                gl.bindVertexArray(b.vao);
                // Attributes without a buffer read these constants, so shaders need no variants.
                if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                if (!b.scalar) { gl.vertexAttrib1f(3, 1); gl.vertexAttrib1f(5, 1); }
                if (b.type === 'circle') { if (!(b.stroke! & 1)) gl.vertexAttrib4f(4, 1, 1, 1, 1); if (!(b.stroke! & 2)) gl.vertexAttrib2f(6, 0, 0); }
                // A number of `Batch.feat` that the batch does not have reads 0. (A custom layer can leave another value
                // at these locations. An attribute with a buffer does not read the value.)
                if (b.type === 'line' || b.type === 'circle') { gl.uniform1f(u.u_zt, Math.min(1, Math.max(0, zoom - (it.tile.z ?? it.id.z)))); for (let l = 7; l < 12; l++) gl.vertexAttrib1f(l, 0); }
                if (b.type === 'circle' && !(b.stroke! & 1)) gl.vertexAttrib4f(10, 1, 1, 1, 1);
                if (b.type === 'line' || b.type === 'circle') {
                    gl.uniform1f(u.u_scale, it.scale);
                    gl.uniform1f(u.u_cam, tr.cameraDistance);
                }
                if (b.type === 'line') {
                    // The part of the screen that is this tile's, in the units of the layer's first tile (see the line shader, #2443).
                    gl.uniformMatrix3fv(u.u_screen, false, screen ??= this.globe ? new Array(9).fill(0) : screenToTile(items[0].matrix4, target));
                    if (!this.globe) gl.uniform4fv(u.u_clip, clipIn(items[0].id, it.id, it.clip));
                    // Dashes are sized at whole zoom levels so they stretch, rather than crawl, while zooming.
                    gl.uniform1f(u.u_dashScale, it.scale / 2 ** (zoom - Math.floor(zoom)));
                }
                if (extrude) {
                    gl.uniform3f(u.u_hb, +!!b.lift, hb[0], hb[1]);
                    // Depth first, color second: translucent buildings then blend once, with the nearest surface only.
                    gl.colorMask(false, false, false, false);
                    gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                    gl.colorMask(true, true, true, true);
                    pending.push(() => {
                        this.placeTile(u, it.id, m, sh);
                        // (The walls take the height in meters to tile units as MapLibre GL JS does, whose tiles have 8192 units.)
                        if (img) { bindImage(u, img); gl.uniformMatrix3fv(u.u_pat, false, patMatrix(img, tilePixels(it.id))); gl.uniform1f(u.u_hf, -(2 ** it.id.z) / 2 / EXTENT); }
                        this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                        gl.uniform4fv(u.u_clip, it.clip);
                        gl.bindVertexArray(b.vao);
                        if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                        gl.uniform3f(u.u_hb, +!!b.lift, hb[0], hb[1]);
                        gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                    });
                } else gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
            }
            if (L.type === 'fill' && L.p.antialias.eval(zoom) !== false) {
                // Edge pass: the style's outline color if it has one, otherwise the fill's own color as antialiasing. As in
                // MapLibre GL JS, fill-antialias false draws no edges, also with a fill-outline-color.
                const oc = L.p.outline.eval(zoom), explicit = oc[3] > 0, op = L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom);
                const col = explicit ? [oc[0], oc[1], oc[2], oc[3] * op] : color(L);
                for (const it of items) for (const b of parts(it, L.id)) {
                    if (!b.edgeVao) continue;
                    const u = use('edge');
                    gl.uniform4fv(u.u_color, col);
                    gl.uniform2f(u.u_world, target[0], target[1]);
                    gl.uniform1f(u.u_attr, b.color && !explicit ? 1 : 0);
                    this.placeTile(u, it.id, moved(it), shift(it));
                    gl.uniform4fv(u.u_clip, it.clip);
                    gl.bindVertexArray(b.edgeVao);
                    gl.drawElements(gl.LINES, b.edgeCount!, b.indexType, 0);
                }
            }
            if (extrude) {
                // Color pass: only the nearest surface, and each pixel once. Touching walls and stacked building parts
                // share depths exactly; without the stencil they would blend twice in a speckled pattern.
                gl.enable(gl.STENCIL_TEST);
                gl.stencilFunc(gl.NOTEQUAL, 1, 0xff);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.depthMask(false);
                for (const draw of pending) draw();
                gl.depthMask(true);
                gl.disable(gl.STENCIL_TEST);
                gl.disable(gl.DEPTH_TEST);
                gl.disable(gl.CULL_FACE);
            }
        }

        this.current = null;
    }

    /** True once a fill-extrusion layer of this frame has cleared the depth buffer. */
    private extrusionDepth = false;
    private uids = 0;
    private current: Program | null = null;
    /** Selects a program, telling it the size of the view being drawn (the screen, or a terrain tile's texture). */
    private use(name: ProgramName, tr: Transform) {
        const p = this.ready(name);
        if (p !== this.current) {
            this.gl.useProgram(p.prog);
            this.gl.uniform2f(p.u.u_view, tr.width, tr.height);
            this.current = p;
        }
        const g = this.globe, gl = this.gl;
        if (g && p.u.u_globe && p.frame !== this.frame) {
            p.frame = this.frame;
            gl.uniformMatrix4fv(p.u.u_globe, false, g.m);
            gl.uniform4fv(p.u.u_horizon, g.horizon);
            gl.uniform1f(p.u.u_globeness, g.t);
            if (p.u.u_cosLat) gl.uniform1f(p.u.u_cosLat, g.cosLat);
        }
        return p.u;
    }

    /** The matrix of a tile, and with the globe the place of the tile on the sphere, moved by `shift` tile units (`*-translate`). */
    private placeTile(u: Record<string, WebGLUniformLocation>, id: TileID, m: Float32Array | number[], shift?: number[]) {
        this.gl.uniformMatrix4fv(u.u_matrix, false, m);
        if (this.globe && u.u_tileMerc) {
            const n = 2 ** id.z, d = 1 / n / EXTENT;
            this.gl.uniform4f(u.u_tileMerc, id.x / n + (shift?.[0] ?? 0) * d, id.y / n + (shift?.[1] ?? 0) * d, d, d);
        }
    }

    /** The grid of the globe (`globeMesh` in globe.ts), made at its first use. */
    private globeGrid() {
        return this.globeMesh ??= this.globeCode!.globeMesh(this.gl);
    }

    /** Draws a picture that is not convex, or is blended toward bilinear, in Mercator on a grid of 16 x 16 cells (see foldOf), made at its first use. */
    private drawSheet() {
        const gl = this.gl;
        if (!this.sheet) {
            const v: number[] = [];
            for (let i = 0; i < 256; i++) for (const k of [0, 1, 16, 16, 1, 17]) v.push((i % 16 + k % 16) / 16, ((i >> 4) + (k >> 4)) / 16);
            gl.bindVertexArray(this.sheet = gl.createVertexArray()!);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        }
        gl.bindVertexArray(this.sheet);
        gl.drawArrays(gl.TRIANGLES, 0, 1536);
        gl.bindVertexArray(this.quad);
    }

    /**
     * Draws a tile on the grid of the globe, with the rows to the poles for a tile at the edge of the world. An image
     * source (`poles` false) ends at its corners, as in MapLibre GL JS: a row to the pole would stretch its edge there.
     */
    private drawGrid(id: TileID, poles = true) {
        const gl = this.gl, g = this.globeGrid(), n = 2 ** id.z;
        gl.drawElements(gl.TRIANGLES, g.main, gl.UNSIGNED_SHORT, 0);
        if (!poles) return;
        if (id.y === 0) gl.drawElements(gl.TRIANGLES, g.pole, gl.UNSIGNED_SHORT, g.main * 2);
        if (id.y === n - 1) gl.drawElements(gl.TRIANGLES, g.pole, gl.UNSIGNED_SHORT, (g.main + g.pole) * 2);
    }

    private compositeLayer(s: Scene, tr: Transform, bySource: Map<string, RenderItem<GLTile>[]>, target: [number, number], pass: 'all' | 'ground' | 'buildings', L: CompiledLayer, opacity: number, blend: string) {
        const gl = this.gl, [w, h] = target, back = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        let t = this.layerTarget;
        if (!t || t.w !== w || t.h !== h) {
            if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
            const tex = this.newTexture(), fb = gl.createFramebuffer()!;
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            t = this.layerTarget = {fb, tex, w, h};
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // The texture that is drawn into must not stay bound: a layer that binds no texture of its own (a plain line)
        // would then read from the texture it draws to, and WebGL refuses the draw.
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.drawLayers(s, tr, bySource, target, pass, L);
        gl.bindFramebuffer(gl.FRAMEBUFFER, back);
        const u = this.use('composite', tr), mode = ['overlay', 'color', 'luminosity'].indexOf(blend) + 1;
        gl.uniform1i(u.u_mode, mode);
        if (mode) {
            // These modes compute the result from the colors underneath, so those are copied and the output replaces them.
            this.belowTex ??= this.newTexture();
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.belowTex);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);
            gl.uniform1i(u.u_below, 1);
            gl.disable(gl.BLEND);
        }
        // Colors are premultiplied. Multiply is exact over an opaque map, which is what lies beneath in practice.
        if (blend === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        else if (blend === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        else if (blend === 'plus-lighter') gl.blendFunc(gl.ONE, gl.ONE);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.uniform1i(u.u_layer, 0);
        gl.uniform1f(u.u_opacity, opacity);
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        this.current = null;
    }

    /** The density picture of a heatmap (see `drawHeatmap` in layers-more.ts). */
    private declare heatTarget?: {fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number};
    private ramps = new Map<Uint8Array | Float32Array, WebGLTexture>();
    private rampLayers?: CompiledLayer[];
    /**
     * The texture of a color ramp (heatmap colors, line gradients, the colors of a `color-relief` layer), made on
     * first use. A `Float32Array` gives a texture of one number for each pixel (the elevations of a `color-relief` layer).
     * When the list of layers changes, `dropRamps` deletes the textures of ramps that no layer has any more (#591).
     */
    private rampTexture(pixels: Uint8Array | Float32Array): WebGLTexture {
        const gl = this.gl;
        let ramp = this.ramps.get(pixels);
        if (!ramp) {
            ramp = this.newTexture();
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            if (pixels instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixels.length / 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            else {
                // (A browser filters a texture of floats only with an extension, and the shader reads single pixels.)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, pixels.length, 1, 0, gl.RED, gl.FLOAT, pixels);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            }
            this.ramps.set(pixels, ramp);
        }
        return ramp;
    }
    private dropRamps(layers: CompiledLayer[]) {
        if (layers === this.rampLayers) return;
        this.rampLayers = layers;
        const keep = new Set(layers.flatMap(L => [L.ramp, L.relief, L.steps]));
        for (const [pixels, tex] of this.ramps) if (!keep.has(pixels)) { this.gl.deleteTexture(tex); this.ramps.delete(pixels); }
    }
    private declare floatTargets?: boolean;

    /** Points a terrain-aware program at the heights under the tile about to be drawn. */
    private bindDem(u: Record<string, WebGLUniformLocation>, dem: DemRef | null, exaggeration: number, level = 0) {
        const gl = this.gl;
        gl.uniform1f(u.u_exag, dem ? exaggeration : 0);
        gl.uniform1f(u.u_level, level);
        gl.uniform1i(u.u_dem, 1);
        if (!dem) return;
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, dem.tex);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform4fv(u.u_demRect, dem.rect);
        gl.uniform4fv(u.u_unpack, dem.unpack);
    }

    private drapes = new Map<string, {tex: WebGLTexture; size: number; signature: string; used: number; /** When the picture was last made. */ at?: number; light?: number; /** Made at half the size while the camera moved. */ rough?: boolean}>();
    private frame = 0;
    private grid?: {vao: WebGLVertexArrayObject; count: number; /** For each skirt vertex, the grid vertex it hangs from. */ skirt: number[]};
    private meshHeights = new Map<string, {buffer: WebGLBuffer; version: number; used: number}>();


    /** Ground textures that are not in use, by size, to be used again. */
    private sparePictures = new Map<number, WebGLTexture[]>();
    /** Gives the memory of the GPU back at once. Without this, a map that was removed keeps it until the browser collects the context. */
    destroy() { if (!this.gl.isContextLost()) this.gl.getExtension(LOSE_CONTEXT)?.loseContext(); }

    private drapeWaits = new Map<string, number>();
    private gap = 33;
    private drapedAt = 0;


    private depthTex?: WebGLTexture; private depthFbo?: WebGLFramebuffer; private depthSize = '';

    /** The sky of the style above the horizon, in Mercator and, on the globe, blended into the space around it. */
    private drawSky(s: Scene) {
        const tr = s.tr, g = s.globe;
        if (!s.sky) return;
        const v = skyValues(s.sky, tr.zoom, tr.pitch), gl = this.gl, k = this.canvas.height / tr.height, u = this.use('sky', tr);
        if (g) {
            // atmosphere-blend fades as the camera rises, as in drawHalo (MapLibre's getAtmosphereAltitudeBlend).
            const h = 100 / 6371, x = clamp((Math.hypot(...g.cam) - 1 - h) / (9 * h), 0, 1);
            gl.uniform3f(u.u_globeSky, g.t, tr.cameraDistance, 1 - v.atmosphere * x * x * (3 - 2 * x));
            gl.uniformMatrix3fv(u.u_rays, false, g.rays);
            gl.uniform3fv(u.u_cam, g.cam);
            gl.uniform2f(u.u_halo, 0, k);
        } else gl.uniform3f(u.u_globeSky, 0, 0, 0);
        gl.uniform2f(u.u_sky, (tr.height - tr.cy + tr.horizon()) * k, Math.max(v.skyBlend, 1e-6) * this.canvas.height / 2);
        gl.uniform4fv(u.u_skyColor, v.sky);
        gl.uniform4fv(u.u_horizonColor, v.horizon);
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Draws a frame. Returns true if some terrain pictures are still out of date or a raster tile fades in, so another frame is wanted. */
    render(s: Scene): boolean {
        this.iconsBehind = false;
        const gl = this.gl, tr = s.tr;
        // (Before the first program is linked, so that `halo` links with the others; see `ready`.)
        if (s.globe) SHADERS.halo = (this.globeCode = tr.globe!).HALO;
        this.frame++;
        this.dropRamps(s.layers);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // (The pictures of the ground tiles are flat, also on the globe: only the mesh that shows them is on the sphere.)
        this.globe = undefined;
        const behind = s.terrain ? s.terrain.code.updateDrapes.call(this, s) : false;
        this.globe = s.globe;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.current = null;
        this.extrusionDepth = false;
        this.drawSky(s);
        const target: [number, number] = [this.canvas.width, this.canvas.height];
        const use = (name: ProgramName) => this.use(name, tr);

        // Labels are drawn above the last symbol layer that has labels (`above` is the index after it). Without 3D
        // terrain, a visible layer of another type between two symbol layers with labels splits them, as in MapLibre GL
        // JS: the labels of the layers before it are drawn below it and the others over it. Each part costs its own
        // draw calls, so symbol layers next to each other share one. The layers after `above` are drawn over all
        // labels: their icons that the tiles have in buffers and, without 3D terrain, the layers of other types. (With
        // 3D terrain, the layers on the ground are pictures on the terrain and stay below all labels.)
        const shown = (L: CompiledLayer) => L.visible && tr.zoom >= L.minzoom && tr.zoom < L.maxzoom;
        let above = 0, first = -1;
        s.layers.forEach((L, i) => { if (L.type === 'symbol' && shown(L) && s.items.get(L.source!)?.some(it => it.tile.labels[L.id]?.length)) { above = i + 1; if (first < 0) first = i; } });
        if (s.terrain) {
            s.terrain.code.drawTerrain.call(this, s); s.terrain.code.terrainDepth.call(this, s); this.drawLayers(s, tr, s.items, target, 'buildings');
            this.drawIcons(s, tr, 0, above);
            this.drawLabels(s, s.labels);
        } else {
            // The starts of the parts: each visible layer of another type after the first symbol layer with labels.
            const cuts = [0];
            for (let i = first + 1; i < above; i++) if (s.layers[i].type !== 'symbol' && shown(s.layers[i])) cuts.push(i);
            cuts.push(above);
            let part: Map<string, number> | undefined;
            if (cuts.length > 2) {
                part = new Map();
                for (let k = 0; k + 1 < cuts.length; k++) for (let i = cuts[k]; i < cuts[k + 1]; i++) part.set(s.layers[i].id, k);
            }
            for (let k = 0; k + 1 < cuts.length; k++) {
                this.drawLayers(s, tr, s.items, target, 'all', undefined, cuts[k], cuts[k + 1]);
                this.drawIcons(s, tr, cuts[k], cuts[k + 1]);
                this.drawLabels(s, part ? s.labels.filter(l => (part.get(l.layer) ?? cuts.length - 2) === k) : s.labels);
            }
        }

        // The layers above the labels, each in its place: icons of symbol layers and, without terrain, other layers.
        for (let i = above; i < s.layers.length; i++) {
            if (s.layers[i].type === 'symbol') this.drawIcons(s, tr, i, i + 1);
            else if (!s.terrain) this.drawLayers(s, tr, s.items, target, 'all', undefined, i, i + 1);
        }

        this.drawHalo(s);
        gl.bindVertexArray(null);
        const fading = this.fading; this.fading = false;
        return behind || fading;
    }

    /**
     * The atmosphere around the globe, over the layers, as MapLibre GL JS's drawAtmosphere does: only for a style with a
     * `sky`. The blend is atmosphere-blend times the change to the globe, and it fades out as the camera comes within ten
     * heights of the atmosphere (100 km) of the ground. The sun comes from the position of `light`: with the anchor
     * `map` it stays over one place of the globe, with `viewport` (the default) it turns with the view.
     */
    private drawHalo(s: Scene) {
        const g = s.globe, tr = s.tr;
        if (!g || !s.sky) return;
        const v = skyValues(s.sky, tr.zoom, tr.pitch), h = 100 / 6371, x = clamp((Math.hypot(...g.cam) - 1 - h) / (9 * h), 0, 1);
        const blend = v.atmosphere * g.t * x * x * (3 - 2 * x), gl = this.gl;
        if (!(blend > 0)) return;
        const light = s.light ?? {}, [, az, polar] = compileProp(light.position, 'string', [1.15, 210, 30]).eval(tr.zoom) as number[];
        const sun = this.globeCode!.haloSun(tr, g.rays, az, polar, lightOnMap(light, tr.zoom)), u = this.use('halo', tr);
        gl.uniformMatrix3fv(u.u_rays, false, g.rays);
        gl.uniform3fv(u.u_cam, g.cam);
        gl.uniform3fv(u.u_sun, sun);
        gl.uniform2f(u.u_halo, blend, this.canvas.height / tr.height);
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Draws placed labels: their icons, then their text in one pass for the halos and one for the fill. */
    private drawLabels(s: Scene, labels: Placed[]) {
        const gl = this.gl, use = (name: ProgramName) => this.use(name, s.tr), at = (q: Prop) => q.dd ? undefined : q.eval(s.tr.zoom);
        // The paint values of each symbol layer that are the same for the whole layer, at the zoom of the map in this frame,
        // so that they transition as in MapLibre GL JS and a change needs no new tiles (#972). A value for each feature is in the tile.
        this.paint = new Map(s.layers.filter(L => L.type === 'symbol').map(({id, p}) => [id, [at(p.color), at(p.haloColor), at(p.haloWidth), at(p.haloBlur), at(p.opacity),
            at(p.iconColor), at(p.iconHalo), at(p.iconHaloWidth), at(p.iconHaloBlur), at(p.iconOpacity)]]));
        // Style-sheet icons and images added at runtime live in different textures.
        for (const custom of [false, true]) {
            const icons = this.iconQuads(labels, custom, s.icon);
            if (!icons.length) continue;
            const u = use('sprite');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, custom ? this.spriteTex : this.iconTex);
            gl.uniform2f(u.u_tex, custom ? this.spriteSize : this.iconSize[0], custom ? this.spriteSize : this.iconSize[1]);
            gl.uniform1i(u.u_img, 0);
            gl.bindVertexArray(this.spriteVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
            gl.bufferData(gl.ARRAY_BUFFER, icons, gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, icons.length / 9);
        }

        if (labels.length) {
            const quads = this.textQuads(labels); // shaping may add glyphs, so build quads before uploading the atlas
            if (this.sdfVersion !== s.atlas.version) this.glyphs(s.atlas);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.sdfTex);
            const u = use('text');
            gl.uniform2f(u.u_tex, s.atlas.width, s.atlas.height);
            gl.uniform1i(u.u_sdf, 0);
            gl.bindVertexArray(this.textVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuf);
            gl.bufferData(gl.ARRAY_BUFFER, quads, gl.DYNAMIC_DRAW);
            const n = quads.byteLength / 36;
            gl.uniform1i(u.u_pass, 1);
            gl.drawArrays(gl.TRIANGLES, 0, n);
            gl.uniform1i(u.u_pass, 0);
            gl.drawArrays(gl.TRIANGLES, 0, n);
        }

    }

    /**
     * Brings the texture of the glyph atlas up to date: the glyphs from glyph files from `data`, and those that the
     * canvas drew as distance fields that the GPU computes from the canvas (#1841). Nothing is read back to the CPU.
     * It runs during a frame (`drawLabels`) and between frames (`GlyphAtlas.flush`), and leaves the screen as the
     * framebuffer, with BLEND on.
     */
    glyphs(a: GlyphAtlas) {
        const gl = this.gl;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sdfTex);
        if (this.sdfResets !== a.resets) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, a.width, a.height, 0, gl.RED, gl.UNSIGNED_BYTE, a.data);
            this.sdfResets = a.resets; this.sdfHeight = a.height; a.dirty = [];
        } else if (this.sdfHeight !== a.height) {
            // The atlas grew: its glyphs keep their places, and those that the GPU computed exist only in the texture.
            const old = this.sdfTex;
            this.sdfTex = this.newTexture();
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, a.width, a.height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, old, 0);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, a.width, this.sdfHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteTexture(old);
            this.sdfHeight = a.height;
        }
        // (Each part of `data` is sent in place, with the rows of `data` as the rows of the upload.)
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, a.width);
        for (const [x, y, w, h] of a.dirty) {
            gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED, gl.UNSIGNED_BYTE, a.data);
        }
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
        a.dirty = [];
        if (a.drawn.length) {
            const c = a.canvas;
            if (!this.coverageTex) {
                this.coverageTex = this.newTexture();
                this.sdfVao = gl.createVertexArray()!;
                gl.bindVertexArray(this.sdfVao);
                this.sdfBuf = gl.createBuffer()!;
                gl.bindBuffer(gl.ARRAY_BUFFER, this.sdfBuf);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
            }
            gl.bindTexture(gl.TEXTURE_2D, this.coverageTex);
            if (this.coverageSize[0] !== c.width || this.coverageSize[1] !== c.height) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, c.width, c.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                this.coverageSize = [c.width, c.height];
            }
            // (Only the rows that glyphs use. In Firefox this upload does not wait for the page thread, as getImageData does.)
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, c.width, a.canvasRows, gl.RGBA, gl.UNSIGNED_BYTE, c);
            const v = new Float32Array(a.drawn.length * 48);
            let o = 0;
            for (const [sx, sy, x, y, w, h] of a.drawn) {
                for (const [i, j] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) {
                    v.set([x + i * w, y + j * h, sx + i * w, sy + j * h, sx, sy, sx + w, sy + h], o); o += 8;
                }
            }
            const u = this.ready('glyphSdf');
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sdfTex, 0);
            gl.viewport(0, 0, a.width, a.height);
            gl.disable(gl.BLEND);
            gl.useProgram(u.prog);
            this.current = null;
            gl.uniform2f(u.u.u_size, a.width, a.height);
            gl.uniform1i(u.u.u_cov, 0);
            gl.bindVertexArray(this.sdfVao!);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.sdfBuf!);
            gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, o / 8);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.enable(gl.BLEND);
            a.drawnSent();
        }
        this.sdfVersion = a.version;
    }

    /** See `drawLabels`. */
    private paint = new Map<string, any[]>();
    /** Kept between frames and grown when necessary, as `textData` is: icons are built again on each frame. */
    private iconData = new Float32Array(0);
    private iconQuads(labels: Placed[], custom: boolean, lookup?: Scene['icon']): Float32Array {
        let f = this.iconData, o = 0;
        const dpr = this.dpr, snap = (v: number) => Math.round(v * dpr) / dpr;
        /** Makes room for `n` more floats. */
        const room = (n: number) => { if (o + n > f.length) { const g = new Float32Array(Math.max(1024, (o + n) * 2)); g.set(f.subarray(0, o)); f = this.iconData = g; } };
        /** One vertex: position, place in the texture, alpha, tint. */
        const vertex = (x: number, y: number, u: number, v: number, alpha: number, tint: number[]) => {
            f[o] = x; f[o + 1] = y; f[o + 2] = u; f[o + 3] = v; f[o + 4] = alpha;
            f[o + 5] = tint[0]; f[o + 6] = tint[1]; f[o + 7] = tint[2]; f[o + 8] = tint[3]; o += 9;
        };
        /**
         * One triangle of an icon on the ground of the globe, as x, y, u, v and the side of the horizon at each corner (see
         * `groundCorners`): the part on the hidden side is cut off, as MapLibre GL JS cuts it with the plane of the horizon.
         */
        const cut = (t: number[][], alpha: number, tint: number[]) => {
            const q: number[][] = [];
            for (let k = 0; k < 3; k++) {
                const a = t[k], b = t[(k + 1) % 3];
                if (a[4] >= 0) q.push(a);
                if (a[4] >= 0 !== b[4] >= 0) q.push(a.map((v, j) => v + (b[j] - v) * a[4] / (a[4] - b[4])));
            }
            for (let k = 1; k + 1 < q.length; k++) for (const v of [q[0], q[k], q[k + 1]]) vertex(v[0], v[1], v[2], v[3], alpha, tint);
        };
        const plain = [0, 0, 0, -1];
        for (const {icon: i, opacity, layer, src} of labels) {
            if (!i || !!i.custom !== custom || !(opacity > 0)) continue;
            // (The paint values of the layer: see `paint`. In the distance field of a sprite, one image pixel is one eighth of the range.)
            const P = this.paint.get(layer) ?? [], ic = src.icon!, hc = P[6] ?? ic.halo, haw = P[7] ?? ic.haloWidth, ring = i.color && haw > 0 && hc[3] > 0;
            // (An icon on the ground of a tilted map has a frame: where one pixel across and one pixel down it go.)
            const fr = i.frame, cos = fr ? fr[0] : Math.cos(i.angle), sin = fr ? fr[1] : Math.sin(i.angle), nx = fr ? fr[2] : -sin, ny = fr ? fr[3] : cos, [sx, sy, sw, sh] = i.rect;
            // Plain icons are one quad; stretched ones are a grid whose fixed cells keep their size.
            const gx = i.gx ?? [0, 0, sw, i.w], gy = i.gy ?? [0, 0, sh, i.h];
            const col = i.color ? P[5] ?? i.color : plain, hw = i.w / 2, hh = i.h / 2;
            // Upright icons are placed on whole device pixels. Between pixels, the texture filter would smear fine
            // detail such as a one-pixel outline into its neighbors. A distance field has no such detail, and
            // MapLibre GL JS draws it where it falls.
            const ox = i.angle === 0 && !i.color ? snap(i.x - hw) - (i.x - hw) : 0, oy = i.angle === 0 && !i.color ? snap(i.y - hh) - (i.y - hh) : 0;
            const x = i.x + ox, y = i.y + oy;
            // (On the globe a point of the icon is between its corners, which `groundCorners` projected: x, y and the side.)
            const gc = i.corners, at = (px: number, py: number) => {
                const tx = px / i.w + 0.5, ty = py / i.h + 0.5;
                return [0, 1, 2].map(k => { const top = gc![k] + (gc![3 + k] - gc![k]) * tx; return top + (gc![6 + k] + (gc![9 + k] - gc![6 + k]) * tx - top) * ty; });
            };
            room((ring ? 2 : 1) * ((gx.length - 2) >> 1) * ((gy.length - 2) >> 1) * (gc ? 108 : 54));
            // A halo is the same picture drawn first, in the halo color and out to a lower level of the distance field.
            for (let pass = ring ? 0 : 1; pass < 2; pass++) {
                const halo = pass === 0, tint = halo ? hc : col, alpha = Math.min(1, Math.max(0, opacity * i.opacity * (P[9] ?? 1))) * 0.999 + (halo ? Math.round(Math.min(0.7, haw / i.k / 8) * 100) + 100 * Math.round(Math.min(0.99, (P[8] ?? ic.haloBlur) * 1.19 / i.k / 8) * 100) : 0);
                for (let a = 0; a + 3 < gx.length; a += 2) for (let b = 0; b + 3 < gy.length; b += 2) {
                    // The two triangles of a cell: corners (0, 0), (1, 0), (0, 1) and (1, 0), (1, 1), (0, 1).
                    const x0 = gx[a + 1] - hw, x1 = gx[a + 3] - hw, y0 = gy[b + 1] - hh, y1 = gy[b + 3] - hh;
                    const u0 = sx + gx[a], u1 = sx + gx[a + 2], v0 = sy + gy[b], v1 = sy + gy[b + 2];
                    if (gc) {
                        const c = (px: number, py: number, u: number, v: number) => { const [x, y, s] = at(px, py); return [x, y, u, v, s]; };
                        const c10 = c(x1, y0, u1, v0), c01 = c(x0, y1, u0, v1);
                        cut([c(x0, y0, u0, v0), c10, c01], alpha, tint); cut([c10, c(x1, y1, u1, v1), c01], alpha, tint);
                        continue;
                    }
                    const p00x = x + x0 * cos + y0 * nx + second(fr, 0, x0, y0), p00y = y + x0 * sin + y0 * ny + second(fr, 1, x0, y0), p10x = x + x1 * cos + y0 * nx + second(fr, 0, x1, y0), p10y = y + x1 * sin + y0 * ny + second(fr, 1, x1, y0);
                    const p01x = x + x0 * cos + y1 * nx + second(fr, 0, x0, y1), p01y = y + x0 * sin + y1 * ny + second(fr, 1, x0, y1), p11x = x + x1 * cos + y1 * nx + second(fr, 0, x1, y1), p11y = y + x1 * sin + y1 * ny + second(fr, 1, x1, y1);
                    vertex(p00x, p00y, u0, v0, alpha, tint); vertex(p10x, p10y, u1, v0, alpha, tint); vertex(p01x, p01y, u0, v1, alpha, tint);
                    vertex(p10x, p10y, u1, v0, alpha, tint); vertex(p11x, p11y, u1, v1, alpha, tint); vertex(p01x, p01y, u0, v1, alpha, tint);
                }
            }
        }
        // Images inside label text (`format` with `image`): each sits on its line where a glyph would, at its own size.
        if (lookup) for (const l of labels) {
            const shaped = l.shaped;
            if (!shaped || l.curve || l.opacity <= 0) continue;
            // (On the ground of a tilted map the images use the frame of their label, as its glyphs do.)
            const k = l.size / EM, fr = l.frame, cos = fr ? fr[0] : Math.cos(l.angle), sin = fr ? fr[1] : Math.sin(l.angle), nx = fr ? fr[2] : -sin, ny = fr ? fr[3] : cos, flat = l.angle === 0 && !fr;
            shaped.lines.forEach((line, row) => {
                if (!line.glyphs?.some(g => g.image)) return;
                const justify = l.justify ?? l.src.justify;
                let pen = justify < 0 ? -shaped.width / 2 : justify > 0 ? shaped.width / 2 - line.width : -line.width / 2;
                const mid = lineMiddle(shaped, row);
                for (const g of line.glyphs) {
                    const img = g.image ? lookup(g.image) : undefined;
                    if (img && !!img.custom === custom) {
                        const w = g.advance * k, h = g.imageHeight! * k, cx = (pen + g.advance / 2) * k, cy = (mid + (g.dy ?? 0)) * k;
                        const x0 = flat ? snap(l.x + cx - w / 2) - l.x : cx - w / 2, y0 = flat ? snap(l.y + cy - h / 2) - l.y : cy - h / 2;
                        room(54);
                        for (const [ux, uy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
                            const dx = x0 + ux * w, dy = y0 + uy * h;
                            vertex(l.x + dx * cos + dy * nx + second(fr, 0, dx, dy), l.y + dx * sin + dy * ny + second(fr, 1, dx, dy), img.x + ux * img.width, img.y + uy * img.height, Math.min(1, l.opacity) * 0.999, plain);
                        }
                    }
                    pen += g.advance + l.src.spacing * EM;
                }
            });
        }
        return f.subarray(0, o);
    }

    /** Kept between frames and grown when necessary: text is rebuilt on each frame, and must not make garbage. */
    private textData = new ArrayBuffer(0);
    private textQuads(labels: Placed[]): Uint8Array {
        let glyphCount = 0;
        for (const l of labels) if (l.shaped) for (const line of l.shaped.lines) glyphCount += line.glyphs!.length;
        if (this.textData.byteLength < glyphCount * 6 * 36) this.textData = new ArrayBuffer(Math.ceil(glyphCount * 1.5) * 6 * 36);
        const buf = this.textData, f = new Float32Array(buf), b = new Uint8Array(buf);
        let o = 0;
        const B = SDF_BUFFER;
        // The state of the label in work. `glyph` reads it, so that no objects are made for each glyph.
        let q: number[] | undefined, hedge = 0, gamma = 0, haloGamma = 0, hw = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0, h0 = 0, h1 = 0, h2 = 0, h3 = 0;
        /**
         * One glyph: two triangles about the origin (ox, oy). (cos, sin) is where one pixel along the text goes on the
         * screen, and (px, py) one pixel down the text: a turn by an angle, or the ground of a tilted map.
         */
        const glyph = (g: {x: number; y: number; w: number; h: number}, ox: number, oy: number, cos: number, sin: number, x0: number, y0: number, x1: number, y1: number, px = -sin, py = cos) => {
            for (let k = 0; k < 6; k++) {
                const right = k === 1 || k === 3 || k === 4, low = k === 2 || k === 4 || k === 5;
                const cx = right ? x1 : x0, cy = low ? y1 : y0, fi = o >> 2;
                f[fi] = ox + cx * cos + cy * px;
                f[fi + 1] = oy + cx * sin + cy * py;
                if (q) { f[fi] += second(q, 0, cx, cy); f[fi + 1] += second(q, 1, cx, cy); }
                f[fi + 2] = right ? g.x + g.w : g.x;
                f[fi + 3] = low ? g.y + g.h : g.y;
                b[o + 16] = c0; b[o + 17] = c1; b[o + 18] = c2; b[o + 19] = c3;
                b[o + 20] = h0; b[o + 21] = h1; b[o + 22] = h2; b[o + 23] = h3;
                f[fi + 6] = hedge;
                f[fi + 7] = gamma;
                f[fi + 8] = haloGamma;
                o += 36;
            }
        };
        for (const l of labels) {
            if (!l.shaped) continue;
            const shaped = l.shaped;
            // (Text on the ground of a tilted map has a frame in the place of its angle: see `Placed.frame`.)
            const s = l.size / EM, fr = l.frame, cos = fr ? fr[0] : Math.cos(l.angle), sin = fr ? fr[1] : Math.sin(l.angle), nx = fr ? fr[2] : -sin, ny = fr ? fr[3] : cos, src = l.src;
            // Where the halo's outer edge sits in distance-field units, limited by how far the field extends.
            // (A paint value that is the same for the layer is the one of this frame, so that it transitions: see `paint`.)
            const P = this.paint.get(l.layer) ?? [], col = P[0] ?? src.color, halo = P[1] ?? src.halo, a = 255 * l.opacity * (P[4] ?? l.alpha ?? 1);
            hw = P[2] ?? src.haloWidth;
            hedge = hw > 0 && halo[3] > 0 ? Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - hw / s / SDF_RADIUS) : 2;
            gamma = 0.7 / (SDF_RADIUS * s * this.dpr); haloGamma = gamma + (P[3] ?? src.haloBlur) * 1.19 / s / SDF_RADIUS;
            c0 = Math.round(col[0] * 255); c1 = Math.round(col[1] * 255); c2 = Math.round(col[2] * 255); c3 = Math.round(col[3] * a * (P[0] ? src.op ?? 1 : 1));
            h0 = Math.round(halo[0] * 255); h1 = Math.round(halo[1] * 255); h2 = Math.round(halo[2] * 255); h3 = Math.round(halo[3] * a * (P[1] ? src.op ?? 1 : 1));
            q = !l.curve && fr && fr.length > 4 ? fr : undefined;
            if (l.curve) {
                // Text along a line: every glyph has its own origin and rotation.
                const glyphs = shaped.lines[0].glyphs!, curve = l.curve;
                for (let i = 0; i < glyphs.length; i++) {
                    const g = glyphs[i];
                    if (!g.w) continue;
                    const k = s * (g.scale ?? 1), ga = curve[i * 3 + 2], x0 = (g.left - B) * k, y0 = (-g.top - B) * k + (g.dy ?? 0) * s, along = l.ground?.[i * 3] ?? 1;
                    // Rich text: this glyph has its own color or size. The label's values come back after it.
                    const keep = [c0, c1, c2, gamma, haloGamma, hedge], gs = g.scale ?? 1;
                    if (g.color) { c0 = Math.round(g.color[0] * 255); c1 = Math.round(g.color[1] * 255); c2 = Math.round(g.color[2] * 255); }
                    if (gs !== 1) { gamma /= gs; haloGamma /= gs; if (hedge < 2) hedge = Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - hw / (s * gs) / SDF_RADIUS); }
                    glyph(g, l.x + curve[i * 3], l.y + curve[i * 3 + 1], Math.cos(ga) * along, Math.sin(ga) * along, x0, y0, x0 + g.w * k, y0 + g.h * k, l.ground?.[i * 3 + 1], l.ground?.[i * 3 + 2]);
                    [c0, c1, c2, gamma, haloGamma, hedge] = keep;
                }
                continue;
            }
            const justify = l.justify ?? src.justify, step = src.spacing * EM;
            for (let i = 0; i < shaped.lines.length; i++) {
                const line = shaped.lines[i];
                let pen = justify < 0 ? -shaped.width / 2 : justify > 0 ? shaped.width / 2 - line.width : -line.width / 2;
                const baseline = lineMiddle(shaped, i) + EM * BASELINE * (line.scale ?? 1);
                for (const g of line.glyphs!) {
                    if (g.w) {
                        if (g.scale || g.color) {
                            // Rich text: this glyph has its own size or color. The label's values come back after it.
                            const k = g.scale ?? 1, x0 = (pen + (g.left - B) * k) * s, y0 = (baseline + (g.dy ?? 0) - (g.top + B) * k) * s, keep = [c0, c1, c2, gamma, haloGamma, hedge];
                            if (g.color) { c0 = Math.round(g.color[0] * 255); c1 = Math.round(g.color[1] * 255); c2 = Math.round(g.color[2] * 255); }
                            gamma /= k; haloGamma /= k; if (hedge < 2) hedge = Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - hw / (s * k) / SDF_RADIUS);
                            glyph(g, l.x, l.y, cos, sin, x0, y0, x0 + g.w * k * s, y0 + g.h * k * s, nx, ny);
                            [c0, c1, c2, gamma, haloGamma, hedge] = keep;
                        } else {
                            const x0 = (pen + g.left - B) * s, y0 = (baseline - g.top - B) * s;
                            glyph(g, l.x, l.y, cos, sin, x0, y0, x0 + g.w * s, y0 + g.h * s, nx, ny);
                        }
                    }
                    pen += g.advance + step;
                }
            }
        }
        return b.subarray(0, o);
    }
}
