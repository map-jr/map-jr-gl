/**
 * The layer types that only some maps have (#2215): `heatmap`, `hillshade` and `color-relief`. Their shaders and the
 * code that draws them are a part of the library that loads on demand (see parts.ts): the engine loads it when the
 * style has a layer of one of these types, and the renderer draws such a layer once it is there. The functions run as
 * methods of the renderer: each is called with `fn.call(this, ...)` and reads the members of the renderer (see
 * terrain.ts).
 */
import {EXTENT, type Transform} from './geo.ts';
import {SHADERS, VS_COMMON, FS_CLIP, type GLTile} from './gl.ts';
import {SPEC, LIGHT_PROPS, type CompiledLayer} from './style.ts';
import {parseColor, warnOnce, type Prop} from './expr.ts';
import type {RenderItem} from './placement.ts';

/** The most lights that a `hillshade` layer with the method `multidirectional` draws. */
export const LIGHTS = 8;
const HILLSHADE_METHODS = ['standard', 'combined', 'igor', 'multidirectional', 'basic'];
/** Heatmap densities are accumulated at this fraction of the screen's resolution: the result is smooth anyway. */
const HEAT_SCALE = 4;

// The vertex shader of the layers that color an elevation tile (`hillshade`, `color-relief`).
const VS_DEM = `${VS_COMMON}
layout(location=0) in vec2 a_pos; out vec2 v_uv; out vec2 v_tile;
#ifdef GLOBE
void main() { v_uv = clamp(unpole(a_pos) / ${EXTENT}.0, 0.0, 1.0); v_tile = v_uv * ${EXTENT}.0; gl_Position = toClip(isPole(a_pos) ? vec2(v_tile.x, a_pos.y) : v_tile); }
#else
void main() { v_uv = a_pos; v_tile = a_pos * ${EXTENT}.0; gl_Position = toClip(v_tile); }
#endif`;

Object.assign(SHADERS, {
    // Heatmap, step one: every point adds a soft bump (a Gaussian, scaled by its weight) to a density picture.
    heat: [`${VS_COMMON}
layout(location=0) in vec2 a_corner; layout(location=2) in vec2 a_pos; layout(location=3) in float a_weight; layout(location=5) in float a_weight1; layout(location=6) in vec2 a_radius;
uniform float u_zt; uniform float u_weight; uniform float u_intensity; uniform float u_radius; uniform vec4 u_clip; uniform float u_scale; uniform float u_corner;
out vec2 v_ex; out float v_w;
void main() {
  v_w = mix(a_weight, a_weight1, u_zt) * u_weight;
  // The bump is drawn out to where it falls below what the picture can store, and no further.
  float s = sqrt(max(0.0, -2.0 * log(${(1 / 255 / 16).toFixed(8)} / max(v_w * u_intensity * 0.3989422804, 1e-9)))) / 3.0;
  v_ex = s * a_corner * u_corner;
  float r = u_radius + a_radius.x + u_zt * a_radius.y; // a radius for each feature is a_radius, and u_radius is then 0
  bool inside = a_pos.x >= u_clip.x && a_pos.y >= u_clip.y && a_pos.x < u_clip.z && a_pos.y < u_clip.w;
#ifdef GLOBE
  // On the globe the bump lies on the sphere, as in MapLibre GL JS (see tessellate): r is in pixels at the center of the view.
  vec4 c = toClipTurn(a_pos, v_ex * r / u_scale, 0.0);
#else
  vec4 c = toClip(a_pos);
  c.xy += v_ex * r * vec2(2.0, -2.0) / u_view * c.w;
#endif
  gl_Position = inside ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`, `
uniform float u_intensity; in vec2 v_ex; in float v_w; out vec4 o;
void main() { o = vec4(v_w * u_intensity * 0.3989422804 * exp(-4.5 * dot(v_ex, v_ex)), 0.0, 0.0, 1.0); }`],

    // Heatmap, step two: the density picture is colored through the layer's ramp.
    heatColor: [`layout(location=0) in vec2 a_pos; out vec2 v_uv;
void main() { v_uv = a_pos; gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0); }`, `
uniform sampler2D u_heat; uniform sampler2D u_ramp; uniform float u_opacity; in vec2 v_uv; out vec4 o;
void main() { o = texture(u_ramp, vec2(clamp(texture(u_heat, v_uv).r, 0.0, 1.0), 0.5)) * u_opacity; }`],

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

    // A `color-relief` layer: the color of each pixel comes from its elevation. `u_stops` has the elevations of the
    // stops of `color-relief-color` and `u_ramp` has the color at each stop. The color between two stops is a linear
    // mix, as in MapLibre GL JS. (The filter of the elevation texture is linear, and so is the encoding: the texture
    // gives the elevation between its pixels.) Two stops of the same elevation have one color in `u_ramp`,
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
}`]
});

/**
 * The lights of a `hillshade` layer at a zoom, as the `hillshade` program takes them. `method` is 0 for `standard`,
 * 1 for `combined`, 2 for `igor` and 3 for `basic` and `multidirectional`. `sun` has the direction (with `bearing`
 * added) and the altitude of each light in radians, and `shadow` and `highlight` have a premultiplied color for each.
 * As in MapLibre GL JS, only `multidirectional` has more than one light, and a list that is shorter than the longest
 * list repeats its last value.
 */
export function hillshadeLights(p: Record<string, Prop>, zoom: number, bearing: number): {method: number; n: number; sun: number[]; shadow: number[]; highlight: number[]} {
    const name = p.method.eval(zoom), spec = SPEC.hillshade;
    let method = HILLSHADE_METHODS.indexOf(name);
    if (method < 0) { warnOnce(`E569 hillshade-method: ${JSON.stringify(name)} is not a method, and the layer uses "standard". Write "standard", "basic", "combined", "igor" or "multidirectional".`); method = 0; }
    const [direction, altitude, shadow, highlight]: any[][] = LIGHT_PROPS.map((k, i) => {
        const v = p[k].eval(zoom), def = spec[k][2], list: any[] = Array.isArray(v) && (i < 2 || typeof v[0] !== 'number') ? v : [v];
        return (list.length ? list : [def]).map(x => i < 2 ? (typeof x === 'number' && !isNaN(x) ? x : def) * Math.PI / 180
            : Array.isArray(x) && x.length === 4 && typeof x[0] === 'number' ? x : (typeof x === 'string' && parseColor(x)) || parseColor(def));
    });
    let n = method === 3 ? Math.max(direction.length, altitude.length, shadow.length, highlight.length) : 1;
    if (n > LIGHTS) { warnOnce(`E10569 hillshade: a layer has ${n} lights, and the layer draws the first ${LIGHTS}. Give lists of at most ${LIGHTS} values.`); n = LIGHTS; }
    const out = {method: Math.min(method, 3), n, sun: [] as number[], shadow: [] as number[], highlight: [] as number[]};
    for (let i = 0; i < n; i++) {
        const at = (a: any[]) => a[Math.min(i, a.length - 1)];
        out.sun.push(at(direction) + bearing, at(altitude));
        for (const [to, c] of [[out.shadow, at(shadow)], [out.highlight, at(highlight)]] as [number[], number[]][]) to.push(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
    }
    return out;
}

/** Sets the uniforms of a `hillshade` or a `color-relief` layer (`u`: the uniforms of its program) before its tiles are drawn. */
export function demUniforms(this: any, L: CompiledLayer, u: Record<string, WebGLUniformLocation>, zoom: number, bearing: number) {
    const gl: WebGL2RenderingContext = this.gl, p = L.p;
    if (L.relief) {
        gl.uniform1f(u.u_opacity, p.opacity.eval(zoom));
        gl.uniform1i(u.u_ramp, 1); gl.uniform1i(u.u_stops, 2);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.ramp!));
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.rampTexture(L.relief));
        gl.activeTexture(gl.TEXTURE0);
        return;
    }
    const h = hillshadeLights(p, zoom, p.anchor.eval(zoom) === 'viewport' ? bearing * Math.PI / 180 : 0); // the map's bearing, also when drawing a terrain tile's picture
    gl.uniform3f(u.u_light, p.exaggeration.eval(zoom), h.method, h.n);
    gl.uniform2fv(u.u_sun, h.sun);
    gl.uniform4fv(u.u_shadow, h.shadow);
    gl.uniform4fv(u.u_highlight, h.highlight);
    const c = p.accent.eval(zoom); gl.uniform4f(u.u_accent, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
}

export function drawHeatmap(this: any, L: CompiledLayer, tr: Transform, items: RenderItem<GLTile>[], target: [number, number]) {
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
    gl.uniform1f(u.u_radius, L.p.radius.dd ? 0 : L.p.radius.eval(zoom));
    for (const it of items) {
        const b = it.tile.batches[L.id];
        if (!b) continue;
        this.placeTile(u, it.id, it.matrix4);
        gl.uniform4fv(u.u_clip, it.clip);
        gl.uniform1f(u.u_scale, it.scale);
        gl.uniform1f(u.u_corner, b.grid ? 1 / 7 : 1);
        gl.uniform1f(u.u_zt, Math.min(1, Math.max(0, zoom - (it.tile.z ?? it.id.z))));
        gl.bindVertexArray(b.vao);
        if (!b.scalar) { gl.vertexAttrib1f(3, 1); gl.vertexAttrib1f(5, 1); }
        if (!b.stroke) gl.vertexAttrib1f(6, 0);
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
