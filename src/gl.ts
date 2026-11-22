import {EXTENT, clamp, latFromMerc, mercX, mercY, type TileID, type Transform} from './geo.ts';
import {hillshadeLights, LIGHTS, withFilter, screenTranslate, type CompiledLayer, type Light} from './style.ts';
import {compileProp} from './expr.ts';
import type {Sky} from './resolve.ts';
import {LOSE_CONTEXT} from './gl-names.ts';
import {LINE_VERTEX, WALL_OTHER, WALL_TOP, type GLBatch, type IconBatch, type LabelSrc, type TileGL} from './tile.ts';
import type {Placed, RenderItem} from './placement.ts';
import {demUnpack, type DemEncoding} from './query.ts';
import {lineMiddle, BASELINE, EM, SDF_BUFFER, SDF_RADIUS, type GlyphAtlas} from './text.ts';

const HEAD = '#version 300 es\nprecision highp float;\n';
/**
 * The globe (#463): the variant of a map-space program that is compiled with `#define GLOBE` puts tile units on the
 * unit sphere (u_tileMerc: the corner of the tile in Mercator units and the size of a tile unit), takes them to clip
 * space with u_globe, and mixes that with the Mercator position of u_matrix by u_globeness (between zoom 11 and 12).
 * z becomes the side of the plane of the horizon (u_horizon), so that the GPU clips away the far side of the globe.
 * The y values -32768 and 32767 are the poles (see subdivide.ts). The method follows MapLibre GL JS (BSD-3-Clause).
 * Without `GLOBE` the programs are exactly those of a Mercator map.
 */
const GLOBE_GLSL = `uniform mat4 u_globe; uniform vec4 u_horizon; uniform float u_globeness; uniform vec4 u_tileMerc; uniform float u_cosLat;
const float GLOBE_PI = 3.141592653589793;
bool isPole(vec2 t) { return t.y < -32767.5 || t.y > 32766.5; }
vec3 toSphere(vec2 t) {
  if (t.y < -32767.5) return vec3(0.0, 1.0, 0.0);
  if (t.y > 32766.5) return vec3(0.0, -1.0, 0.0);
  vec2 m = u_tileMerc.xy + u_tileMerc.zw * t;
  // (exp and rational arithmetic, not atan and sin: as precise near the equator as MapLibre's formula.)
  float e = exp(GLOBE_PI - m.y * 2.0 * GLOBE_PI), a = (m.x - 0.5) * 2.0 * GLOBE_PI, c = 2.0 * e / (e * e + 1.0);
  return vec3(sin(a) * c, (e * e - 1.0) / (e * e + 1.0), cos(a) * c);
}
vec4 toClip3(vec2 t, float h) {
  vec4 f = u_matrix * vec4(isPole(t) ? vec2(t.x, t.y < 0.0 ? 0.0 : ${EXTENT}.0) : t, h, 1.0);
  vec3 s = toSphere(t) * (1.0 + h / 6371008.8);
  vec4 g = u_globe * vec4(s, 1.0);
  g.z = (1.0 - dot(s, u_horizon.xyz) - u_horizon.w) * g.w;
  if (u_globeness >= 1.0) return g;
  vec4 r = vec4(mix(f.xy, g.xy, u_globeness), mix(0.0, g.z, clamp((u_globeness - 0.2) / 0.8, 0.0, 1.0)), mix(f.w, g.w, u_globeness));
  // The caps at the poles show only in the last 2 percent of the change to the globe.
  if (isPole(t) && u_globeness < 0.98) r.z = 2.0 * r.w;
  return r;
}
vec4 toClip(vec2 t) { return toClip3(t, 0.0); }
// Buildings get a depth, so that their walls and roofs hide each other (MapLibre's projectTileFor3D). u_globe gives
// every point the same depth; here the depth grows with the distance w (in pixels) as in a projection with no far
// plane, whose near plane is at 0.0005 of the distance to the centre of the sphere (below zoom 12 that is nearer than
// the ground under the camera). The far side of the globe is hidden by horizonSide: it is below zero for a point of the ground behind the horizon.
vec4 toClip3D(vec2 t, float h) {
  vec4 g = u_globe * vec4(toSphere(t) * (1.0 + h / 6371008.8), 1.0);
  g.z = g.w - 0.0005 * u_globe[3].w;
  return u_globeness >= 1.0 ? g : mix(u_matrix * vec4(t, h, 1.0), g, u_globeness);
}
float horizonSide(vec2 t) { return dot(toSphere(t), u_horizon.xyz) + u_horizon.w; }
// A tile unit is shorter toward the poles on the sphere: lines are made wider by as much (MapLibre's projectLineThickness).
float lineScale(vec2 t) { float e = exp(GLOBE_PI - (u_tileMerc.y + u_tileMerc.w * t.y) * 2.0 * GLOBE_PI); return mix(1.0, (e * e + 1.0) / (2.0 * e) * u_cosLat, u_globeness); }
// For the clip test, a pole vertex is on the border of its tile.
vec2 unpole(vec2 t) { return vec2(t.x, t.y < -32767.5 ? 0.0 : t.y > 32766.5 ? ${EXTENT}.0 : t.y); }
bool shown(vec4 c) { return c.z <= c.w; }
`;
/** Shared by the map-space programs: u_matrix takes tile units (and metres of height) to clip space. */
const VS_COMMON = `uniform mat4 u_matrix; uniform vec2 u_view;
#ifdef GLOBE
${GLOBE_GLSL}
#else
vec4 toClip(vec2 t) { return u_matrix * vec4(t, 0.0, 1.0); }
#define toClip3(t, h) (u_matrix * vec4(t, h, 1.0))
#define toClip3D(t, h) (u_matrix * vec4(t, h, 1.0))
#define horizonSide(t) 1.0
#define lineScale(t) 1.0
#define unpole(t) (t)
#define shown(c) true
#endif
`;
const FS_CLIP = 'if (v_tile.x < u_clip.x || v_tile.y < u_clip.y || v_tile.x > u_clip.z || v_tile.y > u_clip.w) discard;';

// Ground height from an elevation tile, for vertex shaders. `u_demRect` is the part of the elevation image under this
// tile (offset x, y and scale, then the image size in pixels); `u_exag` of zero means "no heights here (yet)", and
// the ground is then taken to be level at `u_level`.
const TERRAIN_GLSL = `uniform highp sampler2D u_dem; uniform vec4 u_demRect; uniform vec4 u_unpack; uniform float u_exag; uniform float u_level;
float demAt(ivec2 p) { vec4 c = texelFetch(u_dem, clamp(p, ivec2(0), ivec2(int(u_demRect.w) - 1)), 0) * 255.0; return dot(c.rgb, u_unpack.rgb) - u_unpack.a; }
float ground(vec2 uv) {
  if (u_exag == 0.0) return u_level;
  vec2 p = (u_demRect.xy + uv * u_demRect.z) * u_demRect.w - 0.5, f = fract(p); ivec2 i = ivec2(floor(p));
  return mix(mix(demAt(i), demAt(i + ivec2(1, 0)), f.x), mix(demAt(i + ivec2(0, 1)), demAt(i + ivec2(1, 1)), f.x), f.y) * u_exag;
}
`;

// The vertex shader of the layers that colour an elevation tile (`hillshade`, `color-relief`).
const VS_DEM = `${VS_COMMON}
layout(location=0) in vec2 a_pos; out vec2 v_uv; out vec2 v_tile;
#ifdef GLOBE
void main() { v_uv = clamp(unpole(a_pos) / ${EXTENT}.0, 0.0, 1.0); v_tile = v_uv * ${EXTENT}.0; gl_Position = toClip(isPole(a_pos) ? vec2(v_tile.x, a_pos.y) : v_tile); }
#else
void main() { v_uv = a_pos; v_tile = a_pos * ${EXTENT}.0; gl_Position = toClip(v_tile); }
#endif`;

const SQUARE = [0, 0, EXTENT, 0, EXTENT, EXTENT, 0, EXTENT], ONES = [1, 1, 1, 1];
/** Heatmap densities are accumulated at this fraction of the screen's resolution: the result is smooth anyway. */
const HEAT_SCALE = 4;
/** Perspective weights for a quadrilateral's corners, from where its diagonals cross (all 1 for a parallelogram). */
function cornerWeights(c: number[]): number[] {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = c, den = (x2 - x0) * (y3 - y1) - (y2 - y0) * (x3 - x1);
    if (Math.abs(den) < 1e-9) return ONES;
    const t = ((x1 - x0) * (y3 - y1) - (y1 - y0) * (x3 - x1)) / den, ix = x0 + (x2 - x0) * t, iy = y0 + (y2 - y0) * t;
    const d = [0, 1, 2, 3].map(i => Math.hypot(c[i * 2] - ix, c[i * 2 + 1] - iy));
    if (d.some(v => v < 1e-9) || t <= 0 || t >= 1) return ONES; // not convex: fall back to plain stretching
    return [(d[0] + d[2]) / d[2], (d[1] + d[3]) / d[3], (d[0] + d[2]) / d[0], (d[1] + d[3]) / d[1]];
}

/** Samples a repeating image of the icon atlas at a position in units of the image. */
const PATTERN_GLSL = `uniform sampler2D u_img; uniform vec4 u_rect; uniform vec2 u_tex;
vec4 tile(vec2 p) { return texture(u_img, (u_rect.xy + clamp(fract(p) * u_rect.zw, vec2(0.5), u_rect.zw - 0.5)) / u_tex); }`;

const SHADERS = {
    // Heatmap, step one: every point adds a soft bump (a Gaussian, scaled by its weight) to a density picture.
    heat: [`${VS_COMMON}
layout(location=0) in vec2 a_corner; layout(location=2) in vec2 a_pos; layout(location=3) in float a_weight;
uniform float u_weight; uniform float u_intensity; uniform float u_radius; uniform vec4 u_clip;
out vec2 v_ex; out float v_w;
void main() {
  v_w = a_weight * u_weight;
  // The bump is drawn out to where it falls below what the picture can store, and no further.
  float s = sqrt(max(0.0, -2.0 * log(${(1 / 255 / 16).toFixed(8)} / max(v_w * u_intensity * 0.3989422804, 1e-9)))) / 3.0;
  v_ex = s * a_corner;
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
  vec4 c = toClip(a_pos);
  c.xy += v_ex * u_radius * vec2(2.0, -2.0) / u_view * c.w;
  gl_Position = inside ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform float u_intensity; in vec2 v_ex; in float v_w; out vec4 o;
void main() { o = vec4(v_w * u_intensity * 0.3989422804 * exp(-4.5 * dot(v_ex, v_ex)), 0.0, 0.0, 1.0); }`],

    // Heatmap, step two: the density picture is coloured through the layer's ramp.
    heatColor: [`layout(location=0) in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_heat; uniform sampler2D u_ramp; uniform float u_opacity; in vec2 v_uv; out vec4 o;
void main() { o = texture(u_ramp, vec2(clamp(texture(u_heat, v_uv).r, 0.0, 1.0), 0.5)) * u_opacity; }`],

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
    // 3D terrain: a grid over the tile, raised to the ground height and textured with the tile's flat layers.
    // `u_part` picks the part of the picture to show: all of it, or the tile's share of an ancestor's while its own is drawn.
    terrain: [`uniform mat4 u_matrix; uniform float u_skirt; uniform float u_exag;
layout(location=0) in vec3 a_pos; layout(location=1) in float a_height; uniform vec3 u_part; uniform vec2 u_fogRange; out vec2 v_uv; out float v_fog;
void main() { vec2 p = u_part.xy + a_pos.xy * u_part.z; v_uv = vec2(p.x, 1.0 - p.y); gl_Position = u_matrix * vec4(a_pos.xy * ${EXTENT}.0, a_height * u_exag - a_pos.z * u_skirt, 1.0);
  v_fog = clamp((gl_Position.w - u_fogRange.x) / (u_fogRange.y - u_fogRange.x), 0.0, 1.0); }`, `
uniform sampler2D u_drape; in vec2 v_uv; out vec4 o;
// Fog (the sky of the style, as in MapLibre GL JS): v_fog is 0 at the map centre and 1 at the far plane. u_fog has
// fog-ground-blend, horizon-fog-blend and the opacity of the fog (from the pitch); u_fogColor and u_horizonColor are opaque.
uniform vec3 u_fog; uniform vec4 u_fogColor; uniform vec4 u_horizonColor; in float v_fog;
void main() {
  o = texture(u_drape, v_uv);
  float f = max(v_fog - u_fog.x, 0.0) / (1.0 - u_fog.x), k = f * f * u_fog.z;
  if (k <= 0.0) return;
  vec3 c = mix(u_fogColor.rgb, u_horizonColor.rgb, smoothstep(0.0, 1.0, (v_fog - u_fog.y) / (1.0 - u_fog.y)));
  // The mix is in linear space (gamma 2.2), on the colour without its alpha.
  vec3 s = o.a > 0.0 ? o.rgb / o.a : vec3(0.0);
  o.rgb = pow(mix(pow(s, vec3(2.2)), pow(c, vec3(2.2)), k), vec3(1.0 / 2.2)) * o.a;
}`],
    // The sky (the `sky` of the style): a quad over the screen. u_sky has the horizon line in device pixels from the
    // bottom and the height of the band in which sky-color turns into horizon-color; below the line nothing is drawn.
    sky: [`layout(location=0) in vec2 a_pos; void main() { gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform vec2 u_sky; uniform vec4 u_skyColor; uniform vec4 u_horizonColor; out vec4 o;
void main() {
  float b = gl_FragCoord.y - u_sky.x;
  if (b <= 0.0) discard;
  o = b < u_sky.y ? mix(u_skyColor, u_horizonColor, pow(1.0 - b / u_sky.y, 2.0)) : u_skyColor;
}`],
    // The atmosphere on the globe: a port of atmosphere.fragment.glsl of MapLibre GL JS (BSD-3-Clause), which follows
    // glsl-atmosphere (Rayleigh and Mie scattering, 5 steps along the ray and 3 toward the sun). u_rays gives the ray
    // of a screen pixel in the space of the unit sphere, u_cam is the camera and u_sun the direction to the sun there.
    // The globe is scaled to the radius of the earth. u_halo is the blend and the device pixels per pixel.
    halo: [`layout(location=0) in vec2 a_pos; void main() { gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform mat3 u_rays; uniform vec3 u_cam; uniform vec3 u_sun; uniform vec2 u_halo; uniform vec2 u_view; out vec4 o;
const float RP = 6371e3, RA = 6471e3, HR = 8e3, HM = 1.2e3, KM = 21e-6, G = 0.758;
const vec3 KR = vec3(5.5e-6, 13.0e-6, 22.4e-6);
vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float b = 2.0 * dot(rd, r0), d = b * b - 4.0 * (dot(r0, r0) - sr * sr);
  return d < 0.0 ? vec2(1e5, -1e5) : vec2(-b - sqrt(d), -b + sqrt(d)) / 2.0;
}
void main() {
  vec3 r = normalize(u_rays * vec3(gl_FragCoord.x / u_halo.y, u_view.y - gl_FragCoord.y / u_halo.y, 1.0)), r0 = u_cam * RP, s = normalize(u_sun);
  vec2 p = rsi(r0, r, RA);
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  if (p.x <= p.y) {
    p.x = max(p.x, 0.0);
    vec2 p2 = rsi(r0, r, RP);
    if (p2.x <= p2.y && p2.x > 0.0) p.y = min(p.y, p2.x);
    float st = (p.y - p.x) / 5.0, t = p.x + st * 0.5, odR = 0.0, odM = 0.0, mu = dot(r, s), gg = G * G;
    vec3 tR = vec3(0.0), tM = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec3 q = r0 + r * t;
      float h = length(q) - RP, dR = exp(-h / HR) * st, dM = exp(-h / HM) * st, js = rsi(q, s, RA).y / 3.0, jt = js * 0.5, jR = 0.0, jM = 0.0;
      odR += dR; odM += dM;
      for (int j = 0; j < 3; j++) { float jh = length(q + s * jt) - RP; jR += exp(-jh / HR) * js; jM += exp(-jh / HM) * js; jt += js; }
      vec3 at = exp(-(KM * (odM + jM) + KR * (odR + jR)));
      tR += dR * at; tM += dM * at; t += st;
    }
    float pR = 3.0 / (16.0 * 3.141593) * (1.0 + mu * mu), pM = 3.0 / (8.0 * 3.141593) * ((1.0 - gg) * (mu * mu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * G, 1.5) * (2.0 + gg));
    c = vec4(22.0 * (pR * KR * tR + pM * KM * tM), exp(-(length(KR) * length(tR) + KM * length(tM))));
  }
  c.rgb = 1.0 - exp(-c.rgb);
  c = pow(c, vec4(1.0 / 2.2));
  o = vec4(c.rgb, 1.0 - c.a) * u_halo.x;
}`],

    fill: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
void main() { v_tile = unpole(a_pos); v_color = a_color; gl_Position = toClip(a_pos); }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; o = vec4(c.rgb * c.a, c.a); }`],

    // Repeating image fill. The image is tiled in world pixels at whole zoom levels, so it stays put while panning
    // and grows with the map between levels, as in MapLibre.
    pattern: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; uniform mat3 u_pat; out vec2 v_p; out vec2 v_tile;
void main() { v_tile = unpole(a_pos); v_p = (u_pat * vec3(unpole(a_pos), 1.0)).xy; gl_Position = toClip(a_pos); }`, `
uniform vec2 u_fade; uniform vec4 u_clip; in vec2 v_p; in vec2 v_tile; out vec4 o;
${PATTERN_GLSL}
void main() { ${FS_CLIP} o = mix(tile(v_p), tile(v_p * 2.0), u_fade.x) * u_fade.y; }`],

    // One-pixel antialiased lines along polygon edges: coverage falls off with distance from the ideal line.
    edge: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; uniform vec2 u_world; uniform float u_attr;
out vec4 v_color; out vec2 v_tile; out vec2 v_px;
void main() { v_tile = a_pos; v_color = mix(vec4(1.0), a_color, u_attr); gl_Position = toClip(a_pos); v_px = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world; }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; in vec2 v_px; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; float a = c.a * (1.0 - smoothstep(0.0, 1.0, length(v_px - gl_FragCoord.xy))); o = vec4(c.rgb * a, a); }`],

    line: [`${VS_COMMON}
layout(location=0) in vec4 a_packed; layout(location=1) in vec4 a_color; layout(location=2) in float a_side; layout(location=3) in float a_width; layout(location=4) in float a_dist; layout(location=5) in float a_width1;
uniform float u_width; uniform float u_scale; uniform float u_gap; uniform float u_offset; uniform float u_zt; uniform float u_floorWidth;
uniform float u_cam;
out vec4 v_color; out vec2 v_tile; out float v_d; out float v_hw; out float v_w; out float v_dist; out float v_persp; out float v_fw;
void main() {
  vec4 a_v = vec4(a_packed.xy, a_packed.zw / 8192.0); vec2 a_sd = vec2(a_side, a_dist);
  float w = mix(a_width, a_width1, u_zt) * u_width; // a width for each feature changes smoothly between zoom levels
  v_fw = a_width * u_floorWidth; // dashes are sized by the width at the whole zoom level, as in MapLibre
  // With a gap the line is two strokes of width w either side of an empty middle.
  v_hw = (u_gap > 0.0 ? u_gap * 0.5 + w : w * 0.5) + 0.5; v_d = a_sd.x * v_hw; v_w = w; v_dist = a_sd.y;
  // (As in MapLibre, a line thinner than a pixel is not made fainter for its width: the soft edge does that. A line of no width is not drawn.)
  v_color = vec4(a_color.rgb, w > 0.0 ? a_color.a : 0.0);
  // line-offset moves the whole stroke sideways: along the same normal, whichever side of the line this vertex is on.
  v_tile = a_v.xy + a_v.zw * (v_hw + sign(a_sd.x) * u_offset) / u_scale * lineScale(a_v.xy);
  gl_Position = toClip(v_tile);
  // Lines lie on the map, so a tilted view draws distant ones thinner; edge antialiasing must shrink to match.
  v_persp = gl_Position.w / u_cam;
}`, `
uniform vec4 u_color; uniform vec4 u_clip; uniform float u_gap; uniform vec4 u_dash; uniform float u_dashScale; uniform float u_blur;
uniform sampler2D u_img; uniform vec4 u_rect; uniform vec2 u_tex; uniform vec2 u_patSize;
uniform int u_cap;
float outside(float t, float from, float to) { return max(max(from - t, t - to), 0.0); }
in vec4 v_color; in vec2 v_tile; in float v_d; in float v_hw; in float v_w; in float v_dist; in float v_persp; in float v_fw; out vec4 o;
uniform float u_zf;
void main() {
  ${FS_CLIP}
  vec4 c = v_color * u_color;
  if (u_patSize.x != 0.0) c = vec4(1.0, 1.0, 1.0, c.a);
  float a = c.a * clamp((v_hw - abs(v_d)) / (v_persp * (1.0 + u_blur)), 0.0, 1.0); // line-blur widens the soft edge
  if (u_gap > 0.0) a *= clamp((abs(v_d) - u_gap * 0.5 + 0.5) / v_persp, 0.0, 1.0);
  float period = u_dash.x + u_dash.y + u_dash.z + u_dash.w;
  if (period > 0.0 && u_patSize.x <= 0.0) { // a pattern replaces the dashes
    // Dash lengths are in multiples of the line width. The gap is how far this point is outside the nearest dash.
    float w = max(v_w, 0.5), fw = max(v_fw, 0.5), t = mod(v_dist * u_dashScale / fw, period), second = u_dash.x + u_dash.y;
    float px = fw * u_zf; // screen pixels for each dash unit
    float gap = min(min(outside(t, 0.0, u_dash.x), outside(t, period, period + u_dash.x)),
                    min(outside(t, second, second + u_dash.z), outside(t, second - period, second - period + u_dash.z))) * px;
    // Each dash has the cap of the line: a round or square cap makes it longer by half the line width.
    if (u_cap == 1) a *= clamp((w * 0.5 - length(vec2(gap, v_d)) + 0.5) / v_persp, 0.0, 1.0);
    else if (u_cap == 2) a *= clamp(0.5 + w * 0.5 - gap, 0.0, 1.0);
    else {
      // Butt caps: the signed distance to the dash end, so that the end is smooth over one pixel.
      float inDash = t < second ? min(t, u_dash.x - t) : min(t - second, second + u_dash.z - t);
      a *= clamp(inDash * px + 0.5, 0.0, 1.0);
    }
  }
  if (u_patSize.x > 0.0) {
    // line-pattern: the image repeats along the line, scaled so that its height is the line width.
    float w = max(v_w, 0.5);
    vec2 p = vec2(fract(v_dist * u_dashScale * u_patSize.y / (u_patSize.x * w)), clamp(v_d / w + 0.5, 0.0, 1.0));
    o = texture(u_img, (u_rect.xy + clamp(p * u_rect.zw, vec2(0.5), u_rect.zw - 0.5)) / u_tex) * a;
    return;
  }
  if (u_patSize.x < 0.0) {
    // line-gradient: the colour comes from a ramp, by the place along the whole line (see tessellateLine).
    o = texture(u_img, vec2((v_color.r * 65280.0 + v_color.g * 255.0) / 65535.0, 0.5)) * a;
    return;
  }
  o = vec4(c.rgb * a, a);
}`],

    circle: [`${VS_COMMON}
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 a_color; layout(location=2) in vec2 a_pos; layout(location=3) in float a_radius; layout(location=5) in float a_radius1;
uniform float u_zt; uniform float u_radius; uniform float u_strokeWidth; uniform vec4 u_clip; uniform vec2 u_translate;
uniform float u_scale; uniform float u_cam; uniform vec2 u_pitch;
out vec4 v_color; out vec2 v_off; out float v_r;
void main() {
  v_r = mix(a_radius, a_radius1, u_zt) * u_radius; v_color = a_color;
  float ext = v_r + u_strokeWidth + 1.0;
  v_off = a_corner * ext;
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
  vec4 c = toClip(a_pos);
  // u_pitch.x: circle-pitch-alignment is 'map', and the circle lies on the map: the offset is in tile units.
  // Otherwise the circle faces the viewer, and the offset is in screen pixels after projection.
  // u_pitch.y: circle-pitch-scale is 'map' (the default), and a distant circle is smaller, as the map under it is.
  // With 'viewport' every circle has the size that it has at the centre of the view (as in MapLibre).
  float w = c.w;
  vec2 px = u_translate;
  if (u_pitch.x > 0.0) c = toClip(a_pos + v_off * (u_pitch.y > 0.0 ? 1.0 : w / u_cam) / u_scale * lineScale(a_pos));
  else px += v_off * (u_pitch.y > 0.0 ? u_cam / w : 1.0);
  c.xy += px * vec2(2.0, -2.0) / u_view * c.w;
  gl_Position = inside ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform vec4 u_color; uniform vec4 u_stroke; uniform float u_strokeWidth; uniform float u_blur; in vec4 v_color; in vec2 v_off; in float v_r; out vec4 o;
void main() {
  float d = length(v_off), outer = v_r + u_strokeWidth;
  // As in MapLibre, the antialiased (or blurred) edge sits inside the radius.
  float w = max(u_blur * outer, 1.0);
  float a = smoothstep(0.0, w, outer - d), st = u_strokeWidth < 0.01 ? 0.0 : smoothstep(-w, 0.0, d - v_r);
  vec4 c = v_color * u_color;
  o = a * mix(vec4(c.rgb * c.a, c.a), u_stroke, st);
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

    // Buildings: roofs and walls with a height in metres and a baked light level.
    extrusion: [`${VS_COMMON} ${TERRAIN_GLSL}
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; layout(location=2) in float a_ed; out vec4 v_color; out vec2 v_tile; out vec2 v_p; out float v_side;
uniform mat3 u_pat; uniform float u_hf; uniform float u_pattern; uniform vec4 u_color; uniform vec3 u_lightPos; uniform vec3 u_lightColor; uniform float u_lightIntensity; uniform float u_gradient;
void main() {
  v_tile = a_v.xy;
  // The light model of MapLibre. A face is brighter when it looks at the light; a dark colour is made brighter by
  // more than a light colour. Walls are darker near the ground (the vertical gradient).
  bool roof = a_v.w < 0.0; float other = floor(a_v.w / ${WALL_OTHER}.0), rest = a_v.w - other * ${WALL_OTHER}.0, t = rest >= ${WALL_TOP}.0 ? 1.0 : 0.0, angle = rest - t * ${WALL_TOP}.0 - ${Math.PI};
  float base = t > 0.5 ? other : max(a_v.z, 0.0), height = t > 0.5 ? max(a_v.z, 0.0) : other;
  vec3 normal = roof ? vec3(0.0, 0.0, 1.0) : vec3(cos(angle), sin(angle), 0.0);
  // fill-extrusion-pattern: the image lies flat on the roof and runs along the ring on the walls, as in MapLibre,
  // and the light alone sets the shade.
  v_p = (u_pat * vec3(roof ? a_v.xy : vec2(a_ed, max(a_v.z, 0.0) * u_hf), 1.0)).xy;
  // (As in MapLibre, a translucent colour is multiplied by its alpha and then drawn solid; only the opacity of the layer shows through.)
  vec4 c = u_pattern > 0.5 ? vec4(1.0, 1.0, 1.0, u_color.a) : vec4(a_color.rgb * a_color.a * u_color.rgb, u_color.a);
  float value = u_pattern > 0.5 ? 0.5 : dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 rgb = c.rgb + 0.03 * (1.0 - u_pattern);
  float lit = clamp(dot(normal, u_lightPos), 0.0, 1.0);
  lit = mix(1.0 - u_lightIntensity, max(1.0 - value + u_lightIntensity, 1.0), lit);
  if (!roof) lit *= (1.0 - u_gradient) + u_gradient * clamp((t + base) * sqrt(height / 150.0), mix(0.7, 0.98, 1.0 - u_lightIntensity), 1.0);
  v_color = vec4(clamp(rgb * lit * u_lightColor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightColor), vec3(1.0)), c.a);
  v_side = horizonSide(a_v.xy);
  gl_Position = toClip3D(a_v.xy, a_v.z + ground(a_v.xy / ${EXTENT}.0));
}`, `
uniform vec4 u_clip; uniform float u_pattern; in vec4 v_color; in vec2 v_tile; in vec2 v_p; in float v_side; out vec4 o; ${PATTERN_GLSL}
void main() { ${FS_CLIP} if (v_side < 0.0) discard; o = u_pattern > 0.5 ? tile(v_p) * vec4(v_color.rgb, 1.0) * v_color.a : vec4(v_color.rgb * v_color.a, v_color.a); }`],

    raster: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; uniform vec2 u_corners[4]; uniform vec4 u_q; out vec3 v_uvq; out vec2 v_tile;
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
  float q = mix(mix(u_q.x, u_q.y, ap.x), mix(u_q.w, u_q.z, ap.x), ap.y);
  v_uvq = vec3(ap * q, q);
  v_tile = mix(mix(u_corners[0], u_corners[1], ap.x), mix(u_corners[3], u_corners[2], ap.x), ap.y);
#ifdef GLOBE
  gl_Position = toClip(isPole(a_pos) ? vec2(v_tile.x, a_pos.y) : v_tile);
#else
  gl_Position = toClip(v_tile);
#endif
}`, `
uniform sampler2D u_image; uniform vec4 u_clip; uniform vec3 u_adjust; uniform vec2 u_bright; uniform vec3 u_spin; in vec3 v_uvq; in vec2 v_tile; out vec4 o;
void main() {
  ${FS_CLIP}
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

    // A `hillshade` layer. `u_light` has `hillshade-exaggeration`, the method (0 `standard`, 1 `combined`, 2 `igor`,
    // 3 `basic` and `multidirectional`) and the number of lights; `u_sun` has the direction and the altitude of each
    // light in radians. The methods are those of MapLibre GL JS; `basic` is `multidirectional` with one light.
    hillshade: [VS_DEM, `
uniform sampler2D u_image; uniform vec4 u_clip; uniform vec2 u_latrange; uniform vec3 u_light; uniform vec2 u_sun[${LIGHTS}];
uniform vec4 u_shadow[${LIGHTS}]; uniform vec4 u_highlight[${LIGHTS}]; uniform vec4 u_accent; in vec2 v_uv; in vec2 v_tile; out vec4 o;
const float PI = 3.141592653589793;
void main() {
  ${FS_CLIP}
  // Slopes are divided by cos(latitude) to undo the mercator projection's stretching.
  float scaleFactor = cos(radians((u_latrange.x - u_latrange.y) * (1.0 - v_uv.y) + u_latrange.y));
  vec2 deriv = (texture(u_image, v_uv).rg - 128.0 / 255.0) * 8.0 / scaleFactor;
  float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);
  float intensity = u_light.x, shade = abs(mod((aspect + u_sun[0].x) / PI + 1.5, 2.0) - 1.0);
  if (u_light.y > 0.0) {
    deriv *= intensity * 2.0;
    float steep = atan(length(deriv)) * 2.0 / PI;
    o = steep * mix(u_shadow[0], u_highlight[0], shade);
    if (u_light.y == 2.0) return;
    for (int i = 0; i < int(u_light.z); i++) {
      // The cosine of the angle between the light and the normal of the ground.
      float c = clamp((sin(u_sun[i].y) + cos(u_sun[i].y) * (deriv.y * cos(u_sun[i].x) - deriv.x * sin(u_sun[i].x))) / sqrt(1.0 + dot(deriv, deriv)), 0.0, 1.0);
      if (u_light.y == 1.0) { o = steep * mix(u_highlight[0], u_shadow[0], acos(c) * 2.0 / PI); return; }
      if (i == 0) o = vec4(0.0);
      o += (c > 0.5 ? u_highlight[i] * (2.0 * c - 1.0) : u_shadow[i] * (1.0 - 2.0 * c)) / u_light.z;
    }
    return;
  }
  float slope = atan(0.625 * length(deriv));
  float base = 1.875 - intensity * 1.75, maxValue = 0.5 * PI;
  float scaledSlope = intensity != 0.5 ? ((pow(base, slope) - 1.0) / (pow(base, maxValue) - 1.0)) * maxValue : slope;
  vec4 accent = (1.0 - cos(scaledSlope)) * u_accent * clamp(intensity * 2.0, 0.0, 1.0);
  vec4 shadeColor = mix(u_shadow[0], u_highlight[0], shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);
  o = accent * (1.0 - shadeColor.a) + shadeColor;
}`],

    // A `color-relief` layer: the colour of each pixel comes from its elevation. `u_stops` has the elevations of the
    // stops of `color-relief-color` and `u_ramp` has the colour at each stop. The colour between two stops is a linear
    // mix, as in MapLibre GL JS. (The filter of the elevation texture is linear, and so is the encoding: the texture
    // gives the elevation between its pixels.) Two stops of the same elevation have one colour in `u_ramp`,
    // and the shader does not divide by their distance of zero. (A ramp of one stop arrives here as two stops.)
    'color-relief': [VS_DEM, `
uniform sampler2D u_image; uniform sampler2D u_ramp; uniform highp sampler2D u_stops; uniform vec4 u_clip; uniform vec4 u_unpack; uniform float u_opacity;
in vec2 v_uv; in vec2 v_tile; out vec4 o;
float stop(int i) { return texelFetch(u_stops, ivec2(i, 0), 0).r; }
void main() {
  ${FS_CLIP}
  float e = dot(texture(u_image, v_uv).rgb * 255.0, u_unpack.rgb) - u_unpack.a;
  int l = 0, r = textureSize(u_stops, 0).x - 1;
  while (r - l > 1) { int m = (l + r) / 2; if (e < stop(m)) r = m; else l = m; }
  float d = stop(r) - stop(l);
  o = mix(texelFetch(u_ramp, ivec2(l, 0), 0), texelFetch(u_ramp, ivec2(r, 0), 0), d > 0.0 ? clamp((e - stop(l)) / d, 0.0, 1.0) : 0.0) * u_opacity;
}`],

    // The icons of a tile that need no place among the labels (see `IconBatch`). The GPU finds the place of each one
    // from its point in the tile, as for circles. `a_v`: the point, and the corner in the texture. `a_d`: the corner
    // from the centre of the icon in pixels at size 1, and 1 for a distance-field icon.
    icon: [`${VS_COMMON}${TERRAIN_GLSL}
layout(location=0) in vec4 a_v; layout(location=1) in vec3 a_d; layout(location=2) in float a_angle; layout(location=3) in vec2 a_size; layout(location=4) in float a_alpha;
uniform float u_zt; uniform float u_size; uniform float u_north; uniform float u_persp; uniform float u_dpr; uniform float u_opacity;
uniform vec2 u_offset; uniform vec2 u_anchor; uniform vec2 u_translate; uniform vec2 u_tex; uniform vec4 u_clip;
out vec2 v_uv; out float v_alpha; out float v_sdf;
void main() {
  vec4 c = toClip3(a_v.xy, ground(a_v.xy / ${EXTENT}.0));
  float s = mix(a_size.x, a_size.y, u_zt) * u_size, a = u_north + a_angle;
  // On a tilted map, far icons are smaller and near icons are larger, by half of what the perspective does (as for labels).
  if (u_persp > 0.0) s *= min(4.0, 0.5 + 0.5 * u_persp / c.w);
  vec2 ext = abs(a_d.xy) * s, centre = (c.xy / c.w * vec2(0.5, -0.5) + 0.5) * u_view + (u_offset + u_anchor * abs(a_d.xy) * 2.0) * s + u_translate;
  // An upright icon is put on whole device pixels: between pixels, the texture filter smears fine detail.
  if (a == 0.0) { vec2 corner = centre - ext; centre += floor(corner * u_dpr + 0.5) / u_dpr - corner; }
  vec2 q = a_d.xy * s, p = centre + vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
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

    // Icons. A colour with alpha >= 0 marks a distance-field icon, drawn in that colour with an edge that stays sharp.
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

/** `u` is empty until the program is first used: see `link`. */
interface Program { prog: WebGLProgram; u: Record<string, WebGLUniformLocation>; shaders?: WebGLShader[]; /** The globe variant: the frame whose globe it has. */ frame?: number }
/** The programs that have a globe variant (see `GLOBE_GLSL`). */
const GLOBE_PROGRAMS = new Set(['fill', 'pattern', 'edge', 'line', 'circle', 'heat', 'raster', 'hillshade', 'color-relief', 'icon', 'extrusion']);
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
    type: GLBatch['type']; vao: WebGLVertexArrayObject; count: number; /** UNSIGNED_SHORT or UNSIGNED_INT. */ indexType: number; color: boolean; scalar: boolean; bufs: WebGLBuffer[];
    edgeVao?: WebGLVertexArrayObject; edgeCount?: number;
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
    /** Latitude of the tile's top and bottom edges, for hillshade. */
    lat?: [number, number];
    /** Elevation tiles: the encoded heights as downloaded, their size in pixels and how to decode them. */
    raw?: WebGLTexture; rawSize?: number; unpack?: number[];
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
     * Ground heights in metres at the corners of a 64 x 64 grid over the tile (65 x 65 values, row by row), and a
     * number that changes when they do. They come from data shared between tiles, so neighbours agree along their edges.
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
    /** 3D terrain: the ground tiles to draw, and a lookup of the heights under any tile (for buildings). */
    terrain?: {exaggeration: number; tiles: TerrainTile[]; dem(id: TileID): DemRef | null};
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
     * centre, and the tiles of the background.
     */
    globe?: {m: Float32Array; horizon: number[]; cam: number[]; rays: number[]; t: number; cosLat: number; tiles: TileID[]};
}

/**
 * The values of the `sky` of a style at a zoom, with the defaults of the specification: the colours (premultiplied
 * RGBA) and the blends. Fog has an opacity of 0 below a pitch of 60 that rises to 1 at 70, as in MapLibre GL JS.
 */
export function skyValues(sky: Sky, zoom: number, pitch: number) {
    const at = (k: keyof Sky, kind: 'number' | 'color', def: unknown) => compileProp(sky[k], kind, def).eval(zoom) as any;
    return {sky: at('sky-color', 'color', '#88c6fc') as number[], horizon: at('horizon-color', 'color', '#ffffff') as number[], fog: at('fog-color', 'color', '#ffffff') as number[],
        skyBlend: at('sky-horizon-blend', 'number', 0.8) as number, horizonFog: at('horizon-fog-blend', 'number', 0.8) as number, ground: at('fog-ground-blend', 'number', 0.5) as number, atmosphere: at('atmosphere-blend', 'number', 0.8) as number,
        opacity: Math.min(1, Math.max(0, (pitch - 60) / 10))};
}

/** A colour without its alpha. */
const opaque = (c: number[]) => { const a = c[3] || 1; return [c[0] / a, c[1] / a, c[2] / a, 1]; };

export const SPRITE_ATLAS = 2048;
// How the light's direction maps to tile coordinates (y points south) and turns with the bearing.
const LIGHT_X = -1, LIGHT_Y = -1, LIGHT_TURN = 1;

type IconOf = (name: string) => {x: number; y: number; width: number; height: number; pixelRatio: number; custom?: boolean; sdf?: boolean} | undefined;

export class GLRenderer {
    gl: WebGL2RenderingContext;
    /** Empty until the first program is used: see `ready`. */
    private programs = {} as Record<keyof typeof SHADERS, Program>;
    /** The globe variants of the programs, linked at their first use (a Mercator map never links them). */
    private globePrograms: Partial<Record<keyof typeof SHADERS, Program>> = {};
    /** The globe of the frame that is being drawn, if any (see `Scene.globe`). */
    private globe?: Scene['globe'];
    /** The grid that raster, hillshade and background tiles are drawn on with the globe, in tile units: see `globeGrid`. */
    private globeMesh?: {vao: WebGLVertexArrayObject; main: number; pole: number};
    private quad: WebGLVertexArrayObject;
    private textVao: WebGLVertexArrayObject;
    private textBuf: WebGLBuffer;
    private spriteVao: WebGLVertexArrayObject;
    private spriteBuf: WebGLBuffer;
    private sdfTex: WebGLTexture;
    private sdfVersion = -1;
    private spriteTex: WebGLTexture;
    private spriteSized = false;
    /** The width and height of the texture of the images that are added at runtime. */
    private spriteSize = 256;
    private iconTex: WebGLTexture;
    private iconSize: [number, number] = [1, 1];
    private newTexture: () => WebGLTexture;
    private fbo: WebGLFramebuffer;
    private dpr = 1;

    constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, antialias = false) {
        const gl = canvas.getContext('webgl2', {antialias, alpha: true, premultipliedAlpha: true, stencil: true, depth: true}) as WebGL2RenderingContext | null;
        if (!gl) throw new Error('WebGL2 is not available');
        this.gl = gl;
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
    private link(vs: string, fs: string, globe = false): Program {
        const gl = this.gl, prog = gl.createProgram()!;
        const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, src]) => {
            const s = gl.createShader(type as number)!;
            gl.shaderSource(s, HEAD + (globe ? '#define GLOBE\n' : '') + src);
            gl.compileShader(s);
            gl.attachShader(prog, s);
            return s;
        });
        gl.linkProgram(prog);
        return {prog, u: {}, shaders};
    }

    /** The program `name`, linked, with the locations of its uniforms. */
    private ready(name: keyof typeof SHADERS): Program {
        const gl = this.gl;
        // The shaders compile at the first use of any program, in the first frame, after that frame has requested its
        // tiles (#390): in some browsers (Safari) `compileShader` itself takes time on this thread. All of them start
        // at once, so that the driver can compile them in parallel (KHR_parallel_shader_compile, where it exists).
        if (!this.programs.fill) {
            gl.getExtension('KHR_parallel_shader_compile');
            for (const n in SHADERS) this.programs[n as keyof typeof SHADERS] = this.link(SHADERS[n as keyof typeof SHADERS][0], SHADERS[n as keyof typeof SHADERS][1]);
        }
        let p = this.programs[name];
        if (this.globe && GLOBE_PROGRAMS.has(name)) p = this.globePrograms[name] ??= this.link(SHADERS[name][0], SHADERS[name][1], true);
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
                index(b.idx);
                count = b.idx.length;
            } else if (b.type === 'line') {
                attr(0, b.v, 4, gl.SHORT, false, LINE_VERTEX, 0);
                attr(2, b.v, 1, gl.SHORT, false, LINE_VERTEX, 8, false, true);
                attr(4, b.v, 1, gl.FLOAT, false, LINE_VERTEX, 12, false, true);
                vertices = b.v.length / LINE_VERTEX;
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.width) { attr(3, b.width, 1, gl.FLOAT); scalar = true; if (b.width1) attr(5, b.width1, 1, gl.FLOAT); else attr(5, b.width, 1, gl.FLOAT, false, 0, 0, false, true); }
                index(b.idx);
                count = b.idx.length;
            } else {
                vertices = b.pos.length / 4;
                attr(2, b.pos, 2, gl.SHORT, false, 8, 0);
                attr(0, b.pos, 2, gl.SHORT, false, 8, 4, false, true);
                if (b.color) attr(1, b.color, 4, gl.UNSIGNED_BYTE, true);
                if (b.radius) { attr(3, b.radius, 1, gl.FLOAT); scalar = true; if (b.radius1) attr(5, b.radius1, 1, gl.FLOAT); else attr(5, b.radius, 1, gl.FLOAT, false, 0, 0, false, true); }
                index(b.idx);
                count = b.idx.length;
            }
            batches[id] = {type: b.type, vao, count, indexType, color: !!b.color, scalar, bufs, edgeVao, edgeCount: b.type === 'fill' ? b.edges?.length : undefined};
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
                    const anchor = p.iconAnchor.eval(zoom) as string, offset = p.iconOffset.eval(zoom) as number[], translate = screenTranslate(p.iconTranslate.eval(zoom), p.iconTranslateAnchor.eval(zoom), tr.bearing), color = p.iconColor.eval(zoom) as number[];
                    gl.uniform1f(u.u_size, p.iconSize.dd ? 1 : p.iconSize.eval(zoom));
                    gl.uniform1f(u.u_opacity, p.iconOpacity.dd ? 1 : p.iconOpacity.eval(zoom));
                    // (`icon-rotation-alignment`: an icon that is aligned with the map turns with the map.)
                    gl.uniform1f(u.u_north, p.iconAlign.eval(zoom) === 'map' ? -tr.bearing * Math.PI / 180 : 0);
                    gl.uniform1f(u.u_persp, tr.pitch ? tr.cameraDistance : 0);
                    gl.uniform1f(u.u_dpr, this.dpr);
                    gl.uniform2f(u.u_offset, offset[0], offset[1]);
                    gl.uniform2f(u.u_anchor, anchor.includes('left') ? 0.5 : anchor.includes('right') ? -0.5 : 0, anchor.includes('top') ? 0.5 : anchor.includes('bottom') ? -0.5 : 0);
                    gl.uniform2f(u.u_translate, translate[0], translate[1]);
                    gl.uniform4f(u.u_color, color[0], color[1], color[2], color[3]);
                    gl.uniform1i(u.u_img, 0);
                }
                this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                this.placeTile(u, it.id, it.matrix4);
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

    /** Wraps a decoded raster or elevation tile image as a drawable tile. */
    createImageTile(image: ImageBitmap | {width: number; height: number; data: Uint8Array}, encoding: DemEncoding | undefined, id: TileID): GLTile {
        const dem = !!encoding;
        const gl = this.gl, tex = this.newTexture();
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !dem);
        // (Elevation tiles arrive as plain pixels, which a tile worker decoded.)
        if ('data' in image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        const tile: GLTile = {uid: ++this.uids, labels: {}, batches: {}, tex};
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
            tile.raw = tex; tile.rawSize = image.width;
            tile.tex = slopes;
            tile.lat = [latFromMerc(id.y / n), latFromMerc((id.y + 1) / n)];
        }
        return tile;
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
        const use = (name: keyof typeof SHADERS) => this.use(name, tr);
        const color = (L: CompiledLayer) => {
            const c = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom), op = L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom);
            return [c[0], c[1], c[2], c[3] * op];
        };

        // Selects the pattern program for an image; returns a function that positions the pattern, or null if the image is missing.
        const Z = Math.floor(zoom), fade = zoom - Z;
        const pattern = (name: string, opacity: number) => {
            const img = s.icon?.(name);
            if (!img) return null;
            const u = use('pattern');
            bindImage(u, img);
            gl.uniform2f(u.u_fade, 0, opacity);
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

        for (const L of only ? [only] : s.layers.slice(from, to)) {
            if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
            // (A custom layer draws on the screen, also with 3D terrain and on the globe, and not on the pictures of the
            // terrain tiles. On the globe it gets the matrices of the globe, #1431.)
            if (L.type === 'custom') { if (pass !== 'ground') { this.custom?.(L.id, s); this.current = null; } continue; }
            if (L.type === 'heatmap') { if (pass !== 'buildings') this.drawHeatmap(L, tr, bySource.get(L.source!) ?? [], target); continue; }
            if (!only && (L.type === 'fill' || L.type === 'line' || L.type === 'raster') && pass !== 'buildings') {
                // Layer-wide opacity and blending: the layer is drawn on its own first, so that overlapping features
                // form one surface, and that surface is then put onto the map once.
                const opacity = L.p.layerOpacity?.eval(zoom) ?? 1, blend = L.p.layerBlend.eval(zoom) as string;
                if (opacity < 1 || blend !== 'normal') {
                    if (opacity > 0) this.compositeLayer(s, tr, bySource, target, pass, L, opacity, blend);
                    continue;
                }
            }
            if ((L.type === 'fill-extrusion') !== (pass === 'buildings') && pass !== 'all') continue;
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
                // Screen position -> world pixels at zoom Z, about the map centre (pitch is ignored for backgrounds).
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
                // Unit square -> the screen below the horizon (all of it unless the pitch is high).
                const top = tr.globeness ? 1 : Math.min(1, 1 - 2 * (tr.cy - tr.horizon()) / tr.height);
                gl.uniformMatrix4fv(u.u_matrix, false, [2, 0, 0, 0, 0, -1 - top, 0, 0, 0, 0, 1, 0, -1, top, 0, 1]);
                gl.uniform4f(u.u_clip, -1, -1, 2, 2);
                gl.uniform4fv(u.u_color, color(L));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                continue;
            }
            const items = bySource.get(L.source!);
            if (!items) continue;
            if (L.type === 'raster' || L.type === 'hillshade' || L.type === 'color-relief') {
                const u = use(L.type), p = L.p;
                gl.activeTexture(gl.TEXTURE0);
                gl.uniform1i(u.u_image, 0);
                gl.bindVertexArray(this.globe ? this.globeGrid().vao : this.quad);
                // `raster-resampling` (or `resampling`): the filter of the texture, set before each tile is drawn.
                const filter = (p.resampling.eval(zoom) ?? p.rasterResampling?.eval(zoom)) === 'nearest' ? gl.NEAREST : gl.LINEAR;
                if (L.type === 'raster') {
                    const sat = p.saturation.eval(zoom), con = p.contrast.eval(zoom);
                    gl.uniform3f(u.u_adjust, p.opacity.eval(zoom), sat > 0 ? 1 - 1 / (1.001 - sat) : -sat, con > 0 ? 1 / (1 - con) : 1 + con);
                    gl.uniform2f(u.u_bright, p.brightnessMin.eval(zoom), p.brightnessMax.eval(zoom));
                    const h = p.hueRotate.eval(zoom) * Math.PI / 180, sn = Math.sin(h), cs = Math.cos(h);
                    gl.uniform3f(u.u_spin, (2 * cs + 1) / 3, (-Math.sqrt(3) * sn - cs + 1) / 3, (Math.sqrt(3) * sn - cs + 1) / 3);
                } else if (L.relief) {
                    gl.uniform1f(u.u_opacity, p.opacity.eval(zoom));
                    gl.uniform1i(u.u_ramp, 1); gl.uniform1i(u.u_stops, 2);
                    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.ramp!));
                    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.relief));
                    gl.activeTexture(gl.TEXTURE0);
                } else {
                    const h = hillshadeLights(p, zoom, p.anchor.eval(zoom) === 'viewport' ? s.tr.bearing * Math.PI / 180 : 0); // the map's bearing, also when drawing a terrain tile's picture
                    gl.uniform3f(u.u_light, p.exaggeration.eval(zoom), h.method, h.n);
                    gl.uniform2fv(u.u_sun, h.sun);
                    gl.uniform4fv(u.u_shadow, h.shadow);
                    gl.uniform4fv(u.u_highlight, h.highlight);
                    const c = p.accent.eval(zoom); gl.uniform4f(u.u_accent, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
                }
                // A map at rest, seen from above: the image moves by less than a pixel, so that its pixels are on the pixels of
                // the screen. An image between the pixels is blurred. The rule is that of MapLibre GL JS: the centre of the
                // map goes to a whole pixel of the world (to a half pixel when the size of the map is odd).
                let snap: number[] | undefined;
                for (const it of items) {
                    if (!it.tile.tex) continue;
                    let m = it.matrix4;
                    if (pass === 'all' && L.type === 'raster' && !s.moving && !tr.pitch && !this.globe) {
                        const a = -tr.bearing * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), xs = tr.width % 2 / 2, ys = tr.height % 2 / 2;
                        snap ??= [mercX(tr.lng) * tr.worldSize + cos * xs + sin * ys, mercY(tr.lat) * tr.worldSize + cos * ys + sin * xs].map(v => (v -= Math.round(v)) > 0.5 ? v - 1 : v);
                        const x = snap[0] / it.scale, y = snap[1] / it.scale;
                        m = m.slice(); m[12] += m[0] * x + m[4] * y; m[13] += m[1] * x + m[5] * y;
                    }
                    this.placeTile(u, it.id, m);
                    gl.uniform4fv(u.u_clip, it.clip);
                    if (it.tile.lat) gl.uniform2fv(u.u_latrange, it.tile.lat);
                    if (L.type === 'raster') { gl.uniform2fv(u.u_corners, it.corners ?? SQUARE); gl.uniform4fv(u.u_q, it.corners ? cornerWeights(it.corners) : ONES); }
                    if (L.relief) gl.uniform4fv(u.u_unpack, it.tile.unpack!);
                    gl.bindTexture(gl.TEXTURE_2D, L.relief ? it.tile.raw! : it.tile.tex);
                    withFilter(gl, filter, () => this.globe ? this.drawGrid(it.id) : gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4));
                }
                continue;
            }
            if (L.type === 'fill' && L.p.pattern.eval(zoom)) {
                const place = pattern(L.p.pattern.eval(zoom), L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                if (place) for (const it of items) {
                    const b = it.tile.batches[L.id];
                    if (!b) continue;
                    const u = place(tilePixels(it.id));
                    this.placeTile(u, it.id, it.matrix4);
                    gl.uniform4fv(u.u_clip, it.clip);
                    gl.bindVertexArray(b.vao);
                    gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                }
                continue;
            }
            let first = true;
            // fill-translate, line-translate and fill-extrusion-translate move the layer by screen pixels. The anchor
            // says if the direction turns with the map (the default) or stays fixed on the screen.
            const tl = L.type === 'fill' || L.type === 'line' || L.type === 'fill-extrusion' ? L.p.translate.eval(zoom) as number[] | null : null;
            let tx = tl?.[0] ?? 0, ty = tl?.[1] ?? 0;
            if ((tx || ty) && L.p.translateAnchor.eval(zoom) === 'viewport') {
                const a = -tr.bearing * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
                [tx, ty] = [tx * c + ty * sn, -tx * sn + ty * c];
            }
            const moved = (it: RenderItem<GLTile>) => {
                if (!tx && !ty) return it.matrix4;
                const m = Float32Array.from(it.matrix4), x = tx / it.scale, y = ty / it.scale;
                for (let i = 0; i < 4; i++) m[12 + i] += m[i] * x + m[4 + i] * y;
                return m;
            };
            // Buildings are the one layer that needs depth sorting; everything else is painted back to front.
            const extrude = L.type === 'fill-extrusion', pending: (() => void)[] = [];
            let patImg: Parameters<typeof patMatrix>[0] | undefined;
            if (extrude) {
                // The fill-extrusion layers of a frame share one depth buffer, as in MapLibre GL JS, so the roof of one
                // layer hides the lower part of a building in a later layer. On 3D terrain the ground's depth is kept
                // too, so hills hide the buildings behind them.
                gl.clear(s.terrain || this.extrusionDepth ? gl.STENCIL_BUFFER_BIT : gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
                this.extrusionDepth = true;
                gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
            }
            for (const it of items) {
                const b = it.tile.batches[L.id];
                if (!b) continue;
                const u = use(b.type), m = moved(it);
                if (extrude) this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                if (first) {
                    first = false;
                    gl.uniform4fv(u.u_color, color(L));
                    if (extrude) {
                        // The position of the light is a distance, an azimuth and a polar angle. With the `viewport`
                        // anchor (the default) the light turns with the view; with `map` it stays at one compass direction.
                        // (The values of the light can be functions of zoom.)
                        const light = s.light ?? {}, at = (v: unknown, kind: 'number' | 'color' | 'string', def: unknown) => compileProp(v, kind, def).eval(zoom);
                        const [r, az, polar] = at(light.position, 'string', [1.15, 210, 30]) as number[], lc = at(light.color, 'color', '#fff') as number[];
                        const a = (az + 90) * Math.PI / 180 + (light.anchor === 'map' ? 0 : LIGHT_TURN * tr.bearing * Math.PI / 180), p = polar * Math.PI / 180;
                        gl.uniform3f(u.u_lightPos, LIGHT_X * r * Math.cos(a) * Math.sin(p), LIGHT_Y * r * Math.sin(a) * Math.sin(p), r * Math.cos(p));
                        gl.uniform3f(u.u_lightColor, lc[0], lc[1], lc[2]);
                        gl.uniform1f(u.u_lightIntensity, at(light.intensity, 'number', 0.5) as number);
                        gl.uniform1f(u.u_gradient, L.p.gradient.eval(zoom) === false ? 0 : 1);
                        const base = L.p.color.dd ? [1, 1, 1, 1] : L.p.color.eval(zoom);
                        gl.uniform4f(u.u_color, base[0] * base[3], base[1] * base[3], base[2] * base[3], L.p.opacity.eval(zoom));
                        // fill-extrusion-pattern: nothing is drawn while the image is not available. A pattern for each
                        // feature is not supported: the colour is drawn.
                        const name = L.p.pattern.dd ? '' : L.p.pattern.eval(zoom), img = name ? s.icon?.(name) : undefined;
                        if (name && !img) { first = true; break; }
                        gl.uniform1f(u.u_pattern, img ? 1 : 0);
                        if (img) { bindImage(u, img); patImg = img; }
                    }
                    if (b.type === 'line') {
                        const dash = L.p.dash.eval(zoom) as number[] | null;
                        gl.uniform1f(u.u_width, L.p.width.dd ? 1 : L.p.width.eval(zoom));
                        gl.uniform1f(u.u_floorWidth, L.p.width.dd ? 1 : L.p.width.eval(Math.floor(zoom)));
                        gl.uniform1f(u.u_zf, 2 ** (zoom - Math.floor(zoom)));
                        gl.uniform1f(u.u_gap, L.p.gap.eval(zoom));
                        gl.uniform1f(u.u_offset, L.p.offset.dd ? 0 : L.p.offset.eval(zoom));
                        gl.uniform1f(u.u_blur, L.p.blur.dd ? 0 : L.p.blur.eval(zoom));
                        gl.uniform4f(u.u_dash, dash?.[0] ?? 0, dash?.[1] ?? 0, dash?.[2] ?? 0, dash?.[3] ?? 0);
                        const cap = L.p.cap.dd ? 'butt' : L.p.cap.eval(zoom);
                        gl.uniform1i(u.u_cap, cap === 'round' ? 1 : cap === 'square' ? 2 : 0);
                        const name = L.p.pattern.dd ? '' : L.p.pattern.eval(zoom), img = name ? s.icon?.(name) : undefined;
                        gl.uniform2f(u.u_patSize, L.ramp ? -1 : img ? img.width / img.pixelRatio : 0, img ? img.height / img.pixelRatio : 1);
                        if (L.ramp) {
                            gl.activeTexture(gl.TEXTURE0);
                            gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.ramp));
                            gl.uniform1i(u.u_img, 0);
                            gl.uniform4f(u.u_color, 1, 1, 1, L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                        }
                        // Draw nothing while the image is not available. A pattern for each feature is not available at all.
                        if (L.p.pattern.dd || (name && !img)) { first = true; break; }
                        if (img) {
                            gl.activeTexture(gl.TEXTURE0);
                            gl.bindTexture(gl.TEXTURE_2D, img.custom ? this.spriteTex : this.iconTex);
                            gl.uniform1i(u.u_img, 0);
                            gl.uniform2f(u.u_tex, img.custom ? this.spriteSize : this.iconSize[0], img.custom ? this.spriteSize : this.iconSize[1]);
                            gl.uniform4f(u.u_rect, img.x, img.y, img.width, img.height);
                            gl.uniform4f(u.u_color, 1, 1, 1, L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                        }
                    }
                    if (b.type === 'circle') {
                        const sc = L.p.strokeColor.eval(zoom), a = sc[3] * (L.p.strokeOpacity.dd ? 1 : L.p.strokeOpacity.eval(zoom));
                        const tl = screenTranslate(L.p.translate.eval(zoom), L.p.translateAnchor.eval(zoom), tr.bearing);
                        gl.uniform1f(u.u_blur, L.p.blur.dd ? 0 : L.p.blur.eval(zoom));
                        gl.uniform2f(u.u_translate, tl[0], tl[1]);
                        gl.uniform1f(u.u_radius, L.p.radius.dd ? 1 : L.p.radius.eval(zoom));
                        gl.uniform1f(u.u_strokeWidth, L.p.strokeWidth.eval(zoom));
                        gl.uniform4f(u.u_stroke, sc[0] * a, sc[1] * a, sc[2] * a, a);
                        gl.uniform2f(u.u_pitch, +(L.p.pitchAlign.eval(zoom) === 'map'), +(L.p.pitchScale.eval(zoom) !== 'viewport'));
                    }
                }
                this.placeTile(u, it.id, m);
                gl.uniform4fv(u.u_clip, it.clip);
                gl.bindVertexArray(b.vao);
                // Attributes without a buffer read these constants, so shaders need no variants.
                if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                if (!b.scalar) { gl.vertexAttrib1f(3, 1); gl.vertexAttrib1f(5, 1); }
                if (b.type === 'line' || b.type === 'circle') gl.uniform1f(u.u_zt, Math.min(1, Math.max(0, zoom - (it.tile.z ?? it.id.z))));
                if (b.type === 'line' || b.type === 'circle') {
                    gl.uniform1f(u.u_scale, it.scale);
                    gl.uniform1f(u.u_cam, tr.cameraDistance);
                }
                if (b.type === 'line') {
                    // Dashes are sized at whole zoom levels so they stretch, rather than crawl, while zooming.
                    gl.uniform1f(u.u_dashScale, it.scale / 2 ** (zoom - Math.floor(zoom)));
                }
                if (extrude) {
                    // Depth first, colour second: translucent buildings then blend once, with the nearest surface only.
                    gl.colorMask(false, false, false, false);
                    gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                    gl.colorMask(true, true, true, true);
                    pending.push(() => {
                        this.placeTile(u, it.id, m);
                        // (The walls take the height in metres to tile units as MapLibre GL JS does, whose tiles have 8192 units.)
                        if (patImg) { gl.uniformMatrix3fv(u.u_pat, false, patMatrix(patImg, tilePixels(it.id))); gl.uniform1f(u.u_hf, -(2 ** it.id.z) / 2 / EXTENT); }
                        this.bindDem(u, s.terrain ? s.terrain.dem(it.id) : null, s.terrain?.exaggeration ?? 0, s.terrain ? s.tr.elevation : 0);
                        gl.uniform4fv(u.u_clip, it.clip);
                        gl.bindVertexArray(b.vao);
                        if (!b.color) gl.vertexAttrib4f(1, 1, 1, 1, 1);
                        gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                    });
                } else gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
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
                    gl.uniform2f(u.u_world, target[0], target[1]);
                    gl.uniform1f(u.u_attr, b.color && !explicit ? 1 : 0);
                    this.placeTile(u, it.id, moved(it));
                    gl.uniform4fv(u.u_clip, it.clip);
                    gl.bindVertexArray(b.edgeVao);
                    gl.drawElements(gl.LINES, b.edgeCount!, b.indexType, 0);
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

        this.current = null;
    }

    /** True once a fill-extrusion layer of this frame has cleared the depth buffer. */
    private extrusionDepth = false;
    private uids = 0;
    private current: Program | null = null;
    /** Selects a program, telling it the size of the view being drawn (the screen, or a terrain tile's texture). */
    private use(name: keyof typeof SHADERS, tr: Transform) {
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

    /** The matrix of a tile, and with the globe the place of the tile on the sphere. */
    private placeTile(u: Record<string, WebGLUniformLocation>, id: TileID, m: Float32Array | number[]) {
        this.gl.uniformMatrix4fv(u.u_matrix, false, m);
        if (this.globe && u.u_tileMerc) {
            const n = 2 ** id.z;
            this.gl.uniform4f(u.u_tileMerc, id.x / n, id.y / n, 1 / n / EXTENT, 1 / n / EXTENT);
        }
    }

    /**
     * The grid of the globe: 32 cells a side in tile units, and a row of triangles to each pole (y -32768 and 32767,
     * see subdivide.ts). The indices of the grid come first, then those of the north row, then those of the south row.
     */
    private globeGrid() {
        if (this.globeMesh) return this.globeMesh;
        const gl = this.gl, N = 32, pos: number[] = [], idx: number[] = [];
        for (let y = -1; y <= N + 1; y++) for (let x = 0; x <= N; x++) pos.push(x * EXTENT / N, y < 0 ? -32768 : y > N ? 32767 : y * EXTENT / N);
        const quad = (y: number) => { for (let x = 0; x < N; x++) { const i = y * (N + 1) + x; idx.push(i, i + 1, i + N + 1, i + 1, i + N + 2, i + N + 1); } };
        for (let y = 1; y <= N; y++) quad(y);
        quad(0); quad(N + 1);
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
        return this.globeMesh = {vao, main: N * N * 6, pole: N * 6};
    }

    /** Draws a tile on the grid of the globe, with the rows to the poles for a tile at the edge of the world. */
    private drawGrid(id: TileID) {
        const gl = this.gl, g = this.globeGrid(), n = 2 ** id.z;
        gl.drawElements(gl.TRIANGLES, g.main, gl.UNSIGNED_SHORT, 0);
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
            // These modes compute the result from the colours underneath, so those are copied and the output replaces them.
            this.belowTex ??= this.newTexture();
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.belowTex);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);
            gl.uniform1i(u.u_below, 1);
            gl.disable(gl.BLEND);
        }
        // Colours are premultiplied. Multiply is exact over an opaque map, which is what lies beneath in practice.
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

    private heatTarget?: {fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number};
    private ramps = new Map<Uint8Array | Float32Array, WebGLTexture>();
    private rampLayers?: CompiledLayer[];
    /**
     * The texture of a colour ramp (heatmap colours, line gradients, the colours of a `color-relief` layer), made on
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
        const keep = new Set(layers.flatMap(L => [L.ramp, L.relief]));
        for (const [pixels, tex] of this.ramps) if (!keep.has(pixels)) { this.gl.deleteTexture(tex); this.ramps.delete(pixels); }
    }
    private floatTargets?: boolean;

    private drawHeatmap(L: CompiledLayer, tr: Transform, items: RenderItem<GLTile>[], target: [number, number]) {
        const gl = this.gl, zoom = tr.zoom, w = Math.max(1, Math.ceil(target[0] / HEAT_SCALE)), h = Math.max(1, Math.ceil(target[1] / HEAT_SCALE));
        const back = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        // Densities add up past 1, so the picture holds half-float values where the browser can draw to them.
        this.floatTargets ??= !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
        let t = this.heatTarget;
        if (!t || t.w !== w || t.h !== h) {
            if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
            const tex = this.newTexture(), fb = gl.createFramebuffer()!;
            if (this.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
            else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            t = this.heatTarget = {fb, tex, w, h};
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.ONE, gl.ONE);
        let u = this.use('heat', tr);
        gl.uniform1f(u.u_weight, L.p.weight.dd ? 1 : L.p.weight.eval(zoom));
        gl.uniform1f(u.u_intensity, L.p.intensity.eval(zoom));
        gl.uniform1f(u.u_radius, L.p.radius.dd ? 30 : L.p.radius.eval(zoom));
        for (const it of items) {
            const b = it.tile.batches[L.id];
            if (!b) continue;
            this.placeTile(u, it.id, it.matrix4);
            gl.uniform4fv(u.u_clip, it.clip);
            gl.bindVertexArray(b.vao);
            if (!b.scalar) gl.vertexAttrib1f(3, 1);
            gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, back);
        gl.viewport(0, 0, target[0], target[1]);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const ramp = this.rampTexture(L.ramp!);
        u = this.use('heatColor', tr);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ramp);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.uniform1i(u.u_heat, 0); gl.uniform1i(u.u_ramp, 1);
        gl.uniform1f(u.u_opacity, L.p.opacity.eval(zoom));
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.current = null;
    }

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

    /** A 64 x 64 grid over a tile plus a skirt hanging from its edges, which hides the cracks between neighbouring tiles. */
    private terrainGrid() {
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
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
        return this.grid = {vao, count: idx.length, skirt};
    }

    /**
     * 3D terrain, step one: bring each ground tile's picture up to date. The flat layers are drawn straight down into
     * a texture per tile, which is kept until what it shows changes; panning and tilting then cost almost nothing.
     */
    /** Ground textures that are not in use, by size, to be used again. */
    private sparePictures = new Map<number, WebGLTexture[]>();
    private freeDrape(d: {tex: WebGLTexture; size: number}) {
        const list = this.sparePictures.get(d.size) ?? [];
        this.sparePictures.set(d.size, list);
        if (list.length < 8) list.push(d.tex); else this.gl.deleteTexture(d.tex);
    }
    /** Gives the memory of the GPU back at once. Without this, a map that was removed keeps it until the browser collects the context. */
    destroy() { if (!this.gl.isContextLost()) this.gl.getExtension(LOSE_CONTEXT)?.loseContext(); }

    private drapeWaits = new Map<string, number>();
    private gap = 33;
    private drapedAt = 0;
    /** How many levels up the nearest coarser tile with a picture is (0: there is none). */
    private coarserDrape(id: TileID) {
        for (let up = 1; up <= 5 && up <= id.z; up++) if (this.drapes.has(`${id.z - up}/${id.x >> up}/${id.y >> up}|${id.w}`)) return up;
        return 0;
    }
    private updateDrapes(s: Scene) {
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
                if (now - since < 300 && this.coarserDrape(t.id)) { behind = true; continue; }
            }
            // (Ground with no picture of its own and none of a coarser tile is a hole in the map: it does not wait its turn.)
            if (!d && this.coarserDrape(t.id) && fresh-- <= 0) { behind = true; continue; }
            if (!d || d.size !== size) {
                if (d) this.freeDrape(d);
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
        for (const [key, d] of this.drapes) if (this.frame - d.used > age) { this.freeDrape(d); this.drapes.delete(key); }
        return behind;
    }

    /** 3D terrain, step two: draw the ground tiles as raised meshes, with depth so near slopes hide far ones. */
    private drawTerrain(s: Scene) {
        const gl = this.gl, grid = this.terrainGrid(), u = this.use('terrain', s.tr);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.bindVertexArray(grid.vao);
        gl.enableVertexAttribArray(1);
        gl.uniform1i(u.u_drape, 0);
        gl.uniform1f(u.u_exag, s.terrain!.exaggeration);
        // Fog only where the style has a sky, and not on the globe.
        const fog = s.sky && !this.globe ? skyValues(s.sky, s.tr.zoom, s.tr.pitch) : undefined;
        gl.uniform2f(u.u_fogRange, s.tr.cameraDistance, s.tr.depthRange()[1]);
        gl.uniform3f(u.u_fog, Math.min(fog?.ground ?? 0, 0.999), Math.min(fog?.horizonFog ?? 0, 0.999), fog?.opacity ?? 0);
        if (fog) { gl.uniform4fv(u.u_fogColor, opaque(fog.fog)); gl.uniform4fv(u.u_horizonColor, opaque(fog.horizon)); }
        for (const t of s.terrain!.tiles) {
            let d = this.drapes.get(t.key), part = [0, 0, 1];
            // No picture of its own yet: show its share of the nearest ancestor's rather than a hole.
            if (!d) {
                const up = this.coarserDrape(t.id), k = 2 ** up;
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
                grid.skirt.forEach((from, k) => { all[t.heights.length + k] = t.heights[from]; });
                gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);
                mh.version = t.heightsVersion;
            }
            gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
            gl.bindTexture(gl.TEXTURE_2D, d.tex);
            gl.uniformMatrix4fv(u.u_matrix, false, t.matrix);
            gl.uniform1f(u.u_skirt, 40075016.686 / 2 ** t.id.z / 16 * Math.max(1, s.terrain!.exaggeration));
            gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_SHORT, 0);
        }
        for (const [key, mh] of this.meshHeights) if (this.frame - mh.used > 90) { gl.deleteBuffer(mh.buffer); this.meshHeights.delete(key); }
        gl.disable(gl.DEPTH_TEST);
    }

    /** The sky of the style above the horizon, in Mercator (on the globe there is none yet). */
    private drawSky(s: Scene) {
        const tr = s.tr;
        if (!s.sky || tr.globeness) return;
        const v = skyValues(s.sky, tr.zoom, tr.pitch), gl = this.gl, k = this.canvas.height / tr.height, u = this.use('sky', tr);
        gl.uniform2f(u.u_sky, (tr.height - tr.cy + tr.horizon()) * k, Math.max(v.skyBlend, 1e-6) * this.canvas.height / 2);
        gl.uniform4fv(u.u_skyColor, v.sky);
        gl.uniform4fv(u.u_horizonColor, v.horizon);
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Draws a frame. Returns true if some terrain pictures are still out of date, so another frame is wanted. */
    render(s: Scene): boolean {
        this.iconsBehind = false;
        const gl = this.gl, tr = s.tr;
        this.frame++;
        this.dropRamps(s.layers);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.globe = s.globe;
        const behind = s.terrain ? this.updateDrapes(s) : false;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.current = null;
        this.extrusionDepth = false;
        this.drawSky(s);
        const target: [number, number] = [this.canvas.width, this.canvas.height];
        const use = (name: keyof typeof SHADERS) => this.use(name, tr);

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
            this.drawTerrain(s); this.drawLayers(s, tr, s.items, target, 'buildings');
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
        return behind;
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
        const a = (az + 90) * Math.PI / 180, p = polar * Math.PI / 180, R = Math.PI / 180;
        // The sun in view space (x right, y up, z toward the camera), as MapLibre's getSunPos.
        let sun = [-Math.cos(a) * Math.sin(p), -Math.sin(a) * Math.sin(p), -Math.cos(p)];
        const turn = (i: number, j: number, t: number) => { const c = Math.cos(t), n = Math.sin(t), u = sun[i], w = sun[j]; sun[i] = c * u - n * w; sun[j] = n * u + c * w; };
        if (light.anchor === 'map') { turn(2, 0, -tr.lng * R); turn(1, 2, tr.lat * R); turn(0, 1, tr.bearing * R); turn(1, 2, -tr.pitch * R); }
        // To the space of the sphere with the rays of the screen: the ray through x, y is A x + B y + C (see `rays`).
        const r = g.rays, d = tr.cameraDistance, ax = [0, 1, 2].map(i => r[i] * d), ay = [0, 1, 2].map(i => -r[3 + i] * d), az2 = [0, 1, 2].map(i => -r[6 + i] - tr.cx * r[i] - tr.cy * r[3 + i]);
        sun = [0, 1, 2].map(i => ax[i] * sun[0] + ay[i] * sun[1] + az2[i] * sun[2]);
        const u = this.use('halo', tr);
        gl.uniformMatrix3fv(u.u_rays, false, g.rays);
        gl.uniform3fv(u.u_cam, g.cam);
        gl.uniform3fv(u.u_sun, sun);
        gl.uniform2f(u.u_halo, blend, this.canvas.height / tr.height);
        gl.bindVertexArray(this.quad);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Draws placed labels: their icons, then their text in one pass for the halos and one for the fill. */
    private drawLabels(s: Scene, labels: Placed[]) {
        const gl = this.gl, use = (name: keyof typeof SHADERS) => this.use(name, s.tr);
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
            const n = quads.byteLength / 36;
            gl.uniform1i(u.u_pass, 1);
            gl.drawArrays(gl.TRIANGLES, 0, n);
            gl.uniform1i(u.u_pass, 0);
            gl.drawArrays(gl.TRIANGLES, 0, n);
        }

    }

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
        const plain = [0, 0, 0, -1];
        for (const {icon: i, opacity} of labels) {
            if (!i || !!i.custom !== custom || !(opacity > 0)) continue;
            // (An icon on the ground of a tilted map has a frame: where one pixel across and one pixel down it go.)
            const fr = i.frame, cos = fr ? fr[0] : Math.cos(i.angle), sin = fr ? fr[1] : Math.sin(i.angle), nx = fr ? fr[2] : -sin, ny = fr ? fr[3] : cos, [sx, sy, sw, sh] = i.rect;
            // Plain icons are one quad; stretched ones are a grid whose fixed cells keep their size.
            const gx = i.gx ?? [0, 0, sw, i.w], gy = i.gy ?? [0, 0, sh, i.h];
            const col = i.color ?? plain, hw = i.w / 2, hh = i.h / 2;
            // Upright icons are placed on whole device pixels. Between pixels, the texture filter would smear fine
            // detail such as a one-pixel outline into its neighbours. A distance field has no such detail, and
            // MapLibre GL JS draws it where it falls.
            const ox = i.angle === 0 && !i.color ? snap(i.x - hw) - (i.x - hw) : 0, oy = i.angle === 0 && !i.color ? snap(i.y - hh) - (i.y - hh) : 0;
            const x = i.x + ox, y = i.y + oy;
            room((i.halo ? 2 : 1) * ((gx.length - 2) >> 1) * ((gy.length - 2) >> 1) * 54);
            // A halo is the same picture drawn first, in the halo colour and out to a lower level of the distance field.
            for (let pass = i.halo ? 0 : 1; pass < 2; pass++) {
                const halo = pass === 0, tint = halo ? i.halo! : col, alpha = Math.min(1, Math.max(0, opacity * i.opacity)) * 0.999 + (halo ? Math.round(i.haloReach! * 100) + 100 * Math.round(i.haloBlur! * 100) : 0);
                for (let a = 0; a + 3 < gx.length; a += 2) for (let b = 0; b + 3 < gy.length; b += 2) {
                    // The two triangles of a cell: corners (0, 0), (1, 0), (0, 1) and (1, 0), (1, 1), (0, 1).
                    const x0 = gx[a + 1] - hw, x1 = gx[a + 3] - hw, y0 = gy[b + 1] - hh, y1 = gy[b + 3] - hh;
                    const u0 = sx + gx[a], u1 = sx + gx[a + 2], v0 = sy + gy[b], v1 = sy + gy[b + 2];
                    const p00x = x + x0 * cos + y0 * nx, p00y = y + x0 * sin + y0 * ny, p10x = x + x1 * cos + y0 * nx, p10y = y + x1 * sin + y0 * ny;
                    const p01x = x + x0 * cos + y1 * nx, p01y = y + x0 * sin + y1 * ny, p11x = x + x1 * cos + y1 * nx, p11y = y + x1 * sin + y1 * ny;
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
                        const w = g.advance * k, h = g.imageHeight! * k, cx = (pen + g.advance / 2) * k, cy = mid * k;
                        const x0 = flat ? snap(l.x + cx - w / 2) - l.x : cx - w / 2, y0 = flat ? snap(l.y + cy - h / 2) - l.y : cy - h / 2;
                        room(54);
                        for (const [ux, uy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
                            const dx = x0 + ux * w, dy = y0 + uy * h;
                            vertex(l.x + dx * cos + dy * nx, l.y + dx * sin + dy * ny, img.x + ux * img.width, img.y + uy * img.height, Math.min(1, l.opacity) * 0.999, plain);
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
        let hedge = 0, gamma = 0, haloGamma = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0, h0 = 0, h1 = 0, h2 = 0, h3 = 0;
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
            hedge = src.haloWidth > 0 && src.halo[3] > 0 ? Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - src.haloWidth / s / SDF_RADIUS) : 2;
            gamma = 0.7 / (SDF_RADIUS * s * this.dpr); haloGamma = gamma + src.haloBlur * 1.19 / s / SDF_RADIUS;
            const col = src.color, halo = src.halo;
            c0 = Math.round(col[0] * 255); c1 = Math.round(col[1] * 255); c2 = Math.round(col[2] * 255); c3 = Math.round(col[3] * 255 * l.opacity * (l.alpha ?? 1));
            h0 = Math.round(halo[0] * 255); h1 = Math.round(halo[1] * 255); h2 = Math.round(halo[2] * 255); h3 = Math.round(halo[3] * 255 * l.opacity * (l.alpha ?? 1));
            if (l.curve) {
                // Text along a line: every glyph has its own origin and rotation.
                const glyphs = shaped.lines[0].glyphs!, curve = l.curve;
                for (let i = 0; i < glyphs.length; i++) {
                    const g = glyphs[i];
                    if (!g.w) continue;
                    const k = s * (g.scale ?? 1), ga = curve[i * 3 + 2], x0 = (g.left - B) * k, y0 = (-g.top - B) * k, along = l.ground?.[i * 3] ?? 1;
                    glyph(g, l.x + curve[i * 3], l.y + curve[i * 3 + 1], Math.cos(ga) * along, Math.sin(ga) * along, x0, y0, x0 + g.w * k, y0 + g.h * k, l.ground?.[i * 3 + 1], l.ground?.[i * 3 + 2]);
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
                            // Rich text: this glyph has its own size or colour. The label's values come back after it.
                            const k = g.scale ?? 1, x0 = (pen + (g.left - B) * k) * s, y0 = (baseline - (g.top + B) * k) * s, keep = [c0, c1, c2, gamma, haloGamma, hedge];
                            if (g.color) { c0 = Math.round(g.color[0] * 255); c1 = Math.round(g.color[1] * 255); c2 = Math.round(g.color[2] * 255); }
                            gamma /= k; haloGamma /= k; if (hedge < 2) hedge = Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - src.haloWidth / (s * k) / SDF_RADIUS);
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
