// A stand-in for src/gl.ts: a renderer whose every method, and every method of its WebGL context, does nothing and
// returns undefined, so that the engine starts in Node with no WebGL (test/unit/request-timeout.test.ts).
export const SPRITE_ATLAS = 2048;
const calls = () => new Proxy({}, {get: (o, k) => k in o ? o[k] : () => undefined});
export class GLRenderer {
    gl = calls();
    constructor() {
        return new Proxy(this, {get: (o, k) => k in o ? o[k] : () => undefined});
    }
}
