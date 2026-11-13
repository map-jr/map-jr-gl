// A Cloudflare Worker that serves server-rendered maps: /map.svg, /map.jpg and /contours.svg
import {renderToSVG, renderToImage} from '../../dist/server.js';
import init, {Renderer} from '@takumi-rs/wasm';
import wasm from './takumi.wasm';
import makeStyle from '../../demo/style.mjs';
import {markers, images, view} from '../../demo/markers.mjs';

let rasteriser;
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const options = {style: makeStyle(env.TILES, ''), ...view, width: 1000, height: 700, images, markers: [markers]};
        const t0 = Date.now();
        if (url.pathname === '/map.svg') {
            const {svg} = await renderToSVG(options);
            return new Response(svg, {headers: {'content-type': 'image/svg+xml', 'x-render-ms': String(Date.now() - t0)}});
        }
        if (url.pathname === '/map.jpg') {
            if (!rasteriser) { await init({module_or_path: wasm}); rasteriser = new Renderer(); }
            const {image, contentType} = await renderToImage({...options, rasteriser});
            return new Response(image, {headers: {'content-type': contentType, 'x-render-ms': String(Date.now() - t0)}});
        }
        if (url.pathname === '/contours.svg') {
            // Contours from lossless WebP elevation tiles, decoded inside the Worker.
            const style = {version: 8, sources: {
                dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
                contours: {type: 'contour', source: 'dem', multiplier: 3.28084, thresholds: {9: [500, 1000], 12: [100, 500]}}},
                layers: [{id: 'contours', type: 'line', source: 'contours', 'source-layer': 'contours', paint: {'line-color': '#7a5c3a'}}]};
            const {svg} = await renderToSVG({style, width: 600, height: 400, center: [7.6586, 45.9763], zoom: 12.3});
            if (!svg.includes('<path')) return new Response('no contour lines drawn', {status: 500});
            return new Response(svg, {headers: {'content-type': 'image/svg+xml', 'x-render-ms': String(Date.now() - t0)}});
        }
        return new Response('Not found', {status: 404});
    },
};
