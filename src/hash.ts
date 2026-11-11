import type {Map} from './map.ts';

type Camera = {zoom: number; center: [number, number]; bearing: number; pitch: number};

/** The camera that the fragment of the URL gives (`#zoom/lat/lng/bearing/pitch`, or `#name=zoom/lat/lng` with a name), or null. */
function readHash(key: true | string): Camera | null {
    const all = location.hash.slice(1), p = (key === true ? all : new URLSearchParams(all).get(key) ?? '').split('/').map(Number);
    return p.length > 2 && !p.some(isNaN) ? {zoom: p[0], center: [p[2], p[1]], bearing: p[3] ?? 0, pitch: p[4] ?? 0} : null;
}

/**
 * The `hash` option of the map, as in MapLibre: a movement of the map writes the camera into the fragment of the URL,
 * and a change of the fragment moves the map. Returns a function that stops it.
 * (The map loads this file only when the option is used.)
 */
export function watchHash(map: Map, key: true | string) {
    const changed = () => { const camera = readHash(key); if (camera) map.jumpTo(camera); };
    const moved = () => {
        // (The position has as many digits as the zoom can show, as in MapLibre.)
        const c = map.getCenter(), zoom = Math.round(map.getZoom() * 100) / 100, m = 10 ** Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10), bearing = map.getBearing(), pitch = map.getPitch();
        const camera = `${zoom}/${Math.round(c.lat * m) / m}/${Math.round(c.lng * m) / m}` + (bearing || pitch ? '/' + Math.round(bearing * 10) / 10 : '') + (pitch ? '/' + Math.round(pitch) : '');
        // Other values in the fragment stay (with a name for the camera).
        const others = key === true ? [] : location.hash.slice(1).split('&').filter(part => part && part.split('=')[0] !== key);
        history.replaceState(history.state, '', location.href.replace(/(#.*)?$/, '#' + [...others, key === true ? camera : `${key}=${camera}`].join('&')));
    };
    addEventListener('hashchange', changed);
    map.on('moveend', moved);
    return () => { removeEventListener('hashchange', changed); map.off('moveend', moved); };
}
