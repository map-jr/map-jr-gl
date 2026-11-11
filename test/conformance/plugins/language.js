// @mapbox/mapbox-gl-language: changes the language of the labels of a style. When the style of the map has loaded, the
// control rewrites the text fields and gives the map the new style with setStyle.
import MapboxLanguage from '@mapbox/mapbox-gl-language';
export async function run({map, wait}) {
    const language = new MapboxLanguage({defaultLanguage: 'fr', supportedLanguages: ['fr', 'de', 'en'], languageSource: 'openmaptiles', languageField: /^name:/, getLanguageField: l => `name:${l}`});
    const fieldsOf = style => JSON.stringify(style.layers.filter(l => l.type === 'symbol').map(l => l.layout?.['text-field']));
    const before = fieldsOf(map.getStyle()), wanted = fieldsOf(language.setLanguage(map.getStyle(), 'fr'));
    let loaded = 0;
    map.on('style.load', () => loaded++);
    map.addControl(language);
    map.setStyle(map.getStyle()); // the control waits for the next `styledata` event
    await wait(3000);
    const fields = fieldsOf(map.getStyle());
    return {ok: wanted !== before && fields === wanted && loaded > 0 && map.isStyleLoaded(),
        detail: `the plugin changes the text fields: ${wanted !== before}; the map has the changed fields: ${fields === wanted}; style.load fired: ${loaded > 0}`};
}
