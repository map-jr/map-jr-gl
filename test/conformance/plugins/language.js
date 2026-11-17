// @mapbox/mapbox-gl-language: changes the language of the labels of a style. When the style of the map has loaded, the
// control rewrites the text fields and gives the map the new style with setStyle. The scenario counts the reloads
// over 5 s: the control calls setStyle again on each `style.load`, so a map that fires `style.load` for a style that
// it applies as a diff reloads without end (#743). This library and MapLibre GL JS 6.17 load once more and then stop, because the third style is the same.
import MapboxLanguage from '@mapbox/mapbox-gl-language';
export async function run({map, wait}) {
    const language = new MapboxLanguage({defaultLanguage: 'fr', supportedLanguages: ['fr', 'de', 'en'], languageSource: 'openmaptiles', languageField: /^name:/, getLanguageField: l => `name:${l}`});
    const fieldsOf = style => JSON.stringify(style.layers.filter(l => l.type === 'symbol').map(l => l.layout?.['text-field']));
    const before = fieldsOf(map.getStyle()), wanted = fieldsOf(language.setLanguage(map.getStyle(), 'fr'));
    let loaded = 0, set = 0;
    map.on('style.load', () => loaded++);
    const setStyle = map.setStyle.bind(map);
    map.setStyle = (...a) => { set++; return setStyle(...a); };
    map.addControl(language);
    // The control acts on the next `style.load`: as in MapLibre, only a setStyle with `diff: false` fires it.
    map.setStyle(map.getStyle(), {diff: false});
    await wait(5000);
    const fields = fieldsOf(map.getStyle());
    return {ok: wanted !== before && fields === wanted && loaded <= 2 && set <= 3 && map.isStyleLoaded(),
        detail: `the plugin changes the text fields: ${wanted !== before}; the map has the changed fields: ${fields === wanted}; in 5 s, style.load fired ${loaded} times and setStyle was called ${set} times`};
}
