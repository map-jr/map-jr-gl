# Server rendering

The server renderer of `@map-jr/map-jr-gl/server` draws one view of a map as an SVG document, without WebGL and
without a browser. Use it to show a map in a page before the page script runs, to create an image for an email or a
link preview, and to export a map as SVG. It runs in Node.js, in Cloudflare Workers, in a browser and in each other
JavaScript runtime that has `fetch`. Every option and result is in the [reference](../reference/server.md).

## Render a map to SVG

This script for Node.js writes the view of Lower Manhattan to a file.

```js
import {writeFile} from 'node:fs/promises';
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg, attribution} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
});
await writeFile('manhattan.svg', svg);
console.log(attribution);
```

[`renderToSVG`](../reference/server.md#rendertosvg) loads the style, its tiles and its sprite, and returns the SVG,
the tile URLs of the view and the attribution of the sources that a visible layer uses at the zoom of the view. The attribution is a list of HTML strings, and a page
or an image that shows the map must show it too.

The SVG links to raster tiles and to the sprite. Set [`inlineImages: true`](../reference/server.md#renderoptions) to
embed them as data instead, for an SVG that is opened as a file or shown with an `<img>` element.

## Show the first view before the script runs

[`renderFirstView`](../reference/server.md#renderfirstview) returns HTML for the element of the map: the SVG, and the
attribution over it. The page shows this HTML at once. The map then starts in the same element, and it removes the
HTML when it has loaded the tiles of its first view. With the option `controls`, the HTML also has the controls of
the map, so that they are on the page from the first paint (see [Controls in the first view](#controls-in-the-first-view)).

**Map Jr**

```js [Map Jr]
import {renderFirstView} from '@map-jr/map-jr-gl/server';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const view = {center: [-74.0065, 40.7085], zoom: 13.6};
const lib = 'https://unpkg.com/@map-jr/map-jr-gl@0.11.0/dist/map-jr-gl.js';

// Your server sends the string that page() returns as the HTML of the page.
export async function page() {
  // A failed render must not fail the page: the map then draws in the
  // browser.
  const firstView = await renderFirstView({
    style,
    ...view,
    width: 800,
    height: 500,
  }).catch(error => {
    console.error(error.message);
    return '';
  });
  return `<!doctype html>
<div id="map"
  style="position: relative; width: 800px; height: 500px">${firstView}</div>
<script type="module">
  import {createMap} from '${lib}';
  createMap('map', ${JSON.stringify({style, initialView: view})});
</script>`;
}
```

**Vue**

```vue [Vue]
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
</script>

<template>
  <div style="height: 500px">
    <MapJr
      map-style="https://styles.map-jr.org/1/elevation-zero.json"
      :initial-view="{center: [-74.0065, 40.7085], zoom: 13.6}"
      :ssr="{width: 800, height: 500}"
    />
  </div>
</template>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<!-- page.html. The server writes the element in place of the last line. -->
<script
  type="module"
  src="https://unpkg.com/@map-jr/map-jr-gl@0.11.0/dist/element.js"
></script>
MAP
```

The Vue component renders the first view on the server when it has the [`ssr` prop](../reference/server.md#the-ssr-prop-of-mapjr).
Without the `ssr` prop, the server renders an empty element and the map draws in the browser.

For `<map-jr>`, [`renderElement`](../reference/server.md#renderelement) returns the element with its attributes and
the first view inside it. This function returns `page.html` with the element in place of its last line, `MAP`. Your server sends
its result as the HTML of the page:

```js
import {readFile} from 'node:fs/promises';
import {renderElement} from '@map-jr/map-jr-gl/server';

export async function page() {
  const element = await renderElement(
    {
      style: 'https://styles.map-jr.org/1/elevation-zero.json',
      initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
    },
    // width and height set the size of the render. The CSS height in
    // attributes sets the size of the element.
    {
      width: 800,
      height: 500,
      attributes: {id: 'map', style: 'height: 500px'},
    },
  );
  return (await readFile('page.html', 'utf8')).replace('MAP', element);
}
```

With React, call `renderFirstView` on the server and pass the HTML to the `firstView` prop of `<MapJr>`. The
built files of `@map-jr/map-jr-gl/react` start with `'use client'`, so a server component of Next.js imports `MapJr`
from the entry and needs no client file of its own:

```jsx
// app/page.jsx, a server component
import {renderFirstView} from '@map-jr/map-jr-gl/server';
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const view = {center: [-74.0065, 40.7085], zoom: 13.6};

export default async function Page() {
  const firstView = await renderFirstView({
    style,
    ...view,
    width: 800,
    height: 500,
  }).catch(() => '');
  return (
    <div style={{height: 500}}>
      <MapJr mapStyle={style} initialView={view} firstView={firstView} />
    </div>
  );
}
```

The adapter for Svelte has no server rendering. Put the HTML of `renderFirstView` into the element of the map
(`{@html firstView}`), as in the main API.

Two things go wrong most often:

- The server and the map have different styles or views. The page then shows one map and replaces it with
  another. Pass the server the same `style`, `sources`, `layers`, `data`, `images`, `colorScheme` and `globalState` as the map. Pass
  `center`, `zoom` and `bearing` of `initialView` as options of the same names, and its `bounds` and `fitPadding` as `bounds` and `padding`. The
  Vue component and `renderElement` pass all of them themselves.
- The element of the map has no `position`. The SVG is positioned at `inset: 0`, so the element needs
  `position: relative` or another position that is not `static`. The Vue and React components and `<map-jr>` set it.

The SVG is scaled to the size of the element. Set `width` and `height` to the size that the element has on most
screens, so that the labels have the size of those of the live map.

## Controls in the first view

Pass the `controls` of the description to `renderFirstView`, and the HTML has the attribution and the built-in
controls (`navigation()`, `scale()`, `fullscreen()`, `geolocate()`, `globe()`, `terrain()` and `colorScheme()` of
`@map-jr/map-jr-gl/controls`) as static markup, with the style sheet of the controls. Each control has the classes,
the corner and the look that it has in the map, so the map takes over with no visible change: the map removes the
markup and its style sheet together with the SVG, and shows its own controls in the same places.

```js
import {renderFirstView} from '@map-jr/map-jr-gl/server';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

const firstView = await renderFirstView({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  width: 800,
  height: 500,
  controls: [navigation(), scale()],
});
```

The Vue component and `renderElement` do this with the `controls`, `locale`, `nonce`, `minZoom`, `maxZoom`, `projection`
and `attribution` of the description, and no option is needed. With React or Svelte, pass the same fields to
`renderFirstView` (`attribution: false` of the description is `attribution: false` there, and its other
`attribution` options are `attributionOptions`).

- The scale has the length that it has at the center of the first view. The compass shows the bearing of the view.
- A button of the first view does nothing until the map takes over. When the map never takes over (the style does not
  load, or the script does not run), the markup stays, its buttons stay without effect, and the buttons of the map stay
  hidden. The map fires `error` for a style that does not load, and the page can listen for it and remove the markup. A control from `custom()` is left out, because
  the server cannot draw an element that the page makes.
- The server cannot know the width of the element, so it folds the attribution to a button when `width` is 640 or
  less, as the map does for an element of that size. When the element has another width, the map replaces the
  attribution at the take-over.
- With `colorScheme: 'auto'`, the style sheet follows the color scheme of the browser, and the control `colorScheme()`
  has both icons, of which the browser shows one. The style of the first view is the `light` style of a pair.
- With a [Content Security Policy](loading.md#content-security-policy), pass the `nonce` of the description. The
  markup of the controls has no `style` attribute, and its style sheet has the nonce. The `style` attribute of the SVG
  is not covered by this, so a strict policy still blocks it.
- Each map carries its own copy of the style sheet of the controls, so the output for a page with several maps grows
  with each map.

The entry `@map-jr/map-jr-gl/maplibre-compat` has no description, so it has no server render of its own. Its controls
also have another look than those of the main API, which the markup has, so the markup of `controls` does not match
the controls of a map of that entry.

## Load the tiles while the script loads

The `tiles` of the result of `renderToSVG` are the vector tile URLs that the live map requests for the same view.
Write a preload link for each one into the head of the page, and the browser loads the tiles at the same time as
the script:

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg, tiles} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  width: 800,
  height: 500,
});
const head = tiles
  .map(url => `<link rel="preload" as="fetch" crossorigin href="${url}">`)
  .join('\n');
```

`renderFirstView` does not return the tile URLs. To have both, call `renderToSVG` and write the attribution of its
result into the page yourself.

## Handle a render that fails

`renderToSVG`, `renderFirstView` and `renderToImage` reject when the style, a TileJSON file, a tile or the sprite
cannot be loaded. A tile with the status 404 or 204 is an empty tile, and the render continues. The renderer never
returns a part of a map. Catch the error and send the page without the first view: the map then draws in the browser
as it does without a server.

The Vue component and `renderElement` do this themselves. They write the error to the console of the server, and
the Vue component also emits it as `error` when it has a listener for `error`.

A host that does not answer delays the page by 10 seconds for one request and by 30 seconds at most for a render.
For a page that a visitor waits for, set a smaller [`timeout`](../reference/server.md#limits-for-requests). In the
Vue component, set it in the `ssr` prop: `:ssr="{timeout: 3000}"`.

```js
import {renderFirstView} from '@map-jr/map-jr-gl/server';

const firstView = await renderFirstView({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
  width: 800,
  height: 500,
  timeout: 3000,
}).catch(error => {
  console.warn(error.message);
  return '';
});
```

The renderer keeps no result and no tile. For the same options and the same tiles it returns the same SVG, so keep
the result in a cache by the style, the view and the size.

## Limit the requests of the server

The requests of a render come from your server. When the style or the view comes from a visitor or from another
party, limit the time, the size of a response and the hosts:

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

The render rejects when a limit is reached, with a message that names the option. `allowHosts` must name every host
of the style: the host of the style, of its TileJSON files, of its tiles and of its sprite. See
[Limits for requests](../reference/server.md#limits-for-requests) for what each limit measures.

## Make the server render smaller

The server render does not need all the detail of the live map, because the map draws over it a moment later. A
style sets changes for the server render in the metadata of a layer, under the key `map-jr:ssr`. MapLibre GL JS
ignores this key. The styles of `https://styles.map-jr.org/1/` already hide the road labels, the points of interest,
the buildings and the casings of the roads in the server render.

For a style that you do not write yourself, pass the same changes as `overrides`, by the id of the layer. The ids
and the `map-jr:ssr` entries are in the `layers` of the style JSON, which the URL of the style returns. A value of
`overrides` overrides the value of `map-jr:ssr` in the style. This render shows the road labels that the style hides:

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
  overrides: {road_label_1: {hidden: false}, road_label_2: {hidden: false}},
});
```

`overrides: false` renders the style with no server change, with every layer and label of the live map. See
[`overrides`](../reference/server.md#overrides) for each key.

`tileZoomOffset: 2` builds the render from vector tiles of two zoom levels lower. The server then loads fewer tiles,
and the render has coarser shapes and fewer labels. Use it for a first view, not for an image that must look like the
live map. See [`tileZoomOffset`](../reference/server.md#tilezoomoffset).

## Create an image

[`renderToImage`](../reference/server.md#rendertoimage) converts the render to a JPEG, WebP or PNG image, for an email
or a link preview. It needs a `Renderer` of Takumi, a library that converts HTML and SVG to images, as
`rasteriser`. The library works with Takumi 2.20. On Node.js, install `@takumi-rs/core`:

```sh
npm install @takumi-rs/core
```

```js
import {writeFile} from 'node:fs/promises';
import {renderToImage} from '@map-jr/map-jr-gl/server';
import {Renderer} from '@takumi-rs/core';

const {image} = await renderToImage({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-74.0065, 40.7085],
  zoom: 14.3,
  width: 800,
  height: 500,
  rasteriser: new Renderer(),
  format: 'webp',
  pixelRatio: 2,
});
await writeFile('manhattan.webp', image);
```

On Cloudflare Workers, use the WebAssembly build `@takumi-rs/wasm`, and initialize it once for each instance of the
Worker. Wrangler imports a `.wasm` file as a `WebAssembly.Module` with its default rules:

```js
import {renderToImage} from '@map-jr/map-jr-gl/server';
import init, {Renderer} from '@takumi-rs/wasm';
import wasm from '@takumi-rs/wasm/takumi_wasm_bg.wasm';

let rasteriser;

export default {
  async fetch() {
    if (!rasteriser) {
      await init({module_or_path: wasm});
      rasteriser = new Renderer();
    }
    const {image, contentType} = await renderToImage({
      style: 'https://styles.map-jr.org/1/elevation-zero.json',
      center: [-74.0065, 40.7085],
      zoom: 14.3,
      width: 800,
      height: 500,
      rasteriser,
      format: 'jpeg',
    });
    return new Response(image, {headers: {'content-type': contentType}});
  },
};
```

With the WebAssembly build, use `format: 'jpeg'` or `'png'`. That build writes a WebP image only as a lossless image,
which is larger than its JPEG. One render takes a few hundred milliseconds of CPU time, so keep the image in a cache.

An SVG is sharp at each size, but its size grows with the detail of the map. An image has a size that changes little
with the detail, and its sharpness is set by `pixelRatio`.

## Export an SVG in the browser

`renderToSVG` also runs in a page. This module saves the view as an SVG file when the user clicks a button. Without
a bundler, map `@map-jr/map-jr-gl/server` to the file `dist/server.js` of the package with an import map.

```js
import {renderToSVG} from '@map-jr/map-jr-gl/server';

// The page has <button id="export">Save as SVG</button>.
document.querySelector('#export').addEventListener('click', async () => {
  const {svg} = await renderToSVG({
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    center: [-74.0065, 40.7085],
    zoom: 14.3,
    width: 800,
    height: 500,
    inlineImages: true,
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  link.download = 'manhattan.svg';
  link.click();
  // Some browsers cancel the download when the URL is revoked at once.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
```

The style, the tiles and the sprite must allow requests from the page (CORS), as for the live map. To export the view
that a map shows, pass its `center`, `zoom` and `bearing`.

## What the server renderer does not draw

| Not drawn | What the render shows |
|---|---|
| Pitch | The view from straight above. |
| Hillshade, color relief and 3D terrain | The other layers, on flat ground. |
| Image patterns (`fill-pattern`, `background-pattern`) | Nothing for that layer. |
| Images that a page adds with `map.addImage` of `@map-jr/map-jr-gl/maplibre-compat` | Nothing. Pass them as [`images`](../reference/server.md#images), or return them from [`resolveImage`](../reference/server.md#renderoptions). |
| Images of `images` that are not SVG documents | Nothing for that image. |

The SVG uses the fonts of the page that shows it. Set `fontFamily` to the font of the live map. The server estimates
the width of each label, so where labels are close together it can show a different label than the live map shows.
For an image, register the font files with `renderer.registerFont(bytes)` of Takumi before the render. Text in a
script that is not Latin needs this.

## See also

- [The server renderer](../reference/server.md): every option, result and error.
- [The description](../reference/description.md): `sources`, `layers`, `data` and `images`, which the server renderer
  accepts with the same values.
