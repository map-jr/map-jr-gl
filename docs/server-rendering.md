# Server rendering

The server renderer (`@map-jr/map-jr-gl/server`) renders one view of a map to an SVG without WebGL. Use it for these
tasks:

- Show a map immediately, before the page script runs.
- Make an image for an email, a document, or a link preview.
- Export a map as a vector SVG from a page, with no server (see [Export an SVG in the browser](#export-an-svg-in-the-browser)).

It works on Node.js, on Cloudflare Workers, in a browser, and in other JavaScript environments that have `fetch`.

## Make an SVG

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg, tiles} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
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

## Export an SVG in the browser

`renderToSVG` also runs in a page. This example of the entry `@map-jr/map-jr-gl/server` saves the view as a vector SVG
when the user clicks a button:

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

document.querySelector('#export').addEventListener('click', async () => {
  const {svg} = await renderToSVG({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    center: [-74.0065, 40.7085],
    zoom: 14.3,
    width: 800,
    height: 500,
  });
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'map.svg';
  link.click();
  URL.revokeObjectURL(url);
});
```

The page needs a `<button id="export">`. The style, the tiles and the glyphs must allow requests from the page
(CORS), as for the map itself. To export the view that a map shows, pass its centre, zoom and bearing. The server renderer draws no pitch.

This example ran on 2026-11-17 in Chromium 153 and in WebKit 26.6 of Playwright, with `dist/server.js` loaded as a
module and no bundler. Each run gave the same SVG of 428 KB, in 0.8 s in Chromium and 0.4 s in WebKit. It is not
checked in Firefox or in Safari on a device.

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
| `bounds`, `padding` | A box (`[[west, south], [east, north]]` or `[west, south, east, north]`) to fit into the view, with `padding` in pixels around it (a number or `{top, right, bottom, left}`, default 0). With `bounds`, the renderer uses the box in place of `center` and `zoom` (give them all the same, because they are required). |
| `images` | Images for the style layers, by name: SVG documents, or `{image, width, height}`. An SVG with slots (`{{name}}`) is a template, as in the description of a map. An image that is not an SVG document is not drawn. An image of `images` is used before `resolveImage`, which is asked only for a name that `images` does not have. |
| `label` | The name of the SVG for assistive technology. The SVG has `role="img"` and this text as its `aria-label`. The default is `"Map"`. `renderToImage` accepts the option, but an image cannot carry it. |
| `resolveImage` | A function that supplies an icon as SVG when the sprite does not contain it |
| `layerFilter` | A function that returns `false` for a layer to leave out |
| `inlineImages` | When `true`, raster tiles and the sprite go into the SVG as data. Required when the SVG is shown with an `<img>` element. |
| `highDensity` | When `true`, the render uses the high-density (@2x) sprite |
| `overrides` | Server changes for style layers, by the id of the layer: `{building: {hidden: true}}`. For a style that you do not write yourself. `false` renders the style with no server change. Without the option, the server changes in the style apply. See below. |
| `sources`, `layers`, `terrain` | Sources and layers to add to the style, and terrain in place of that of the style, as the fields of the same names in `MapDescription`. A style from a URL is fetched first. |
| `data` | GeoJSON for GeoJSON sources, by the id of the source, as `data` in `MapDescription`. A key with no source of that id makes a GeoJSON source with the default options. A key that is the id of a source of another type makes `renderToSVG` reject with an error. |
| `decodeImage` | A function that decodes elevation tiles. Required only for formats other than PNG and lossless WebP. |
| `fetch` | A replacement for `fetch`, for example to add a cache |
| `timeout` | The time in milliseconds that all requests of one render can take together. The default is 30000. `0` sets no limit. See [Limits for requests](#limits-for-requests). |
| `requestTimeout` | The time in milliseconds that one request can take, with its redirects and its body. The default is 10000. `0` sets no limit. |
| `maxBytes` | The largest body of one response in bytes, after decompression. There is no limit by default. |
| `allowHosts` | The list of host names that the render can request. All hosts are allowed by default. |
| `tileZoomOffset` | Builds the render from vector tiles this many zoom levels lower (a positive value) or higher (a negative value). The default is 0. A whole number. See [Simplify the server render](#simplify-the-server-render). |

`renderToImage` also accepts `rasteriser`, `format`, `quality` and `pixelRatio`.

## Limits for requests

The server renderer requests the URL of the style and each URL that the style names: TileJSON files, tiles, the
sprite and PMTiles archives. These requests come from your server. Set limits when a part of the style or of the
view comes from a visitor, or when the style comes from another party.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
  timeout: 5000,
  requestTimeout: 2000,
  maxBytes: 4 * 1024 * 1024,
  allowHosts: ['styles.map-jr.org', 'tiles.openfreemap.org'],
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
browser as it does without a server render. The Vue component (`ssr` prop of `<MapJr>`) does this itself, and it
writes one message to the console of the server.

```js
import {renderFirstView} from '@map-jr/map-jr-gl/server';

const options = {style: 'https://styles.map-jr.org/1/elevation-zero.json', center: [-74.0065, 40.7085], zoom: 14.3, width: 800, height: 500};
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
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center, zoom, width: 800, height: 500,
  overrides: {building: {hidden: true}, poi_z18: {hidden: true}},
});
```

A value in `overrides` comes before the value in the style.

With `overrides: false`, the renderer ignores every `map-jr:ssr` in the style, `simplify` and `minSize` included. The
defaults of `simplify` (0.6 pixels) and `minSize` (0.8 pixels) still apply.

| Key | Effect on the server render |
|---|---|
| `hidden` | The layer does not show |
| `filter` | An additional filter that features must also pass. It can read `["zoom"]` (see below) |
| `minzoom`, `maxzoom` | A different zoom range |
| `paint`, `layout` | Different property values |
| `simplify` | Lines and polygons are made simpler by this number of pixels |
| `minSize` | Shapes smaller than this number of pixels do not show. On a line layer, keep it to a few pixels (see below) |

In `filter`, `["zoom"]` is the whole zoom of the render, as in a layer filter of MapLibre GL JS. It is the zoom of
the tile, or, for a tile that is over-zoomed (past the `maxzoom` of the source, or with a positive `tileZoomOffset`),
the whole zoom that the tile is drawn at. A render at zoom 13.5 uses tiles of zoom 13, so `[">=", ["zoom"], 13.5]` is false there and the layer shows nothing. Test for a
whole zoom instead. This override keeps the secondary roads from zoom 13 on:

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.99, 40.73], zoom: 13.5, width: 800, height: 500,
  overrides: {road_secondary_tertiary: {filter: ['step', ['zoom'], false, 13, true]}},
});
```

`minSize` tests each piece of a line on its own. The tiles cut a road into many short pieces (from crossing to
crossing, and at the edges of the tiles), so a large value leaves gaps: with `minSize: 16` at zoom 12, the streets of
Manhattan show as broken dashes. A value of a few pixels is safe for lines.

The option `tileZoomOffset` builds the render from vector tiles of a lower zoom, which the server draws at the
size of the render. With `tileZoomOffset: 2`, a render at zoom 12 fetches tiles of zoom 10. The server fetches
fewer tiles, and the tiles have fewer features that the tile server has already made simpler. Roads are whole lines,
the shapes are coarser, and fewer place names show. Use it for a first view that the map draws over, not for an image
that must look like the live map. The default is 0. A value of 1 can make the SVG larger, because the tiles of one
zoom lower can have more features for some layers; the gain starts at 2. A source does not go below its `minzoom`,
and raster and GeoJSON sources keep the zoom of the render. The option changes only the tiles that the server
fetches to draw: the `tiles` of the result, which you give the page to prefetch, stay the tiles of the zoom of the
render, because those are the tiles that the live map requests. The style is evaluated at the whole zoom of the
render, not at the zoom of the tiles: with `tileZoomOffset: 2` at zoom 15, a filter `[">=", ["zoom"], 15]` passes,
and the widths are those of zoom 15.

A negative value does the opposite, for a detailed image: with `tileZoomOffset: -2`, a render at zoom 10 fetches
tiles of zoom 12 and draws them at the size of zoom 10. Each step lower fetches about four times as many tiles, so
the render takes longer and the SVG is larger. The limits for requests (`timeout`, `requestTimeout`, `maxBytes`,
`allowHosts`) apply to these tiles as to any other. The zoom of the tiles does not go above the `maxzoom` of the
source. The style is evaluated at the zoom of the render, as with a positive value: the layers, the filters, the widths
and the other values that depend on the zoom are those of the live map at that zoom, and only the shapes are finer.

A value that is not a whole number makes the render reject with an error.

```js
const {svg} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [2.35, 48.86], zoom: 10, width: 800, height: 500,
  tileZoomOffset: 2,
});
```

## The first view for a framework

`renderFirstView` takes the options of `renderToSVG` and returns HTML for the element of the map: the SVG, and the
credits of the sources that a visible layer uses over it. The option `attribution` gives other credits; `false` shows none. The option `colorScheme` gives the colours of
the credits: `'light'` (the default) or `'dark'`. The server cannot read the scheme of the browser, so `'auto'`
writes both colours with the CSS function `light-dark()`, and a browser without that function shows the light
colours. The Vue component passes its prop `color-scheme`, with `'light'` when the prop is not set. The Vue component
uses this function for its `ssr` prop. For a pair `{light, dark}` in `style`, the option `colorScheme` also chooses the
style: `'dark'` uses `dark`, and each other value uses `light`. With React, call it on the server and give the result to the component. See
[Vue and Nuxt](vue.md) and [React](react.md).

With the option `controls` (the `controls` of the description), the HTML also has the attribution and the built-in
controls as static markup with the style sheet of the controls, in the places and the look that the map gives them, so
that the map takes over with no visible change. The Vue component and `renderElement` pass the `controls`, `locale`,
`nonce`, `minZoom`, `maxZoom`, `projection` and `attribution` of the description themselves. See
[Controls in the first view](guide/server-rendering.md#controls-in-the-first-view).

`renderElement(description, options)` returns the markup of the element `<map-jr>` of `@map-jr/map-jr-gl/element`:
the attributes from the description (`MapDescription`) and the result of `renderFirstView` as the children of the
element. See [Server rendering](element.md#server-rendering) in the document of the web component.

## Credits

The result of `renderToSVG` has `attribution`: the credits of the sources that a visible layer uses at the zoom of the view, as a list of HTML strings.
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
