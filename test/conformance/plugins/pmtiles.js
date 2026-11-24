// pmtiles: register its protocol, as its documentation says, add a vector source from an archive, and check that a
// layer of that source draws features. This library reads pmtiles:// URLs itself and does not call the protocol of the
// plugin (docs/reference/maplibre-differences.md), so the scenario tests that a page written for the plugin draws the
// archive; it reports how often the plugin was called.
import {Protocol} from 'pmtiles';
const FILE = 'https://styles.map-jr.org/data/natural-earth-5.1.2.pmtiles';
export async function run({lib, map, wait}) {
    const protocol = new Protocol();
    let calls = 0;
    lib.addProtocol('pmtiles', (params, abort) => { calls++; return protocol.tile(params, abort); });
    map.jumpTo({center: [10, 50], zoom: 3});
    map.addSource('archive', {type: 'vector', url: 'pmtiles://' + FILE});
    map.addLayer({id: 'archive-countries', type: 'line', source: 'archive', 'source-layer': 'countries', paint: {'line-color': '#f0f', 'line-width': 2}});
    let found = 0;
    for (let i = 0; i < 100 && !found; i++) { await wait(200); found = (await map.queryRenderedFeatures({layers: ['archive-countries']})).length; }
    lib.removeProtocol('pmtiles');
    return {ok: found > 0, detail: `a layer of a pmtiles:// source draws ${found} features; the library read the archive itself (the protocol of the plugin was called ${calls} times)`};
}
