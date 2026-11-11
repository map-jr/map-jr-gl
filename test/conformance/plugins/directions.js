// @maplibre/maplibre-gl-directions: a route between waypoints. The plugin adds a source and layers, and reads
// queryRenderedFeatures at once (not as a promise) when the pointer moves over the route.
// The routing service is not called: each request gets the same recorded answer of the OSRM demo server
// (data/osrm-route.json, route data © OpenStreetMap contributors).
import MapLibreGlDirections from '@maplibre/maplibre-gl-directions';
import route from './data/osrm-route.json';
export async function run({map, wait, mouse}) {
    const real = window.fetch;
    window.fetch = (url, options) => String(url?.url ?? url).includes('router.project-osrm.org') ? Promise.resolve(new Response(JSON.stringify(route), {headers: {'content-type': 'application/json'}})) : real(url, options);
    const directions = new MapLibreGlDirections(map);
    directions.interactive = true;
    let routes = 0, added = 0;
    directions.on('addwaypoint', () => added++);
    directions.on('fetchroutesend', e => { routes = e.data?.directions?.routes?.length ?? 0; });
    await directions.setWaypoints([[-74.01, 40.705], [-74.0, 40.715]]);
    await wait(1500);
    const source = map.getSource('maplibre-gl-directions'), layers = map.getStyle().layers.filter(l => l.source === 'maplibre-gl-directions').length;
    // A waypoint can be found under the pointer at once: that is what makes it possible to drag it.
    const p = map.project([-74.01, 40.705]), under = map.queryRenderedFeatures([p.x, p.y]).filter(f => f.source === 'maplibre-gl-directions').length;
    await mouse.click(p.x + 200, p.y - 120); // a click on the map adds a waypoint
    await wait(1500);
    window.fetch = real;
    return {ok: routes > 0 && !!source && layers > 0 && under > 0 && added === 1,
        detail: `routes: ${routes}; layers of the plugin: ${layers}; features under the first waypoint, read at once: ${under}; waypoints added by a click on the map: ${added}`};
}
