# Server rendering

The server renderer draws the first picture of a map without a browser. Use it for these tasks:

- Show a map immediately, before the page script runs.
- Make a picture for an email, a document, or a link preview.

It works on Node.js, on Cloudflare Workers, and in other JavaScript environments that have `fetch`.

## Make an SVG

```js
import {renderToSVG} from 'tessera-map/server';

const {svg, tiles} = await renderToSVG({
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
});
```

- `svg` is the picture.
- `tiles` is the list of tile addresses that the picture used.

`renderToSVG` has no dependencies.

## Put the picture in a page

1. Put the SVG in the map container:

   ```html
   <div id="map" style="position: relative; width: 800px; height: 500px">
     <!-- the SVG from renderToSVG -->
   </div>
   ```

2. Add a preload link for each tile address. The browser then gets the tiles while it loads the script:

   ```html
   <link rel="preload" as="fetch" crossorigin href="https://example.com/tiles/14/4823/6160.pbf">
   ```

3. Create the map with the same style, centre and zoom. The map removes the SVG when its first picture is ready.

## Make an image

`renderToImage` changes the SVG to a JPEG, WebP or PNG image. You supply the part that does this change. The part
is the Takumi renderer. There is one version for Node.js and one version for WebAssembly.

On Node.js:

```js
import {renderToImage} from 'tessera-map/server';
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
import {renderToImage} from 'tessera-map/server';
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
- The WebAssembly file is approximately 1.9 MB (gzip).
- One picture uses some hundred milliseconds of processor time. Keep the result in a cache.

`test/cloudflare` contains a complete Worker.

## SVG or image

| | SVG | Image |
|---|---|---|
| Size | Becomes large for a city with much detail (some hundred KB) | Almost constant |
| Sharpness | Sharp at each size | Set by `pixelRatio` |
| Dependencies | None | The Takumi renderer |

## Options

| Option | Meaning |
|---|---|
| `style` | A style object or the address of a style. Necessary. |
| `center`, `zoom`, `width`, `height` | The view. Necessary. |
| `bearing` | The rotation of the map in degrees |
| `markers` | A list of marker layer options. See [Markers](markers.md). |
| `resolveImage` | A function that supplies an icon as SVG when the sprite does not contain it |
| `layerFilter` | A function that returns `false` for a layer that must not be in the picture |
| `inlineImages` | When `true`, raster tiles and the icon sheet go into the SVG as data. Necessary when the SVG is shown with an `<img>` element. |
| `highDensity` | When `true`, the picture uses the high-density icon sheet |
| `ssrOverrides` | When `false`, the server changes in the style are ignored. See below. |
| `decodeImage` | A function that decodes elevation tiles. Necessary only for formats other than PNG and lossless WebP. |
| `fetch` | A replacement for `fetch`, for example to add a cache |

`renderToImage` also accepts `rasteriser`, `format`, `quality` and `pixelRatio`.

## Make the server picture simpler

A server picture does not need all the detail of the live map. You can put changes for the server in the style.
MapLibre GL JS ignores them, thus the style stays correct for the two libraries.

```json
{
  "id": "building",
  "type": "fill",
  "source": "omt",
  "source-layer": "building",
  "metadata": {
    "tessera:ssr": {"hidden": true}
  }
}
```

| Key | Effect on the server picture |
|---|---|
| `hidden` | The layer does not show |
| `filter` | An additional filter |
| `minzoom`, `maxzoom` | A different zoom range |
| `paint`, `layout` | Different property values |
| `simplify` | Lines and polygons are made simpler by this number of pixels |
| `minSize` | Shapes smaller than this number of pixels do not show |

## Fonts

The SVG uses the fonts of the page where you show it. Set `fontFamily` to make the text the same as the live map.

For an image, register your fonts with the Takumi renderer. This is necessary for scripts that are not Latin.

## What the server renderer does not draw

- Relief shading and 3D terrain
- Image patterns
- Images that you add with `addImage` in the browser. Use `resolveImage` instead.
