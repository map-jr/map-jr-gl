// The images of a style in metadata['map-jr:images'] (#495). The page loads this file only for a style that has the key.
/** The key of the metadata of a style that carries images (see "Images for style layers" in docs/api.md). */
export const STYLE_IMAGES = 'map-jr:images';
/**
 * The bounds for the images of a style, which comes from another party: the number of images, and the length of the text of one.
 * The page draws every image when the style arrives, so the number bounds that time. 800 icons of 21 CSS pixels fill 77%
 * of the texture of the images at a pixel ratio of 3, and the texture is full after 961 of them (measured for #610).
 */
const MAX_STYLE_IMAGES = 800, MAX_STYLE_IMAGE = 200_000;
/**
 * The images in `metadata['map-jr:images']` of a style: an SVG document or the URL of an image, as text, or an object
 * with such a text as `image`. An image that breaks a bound, or an SVG that refers to another file, is left out, and
 * `fault` gets a message for it.
 */
export function styleImages(style: any, fault: (message: string) => void): Record<string, string | {image: string; width?: number; height?: number}> {
    const given = style?.metadata?.[STYLE_IMAGES], out: Record<string, any> = {};
    if (given == null) return out;
    if (typeof given !== 'object' || Array.isArray(given)) { fault(`[map-jr-gl] the style: metadata["${STYLE_IMAGES}"] is not an object of images by name, and the map uses none of them. Write {"name": "<svg ...>"}.`); return out; }
    let n = 0;
    for (const name in given) {
        const v = given[name], text = typeof v === 'string' ? v : v && typeof v === 'object' ? v.image : undefined;
        const why = ++n > MAX_STYLE_IMAGES ? `the style has more than ${MAX_STYLE_IMAGES} images`
            : typeof text !== 'string' ? 'the value is not a text, or an object with a text as "image"'
            : text.length > MAX_STYLE_IMAGE ? `the text is longer than ${MAX_STYLE_IMAGE} characters`
            : text.trimStart().startsWith('<') && /(\bhref\s*=|\burl\()(?![\s"']*(#|data:))/i.test(text) ? 'the SVG refers to another file' : '';
        if (why) fault(`[map-jr-gl] the style: the image "${name}" of metadata["${STYLE_IMAGES}"] is left out, because ${why}. Give an SVG document without references to other files, or the URL of an image.`);
        else out[name] = typeof v === 'string' ? v : {...v};
    }
    return out;
}
