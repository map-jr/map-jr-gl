/**
 * The module for Nuxt: `modules: ['@map-jr/map-jr-gl/nuxt']` in nuxt.config.
 *
 * It registers the components of `@map-jr/map-jr-gl/vue` (`MapJr`, `MapOverlay`, `MapImage`), so that a page uses them without an import.
 * Nuxt then also has `LazyMapJr`: the code of the map is a file of its own, and with `hydrate-on-visible` it loads
 * when the map comes into view. It registers the composables (`useMap`, `useMapHost`, `useMapFeatures`) and the controls. The controls
 * get longer names, because `scale` and `navigation` are common words: `navigationControl()`, `scaleControl()`,
 * `fullscreenControl()`, `geolocateControl()`, `terrainControl()`.
 */
// @ts-ignore: the kit of Nuxt comes with the application, it is not a dependency of this library
import {addComponent, addImports, defineNuxtModule} from '@nuxt/kit';

// (The type is written out, so that the declaration of this file does not need the types of Nuxt: with them installed,
// the compiler writes a declaration that names types it does not import.)
const nuxtModule: any = defineNuxtModule({
    meta: {name: '@map-jr/map-jr-gl', configKey: 'mapJr'},
    setup(_options: unknown, nuxt: any) {
        // (By package specifier, so that the generated `components.d.ts` and `imports.d.ts` take the types from `exports`.)
        const vue = '@map-jr/map-jr-gl/vue', controls = '@map-jr/map-jr-gl/controls';
        // Vite in development must not pre-bundle the package, or the URL of the tile worker breaks (docs/loading.md).
        const deps = ((nuxt.options.vite ||= {}).optimizeDeps ||= {});
        deps.exclude = [...(deps.exclude || []), '@map-jr/map-jr-gl', vue, controls];
        for (const name of ['MapJr', 'MapOverlay', 'MapImage']) addComponent({name, export: name, filePath: vue});
        addImports(['useMap', 'useMapHost', 'useMapFeatures'].map(name => ({name, from: vue})));
        addImports(['navigation', 'scale', 'fullscreen', 'geolocate', 'terrain'].map(name => ({name, as: name + 'Control', from: controls})));
    },
});
export default nuxtModule;
