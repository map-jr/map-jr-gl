# Server rendering

The server renderer renders the first view of a map without a browser. Use it for these tasks:

- Show a map immediately, before the page script runs.
- Make an image for an email, a document, or a link preview.

It works on Node.js, on Cloudflare Workers, and in other JavaScript environments that have `fetch`.

## Make an SVG

```js
import {renderToSVG} from 'map-jr-gl/server';

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
import {renderToImage} from 'map-jr-gl/server';
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
import {renderToImage} from 'map-jr-gl/server';
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
- One render uses a few hundred milliseconds of CPU time. Keep the result in a cache.

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
| `resolveImage` | A function that supplies an icon as SVG when the sprite does not contain it |
| `layerFilter` | A function that returns `false` for a layer to leave out |
| `inlineImages` | When `true`, raster tiles and the sprite go into the SVG as data. Required when the SVG is shown with an `<img>` element. |
| `highDensity` | When `true`, the render uses the high-density (@2x) sprite |
| `ssrOverrides` | When `false`, the server changes in the style are ignored. See below. |
| `overrides` | Server changes for style layers, by the id of the layer: `{building: {hidden: true}}`. For a style that you do not write yourself. See below. |
| `decodeImage` | A function that decodes elevation tiles. Required only for formats other than PNG and lossless WebP. |
| `fetch` | A replacement for `fetch`, for example to add a cache |

`renderToImage` also accepts `rasteriser`, `format`, `quality` and `pixelRatio`.

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
