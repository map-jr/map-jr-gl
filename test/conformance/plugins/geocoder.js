// @maplibre/maplibre-gl-geocoder: a search control. The scenario gives it a geocoder that knows one place.
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder';
export async function run({lib, map, wait}) {
    const place = {type: 'Feature', geometry: {type: 'Point', coordinates: [2.2945, 48.8584]}, place_name: 'Eiffel Tower', properties: {}, text: 'Eiffel Tower', place_type: ['place'], center: [2.2945, 48.8584]};
    const api = {forwardGeocode: async () => ({type: 'FeatureCollection', features: [place]})};
    const geocoder = new MaplibreGeocoder(api, {maplibregl: lib, flyTo: {duration: 0}, marker: true});
    let result = null;
    geocoder.on('result', e => { result = e.result; });
    map.addControl(geocoder, 'top-left');
    const input = map.getContainer().querySelector('.maplibregl-ctrl-geocoder input');
    geocoder.query('eiffel');
    await wait(2500);
    const c = map.getCenter(), near = Math.hypot(c.lng - 2.2945, c.lat - 48.8584) < 0.01, marker = !!map.getContainer().querySelector('.maplibregl-marker');
    return {ok: !!input && result?.place_name === 'Eiffel Tower' && near && marker,
        detail: `the control is in the page: ${!!input}; result: ${result?.place_name}; the map went to the place: ${near}; marker: ${marker}`};
}
