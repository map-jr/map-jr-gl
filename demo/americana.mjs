/**
 * OSM Americana's highway shields (https://github.com/osm-americana/maplibre-gl-shields) on this map.
 *
 * The shield library is used unmodified. It needs two things from its host: somewhere to read shield artwork from
 * and somewhere to put the shields it draws. MapLibre gives it the style's sprite sheet for the first; here the
 * artwork comes from a sprite sheet loaded just for the purpose, so the map's own style can keep any sprite it likes.
 */
import {URLShieldRenderer} from '/vendor/shields.js';

/** Loads a sprite sheet (the URL without "@2x.png" / ".json") and exposes it the way the shield library expects. */
async function spriteRepository(map, spriteUrl) {
    const suffix = devicePixelRatio > 1 ? '@2x' : '';
    const [index, image] = await Promise.all([
        fetch(`${spriteUrl}${suffix}.json`).then(r => r.json()),
        fetch(`${spriteUrl}${suffix}.png`).then(r => r.blob()).then(createImageBitmap)]);
    const canvas = Object.assign(document.createElement('canvas'), {width: image.width, height: image.height});
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(image, 0, 0);
    return {
        hasSprite: id => id in index || map.hasImage(id),
        getSprite(id) {
            const s = index[id];
            return s && {data: {width: s.width, height: s.height, data: ctx.getImageData(s.x, s.y, s.width, s.height).data}, pixelRatio: s.pixelRatio};
        },
        putSprite(id, pixels, options, update) {
            if (update && map.hasImage(id)) map.removeImage(id);
            map.addImage(id, pixels, options);
        },
    };
}

/** The image name a shield is asked for by: network, ref and name on separate lines (none of them can contain one). */
export const shieldImage = n => ['concat', 'shield\n', ['coalesce', ['get', `route_${n}_network`], ''], '\n', ['coalesce', ['get', `route_${n}_ref`], ''], '\n', ['coalesce', ['get', `route_${n}_name`], '']];

/** Draws Americana shields for any image named by `shieldImage`. OpenMapTiles data (e.g. OpenFreeMap) carries what it needs. */
export async function americanaShields(map, {shields = 'https://americanamap.org/shields.json', sprite = 'https://americanamap.org/sprites/sprite'} = {}) {
    const parser = {
        parse(id) { const [, network, ref, name] = id.split('\n'); return {network, ref, name}; },
        format: (network, ref, name) => `shield\n${network}\n${ref}\n${name}`,
    };
    return new URLShieldRenderer(shields, parser)
        .filterImageID(id => id.startsWith('shield\n'))
        // Walking, cycling and other non-road route networks are not highway shields.
        .filterNetwork(network => !/^[lrni][chimpw]n$/.test(network))
        .renderOnRepository(await spriteRepository(map, sprite))
        .renderOnMaplibreGL(map);
}
