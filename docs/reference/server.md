# The server renderer

The entry `@map-jr/map-jr-gl/server` draws one view of a map as an SVG document or as an image, without WebGL. It
runs in Node.js, in Cloudflare Workers, in a browser and in each other JavaScript runtime that has `fetch`. See
[Server rendering](../guide/server-rendering.md) for how to show the result in a page.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg, tiles, attribution} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
});
```

## `renderToSVG`

```ts
renderToSVG(options: RenderOptions): Promise<RenderResult>
```

Draws the view that `options` describes. The renderer loads the style, its TileJSON files, the tiles of the view
and the sprite.

| Name | Type | Default | Description |
|---|---|---|---|
| `options` **required** | [`RenderOptions`](#renderoptions) | | The style, the view, the size and the other options. |

**Returns** a promise of [`RenderResult`](#renderresult).

**Errors.** The promise rejects in these cases:

- The style, a TileJSON file, a tile or the sprite cannot be loaded, or its HTTP status is not successful. A tile
  with the status 404 or 204 is an empty tile, and the render continues.
- A [limit for requests](#limits-for-requests) is reached, or the value of a limit is not valid.
- A key of `data` is the id of a source that is not a GeoJSON source.
- `tileZoomOffset` is not a whole number.

## `RenderOptions`

<!-- ref:RenderOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`style`](#style) **required** | `unknown` | | The style: a style object, the URL of a style, or `{light, dark}` with one style or URL for each scheme, as `style` of `MapDescription`. |
| `colorScheme` | `'auto' \| 'light' \| 'dark'` | | The color scheme that selects the style of `{light, dark}` in `style`, and the colors of the credits of `renderFirstView`. |
| `globalState` | `Record<string, unknown> \| null` | | Values for the `global-state` expressions of the style, by name, as `globalState` of `MapDescription`. |
| `center` **required** | `LngLatLike` | | The center of the view, `[lng, lat]`. |
| `zoom` **required** | `number` | | The zoom level of the view. |
| `bearing` | `number` | `0` | The bearing of the view in degrees. |
| [`bounds`](#bounds-and-padding) | `LngLatBoundsInput` | | A box `[west, south, east, north]` to fit into the view. |
| [`padding`](#bounds-and-padding) | `PaddingInput` | `0` | Space in CSS pixels around `bounds` for the fit: one number, or `{top, right, bottom, left}`. |
| `width` **required** | `number` | | The width of the render in CSS pixels. |
| `height` **required** | `number` | | The height of the render in CSS pixels. |
| [`images`](#images) | `Record<string, string \| {image: string; width?: number; height?: number}>` | | Images for the style layers, by name: an SVG document as a string, or `{image, width, height}` with the size in CSS pixels. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family of labels. |
| `label` | `string` | `'Map'` | The `aria-label` of the SVG, which has `role="img"`. |
| `layerFilter` | `(layerId: string) => boolean` | | A function that returns `false` for the ids of style layers to leave out of the render, for example dense building footprints. |
| `inlineImages` | `boolean` | `false` | Whether raster tiles and the icon sheet are embedded as data URIs instead of linked. |
| `highDensity` | `boolean` | false in `renderToSVG`; in `renderToImage`, true when `pixelRatio` is above 1 | Whether the render uses the high-density (@2x) icon sheet and requests raster tiles at @2x. |
| `resolveImage` | `(name: string) => {svg: string; width: number; height: number} \| undefined` | | A function that returns an SVG icon for an image name that the sprite does not have, or `undefined` for a name that it does not handle. |
| [`overrides`](#overrides) | `false \| Record<string, `[`SSROverrides`](#overrides)`>` | | Changes for the server render, for each id of a style layer: the same values as `map-jr:ssr` in the metadata of a layer, for example `{building: {hidden: true}, 'road-minor': {minzoom: 15}}`. |
| `sources` | `Record<string, object>` | | Sources to add to the style, by id, as `sources` in the description of a map (`MapDescription`). |
| `layers` | `({id: string; before?: string} & Record<string, unknown>)[]` | | Layers to add to the layers of the style, as `layers` in the description of a map (`MapDescription`). |
| `sprite` | `{id: string; url: string}[]` | | Sprites to add to the sprite of the style, as `sprite` in the description of a map (`MapDescription`): `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`. |
| `terrain` | `object \| null` | | 3D terrain, as `terrain` in the description of a map (`MapDescription`). |
| `data` | `Record<string, unknown>` | | GeoJSON data for GeoJSON sources of the style, by the id of the source, as `data` in the description of a map. |
| [`fetch`](#fetch) | `typeof fetch` | `globalThis.fetch` | The function that the render uses for its requests. |
| `timeout` | `number` | `30000` | The time in milliseconds that all requests of one render can take together. |
| `requestTimeout` | `number` | `10000` | The time in milliseconds that one request can take, with its redirects and its body. |
| `maxBytes` | `number` | `0` | The largest body of one response in bytes, after decompression. |
| `allowHosts` | `string[]` | | The host names that the render can request, for example `['tiles.openfreemap.org']`, compared with the host of the URL without the port. |
| `decodeImage` | `ImageDecoder` | | A function that decodes elevation tile images of another format than PNG and lossless WebP, such as lossy WebP. |
| [`tileZoomOffset`](#tilezoomoffset) | `number` | `0` | The number of zoom levels below the zoom of the render at which the server loads vector tiles, as a whole number. |
<!-- ref:RenderOptions:end -->

### `style`

| Form | What the renderer does |
|---|---|
| The URL of a style | Loads the style from that URL. |
| A style object | Draws it. |
| `{light, dark}`, each a URL or a style object | Draws `dark` when `colorScheme` is `'dark'`, and `light` otherwise. |

The server cannot read the color scheme of the browser, so `colorScheme: 'auto'` selects `light`.

### `bounds` and `padding`

With `bounds`, the renderer fits the box into the view and uses neither `center` nor `zoom`. Both are required by
the type, so pass any value for them. `padding` is the space in CSS pixels that the box keeps from each side.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [0, 0],
  zoom: 0,
  bounds: [-74.02, 40.7, -73.97, 40.72],
  padding: 20,
  width: 800,
  height: 500,
});
```

### `images`

Each value is an SVG document as a string, or `{image, width, height}` with the size in CSS pixels. Without a size,
the size is that of the `viewBox` of the SVG, then that of its `width` and `height` attributes, and 24 by 24 pixels
when it has neither. An SVG with slots (`{{color}}`) is a template, as in [`images`](description.md#images) of the
description.

An image of `images` or of `metadata["map-jr:images"]` of the style takes the place of the sprite image of the same
name, as in the map. The server draws it as follows:

- An SVG document is drawn.
- The URL of an image is drawn when a symbol layer names it literally and its size is given or the server can decode
  it (PNG, or lossless WebP, unless `decodeImage` is given). The SVG links to the URL, or embeds it with `inlineImages`.
- Any other image is not drawn, and the sprite image of its name is not drawn either. For a URL that fails, the server
  writes a warning.

### `overrides`

A style sets changes for the server render in the `metadata` of a layer, under the key `map-jr:ssr`. MapLibre GL JS
ignores this key.

```json
{
  "id": "building",
  "type": "fill",
  "source": "openmaptiles",
  "source-layer": "building",
  "metadata": {"map-jr:ssr": {"hidden": true}}
}
```

`overrides` sets the same changes by the id of the layer, for a style that you do not write yourself. A key of
`overrides` overrides the same key of `map-jr:ssr`, and the other keys of `map-jr:ssr` still apply.
`overrides: false` ignores every `map-jr:ssr` of the style.

<!-- ref:SSROverrides:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `hidden` | `boolean` | | Leave the layer out of server output. |
| `filter` | `unknown` | | An extra filter that features must also pass, e.g. to keep only major roads. |
| `minzoom` | `number` | | Replaces the `minzoom` of the layer in server output. |
| `maxzoom` | `number` | | Replaces the `maxzoom` of the layer in server output. |
| `paint` | `Record<string, unknown>` | | Paint properties for server output; each replaces the property of the same name of the layer, and the others stay. |
| `layout` | `Record<string, unknown>` | | Layout properties for server output; each replaces the property of the same name of the layer, and the others stay. |
| `simplify` | `number` | | Drop vertices closer together than this many pixels (default 0.6). |
| `minSize` | `number` | | Drop features smaller than this many pixels (default 0.8). |
<!-- ref:SSROverrides:end -->

In `filter`, `["zoom"]` is the zoom of the render rounded down to a whole number. At zoom 13.5,
`["step", ["zoom"], false, 13, true]` passes and `[">=", ["zoom"], 13.5]` does not.

`minSize` tests each piece of a line on its own, and the tiles cut a road into many short pieces. A value of more
than a few pixels on a line layer leaves gaps in the roads.

### `tileZoomOffset`

A positive value builds the render from vector tiles of that many zoom levels lower: with `2`, a render at zoom 12
draws tiles of zoom 10. The render then loads fewer tiles and has coarser shapes and fewer labels. A value of `1` can
make the SVG larger, because some layers of a lower zoom have more features.

A negative value builds the render from tiles of a higher zoom, for finer shapes. Each step loads about four times as
many tiles.

- The zoom of the tiles stays within the `minzoom` and `maxzoom` of the source.
- Raster and GeoJSON sources keep the zoom of the render.
- The style is evaluated at the zoom of the render, so the filters, the widths and the other values of the zoom are
  those of the live map.
- The `tiles` of the result are the tiles of the zoom of the render, which the live map requests.

### `fetch`

The renderer calls `fetch` for the style, the TileJSON files, the tiles, the sprite and the PMTiles archives. Pass a
function to add a cache or a limit for the number of requests at the same time: the renderer limits neither. The
[limits for requests](#limits-for-requests) also apply to the requests of this function.

With `allowHosts`, the renderer calls `fetch` with `redirect: 'manual'` and follows at most 5 redirects itself. A
function that follows a redirect itself makes the request to the new host before the renderer can check it. The
renderer then rejects the response when its `url` has a host that is not in `allowHosts`.

### Limits for requests

| Name | Type | Default | Description |
|---|---|---|---|
| `timeout` | `number` | `30000` | The render rejects when all requests together take longer, counted from the start of the render. |
| `requestTimeout` | `number` | `10000` | The render rejects when one request takes longer, from its start to the end of its body, with its redirects. |
| `maxBytes` | `number` | `0` (no limit) | The render rejects when the body of one response is larger after decompression, or its `content-length` is larger. |
| `allowHosts` | `string[]` | every host | The render rejects when a request or a redirect goes to a host that is not in the list. |

When a time limit ends, the renderer aborts the request. A time of `0` sets no limit.

Each name of `allowHosts` is compared with the complete host name of the URL, without the port and the scheme.
`example.com` does not allow `tiles.example.com`. `allowHosts` compares names only, and not the IP address of a
name. Without `inlineImages`, the SVG links to raster tiles and to the sprite, which the browser of the visitor
loads, and `allowHosts` does not check these links.

A negative number, or a host name with a scheme, a port, a path, an `@` or an IPv6 address in brackets, makes the render reject with a message that
names the option.

## `RenderResult`

<!-- ref:RenderResult:start -->
| Name | Type | Description |
|---|---|---|
| `svg` | `string` | The SVG document of the render. |
| `tiles` | `string[]` | The URLs of the tiles of the view. |
| `attribution` | `string[]` | The credits of the sources that a visible layer uses at the zoom of the view, as HTML. |
<!-- ref:RenderResult:end -->

The SVG has the attribute `data-map-jr-ssr`, and its style is `position: absolute; inset: 0; width: 100%;
height: 100%`. A map of `@map-jr/map-jr-gl` or of `@map-jr/map-jr-gl/maplibre-compat` removes each element with
`data-map-jr-ssr` from its container when it has loaded the tiles of its first view.

## `renderFirstView`

```ts
renderFirstView(options: FirstViewOptions): Promise<string>
```

Returns the HTML of the first view of a map: the SVG of `renderToSVG`, and the attribution in a box at the bottom
right. With `controls`, it also returns the controls of the map and their style sheet. Put the HTML into the
element of the map, which needs a `position` that is not `static`.

| Name | Type | Default | Description |
|---|---|---|---|
| `options` **required** | [`FirstViewOptions`](#firstviewoptions) | | The options of `renderToSVG`, the attribution to show, and the controls. |

### `FirstViewOptions`

`FirstViewOptions` has the options of [`RenderOptions`](#renderoptions), and these:

| Name | Type | Default | Description |
|---|---|---|---|
| `attribution` | `string \| string[] \| false` | the attribution of the sources that a visible layer uses | The attribution as HTML. `false` shows none, also with `controls`. |
| `colorScheme` | `'auto' \| 'light' \| 'dark'` | `'light'` | The colors of the attribution and the controls, and the [style](#style) of a pair `{light, dark}`. |
| `controls` | `ControlSpec[]` | | The controls of the description, for example `[navigation(), scale()]`. With the option (also `[]`), the HTML has these controls and the attribution as markup. `custom()` controls are left out. |
| `locale` | `Record<string, string>` | | The texts of the controls, as `locale` of the description. It has an effect with `controls`. |
| `nonce` | `string` | | The nonce of a Content Security Policy with `style-src 'nonce-…'` for the style sheet of the controls. It has an effect with `controls`. |
| `minZoom`, `maxZoom` | `number` | `-2`, `22` | The limits of the zoom of the description. At a limit, the zoom button is disabled. They have an effect with `controls`. |
| `projection` | `{type?: string}` | | The projection of the description. With `{type: 'globe'}`, the globe control is on. It has an effect with `controls`. |
| `attributionOptions` | `{compact?: boolean; customAttribution?: string \| string[]}` | | The options of the attribution, as `attribution` of the description. It has an effect with `controls`. |

The HTML keeps only the text and the links to `http` and `https` URLs of the attribution. Without `controls`, and with
`'auto'`, the box of the credits follows the color scheme of the browser with the CSS function `light-dark()`, and the
render uses the `light` style. A browser without `light-dark()` shows the light colors. With `controls`, the style
sheet has a copy of the dark rules inside `@media (prefers-color-scheme: dark)`.

Without `controls`, the HTML has the credits in a plain box and no controls. With `controls`, it has:

- The markup of the attribution and the controls, in the corners and the look of the map, and the style sheet of the
  controls. The markup has no `style` attribute.
- The scale with the length that it has at the center of the view, and the compass with the bearing of the view.
- The attribution folded to a button when `width` is 640 or less, as the map folds it for an element of that size.
  `attributionOptions.compact` sets it.
- The attribute `data-map-jr-ssr` on the SVG, the style sheet and the markup. The map removes them together when it
  takes over. Until then the controls of the map are hidden, and they are in the same places as the markup.

The buttons of the markup do nothing until the map takes over. The
[guide](../guide/server-rendering.md#controls-in-the-first-view) shows an example.

**Returns** a promise of the HTML as a string. The promise rejects in the cases of [`renderToSVG`](#rendertosvg).

## `renderElement`

```ts
renderElement(
  description: MapDescription,
  options?: ElementRenderOptions,
): Promise<string>
```

Returns the markup of the element `<map-jr>` of `@map-jr/map-jr-gl/element`, with the first view inside it.

| Name | Type | Default | Description |
|---|---|---|---|
| `description` **required** | [`MapDescription`](description.md) | | The description of the map. |
| `options` **required** | [`ElementRenderOptions`](#elementrenderoptions) | | The size of the render, the attributes of the element, and the other options of the render. |

The element has an attribute for each field of the description that has one. The page sets each other field, such
as `layers`, `data` or a style object, as a property of the element, with the same value. The render uses `style`,
the view of `view` or `initialView`, `sources`, `layers`, `terrain`, `sprite`, `data`, `images`, `fontFamily`,
`colorScheme`, `globalState`, `controls`, `locale`, `nonce`, `minZoom`, `maxZoom`, `projection` and `attribution` of the description,
so the first view has its controls (see [`renderFirstView`](#renderfirstview)).

**Returns** a promise of the markup as a string. When the render fails, the promise resolves to the element without
the first view, and the console of the server has the error.

**Errors.** The promise rejects when a name of `attributes` is not the name of an attribute, or starts with `on`.

### `ElementRenderOptions`

<!-- ref:ElementRenderOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `800` | The width in CSS pixels that the element has on most screens. |
| `height` | `number` | `500` | The height in CSS pixels that the element has on most screens. |
| `attribution` | `string \| string[]` | | The credits to show, when the server must not take them from the sources of the style. |
| `attributes` | `Record<string, string>` | | More attributes of the element, by name, for example `{id: 'map', class: 'map', style: 'height:400px'}`. |
<!-- ref:ElementRenderOptions:end -->

`ElementRenderOptions` also accepts `overrides`, `layerFilter`, `tileZoomOffset`, `inlineImages`, `highDensity`,
`label`, `resolveImage`, `fetch`, `decodeImage` and the [limits for requests](#limits-for-requests) of
`RenderOptions`. The element always has the style `display:block;position:relative;overflow:hidden`, and the text of
`attributes.style` follows it. Without `label`, the `aria-label` of the first view is `Map.Title` of the `locale` of
the description, and `'Map'` when the locale has none, as in the map in the browser.

## `renderToImage`

```ts
renderToImage(options: ImageOptions): Promise<ImageResult>
```

Draws the view as a JPEG, WebP or PNG image with `rasteriser`. It always embeds raster tiles and the icon sheet,
because the rasterizer cannot load linked images, so `ImageOptions` has no `inlineImages`. A JavaScript caller that passes it gets a warning once. The default of
`highDensity` is `true` when `pixelRatio` is more than 1, and a value that you pass overrides it.

| Name | Type | Default | Description |
|---|---|---|---|
| `options` **required** | [`ImageOptions`](#imageoptions) | | The options of `renderToSVG`, the rasterizer and the format. |

**Returns** a promise of [`ImageResult`](#imageresult). The promise rejects in the cases of
[`renderToSVG`](#rendertosvg), and when the rasterizer throws.

### `ImageOptions`

`ImageOptions` has every option of [`RenderOptions`](#renderoptions), and these:

<!-- ref:ImageOptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `rasteriser` **required** | `Rasteriser` | | The renderer that converts the SVG to an image. |
| `format` | `'jpeg' \| 'webp' \| 'png'` | `'jpeg'` | The format of the image. |
| `quality` | `number` | `75` | The quality of a `'jpeg'` or `'webp'` image, as the rasterizer reads it. |
| `pixelRatio` | `number` | `1` | The number of image pixels for one CSS pixel. |
<!-- ref:ImageOptions:end -->

The image has no accessible name, so `label` has no effect.

### `ImageResult`

<!-- ref:ImageResult:start -->
| Name | Type | Description |
|---|---|---|
| `image` | `Uint8Array` | The bytes of the image, in the format of `format`. |
| `contentType` | `string` | The media type of the image, for example `image/jpeg`, for the `Content-Type` header. |
| `tiles` | `string[]` | The URLs of the tiles that the render used, as in `RenderResult`. |
<!-- ref:ImageResult:end -->

## `decodePNG` and `decodeWebPLossless`

```ts
decodePNG(
  bytes: Uint8Array,
): Promise<{width: number; height: number; data: Uint8Array}>
decodeWebPLossless(bytes: Uint8Array): {
  width: number;
  height: number;
  data: Uint8Array;
}
```

```ts
// Pixels is {width, height, data}
type ImageDecoder = (bytes: Uint8Array) => Pixels | Promise<Pixels>;
```

The decoders that `decodeImage` uses by default. `data` has the RGBA bytes of the image, and `bytes` is the file of
an elevation tile. Each returns the pixels of an image as RGBA bytes. Call one of them
from your own `decodeImage` to keep these formats and add another one.

## The `ssr` prop of `<MapJr>`

The Vue component of `@map-jr/map-jr-gl/vue` renders the first view on the server when it has the prop `ssr`. The
value `true` renders with the defaults below. An object sets these options. When the render fails, the component renders the element without
the first view, writes the error to the console of the server, and emits it as `error` when it has a listener for `error`.

<!-- ref:MapJrSSROptions:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `800` | The width in CSS pixels that the map has on most screens. |
| `height` | `number` | `500` | The height in CSS pixels that the map has on most screens. |
| `overrides` | `false \| Record<string, `[`SSROverrides`](#overrides)`>` | | Changes for the server render, for each id of a style layer, as `overrides` of `renderToSVG`. |
| `attribution` | `string \| string[]` | the attribution of the sources | The attribution to show, as HTML. |
| `timeout` | `number` | `30000` | The time in milliseconds that all requests of the render can take together, as `timeout` of `renderToSVG`. |
| `requestTimeout` | `number` | `10000` | The time in milliseconds that one request can take, as `requestTimeout` of `renderToSVG`. |
| `maxBytes` | `number` | `0` | The largest body of one response in bytes, after decompression, as `maxBytes` of `renderToSVG`. |
| `allowHosts` | `string[]` | | The host names that the render can request, as `allowHosts` of `renderToSVG`. |
| `tileZoomOffset` | `number` | `0` | The number of zoom levels below the zoom of the render at which the server loads vector tiles, as `tileZoomOffset` of `renderToSVG`. |
| `label` | `string` | the text `Map.Title` of the prop `locale`, as the canvas of the map has it, else `'Map'` | The `aria-label` of the SVG, as `label` of `renderToSVG`. |
<!-- ref:MapJrSSROptions:end -->

The prop `:attribution="false"` overrides `attribution` and shows none.

The render uses the props `map-style`, `initial-view`, `view`, `sources`, `layers`, `terrain`, `sprite`, `data`,
`images` and `color-scheme`. It does not use `font-family`.

The React component of `@map-jr/map-jr-gl/react` has the prop `firstView`: the HTML of `renderFirstView`. The
component reads it in its first render only.
