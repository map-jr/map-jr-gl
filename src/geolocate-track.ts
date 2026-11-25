// `trackUserLocation` of GeolocateControl, loaded on demand the first time tracking turns on (see controls-more.ts),
// so that a map without tracking does not load it. It follows MapLibre GL JS 6.17.
import type {Map} from './map.ts';
import {cls, toggleClass} from './controls.ts';

type WatchState = 'OFF' | 'WAITING_ACTIVE' | 'ACTIVE_LOCK' | 'ACTIVE_ERROR' | 'BACKGROUND' | 'BACKGROUND_ERROR';
/** What the tracker needs from the control. */
export interface TrackHost {
    fire(type: string): unknown;
    /** Checks `maxBounds` and fires `outofmaxbounds`, or `geolocate`. Returns false when the position is outside `maxBounds`. */
    found(p: GeolocationPosition): boolean;
    failed(err: {code: number; message: string}): void;
    follow(p: GeolocationPosition): void;
}

/** Returns `click()` (one step of the button) and `remove()`. */
export function tracker(host: TrackHost, map: Map, b: HTMLButtonElement, positionOptions: PositionOptions | undefined, showDot: boolean, showCircle: boolean) {
    let state: WatchState = 'OFF', watch: number | undefined, last: GeolocationPosition | undefined, own = false, dot: HTMLElement | undefined, circle: HTMLElement | undefined;
    // The dot and the accuracy circle are elements over the map that follow the position at every `move` (which a zoom
    // fires too). They show while tracking is on.
    const place = () => {
        if (!last || state === 'OFF' || !showDot) { dot?.remove(); circle?.remove(); return; }
        const container = map.getContainer(), ll = [last.coords.longitude, last.coords.latitude] as [number, number], {x, y} = map.project(ll), at = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        // As in MapLibre GL JS 6.17: the diameter is twice the accuracy (meters) over the meters of one pixel, measured over 100 px at the position.
        const accuracy = last.coords.accuracy;
        if (showCircle && accuracy) {
            circle ??= Object.assign(document.createElement('div'), {className: cls('user-location-accuracy-circle')});
            if (!circle.parentNode) container.appendChild(circle);
            const d = (2 * accuracy * 100 / map.unproject([x, y]).distanceTo(map.unproject([x + 100, y]))).toFixed(2) + 'px';
            Object.assign(circle.style, {width: d, height: d, transform: at});
        } else circle?.remove();
        dot ??= Object.assign(document.createElement('div'), {className: cls('user-location-dot')});
        if (!dot.parentNode) container.appendChild(dot);
        toggleClass(dot, 'user-location-dot-stale', state.endsWith('ERROR'));
        dot.style.transform = at;
    };
    // The class names of the button are those of MapLibre GL JS (`maplibregl-ctrl-geolocate-active` and others).
    const set = (s: WatchState) => {
        state = s;
        for (const [name, on] of [['active', s === 'ACTIVE_LOCK'], ['active-error', s === 'ACTIVE_ERROR'], ['background', s === 'BACKGROUND'], ['background-error', s === 'BACKGROUND_ERROR'], ['waiting', s === 'WAITING_ACTIVE']] as const) toggleClass(b, 'ctrl-geolocate-' + name, on);
        b.setAttribute('aria-pressed', String(s !== 'OFF'));
        place();
    };
    // `own` is set after easeTo, so that the end of an earlier move that easeTo stops does not clear it.
    const follow = (p: GeolocationPosition) => { host.follow(p); own = true; };
    const stop = () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); watch = undefined; set('OFF'); };
    const bg = () => state.startsWith('BACKGROUND');
    const onPosition = (p: GeolocationPosition) => {
        if (state === 'OFF') return;
        last = p;
        if (!host.found(p)) set(bg() ? 'BACKGROUND_ERROR' : 'ACTIVE_ERROR');
        else if (state === 'BACKGROUND_ERROR') set('BACKGROUND');
        else if (state === 'BACKGROUND') place();
        else { set('ACTIVE_LOCK'); follow(p); }
    };
    const onError = (err: GeolocationPositionError) => {
        // As in MapLibre GL JS, a refused permission turns tracking off and disables the button.
        if (err.code === 1) { stop(); b.disabled = true; }
        else if (state !== 'OFF') set(bg() ? 'BACKGROUND_ERROR' : 'ACTIVE_ERROR');
        host.failed(err);
    };
    // A move that the control did not start (a drag, the wheel, a call of the application) ends the lock, as in MapLibre GL JS.
    const onUserMove = () => {
        own = false;
        if (state !== 'ACTIVE_LOCK') return;
        set('BACKGROUND'); host.fire('trackuserlocationend'); host.fire('userlocationlostfocus');
    };
    const onMoveStart = () => { if (!own) onUserMove(); };
    const onMoveEnd = () => { own = false; };
    map.on('movestart', onMoveStart); map.on('dragstart', onUserMove); map.on('moveend', onMoveEnd); map.on('move', place);
    return {
        click() {
            switch (state) {
                case 'OFF':
                    set('WAITING_ACTIVE'); host.fire('trackuserlocationstart');
                    watch = navigator.geolocation.watchPosition(onPosition, onError, positionOptions);
                    break;
                case 'BACKGROUND': case 'BACKGROUND_ERROR':
                    if (state === 'BACKGROUND' && last) { set('ACTIVE_LOCK'); follow(last); } else set('ACTIVE_ERROR');
                    host.fire('trackuserlocationstart'); host.fire('userlocationfocus');
                    break;
                default:
                    stop(); host.fire('trackuserlocationend');
            }
        },
        remove() {
            if (watch !== undefined) navigator.geolocation.clearWatch(watch);
            watch = undefined; state = 'OFF';
            map.off('movestart', onMoveStart).off('dragstart', onUserMove).off('moveend', onMoveEnd).off('move', place);
            dot?.remove(); circle?.remove();
        },
    };
}
