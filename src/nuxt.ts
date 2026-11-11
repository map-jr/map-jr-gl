/**
 * The module for Nuxt: `modules: ['map-jr-gl/nuxt']` in nuxt.config.
 *
 * It registers the components of `map-jr-gl/vue` (`MapJr`, `MapOverlay`), so that a page uses them without an import.
 * Nuxt then also has `LazyMapJr`: the code of the map is a file of its own, and with `hydrate-on-visible` it loads
 * when the map comes into view. It registers the composables (`useMap`, `useMapHost`) and the controls. The controls
 * get longer names, because `scale` and `navigation` are common words: `navigationControl()`, `scaleControl()`,
 * `fullscreenControl()`, `geolocateControl()`, `terrainControl()`.
 */
// @ts-ignore: the kit of Nuxt comes with the application, it is not a dependency of this library
import {addComponent, addImports, createResolver, defineNuxtModule} from '@nuxt/kit';

export default defineNuxtModule({
    meta: {name: 'map-jr-gl', configKey: 'mapJr'},
    setup() {
        // (The files beside this one, by their path: the same files that `map-jr-gl/vue` and `map-jr-gl/controls` name.)
        const {resolve} = createResolver(import.meta.url), vue = resolve('./vue.js'), controls = resolve('./controls.js');
        for (const name of ['MapJr', 'MapOverlay']) addComponent({name, export: name, filePath: vue});
        addImports(['useMap', 'useMapHost'].map(name => ({name, from: vue})));
        addImports(['navigation', 'scale', 'fullscreen', 'geolocate', 'terrain'].map(name => ({name, as: name + 'Control', from: controls})));
    },
});
