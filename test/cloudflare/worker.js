// A Cloudflare Worker that serves server-rendered maps: /map.svg and /map.jpg
import {renderToSVG, renderToImage} from '../../dist/server.js';
import init, {Renderer} from '@takumi-rs/wasm';
import wasm from './takumi.wasm';
import makeStyle from '../../demo/style.mjs';
import {markers, view} from '../../demo/markers.mjs';

let rasteriser;
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const options = {style: makeStyle(env.TILES, ''), ...view, width: 1000, height: 700, markers: [markers]};
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
        return new Response('Not found', {status: 404});
    },
};
