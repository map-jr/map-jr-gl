import {EXTENT, latFromMerc, mercX, mercY, type TileID, type Transform} from './geo.ts';
import type {CompiledLayer, Light} from './style.ts';
import {compileProp} from './expr.ts';
import {LINE_VERTEX, WALL_OTHER, WALL_TOP, type GLBatch, type LabelSrc, type TileGL} from './tile.ts';
import type {Placed, RenderItem} from './placement.ts';
import {lineMiddle, BASELINE, EM, SDF_BUFFER, SDF_RADIUS, type GlyphAtlas} from './text.ts';

const HEAD = '#version 300 es\nprecision highp float;\n';
/** Shared by the map-space programs: u_matrix takes tile units (and metres of height) to clip space. */
const VS_COMMON = `uniform mat4 u_matrix; uniform vec2 u_view;
vec4 toClip(vec2 t) { return u_matrix * vec4(t, 0.0, 1.0); }
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
layout(location=0) in vec3 a_pos; layout(location=1) in float a_height; uniform vec3 u_part; out vec2 v_uv;
void main() { vec2 p = u_part.xy + a_pos.xy * u_part.z; v_uv = vec2(p.x, 1.0 - p.y); gl_Position = u_matrix * vec4(a_pos.xy * ${EXTENT}.0, a_height * u_exag - a_pos.z * u_skirt, 1.0); }`, `
uniform sampler2D u_drape; in vec2 v_uv; out vec4 o;
void main() { o = texture(u_drape, v_uv); }`],

    fill: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
void main() { v_tile = a_pos; v_color = a_color; gl_Position = toClip(a_pos); }`, `
uniform vec4 u_color; uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} vec4 c = v_color * u_color; o = vec4(c.rgb * c.a, c.a); }`],

    // Repeating image fill. The image is tiled in world pixels at whole zoom levels, so it stays put while panning
    // and grows with the map between levels, as in MapLibre.
    pattern: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; uniform mat3 u_pat; out vec2 v_p; out vec2 v_tile;
void main() { v_tile = a_pos; v_p = (u_pat * vec3(a_pos, 1.0)).xy; gl_Position = toClip(a_pos); }`, `
uniform sampler2D u_img; uniform vec4 u_rect; uniform vec2 u_tex; uniform vec2 u_fade; uniform vec4 u_clip; in vec2 v_p; in vec2 v_tile; out vec4 o;
vec4 tile(vec2 p) { return texture(u_img, (u_rect.xy + clamp(fract(p) * u_rect.zw, vec2(0.5), u_rect.zw - 0.5)) / u_tex); }
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
  v_color = vec4(a_color.rgb, a_color.a * min(1.0, w));
  // line-offset moves the whole stroke sideways: along the same normal, whichever side of the line this vertex is on.
  v_tile = a_v.xy + a_v.zw * (v_hw + sign(a_sd.x) * u_offset) / u_scale;
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
out vec4 v_color; out vec2 v_off; out float v_r;
void main() {
  v_r = mix(a_radius, a_radius1, u_zt) * u_radius; v_color = a_color;
  float ext = v_r + u_strokeWidth + 1.0;
  v_off = a_corner * ext;
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
  vec4 c = toClip(a_pos);
  // Circles face the viewer: offset in screen pixels after projection.
  c.xy += (v_off + u_translate) * vec2(2.0, -2.0) / u_view * c.w;
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
    extrusion: [`uniform mat4 u_matrix; ${TERRAIN_GLSL}
layout(location=0) in vec4 a_v; layout(location=1) in vec4 a_color; out vec4 v_color; out vec2 v_tile;
uniform vec4 u_color; uniform vec3 u_lightPos; uniform vec3 u_lightColor; uniform float u_lightIntensity; uniform float u_gradient;
void main() {
  v_tile = a_v.xy;
  // The light model of MapLibre. A face is brighter when it looks at the light; a dark colour is made brighter by
  // more than a light colour. Walls are darker near the ground (the vertical gradient).
  bool roof = a_v.w < 0.0; float other = floor(a_v.w / ${WALL_OTHER}.0), rest = a_v.w - other * ${WALL_OTHER}.0, t = rest >= ${WALL_TOP}.0 ? 1.0 : 0.0, angle = rest - t * ${WALL_TOP}.0 - ${Math.PI};
  float base = t > 0.5 ? other : max(a_v.z, 0.0), height = t > 0.5 ? max(a_v.z, 0.0) : other;
  vec3 normal = roof ? vec3(0.0, 0.0, 1.0) : vec3(cos(angle), sin(angle), 0.0);
  // (As in MapLibre, a translucent colour is multiplied by its alpha and then drawn solid; only the opacity of the layer shows through.)
  vec4 c = vec4(a_color.rgb * a_color.a * u_color.rgb, u_color.a);
  float value = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 rgb = c.rgb + 0.03;
  float lit = clamp(dot(normal, u_lightPos), 0.0, 1.0);
  lit = mix(1.0 - u_lightIntensity, max(1.0 - value + u_lightIntensity, 1.0), lit);
  if (!roof) lit *= (1.0 - u_gradient) + u_gradient * clamp((t + base) * sqrt(height / 150.0), mix(0.7, 0.98, 1.0 - u_lightIntensity), 1.0);
  v_color = vec4(clamp(rgb * lit * u_lightColor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightColor), vec3(1.0)), c.a);
  gl_Position = u_matrix * vec4(a_v.xy, a_v.z + ground(a_v.xy / ${EXTENT}.0), 1.0);
}`, `
uniform vec4 u_clip; in vec4 v_color; in vec2 v_tile; out vec4 o;
void main() { ${FS_CLIP} o = vec4(v_color.rgb * v_color.a, v_color.a); }`],

    raster: [`${VS_COMMON}
layout(location=0) in vec2 a_pos; uniform vec2 u_corners[4]; uniform vec4 u_q; out vec3 v_uvq; out vec2 v_tile;
// A tile fills its square; an image source's picture is stretched between four given corners instead. For a shape
// that is not a parallelogram the picture must be foreshortened as if seen in perspective: each corner carries a
// weight q, and dividing by the interpolated weight in the fragment shader gives the right texture position.
void main() {
  float q = mix(mix(u_q.x, u_q.y, a_pos.x), mix(u_q.w, u_q.z, a_pos.x), a_pos.y);
  v_uvq = vec3(a_pos * q, q);
  v_tile = mix(mix(u_corners[0], u_corners[1], a_pos.x), mix(u_corners[3], u_corners[2], a_pos.x), a_pos.y); gl_Position = toClip(v_tile); }`, `
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
    marker: [`uniform vec2 u_view; uniform vec2 u_centre; uniform vec4 u_center; uniform float u_world; uniform vec2 u_rot; uniform vec3 u_pitch;
uniform vec2 u_size; uniform vec2 u_offset; uniform vec2 u_tex;
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 a_merc; layout(location=2) in vec4 a_rect; layout(location=3) in vec2 a_scale;
layout(location=4) in float a_height; uniform vec2 u_lift; // metres to pixels (exaggerated), and the height of the map centre in pixels
uniform float u_opacity; out vec2 v_uv; out float v_alpha; // a_corner is 0 or 1 on each axis out vec2 v_uv; out float v_alpha;
void main() {
  float dx = (a_merc.x - u_center.x) + (a_merc.y - u_center.y);
  dx -= floor(dx + 0.5); // nearest copy of the world
  float dy = (a_merc.z - u_center.z) + (a_merc.w - u_center.w);
  vec2 w = vec2(dx, dy) * u_world;
  float rx = u_rot.x * w.x - u_rot.y * w.y, ry = u_rot.y * w.x + u_rot.x * w.y;
  float z = a_height * u_lift.x - u_lift.y; // above the ground at the map centre; zero without 3D terrain
  float k = u_pitch.z / (u_pitch.z - ry * u_pitch.y - z * u_pitch.x);
  vec2 corner = a_corner;
  // Markers stay upright and keep their size; a scale other than 1 grows them about their anchor point.
  vec2 px = vec2(rx * k, (ry * u_pitch.x - z * u_pitch.y) * k) + u_centre + (u_offset + corner * u_size) * a_scale.x;
  v_alpha = a_scale.y * u_opacity;
  v_uv = (a_rect.xy + corner * a_rect.zw) / u_tex;
  vec2 c = px / u_view * 2.0 - 1.0;
  gl_Position = a_scale.x > 0.0 && v_alpha > 0.0 ? vec4(c.x, -c.y, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform sampler2D u_img; in vec2 v_uv; in float v_alpha; out vec4 o; void main() { o = texture(u_img, v_uv) * v_alpha; }`],

    // Icons. A colour with alpha >= 0 marks a distance-field icon, drawn in that colour with an edge that stays sharp.
    sprite: [`uniform vec2 u_view; uniform vec2 u_tex; layout(location=0) in vec4 a_v; layout(location=1) in float a_alpha; layout(location=2) in vec4 a_color;
out vec2 v_uv; out float v_alpha; out vec4 v_color;
void main() { v_uv = a_v.zw / u_tex; v_alpha = a_alpha; v_color = a_color; vec2 c = a_v.xy / u_view * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`, `
uniform sampler2D u_img; in vec2 v_uv; in float v_alpha; in vec4 v_color; out vec4 o;
void main() {
  vec4 t = texture(u_img, v_uv);
  if (v_color.a < 0.0) { o = t * v_alpha; return; }
  float g = max(fwidth(t.a) * 0.7, 0.01), a = smoothstep(0.75 - g, 0.75 + g, t.a) * v_color.a * v_alpha;
  o = vec4(v_color.rgb * a, a);
}`],
};

interface Program { prog: WebGLProgram; u: Record<string, WebGLUniformLocation> }
interface GLBuffers {
    type: GLBatch['type']; vao: WebGLVertexArrayObject; count: number; /** UNSIGNED_SHORT or UNSIGNED_INT. */ indexType: number; color: boolean; scalar: boolean; bufs: WebGLBuffer[];
    edgeVao?: WebGLVertexArrayObject; edgeCount?: number;
}
export interface GLTile {
    /** Distinguishes this tile's contents from any other's, including an earlier build of the same tile. */
    uid?: number;
    labels: Record<string, LabelSrc[]>; batches: Record<string, GLBuffers>;
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
    markers: MarkerBuffers[];
    /** 3D terrain: the ground tiles to draw, and a lookup of the heights under any tile (for buildings). */
    terrain?: {exaggeration: number; tiles: TerrainTile[]; dem(id: TileID): DemRef | null};
    /** The light on buildings. */
    light?: Light;
    /** Looks up a sprite or runtime image by name, for patterns. */
    icon?: (name: string) => {x: number; y: number; width: number; height: number; pixelRatio: number; custom?: boolean} | undefined;
}

export const SPRITE_ATLAS = 2048;
// How the light's direction maps to tile coordinates (y points south) and turns with the bearing.
const LIGHT_X = 1, LIGHT_Y = -1, LIGHT_TURN = -1;

/** Floats per marker vertex: mercator x and y each split into high and low parts, atlas rectangle, corner, scale, opacity. */
export const MARKER_STRIDE = 12;
/** Each marker is four such vertices. */
export const MARKER_FLOATS = MARKER_STRIDE * 4;
export interface MarkerBuffers { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; index: WebGLBuffer; /** Ground height in metres under each marker (per vertex), for 3D terrain. */ heights: WebGLBuffer; count: number; width: number; height: number; offset: [number, number]; /** Whole-layer opacity, used to fade a layer in and out at the ends of its zoom range. */ opacity: number }

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
            u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name)!; // arrays are reported as "name[0]"
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
        gl.bindVertexArray(null);
        return {uid: ++this.uids, labels: t.labels, batches};
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
        const tile: GLTile = {uid: ++this.uids, labels: {}, batches: {}, tex};
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
            tile.raw = tex; tile.rawSize = image.width;
            tile.unpack = encoding === 'terrarium' ? [256, 1, 1 / 256, 32768] : [6553.6, 25.6, 0.1, 10000];
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
        const heights = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, heights);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(count * 4), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, 0);
        // Plain indexed quads rather than instancing, which software renderers execute very slowly.
        const idx = new Uint32Array(count * 6), index = gl.createBuffer()!;
        for (let i = 0; i < count; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return {vao, buffer, index, heights, count, width, height, offset, opacity: 1};
    }

    /** Sets the ground height under each marker of a layer (one value per marker, in metres). */
    setMarkerHeights(m: MarkerBuffers, metres: Float32Array) {
        const gl = this.gl, perVertex = new Float32Array(m.count * 4);
        for (let i = 0; i < m.count; i++) perVertex.fill(metres[i], i * 4, i * 4 + 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.heights);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, perVertex);
    }
    removeMarkers(m: MarkerBuffers) { this.gl.deleteVertexArray(m.vao); this.gl.deleteBuffer(m.buffer); this.gl.deleteBuffer(m.index); this.gl.deleteBuffer(m.heights); }
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

    /**
     * Draws the style's layers (not labels) for one view: the whole map, or with 3D terrain either the flat layers
     * of one ground tile ('ground') or just the buildings standing on it ('buildings').
     */
    private layerTarget?: {fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number};
    private belowTex?: WebGLTexture;

    private drawLayers(s: Scene, tr: Transform, bySource: Map<string, RenderItem<GLTile>[]>, target: [number, number], pass: 'all' | 'ground' | 'buildings', only?: CompiledLayer) {
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
            const u = use('pattern'), pw = img.width / img.pixelRatio, ph = img.height / img.pixelRatio;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, img.custom ? this.spriteTex : this.iconTex);
            gl.uniform1i(u.u_img, 0);
            gl.uniform2f(u.u_tex, img.custom ? SPRITE_ATLAS : this.iconSize[0], img.custom ? SPRITE_ATLAS : this.iconSize[1]);
            gl.uniform4f(u.u_rect, img.x, img.y, img.width, img.height);
            gl.uniform2f(u.u_fade, 0, opacity);
            /** `m` maps the drawn coordinates to world pixels at zoom Z (column-major 3x3). */
            return (m: number[]) => {
                const fr = (v: number) => v - Math.floor(v);
                gl.uniformMatrix3fv(u.u_pat, false, [m[0] / pw, m[1] / ph, 0, m[3] / pw, m[4] / ph, 0, fr(m[6] / pw), fr(m[7] / ph), 1]);
                return u;
            };
        };

        for (const L of only ? [only] : s.layers) {
            if (!L.visible || zoom < L.minzoom || zoom >= L.maxzoom || L.type === 'symbol') continue;
            if (L.type === 'heatmap') { if (pass !== 'buildings') this.drawHeatmap(L, tr, bySource.get(L.source!) ?? [], target); continue; }
            if (!only && (L.type === 'fill' || L.type === 'line') && pass !== 'buildings') {
                // Layer-wide opacity and blending: the layer is drawn on its own first, so that overlapping features
                // form one surface, and that surface is then put onto the map once.
                const opacity = L.p.layerOpacity.eval(zoom), blend = L.p.layerBlend.eval(zoom) as string;
                if (opacity < 1 || blend !== 'normal') {
                    if (opacity > 0) this.compositeLayer(s, tr, bySource, target, pass, L, opacity, blend);
                    continue;
                }
            }
            if ((L.type === 'fill-extrusion') !== (pass === 'buildings') && pass !== 'all') continue;
            if (L.type === 'background' && L.p.pattern.eval(zoom)) {
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
                gl.uniformMatrix4fv(u.u_matrix, false, [2, 0, 0, 0, 0, -2, 0, 0, 0, 0, 1, 0, -1, 1, 0, 1]); // unit square -> whole screen
                gl.uniform4f(u.u_clip, -1, -1, 2, 2);
                gl.uniform4fv(u.u_color, color(L));
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                continue;
            }
            const items = bySource.get(L.source!);
            if (!items) continue;
            if (L.type === 'raster' || L.type === 'hillshade') {
                const u = use(L.type), p = L.p;
                gl.activeTexture(gl.TEXTURE0);
                gl.uniform1i(u.u_image, 0);
                gl.bindVertexArray(this.quad);
                if (L.type === 'raster') {
                    const sat = p.saturation.eval(zoom), con = p.contrast.eval(zoom);
                    gl.uniform3f(u.u_adjust, p.opacity.eval(zoom), sat > 0 ? 1 - 1 / (1.001 - sat) : -sat, con > 0 ? 1 / (1 - con) : 1 + con);
                    gl.uniform2f(u.u_bright, p.brightnessMin.eval(zoom), p.brightnessMax.eval(zoom));
                    const h = p.hueRotate.eval(zoom) * Math.PI / 180, sn = Math.sin(h), cs = Math.cos(h);
                    gl.uniform3f(u.u_spin, (2 * cs + 1) / 3, (-Math.sqrt(3) * sn - cs + 1) / 3, (Math.sqrt(3) * sn - cs + 1) / 3);
                } else {
                    const pre = (c: number[]) => [c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]];
                    const azimuth = p.direction.eval(zoom) * Math.PI / 180 + (p.anchor.eval(zoom) === 'viewport' ? s.tr.bearing * Math.PI / 180 : 0) // the map's bearing, also when drawing a terrain tile's picture;
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
                    if (L.type === 'raster') { gl.uniform2fv(u.u_corners, it.corners ?? SQUARE); gl.uniform4fv(u.u_q, it.corners ? cornerWeights(it.corners) : ONES); }
                    gl.bindTexture(gl.TEXTURE_2D, it.tile.tex);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
                continue;
            }
            if (L.type === 'fill' && L.p.pattern.eval(zoom)) {
                const place = pattern(L.p.pattern.eval(zoom), L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                if (place) for (const it of items) {
                    const b = it.tile.batches[L.id];
                    if (!b) continue;
                    const px = 512 * 2 ** (Z - it.id.z), u = place([px / EXTENT, 0, 0, 0, px / EXTENT, 0, it.id.x * px, it.id.y * px, 1]);
                    gl.uniformMatrix4fv(u.u_matrix, false, it.matrix4);
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
            if (extrude) {
                // On 3D terrain the ground's depth is kept, so hills hide the buildings behind them.
                gl.clear(s.terrain ? gl.STENCIL_BUFFER_BIT : gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
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
                            gl.uniform2f(u.u_tex, img.custom ? SPRITE_ATLAS : this.iconSize[0], img.custom ? SPRITE_ATLAS : this.iconSize[1]);
                            gl.uniform4f(u.u_rect, img.x, img.y, img.width, img.height);
                            gl.uniform4f(u.u_color, 1, 1, 1, L.p.opacity.dd ? 1 : L.p.opacity.eval(zoom));
                        }
                    }
                    if (b.type === 'circle') {
                        const sc = L.p.strokeColor.eval(zoom), a = sc[3] * (L.p.strokeOpacity.dd ? 1 : L.p.strokeOpacity.eval(zoom));
                        const tl = L.p.translate.eval(zoom) as number[];
                        gl.uniform1f(u.u_blur, L.p.blur.dd ? 0 : L.p.blur.eval(zoom));
                        gl.uniform2f(u.u_translate, tl?.[0] ?? 0, tl?.[1] ?? 0);
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
                if (!b.scalar) { gl.vertexAttrib1f(3, 1); gl.vertexAttrib1f(5, 1); }
                if (b.type === 'line' || b.type === 'circle') gl.uniform1f(u.u_zt, Math.min(1, Math.max(0, zoom - it.id.z)));
                if (b.type === 'line') {
                    gl.uniform1f(u.u_scale, it.scale);
                    gl.uniform1f(u.u_cam, tr.cameraDistance);
                    // Dashes are sized at whole zoom levels so they stretch, rather than crawl, while zooming.
                    gl.uniform1f(u.u_dashScale, it.scale / 2 ** (zoom - Math.floor(zoom)));
                }
                if (extrude) {
                    // Depth first, colour second: translucent buildings then blend once, with the nearest surface only.
                    gl.colorMask(false, false, false, false);
                    gl.drawElements(gl.TRIANGLES, b.count, b.indexType, 0);
                    gl.colorMask(true, true, true, true);
                    pending.push(() => {
                        gl.uniformMatrix4fv(u.u_matrix, false, m);
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
                    gl.uniformMatrix4fv(u.u_matrix, false, moved(it));
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

    private uids = 0;
    private current: Program | null = null;
    /** Selects a program, telling it the size of the view being drawn (the screen, or a terrain tile's texture). */
    private use(name: keyof typeof SHADERS, tr: Transform) {
        const p = this.programs[name];
        if (p !== this.current) {
            this.gl.useProgram(p.prog);
            this.gl.uniform2f(p.u.u_view, tr.width, tr.height);
            this.current = p;
        }
        return p.u;
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
    private ramps = new WeakMap<Uint8Array, WebGLTexture>();
    /** The texture of a colour ramp (heatmap colours, line gradients), made on first use. */
    private rampTexture(pixels: Uint8Array): WebGLTexture {
        const gl = this.gl;
        let ramp = this.ramps.get(pixels);
        if (!ramp) {
            ramp = this.newTexture();
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            this.ramps.set(pixels, ramp);
        }
        return ramp;
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
            gl.uniformMatrix4fv(u.u_matrix, false, it.matrix4);
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

    private drapes = new Map<string, {tex: WebGLTexture; size: number; signature: string; used: number}>();
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
    private updateDrapes(s: Scene) {
        const gl = this.gl;
        // Per frame: a couple of out-of-date pictures are redrawn and a few missing ones drawn (all of them when starting
        // from nothing). A missing one shows its ancestor's picture meanwhile, so spreading the work costs no holes.
        let budget = 2, fresh = this.drapes.size ? 3 : Infinity, behind = false;
        for (const t of s.terrain!.tiles) {
            let d = this.drapes.get(t.key);
            // 1024 pixels a side at most (what MapLibre uses): larger pictures cost high-density phones frames for little gain.
            const size = Math.min(1024, Math.max(64, Math.round(t.view.width * this.dpr)));
            if (d && d.signature === t.signature) { d.used = this.frame; continue; }
            if (d && !t.complete && d.signature.split('|')[0] === t.signature.split('|')[0]) { d.used = this.frame; continue; }
            if (d && budget-- <= 0) { d.used = this.frame; behind = true; continue; }
            if (!d && fresh-- <= 0) { behind = true; continue; }
            if (!d || d.size !== size) {
                if (d) gl.deleteTexture(d.tex);
                const tex = this.newTexture();
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
                d = {tex, size, signature: '', used: this.frame};
                this.drapes.set(t.key, d);
            }
            d.signature = t.signature; d.used = this.frame;
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
        for (const [key, d] of this.drapes) if (this.frame - d.used > 90) { gl.deleteTexture(d.tex); this.drapes.delete(key); }
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
        for (const t of s.terrain!.tiles) {
            let d = this.drapes.get(t.key), part = [0, 0, 1];
            // No picture of its own yet: show its share of the nearest ancestor's rather than a hole.
            for (let up = 1; !d && up <= 5 && up <= t.id.z; up++) {
                const k = 2 ** up;
                d = this.drapes.get(`${t.id.z - up}/${t.id.x >> up}/${t.id.y >> up}|${t.id.w}`);
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

    /** Draws a frame. Returns true if some terrain pictures are still out of date, so another frame is wanted. */
    render(s: Scene): boolean {
        const gl = this.gl, tr = s.tr;
        this.frame++;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const behind = s.terrain ? this.updateDrapes(s) : false;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.current = null;
        const target: [number, number] = [this.canvas.width, this.canvas.height];
        if (s.terrain) { this.drawTerrain(s); this.drawLayers(s, tr, s.items, target, 'buildings'); }
        else this.drawLayers(s, tr, s.items, target, 'all');
        const use = (name: keyof typeof SHADERS) => this.use(name, tr);

        // Style-sheet icons and images added at runtime live in different textures.
        for (const custom of [false, true]) {
            const icons = this.iconQuads(s.labels, custom, s.icon);
            if (!icons.length) continue;
            const u = use('sprite');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, custom ? this.spriteTex : this.iconTex);
            gl.uniform2f(u.u_tex, custom ? SPRITE_ATLAS : this.iconSize[0], custom ? SPRITE_ATLAS : this.iconSize[1]);
            gl.uniform1i(u.u_img, 0);
            gl.bindVertexArray(this.spriteVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
            gl.bufferData(gl.ARRAY_BUFFER, icons, gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, icons.length / 9);
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
            const n = quads.byteLength / 36;
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
            gl.uniform2f(u.u_centre, tr.cx, tr.cy);
            gl.uniform2f(u.u_lift, (s.terrain?.exaggeration ?? 0) * tr.pixelsPerMetre, s.terrain ? tr.elevation * tr.pixelsPerMetre : 0);
            for (const m of s.markers) {
                gl.uniform2f(u.u_size, m.width, m.height);
                gl.uniform2f(u.u_offset, m.offset[0], m.offset[1]);
                gl.uniform1f(u.u_opacity, m.opacity);
                gl.bindVertexArray(m.vao);
                gl.drawElements(gl.TRIANGLES, m.count * 6, gl.UNSIGNED_INT, 0);
            }
        }
        gl.bindVertexArray(null);
        return behind;
    }

    private iconQuads(labels: Placed[], custom: boolean, lookup?: Scene['icon']): Float32Array {
        const mine = labels.filter(l => l.icon && !!l.icon.custom === custom && l.opacity > 0);
        const out: number[] = [];
        for (const {icon, opacity} of mine) {
            const i = icon!, cos = Math.cos(i.angle), sin = Math.sin(i.angle), [sx, sy, sw, sh] = i.rect;
            // Plain icons are one quad; stretched ones are a grid whose fixed cells keep their size.
            const gx = i.gx ?? [0, 0, sw, i.w], gy = i.gy ?? [0, 0, sh, i.h];
            const col = i.color ?? [0, 0, 0, -1];
            // Upright icons are placed on whole device pixels. Between pixels, the texture filter would smear fine
            // detail such as a one-pixel outline into its neighbours.
            const snap = (v: number) => Math.round(v * this.dpr) / this.dpr;
            const ox = i.angle === 0 ? snap(i.x - i.w / 2) - (i.x - i.w / 2) : 0, oy = i.angle === 0 ? snap(i.y - i.h / 2) - (i.y - i.h / 2) : 0;
            for (let a = 0; a + 3 < gx.length; a += 2) for (let b = 0; b + 3 < gy.length; b += 2) {
                for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
                    const dx = gx[a + cx * 2 + 1] - i.w / 2, dy = gy[b + cy * 2 + 1] - i.h / 2;
                    out.push(i.x + ox + dx * cos - dy * sin, i.y + oy + dx * sin + dy * cos, sx + gx[a + cx * 2], sy + gy[b + cy * 2], opacity * i.opacity, ...col);
                }
            }
        }
        // Images inside label text (`format` with `image`): each sits on its line where a glyph would, at its own size.
        if (lookup) for (const l of labels) {
            const shaped = l.shaped;
            if (!shaped || l.curve || l.opacity <= 0) continue;
            const k = l.size / EM, cos = Math.cos(l.angle), sin = Math.sin(l.angle);
            shaped.lines.forEach((line, row) => {
                if (!line.glyphs?.some(g => g.image)) return;
                const justify = l.justify ?? l.src.justify;
                let pen = justify < 0 ? -shaped.width / 2 : justify > 0 ? shaped.width / 2 - line.width : -line.width / 2;
                const mid = lineMiddle(shaped, row);
                for (const g of line.glyphs) {
                    const img = g.image ? lookup(g.image) : undefined;
                    if (img && !!img.custom === custom) {
                        const w = g.advance * k, h = g.imageHeight! * k, cx = (pen + g.advance / 2) * k, cy = mid * k;
                        const snap = (v: number) => Math.round(v * this.dpr) / this.dpr;
                        const x0 = l.angle === 0 ? snap(l.x + cx - w / 2) - l.x : cx - w / 2, y0 = l.angle === 0 ? snap(l.y + cy - h / 2) - l.y : cy - h / 2;
                        for (const [ux, uy] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) {
                            const dx = x0 + ux * w, dy = y0 + uy * h;
                            out.push(l.x + dx * cos - dy * sin, l.y + dx * sin + dy * cos, img.x + ux * img.width, img.y + uy * img.height, l.opacity, 0, 0, 0, -1);
                        }
                    }
                    pen += g.advance + l.src.spacing * EM;
                }
            });
        }
        return new Float32Array(out);
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
        /** One glyph: two triangles about the origin (ox, oy), turned by the angle whose cosine and sine are given. */
        const glyph = (g: {x: number; y: number; w: number; h: number}, ox: number, oy: number, cos: number, sin: number, x0: number, y0: number, x1: number, y1: number) => {
            for (let k = 0; k < 6; k++) {
                const right = k === 1 || k === 3 || k === 4, low = k === 2 || k === 4 || k === 5;
                const cx = right ? x1 : x0, cy = low ? y1 : y0, fi = o >> 2;
                f[fi] = ox + cx * cos - cy * sin;
                f[fi + 1] = oy + cx * sin + cy * cos;
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
            const s = l.size / EM, cos = Math.cos(l.angle), sin = Math.sin(l.angle), src = l.src;
            // Where the halo's outer edge sits in distance-field units, limited by how far the field extends.
            hedge = src.haloWidth > 0 && src.halo[3] > 0 ? Math.max(0.75 - (B - 0.75) / SDF_RADIUS, 0.75 - src.haloWidth / s / SDF_RADIUS) : 2;
            gamma = 0.7 / (SDF_RADIUS * s * this.dpr); haloGamma = gamma + src.haloBlur * 1.19 / s / SDF_RADIUS;
            const col = src.color, halo = src.halo;
            c0 = Math.round(col[0] * 255); c1 = Math.round(col[1] * 255); c2 = Math.round(col[2] * 255); c3 = Math.round(col[3] * 255 * l.opacity);
            h0 = Math.round(halo[0] * 255); h1 = Math.round(halo[1] * 255); h2 = Math.round(halo[2] * 255); h3 = Math.round(halo[3] * 255 * l.opacity);
            if (l.curve) {
                // Text along a line: every glyph has its own origin and rotation.
                const glyphs = shaped.lines[0].glyphs!, curve = l.curve;
                for (let i = 0; i < glyphs.length; i++) {
                    const g = glyphs[i];
                    if (!g.w) continue;
                    const k = s * (g.scale ?? 1), ga = curve[i * 3 + 2], x0 = (g.left - B) * k, y0 = (-g.top - B) * k;
                    glyph(g, l.x + curve[i * 3], l.y + curve[i * 3 + 1], Math.cos(ga), Math.sin(ga), x0, y0, x0 + g.w * k, y0 + g.h * k);
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
                            glyph(g, l.x, l.y, cos, sin, x0, y0, x0 + g.w * k * s, y0 + g.h * k * s);
                            [c0, c1, c2, gamma, haloGamma, hedge] = keep;
                        } else {
                            const x0 = (pen + g.left - B) * s, y0 = (baseline - g.top - B) * s;
                            glyph(g, l.x, l.y, cos, sin, x0, y0, x0 + g.w * s, y0 + g.h * s);
                        }
                    }
                    pen += g.advance + step;
                }
            }
        }
        return b.subarray(0, o);
    }
}
