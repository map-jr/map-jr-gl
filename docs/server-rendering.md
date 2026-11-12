# Server rendering

The server renderer renders the first view of a map without a browser. Use it for these tasks:

- Show a map immediately, before the page script runs.
- Make an image for an email, a document, or a link preview.

It works on Node.js, on Cloudflare Workers, and in other JavaScript environments that have `fetch`.

## Make an SVG

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg, tiles} = await renderToSVG({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
});
```

- `svg` is the rendered map.
- `tiles` is the list of tile URLs that the render used.

`renderToSVG` has no dependencies.

## Put the SVG in a page

1. Put the SVG in the map container:

   ```html
   <div id="map" style="position: relative; width: 800px; height: 500px">
     <!-- the SVG from renderToSVG -->
   </div>
   ```

2. Add a preload link for each tile URL. The browser then gets the tiles while it loads the script:

   ```html
   <link rel="preload" as="fetch" crossorigin href="https://example.com/tiles/14/4823/6160.pbf">
   ```

3. Create the map with the same style, centre and zoom. The map removes the SVG when its first frame is ready.

## Make an image

`renderToImage` changes the SVG to a JPEG, WebP or PNG image. You supply the part that does this change. The part
is the Takumi renderer. There is one version for Node.js and one version for WebAssembly.

On Node.js:

```js
import {renderToImage} from '@map-jr/map-jr-gl/server';
import {Renderer} from '@takumi-rs/core';

const {image, contentType} = await renderToImage({
  style, center, zoom, width: 800, height: 500,
  rasteriser: new Renderer(),
  format: 'webp',
  pixelRatio: 2,
});
```

On Cloudflare Workers:

```js
import {renderToImage} from '@map-jr/map-jr-gl/server';
import init, {Renderer} from '@takumi-rs/wasm';
import wasm from '@takumi-rs/wasm/takumi_wasm_bg.wasm';

let rasteriser;

export default {
  async fetch(request) {
    if (!rasteriser) {
      await init({module_or_path: wasm});
      rasteriser = new Renderer();
    }
    const {image, contentType} = await renderToImage({
      style, center, zoom, width: 800, height: 500,
      rasteriser,
      format: 'jpeg',
    });
    return new Response(image, {headers: {'content-type': contentType}});
  },
};
```

Notes for Cloudflare Workers:

- Use `format: 'jpeg'`. The WebAssembly version makes only large WebP files.
- The WebAssembly file is about 1.9 MB (gzip).
- One render uses a few hundred milliseconds of CPU time. Keep the result in a cache. See [Operation](#operation).

`test/cloudflare` contains a complete Worker.

## SVG or image

| | SVG | Image |
|---|---|---|
| Size | Becomes large for a city with much detail (a few hundred KB) | Almost constant |
| Sharpness | Sharp at each size | Set by `pixelRatio` |
| Dependencies | None | The Takumi renderer |

## Options

| Option | Meaning |
|---|---|
| `style` | A style object or the URL of a style. Required. |
| `center`, `zoom`, `width`, `height` | The view. Required. |
| `bearing` | The rotation of the map in degrees |
| `markers` | A list of marker layer options. See [Markers](markers.md). |
| `label` | The name of the SVG for assistive technology. The SVG has `role="img"` and this text as its `aria-label`. The default is `"Map"`. `renderToImage` accepts the option, but an image cannot carry it. |
| `resolveImage` | A function that supplies an icon as SVG when the sprite does not contain it |
| `layerFilter` | A function that returns `false` for a layer to leave out |
| `inlineImages` | When `true`, raster tiles and the sprite go into the SVG as data. Required when the SVG is shown with an `<img>` element. |
| `highDensity` | When `true`, the render uses the high-density (@2x) sprite |
| `ssrOverrides` | When `false`, the server changes in the style are ignored. See below. |
| `overrides` | Server changes for style layers, by the id of the layer: `{building: {hidden: true}}`. For a style that you do not write yourself. See below. |
| `decodeImage` | A function that decodes elevation tiles. Required only for formats other than PNG and lossless WebP. |
| `fetch` | A replacement for `fetch`, for example to add a cache |
| `timeout` | The time in milliseconds that all requests of one render can take together. The default is 30000. `0` sets no limit. See [Limits for requests](#limits-for-requests). |
| `requestTimeout` | The time in milliseconds that one request can take, with its redirects and its body. The default is 10000. `0` sets no limit. |
| `maxBytes` | The largest body of one response in bytes, after decompression. There is no limit by default. |
| `allowHosts` | The list of host names that the render can request. All hosts are allowed by default. |

`renderToImage` also accepts `rasteriser`, `format`, `quality` and `pixelRatio`.

## Limits for requests

The server renderer requests the URL of the style and each URL that the style names: TileJSON files, tiles, the
sprite and PMTiles archives. These requests come from your server. Set limits when a part of the style or of the
view comes from a visitor, or when the style comes from another party.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
  timeout: 5000,
  requestTimeout: 2000,
  maxBytes: 4 * 1024 * 1024,
  allowHosts: ['tiles.openfreemap.org'],
});
```

| Option | Default | What the limit does |
|---|---|---|
| `timeout` | 30000 ms | The render rejects when all its requests together take longer. The time starts when the render starts. The time that the render needs after the last request is not limited. |
| `requestTimeout` | 10000 ms | The render rejects when one request takes longer, from its start to the end of its body. Redirects are part of the request. |
| `maxBytes` | No limit | The render rejects when the body of one response is larger. The bytes are counted after decompression. A response with a larger `content-length` is not read. |
| `allowHosts` | All hosts | The render rejects before a request to a host that is not in the list. |

- A time limit of `0` sets no limit.
- When a time limit ends, the renderer aborts the request with an `AbortSignal`.
- The limits apply to `renderToSVG`, `renderToImage` and `renderFirstView`. They also apply to the requests of a
  function that you pass as `fetch`.
- A value that is not valid (a negative number, or a host with a scheme, a port or a path) makes the render
  reject with a message.

### Allowed hosts

Each name in `allowHosts` is compared with the complete host name of the URL. The port and the scheme are not
compared, and there are no wildcards: `example.com` does not allow `tiles.example.com`. Name each host that the
style uses: the host of the style, of the TileJSON files, of the tiles and of the sprite.

With `allowHosts`, the renderer follows redirects itself (5 at most) and checks the host of each one. For this it
calls `fetch` with `redirect: 'manual'`. Node.js and Cloudflare Workers then return the redirect response, which is
what the renderer needs. A function that you pass as `fetch` must do the same. If it follows redirects itself, the
renderer rejects the response when the `url` of the response has a host that is not in the list, but the request to
that host was made.

`allowHosts` compares names only. It does not look at the IP address that a name resolves to, so allow only hosts
that you trust.

Without `inlineImages`, the SVG contains the URLs of raster tiles and of the sprite as links. The server does not
request them, and `allowHosts` does not check them: the browser of the visitor requests them.

## Operation

**Requests.** A render first loads the style, and the TileJSON files that the style names. Then it requests all
tiles of the view and the sprite at the same time. The library does not limit the number of renders that run at
the same time, and it does not limit the number of requests. If you need such a limit, put it in the function
that you pass as `fetch`, or in front of the render.

**When a host is down or slow.** The render rejects when the style, a TileJSON file or a tile cannot be loaded.
This is the case for a network error, for a time limit, and for a tile with an HTTP status that is not successful.
There are two exceptions: a tile with status 404 or 204 is an empty tile, and the render continues. The renderer
does not return a part of a map. Catch the error and send the page without the SVG: the map then draws in the
browser as it does without a server render.

```js
import {renderFirstView} from '@map-jr/map-jr-gl/server';

const options = {style: 'https://tiles.openfreemap.org/styles/liberty', center: [-74.0065, 40.7085], zoom: 14.3, width: 800, height: 500};
let firstView = '';
try {
  firstView = await renderFirstView({...options, timeout: 3000});
} catch (error) {
  console.warn(error.message);
}
```

With the default limits, a host that does not answer delays the response of your server by 10 seconds for one
request, and by 30 seconds at most for one render. Set a smaller `timeout` for a page that a visitor waits for.

**Caching.** The renderer does not keep a result. For the same options and the same tiles, the result is the
same, so keep the SVG or the image in a cache (by the style, the view and the size). To keep tiles instead, pass
a function as `fetch` that has a cache.

## Simplify the server render

A server render does not need all the detail of the live map. You can put changes for the server in the style.
MapLibre GL JS ignores them, so the style stays correct for the two libraries.

```json
{
  "id": "building",
  "type": "fill",
  "source": "omt",
  "source-layer": "building",
  "metadata": {
    "map-jr:ssr": {"hidden": true}
  }
}
```

For a style that you do not write yourself (a style from a URL), give the same changes in the option `overrides`,
by the id of the layer:

```js
const {svg, attribution} = await renderToSVG({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center, zoom, width: 800, height: 500,
  overrides: {building: {hidden: true}, poi_r20: {hidden: true}},
});
```

A value in `overrides` comes before the value in the style.

| Key | Effect on the server render |
|---|---|
| `hidden` | The layer does not show |
| `filter` | An additional filter |
| `minzoom`, `maxzoom` | A different zoom range |
| `paint`, `layout` | Different property values |
| `simplify` | Lines and polygons are made simpler by this number of pixels |
| `minSize` | Shapes smaller than this number of pixels do not show |

## The first view for a framework

`renderFirstView` takes the options of `renderToSVG` and returns HTML for the element of the map: the SVG, and the
credits of the sources over it. The option `attribution` gives other credits; `false` shows none. The Vue component
uses this function for its `ssr` prop. With React, call it on the server and give the result to the component. See
[Vue and Nuxt](vue.md) and [React](react.md).

## Credits

The result of `renderToSVG` has `attribution`: the credits of the sources of the style, as a list of HTML strings.
Show them with the render. (The Vue component does this.)

## Fonts

The SVG uses the fonts of the page where you show it. Set `fontFamily` to make the text the same as the live map.

The server does not have the fonts, so it estimates the width of each label. The live map measures the width.
Where labels are close together, the server render can therefore show a different label than the live map shows
(one street name in place of the name of the next street, for example).

For an image, register your fonts with the Takumi renderer. You need this for scripts that are not Latin.

## What the server renderer does not draw

- Relief shading and 3D terrain
- Image patterns
- Images that you add with `addImage` in the browser. Use `resolveImage` instead.
