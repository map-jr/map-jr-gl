// The images in metadata['map-jr:images'] of a style for the compat entry (#759). The page loads this file only for a style that has the key.
import {styleImages} from './style-images.ts';

type Add = (name: string, source: any, options: object) => Promise<unknown>;
/**
 * Adds the templates of the style at once, and gives a function that adds another image of the style when a layer asks
 * for it. That function returns `false` for a name that the style does not have. `names` gets the names of the images
 * that came from the style; an image that the page added (not in `names`) wins. `live` is false once a newer style came.
 */
export function compatImages(map: {hasImage(name: string): boolean; fire: Function}, style: any, names: Set<string>, live: () => boolean, add: Add) {
    const fault = (message: string) => { if (live()) map.fire('error', {error: new Error(message)}); }, now = new Set<string>();
    const from = styleImages(style, fault, now);
    const put = (name: string) => {
        if (map.hasImage(name) && !names.has(name)) return;
        const v = from[name], spec = typeof v === 'object' ? v : null;
        names.add(name);
        return add(name, spec ? spec.image : v, spec ?? {}).catch(() => fault(`[map-jr-gl] E121 the style: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.`));
    };
    for (const name of now) put(name);
    return (name: string) => Object.hasOwn(from, name) && !map.hasImage(name) && (put(name) ?? true);
}
