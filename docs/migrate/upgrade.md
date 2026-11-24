# Upgrade to a new version

This page lists the changes that an application makes when it moves to a version whose second number is higher, such
as 0.10.x to 0.11.0. A version with the same second number needs no change. [CHANGELOG.md](../../CHANGELOG.md) has
every change of each version.

## From 0.10 to 0.11

Do the steps for the entries and the functions that your application uses.

1. **`renderToImage` of `@map-jr/map-jr-gl/server`: remove `inlineImages`.** The image always embeds the raster
   tiles and the icon sheet. TypeScript code that passes the option does not compile, and JavaScript code that passes
   it writes a warning. `renderToSVG`, `renderFirstView` and `renderElement` keep `inlineImages`.

   ```js
   import {renderToImage} from '@map-jr/map-jr-gl/server';
   import {Renderer} from '@takumi-rs/core';

   const {image} = await renderToImage({
     style: 'https://styles.map-jr.org/1/elevation-zero.json',
     center: [-74.0065, 40.7085],
     zoom: 14.3,
     width: 800,
     height: 500,
     rasteriser: new Renderer(),
     // inlineImages: true, <- remove this line
   });
   ```

2. **Option types of `@map-jr/map-jr-gl/server`: extend the base types.** `RenderOptions`, `FirstViewOptions` and
   `ImageOptions` require a view, either `center` and `zoom` or `bounds`, and an `interface` cannot extend them. Extend
   `RenderOptionsBase`, `FirstViewOptionsBase` or `ImageOptionsBase` instead, or write an intersection type.

   Before:

   ```ts
   import type {RenderOptions} from '@map-jr/map-jr-gl/server';

   interface PreviewOptions extends RenderOptions {
     cacheKey: string;
   }
   ```

   After:

   ```ts
   import type {RenderOptionsBase} from '@map-jr/map-jr-gl/server';

   interface PreviewOptions extends RenderOptionsBase {
     cacheKey: string;
   }
   ```

   Code that reads `center` or `zoom` from a value of `RenderOptions` checks first that the value has them, because
   options with `bounds` can leave them out.

3. **`renderToSVG`, `renderFirstView` and `renderToImage`: pass a view and a numeric size.** The promise rejects for
   options without `center` and `zoom` and without `bounds`, and for a `width` or `height` that is not a number greater
   than 0. Pass the size as a number: `width: 800`, not `width: '800'`. A size that comes from a query string needs
   `Number()`.

4. **`terrain()` of `@map-jr/map-jr-gl/controls`: pass `source`.** The options are required and name the
   `raster-dem` source of the style. TypeScript code that calls `terrain()` without `source` does not compile.

   ```js
   import {createMap} from '@map-jr/map-jr-gl';
   import {navigation, terrain} from '@map-jr/map-jr-gl/controls';

   createMap('map', {
     style: 'https://styles.map-jr.org/1/elevation.json',
     initialView: {center: [7.6586, 45.9763], zoom: 12.4, pitch: 60},
     // Before: terrain()
     controls: [navigation(), terrain({source: 'terrarium'})],
   });
   ```

5. **`terrain()` with `@map-jr/map-jr-gl`, Vue, React or Svelte: keep the value of a click.** A click sets `terrain`
   of the description, and the next description that the application passes overrides it. An application that passes
   its description again, as a component does on each change of a prop, keeps the value of the option
   `onTerrainChange` and passes it as `terrain`. See [`terrain()`](../reference/controls.md#terrain) and the example
   for [Vue](../reference/vue.md#terrain).

6. **`transformRequest` in TypeScript, both entries: widen the second parameter.** Its type is `ResourceType`. Type
   the parameter as `ResourceType` or as `string`. A parameter that accepts only some of the kinds does not compile.

   ```ts
   import type {ResourceType} from '@map-jr/map-jr-gl/maplibre-compat';

   export const transformRequest = (url: string, kind?: ResourceType) =>
     kind === 'Tile' ? {url, credentials: 'include' as const} : undefined;
   ```

7. **`transformRequest` and `addProtocol` of `@map-jr/map-jr-gl/maplibre-compat`: handle the requests of
   `loadImage`.** These requests now reach both functions, with the resource type `Image`, as in MapLibre GL JS. A
   `transformRequest` that changes every request also changes them: return `{url}` for the type `Image` when the change
   must not apply to images.

8. **`addProtocol`, both entries: handle the new values of `request.type`.** A protocol receives the type `'image'`
   for the images of `loadImage`, of `addImage` with a URL, of an `image` source and of the sprite, and the type
   `'arrayBuffer'` for glyphs and font files. A protocol that branches on `request.type` handles these values. It can
   answer an `'image'` request with an `ImageBitmap` or with the bytes of the file. See
   [`addProtocol`](../reference/exports.md#addprotocol) for each request type.

9. **The first view from the server: select the SVG as a descendant.** The SVG of `renderFirstView`, `renderElement`
   and the Vue component is inside a box with the attribute `data-map-jr-ssr`. CSS or code that selects it as a
   direct child of the element (`#map > svg`) uses a descendant selector (`#map svg`) instead.

10. **Code that matches the text of a message.** Messages use US spelling, and the HTTP errors of the server renderer
    and of marker images and the error of `queryElevation` start with `[map-jr-gl]`. The labels of the
    `colorScheme()` control use US spelling. Code that compares these texts compares the new ones.

## See also

- [From MapLibre GL JS](from-maplibre.md) to move an application from MapLibre GL JS to this library.
- [The server renderer](../reference/server.md) for the options of `renderToSVG`, `renderFirstView` and
  `renderToImage`.
