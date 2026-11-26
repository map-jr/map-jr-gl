// The page side of video and canvas sources: the `<video>` element, the copies of the canvas, and the frames that go to
// the engine. Few maps have such a source, so this file loads on demand with the first style that has one (see `syncVideos` in map.ts). It also has the
// methods of `getSource(id)` for a video source.

/** Sends the frames of a drawable to the engine, one at a time: a frame waits while the one before is still being copied. */
export function framePump(from: () => CanvasImageSource | undefined, send: (frame: ImageBitmap) => void) {
    let busy = false, again = false, stopped = false;
    const frame = () => {
        const image = from();
        if (stopped || !image) return;
        if (busy) { again = true; return; }
        busy = true;
        createImageBitmap(image).then(bitmap => { if (stopped) bitmap.close(); else send(bitmap); }, () => {}).finally(() => {
            busy = false;
            if (again) { again = false; frame(); }
        });
    };
    return {frame, stop() { stopped = true; }};
}

/**
 * Plays a video source as MapLibre GL JS does: muted, in a loop, from the first of `urls` that the browser can play.
 * Each new frame of the video goes to `send`. `fail` gets an error when none of the URLs loads.
 */
export function playVideo(id: string, urls: string[], send: (frame: ImageBitmap) => void, fail: (error: Error) => void) {
    const video = document.createElement('video');
    video.muted = video.loop = video.playsInline = true;
    let last: HTMLSourceElement | undefined;
    for (const url of urls) {
        // (Another origin needs CORS, or the frames cannot be copied.)
        if (new URL(url).origin !== location.origin) video.crossOrigin = 'anonymous';
        last = document.createElement('source');
        last.src = url;
        video.append(last);
    }
    last?.addEventListener('error', () => fail(new Error(`[map-jr-gl] E1448 The video source "${id}" could not load any of its "urls". Check the URLs, and that a server of another origin sends CORS headers.`)));
    const pump = framePump(() => video.readyState >= 2 ? video : undefined, send);
    // A frame for each frame of the video (requestVideoFrameCallback), or for each frame of the page where the browser
    // does not have that. (A callback of requestVideoFrameCallback waits while the video is paused.)
    let looping = false;
    const tick = () => { looping = false; pump.frame(); if (!video.paused) schedule(); };
    const schedule = () => {
        if (looping) return;
        looping = true;
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
    };
    video.addEventListener('playing', schedule);
    // (The frame of the pause lets the map reach `idle`, which it does not while the video plays.)
    video.addEventListener('pause', pump.frame);
    // (A paused video shows a new frame after a seek, and its first frame once it has loaded.)
    video.addEventListener('seeked', pump.frame);
    video.addEventListener('loadeddata', pump.frame);
    video.play().catch(() => {});
    return {
        el: video,
        /** Sends the frame that the video shows now: a new engine has no picture yet. */
        frame: pump.frame,
        playing: () => !video.paused,
        play() { video.play().catch(() => {}); },
        pause() { video.pause(); },
        stop() { pump.stop(); video.pause(); video.replaceChildren(); video.load(); },
    };
}

/**
 * Copies a canvas source as MapLibre GL JS does: once at the start, and in each frame of the page while it plays.
 * With `animate` (the default) it plays from the start. A pause copies the canvas one more time.
 */
export function playCanvas(id: string, canvas: HTMLCanvasElement, animate: boolean, send: (frame: ImageBitmap) => void, fail: (error: Error) => void) {
    // (A canvas of no size gives no frame, and the error of MapLibre GL JS.)
    if (!(canvas.width > 0 && canvas.height > 0)) fail(new Error(`[map-jr-gl] E1452 The canvas source "${id}": the canvas is ${canvas.width} × ${canvas.height} pixels. Give it a width and a height above 0.`));
    const pump = framePump(() => canvas.width > 0 && canvas.height > 0 ? canvas : undefined, send);
    let on = false;
    const tick = () => { if (on) { pump.frame(); requestAnimationFrame(tick); } };
    const play = () => { if (!on) { on = true; tick(); } };
    pump.frame();
    if (animate) play();
    return {
        el: canvas, frame: pump.frame, playing: () => on, play,
        pause() { if (on) { on = false; pump.frame(); } },
        stop() { on = false; pump.stop(); },
    };
}

type Player = ReturnType<typeof playVideo> | ReturnType<typeof playCanvas>;
/** The players of the video and canvas sources of one map, by source id. */
export class Videos {
    private players = new Map<string, {key: unknown; player: Player}>();
    constructor(private sources: () => Record<string, any>, private base: () => string, private send: (source: string, frame: ImageBitmap) => void,
        private fail: (error: Error) => void, private edit: (fn: () => void) => unknown) {}
    /**
     * Starts a player for each new video or canvas source, and stops the players of the sources that are gone, or that
     * have other URLs or another canvas.
     */
    sync() {
        const sources = this.sources();
        const keyOf = (spec: any) => spec?.type === 'video' ? Array.isArray(spec.urls) && spec.urls.length ? JSON.stringify(spec.urls) : '' : spec?.type === 'canvas' ? spec.canvas : '';
        for (const [id, v] of this.players) if (keyOf(sources[id]) !== v.key) { v.player.stop(); this.players.delete(id); }
        for (const [id, spec] of Object.entries(sources)) {
            const key = keyOf(spec);
            if (!key || this.players.has(id)) continue;
            const send = (image: ImageBitmap) => this.players.get(id) === v ? this.send(id, image) : image.close();
            let player: Player;
            if (spec.type === 'video') player = playVideo(id, spec.urls.map((u: string) => new URL(u, this.base()).href), send, this.fail);
            else {
                const canvas = typeof key === 'string' ? document.getElementById(key) : key;
                if (!(canvas instanceof HTMLCanvasElement)) { this.fail(new Error(`[map-jr-gl] E11452 The canvas source "${id}": ${typeof key === 'string' ? `the page has no <canvas> with the id "${key}"` : '"canvas" is not a <canvas> element'}. Give the id of a <canvas> of the page, or the element.`)); continue; }
                player = playCanvas(id, canvas, spec.animate !== false, send, this.fail);
            }
            const v = {key, player};
            this.players.set(id, v);
        }
    }
    /** Sends the frame of each source again: a new engine has no picture yet. */
    frame() { for (const v of this.players.values()) v.player.frame(); }
    /** A video plays, or a canvas is copied in each frame: as in MapLibre GL JS, the map is not `loaded()` and does not fire `idle`. */
    playing() { return [...this.players.values()].some(v => v.player.playing()); }
    /** `getSource(id)` of a video or canvas source, with the methods of MapLibre GL JS. */
    source(id: string, spec: any) {
        const player = () => this.players.get(id)?.player, el = () => player()?.el;
        return {
            ...spec, id, [spec.type === 'video' ? 'getVideo' : 'getCanvas']: el, setCoordinates: (coordinates: unknown) => this.edit(() => { spec.coordinates = coordinates; }),
            play: () => player()?.play(), pause: () => player()?.pause(),
            ...spec.type === 'video' && {seek: (seconds: number) => { const v = el() as HTMLVideoElement | undefined; if (v) v.currentTime = seconds; }},
        };
    }
}
