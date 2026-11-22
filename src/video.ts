// The page side of a video source: its `<video>` element and the frames that go to the engine. Few maps have a video
// source, so this file loads on demand with the first style that has one (see `syncVideos` in map.ts). It also has the
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
    last?.addEventListener('error', () => fail(new Error(`[map-jr-gl] The video source "${id}" could not load any of its "urls". Check the URLs, and that a server of another origin sends CORS headers.`)));
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
        video,
        /** Sends the frame that the video shows now: a new engine has no picture yet. */
        frame: pump.frame,
        stop() { pump.stop(); video.pause(); video.replaceChildren(); video.load(); },
    };
}

type Player = ReturnType<typeof playVideo>;
/** The players of the video sources of one map, by source id. */
export class Videos {
    private players = new Map<string, {urls: string; player: Player}>();
    constructor(private sources: () => Record<string, any>, private base: () => string, private send: (source: string, frame: ImageBitmap) => void,
        private fail: (error: Error) => void, private edit: (fn: () => void) => unknown) {}
    /** Starts a player for each new video source, and stops the players of the sources that are gone or have other URLs. */
    sync() {
        const sources = this.sources(), urlsOf = (spec: any) => spec?.type === 'video' && Array.isArray(spec.urls) && spec.urls.length ? JSON.stringify(spec.urls) : '';
        for (const [id, v] of this.players) if (urlsOf(sources[id]) !== v.urls) { v.player.stop(); this.players.delete(id); }
        for (const [id, spec] of Object.entries(sources)) {
            const urls = urlsOf(spec);
            if (!urls || this.players.has(id)) continue;
            const v = {urls, player: playVideo(id, spec.urls.map((u: string) => new URL(u, this.base()).href), image => this.players.get(id) === v ? this.send(id, image) : image.close(), this.fail)};
            this.players.set(id, v);
        }
    }
    /** Sends the frame of each video again: a new engine has no picture yet. */
    frame() { for (const v of this.players.values()) v.player.frame(); }
    /** A video plays: as in MapLibre GL JS, the map is not `loaded()` and does not fire `idle`. */
    playing() { return [...this.players.values()].some(v => !v.player.video.paused); }
    /** `getSource(id)` of a video source, with the methods of MapLibre GL JS. */
    source(id: string, spec: any) {
        const video = () => this.players.get(id)?.player.video;
        return {
            ...spec, id, getVideo: video, setCoordinates: (coordinates: unknown) => this.edit(() => { spec.coordinates = coordinates; }),
            play: () => { video()?.play().catch(() => {}); }, pause: () => video()?.pause(),
            seek: (seconds: number) => { const el = video(); if (el) el.currentTime = seconds; },
        };
    }
}
