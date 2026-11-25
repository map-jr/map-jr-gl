// A class with a member that has the name of a method of the WebGL context (#1948).
export class Lens {
    depthRange(): [number, number] { return [0, 1]; }
}
export function reset(gl: WebGL2RenderingContext, c: Lens) { gl.depthRange(0, 1); return c.depthRange(); }
