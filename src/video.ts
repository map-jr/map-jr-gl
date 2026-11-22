// The page side of a video source: its `<video>` element and the frames that go to the engine. Few maps have a video
// source, so this file loads on demand with the first style that has one (see `Map.syncVideos` in map.ts).

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

export type VideoPlayer = ReturnType<typeof playVideo>;

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
