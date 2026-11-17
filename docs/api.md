# The main API

The entry `@map-jr/map-jr-gl` makes a map from one description. To change the map, you give a new description. The library
finds what is different and changes only that. The state of the map is in a store that your code can watch.

This model fits how the library works: the map draws in a worker, and one description goes to it as one message.
It also fits frameworks, which describe what the page must show and do not call methods one after the other.

For the API of MapLibre GL JS (`new Map`, `map.addLayer`), use the entry `@map-jr/map-jr-gl/maplibre-compat`. See
[MapLibre compatibility](maplibre-compatibility.md).

## Make a map

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

`createMap(container, description)` returns the map. The container is an element or the `id` of an element. The map
fills the container, so give the container a height.

### A browser without WebGL2

The map requires WebGL2. `supported()` returns `false` in a browser that has no WebGL2, so that the application
can show other content. The first call makes a WebGL2 context on a canvas that is not in the page, and later calls
return the same answer.

```js
import {createMap, supported} from '@map-jr/map-jr-gl';

const container = document.getElementById('map');
if (supported()) {
  createMap(container, {
    style: 'https://tiles.openfreemap.org/styles/liberty',
    initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  });
} else {
  container.textContent = 'This browser cannot show the map. Our address is 1 Example Street.';
}
```

A map that is made in such a browser does not load. It reports one error (`onError`) with the
message `[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and
show other content when it returns false.` It also puts an element into the container with the class
`map-jr-unavailable` and the text "This browser cannot show the map.". The element fills the container. To change
its look, write CSS rules for `.map-jr-unavailable`: a rule of the application wins over the rule of the library.
To show other text, set the `textContent` of that element in `onError`, or hide the element with `display: none`.
`destroy()` removes the element. `supported()` does not test whether a worker can draw: where a worker cannot, the
map draws on the main thread (see [Loading](loading.md)).

## Change the map

```js
let description = {style, initialView, data: {pins}, layers: [pinLayer]};
const map = createMap(container, description);

// Later: other points. Give the complete description again.
description = {...description, data: {pins: newPins}};
map.update(description);

// Or change only some fields: the other fields stay as they are.
map.patch({cursor: 'crosshair'});
```

`patch(part)` changes only the fields of `part`. It is `map.update({...map.description, ...part})`: a field of
`part` that is `undefined` is removed (`map.patch({cursor: undefined})`). `map.description` is the description of
the last `createMap`, `update` or `patch`. It is read only. After `createMap` and `update` it is the object that you
passed, so do not change that object in place. A framework adapter gives the complete description from its props, so with an adapter use the props
and not `patch`. The compat entry has neither member.

`update` takes the complete description, not only the changed fields:

- A description with no `style` throws an error, in `update`, `patch` and `createMap`. Write
  `map.patch({cursor: 'crosshair'})` or `map.update({...description, cursor: 'crosshair'})`, not
  `map.update({cursor: 'crosshair'})`.
- A field that the new description leaves out is removed from the map. This holds for `controls`,
  `cursor`, `sources`, `layers`, `terrain` and the limits of the camera. A source keeps the last data that `data` gave it.
- The fields that are read when the map is made (`renderer`, `fontFamily`, `interactive`,
  `antialias`, `attribution`, `hash`, `nonce`) and `initialView` have no effect in `update`. A change of one of them gives a
  warning.

The map writes a warning to the console with `console.warn`, once for each map, for each of these mistakes:

- The container is in the page, is not hidden, and has height 0 one second after the map is made.
- An id in `interactiveLayers`, in `layers` of `queryFeatures`, or the source of `querySource`, is not in the style.
- A layer names a source that the map does not have, for example after its key left `data`.
- A layer of `layers` names a `before` layer or a source that the style does not have.
- A layer gives an image a parameter that is not a slot of the image.
- An option of `queryFeatures` or `querySource` has no effect in that query, or belongs to the other method.

The ids of the description are compared each time that the map is idle, so a layer or a source that the application
adds itself in `load` gives no warning.

The checks run in the development build only. `package.json` names that build under the `development` condition, so
a bundler that sets the condition takes it in development and takes the production build otherwise. Vite does so
(ran with Vite 8: the development server takes the development build, and `vite build` takes the production build).
Node.js resolves the development build with `--conditions=development`. The development server of webpack in Next.js 14.2 and 16 takes the development build (seen in the field test of #187). Nuxt is not checked. The
production build makes no request for the checks and gives none of these warnings.

| How the page gets `@map-jr/map-jr-gl` | Checks |
|---|---|
| A bundler in development that sets the `development` condition | Yes. The map loads a file of about 1.3 KB (gzip) after it has started. |
| A bundler that builds for production | No. |
| The file `dist/map-jr-gl.js` by URL, with no bundler | No. Import `dist/map-jr-gl.dev.js` instead while you develop. |
| The standalone file (`@map-jr/map-jr-gl/standalone`) | Yes. The checks are inside the file. |

When the file of the checks does not load, the map works and gives none of these warnings.

The library compares each field with the field of the last description:

- A field that is the same object as before is not looked at again. This is the fast path: keep the object when
  nothing changed.
- A field that is a new object is compared by its content (the style, the limits, the lists of layers and
  controls). So a description that your code makes again each time does not make the map do work.
- Each value of `data` is compared by identity only, because it can be large. To change the data of a source, give
  a new object. Do not change the old object in place. This holds for the Vue component too: see
  [Vue and Nuxt](vue.md).

## The description

| Field | Meaning |
|---|---|
| `style` | A style object or the URL of a style (the MapLibre style specification). Required. A new object or URL is a new style. A pair `{light, dark}` of two styles uses the style of the resolved `colorScheme`: see [A light and a dark style](#a-light-and-a-dark-style). |
| `sources` | Sources to add to the sources of the style, by id. A source here replaces the source of the style with the same id. See [Your own layers on a style from a URL](#your-own-layers-on-a-style-from-a-url). |
| `layers` | Layers to add to the layers of the style: they do not replace them. A layer with `before` goes below the layer of the style with that id, and a layer without it goes on top. See [Your own layers on a style from a URL](#your-own-layers-on-a-style-from-a-url). |
| `terrain` | 3D terrain in place of the terrain of the style: `{source: 'dem', exaggeration: 1.5}`. `null` or no field means the terrain of the style. |
| `initialView` | The view at the start: `center` (`[lng, lat]`), `zoom`, `bearing`, `pitch`. In place of `center` and `zoom`, give `bounds` (`[[west, south], [east, north]]` or `[west, south, east, north]`) and the map starts with that box fitted into the view, with `padding` in CSS pixels around it (a number or `{top, right, bottom, left}`, default 0) and `maxZoom` as the largest zoom of the fit. See [The camera](#the-camera). This is `bounds` with `fitBoundsOptions.padding` of MapLibre GL JS. When the description also has `view`, the map starts at `view` and `bounds` has no effect. The user then moves the map. |
| `view`, `onViewChange` | A view that your application owns. See below. |
| `data` | GeoJSON data for GeoJSON sources, by the id of the source. A key with no source of that id makes a GeoJSON source with the default options. See below. |
| `images` | Images for the style layers, by name: an SVG document, the URL of an image, or `{image, width, height}`. See [Images for style layers](#images-for-style-layers). |
| `sprite` | Sprites to add to the sprite of the style: `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`, the list form of `sprite` in the style specification. An `icon-image` names an image of such a sprite as `id:name`. See [A sprite of the description](#a-sprite-of-the-description). |
| `controls` | A list of controls. See below. |
| `projection` | The projection in place of the property `projection` of the style, with the same shape: `{type: 'globe'}`, `{type: 'vertical-perspective'}` or `{type: 'mercator'}`. Without the field, or with `null`, the map uses the projection of the style. A change in `update()` switches the projection without loading the style again, and a new style gets the projection of the description too. `globe` draws the map on a sphere and turns into Mercator between zoom 11 and 12, as in MapLibre GL JS; `vertical-perspective` keeps the sphere at every zoom. On the globe the map draws fills, lines, circles, heatmaps, raster and hillshade layers, symbols and the background (on the sphere only; the space around it stays transparent). 3D terrain, `fill-extrusion` layers and the atmosphere of `sky` are not drawn on the globe yet: the map writes one warning, and they show past zoom 12. `maxBounds` has no effect on the globe. A drag on the globe turns it as in MapLibre GL JS: each move turns the sphere from the place under the last position of the pointer to the place under the new one, and the bearing stays. Near the edge of the globe and near a pole, the place under the pointer drifts away from it, as in MapLibre GL JS, and the centre can pass 85° north or south while the area around the pole fits in the view. On the globe, a new centre without a zoom (`moveTo`, a drag, the fling after it) keeps the size of the globe on the screen, and the zoom changes with the latitude instead (from zoom 1.5 at the equator to -0.048 at 70°N), as in MapLibre GL JS. A `zoom` that is given is used as it is, and the arrow keys keep the zoom. A switch from Mercator to the globe shows the globe when the tiles of the view have been built again for it, or after 1 s at most; until then the map shows Mercator. A label whose anchor turns behind the globe is not drawn from that frame on, also between two placements of the labels. The page loads the code of the globe (about 2 KB gzip) only for a map with a globe. |
| `globalState` | Values for the `global-state` expressions of the style, by name: `{season: 'winter'}`. A value here is used in place of the default of the same name in `state` of the style. A change in `update()` sets only the names whose values changed and repaints the layers that read them, without loading the style again. A name that the new description leaves out, or gives `null`, goes back to the default of the style. A new style gets the values of the description. A value is JSON (a string, number, boolean, array or plain object); the development build warns once for a value that is not, such as a function or `NaN`. The default is no values. |
| `interactiveLayers` | The ids of style layers. The features of these layers under the pointer are in `state.hover` and in `onClick`. |
| `hoverState` | `true`: the map gives the top feature of `interactiveLayers` under the pointer the feature state `hover: true`, and removes it when the pointer leaves the feature or the map. A style highlights it with `['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.5]`. A feature needs an id: a feature with no id gets no state, and the development build warns once for the layer (set `promoteId` of the source, or `generateId: true` for a GeoJSON source). A GeoJSON feature whose `id` is a string has no id for the map unless the source has `promoteId`. A layer that does not read `feature-state` costs nothing more. An `icon-image` with `params` that read `feature-state` builds the tiles of the source again at each change, which is slow for a hover. The default is `false`, so an application that sets `hover` itself with `setFeatureState` is not changed. |
| `onClick` | A function that is called for a click, with `point`, `lngLat` and `features`. |
| `onError` | A function that is called with each error of the map (an `Error`): a style or a source that does not load, a style that has no list `layers`, a mistake in a style edit, a failure of the renderer. Use it to send errors to your error tracker. Without it, the map writes each error to the console with `console.error`. |
| `minZoom`, `maxZoom`, `maxPitch`, `maxBounds` | The limits of the camera. `maxBounds` keeps the whole view inside the bounds, as MapLibre GL JS does: the canvas less the padding, with no regard to bearing and pitch. When the bounds are smaller than that view, the zoom rises until they fill it. A west edge east of the east edge (for example `[[150, -50], [-120, 10]]`) gives bounds that cross the antimeridian. |
| `cooperativeGestures` | `true`: the wheel zooms the map only with Ctrl (⌘ on a Mac), one finger scrolls the page and two fingers move the map. A blocked gesture shows a hint over the map. The default is `false`. `update()` can turn it on and off. |
| `colorScheme` | The colours of the controls, the popup, the attribution and the message of a browser without WebGL 2: `'light'` (the default), `'dark'` or `'auto'`. `'auto'` follows the media query `prefers-color-scheme` and changes while the page is open. An application with its own theme switch passes `'light'` or `'dark'`. While the scheme is dark, the container has the class `map-jr-dark`. The dark colours have no specificity, so a rule of the application and the custom properties `--map-control-*`, `--map-attribution-background` and `--map-popup-*` still win. `update()` changes it. The map also sets the global state property `color-scheme` of the style to the resolved scheme, so that a style can follow it: see [Dark mode](#dark-mode). A value that is not one of the three gives the light colours, and the development build warns once. |
| `onColorSchemeChange` | Called with the new value when the control `colorScheme()` changes `colorScheme`. The control has changed the map already with `patch`; an application that keeps the description in its state (Vue, React) writes the value back, or the next `update` with the old value changes the map back. |
| `locale` | The texts of the controls, the popup, the marker and the hint of `cooperativeGestures`, by the keys of MapLibre GL JS: `{'NavigationControl.ZoomIn': 'Zoom avant'}`. A key that is left out keeps the English text, and the library ships no translations. `update()` changes it: the controls are added again with the new texts, and an open popup takes the new texts. It does not change the language of the labels of the map: set a property of `globalState` for that. See [The texts of the controls](#the-texts-of-the-controls). |
| `cursor` | The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. |
| `transformRequest` | A function that changes a request before the map makes it, as `transformRequest` of MapLibre GL JS. It gets the URL and the kind of resource (`Style`, `Source`, `Tile`, `Glyphs`, `SpriteJSON`, `SpriteImage`, `Image` or `Font`) and returns `{url, headers, credentials}`, or `undefined` to leave the request as it is. It applies to the requests of the tile workers too. The map calls the function of the last description, so a function that is made again in each render works. Example: `transformRequest: url => url.startsWith('https://api.os.uk/') ? {url: url + '&key=' + KEY} : undefined`. |
| `padding` | Space in CSS pixels at the sides of the map that the view keeps free, for example under a side panel: one number for all sides, or `{top, right, bottom, left}` (a side that is left out is 0). The centre of the view is the centre of the rest of the map. The default is 0. A change moves the camera at once (as `setPadding` of MapLibre GL JS). It is not the `padding` of `initialView` and `moveTo`, which is space around `bounds` for one fit. |

These fields are read only when the map is made:

| Field | Meaning |
|---|---|
| `renderer` | `'auto'` (the default), `'worker'` or `'main'`: the thread that draws. When the worker cannot draw (it has no WebGL2 context, or loses it), the map draws on the main thread. With `'auto'` this happens without a warning (the development build writes a note with `console.info`); with `'worker'` the map warns once. `state.renderer` says which thread draws. See [Loading](loading.md). |
| `fontFamily` | The CSS family for text that has no web font: the map tries it after the family of the `text-font` name. See [Web fonts](#web-fonts). |
| `interactive` | `false` for a map that the user cannot move. The default is `true`. With `false`, `onClick` and `state.hover` still work, and a touch on the map scrolls the page. |
| `antialias` | Multisample antialiasing for the canvas. |
| `attribution` | `false` to show the credits yourself, or options for the built-in credits. |
| `hash` | Keeps the view in the fragment of the URL. |
| `nonce` | The nonce of a Content Security Policy with `style-src 'nonce-…'`. The map sets it on the `<style>` element of its style sheet, which it adds only in a browser that cannot adopt a constructed style sheet. See [Content Security Policy](loading.md#content-security-policy). |

For a map in a page that scrolls, set `cooperativeGestures: true` (see the table of fields above), or
`interactive: false` for a map that the user cannot move.

A drag with the right mouse button, or with Ctrl and the left mouse button, rotates and pitches the map as in
MapLibre GL JS:

- When the pointer is more than 100 pixels above or below the centre of the map, the map turns by the angle that the
  sideways movement of the pointer makes around that centre.
- Nearer to the centre, the map turns by 0.8 degrees for each pixel sideways. A drag to the right increases the bearing
  when the pointer is below the centre, and decreases it when the pointer is above the centre.
- The map pitches by 0.5 degrees for each pixel that the pointer moves up.

The map stops when the drag ends. The compass of the control `navigation` turns the map in a different way: see
[Controls](#controls).

## A light and a dark style

`style` of the description (`@map-jr/map-jr-gl`) also takes a pair `{light, dark}`, where each value is a style object
or the URL of a style. The map uses the style of the colour scheme that `colorScheme` resolves to, and changes to the
other style when the scheme changes: when `prefers-color-scheme` changes while `colorScheme` is `'auto'`, or when
`update()` gives another `colorScheme`. `colorScheme` is `'light'` by default, so write `colorScheme: 'auto'` to
follow the browser.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: {light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark'},
  colorScheme: 'auto',
});
```

A change of scheme is a new style: the map requests the other style (for a URL) and draws the map from the start.
`sources`, `layers`, `terrain`, `data`, `images` and the view of the description stay, as with each new
`style`. To change the colours without a request, use one style that reads the global state property `color-scheme`: see
[One style for both schemes](#one-style-for-both-schemes). In `update()`, a pair with the same content is the same style. An object that has `layers` is a
style, and not a pair. A pair with only one of the two values uses that style in both schemes, and the development
build warns once; so does an object that is neither a style nor a pair. The server renderer
(`@map-jr/map-jr-gl/server`) cannot read the scheme of the browser: it uses `dark` when its option `colorScheme` is
`'dark'`, and `light` otherwise.

## Your own layers on a style from a URL

```js
createMap(container, {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  sources: {routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
  layers: [{id: 'routes', type: 'line', source: 'routes', before: 'water_name', paint: {'line-color': '#d6453d', 'line-width': 3}}],
  terrain: {source: 'dem', exaggeration: 1.5},   // if the style or `sources` has an elevation source
});
```

The fields `sources`, `layers` and `terrain` of the description add to the style when the style has loaded. They
work for a style from a URL as for a style object:

| Field | Rule |
|---|---|
| `sources` | Merged with the sources of the style by id. A source of the description replaces the source of the style with the same id. |
| `layers` | Added to the layers of the style. A layer with `before` goes below the layer with that id, and a layer without it goes on top. |
| `terrain` | Replaces the terrain of the style. `null` or no field means the terrain of the style. |
| `sprite` | Added to the sprites of the style. A sprite with the id of a sprite of the style replaces it. |

`images` and `globalState` are merged by key in the same way (see their rows in [The description](#the-description)),
and `projection` replaces the projection of the style. A style object that your application writes itself needs
none of these fields. Up to version 0.5, these three fields were inside a field `extend`, which no longer exists.

When only `sources`, `layers` and `terrain` change, `update()` edits the map: it adds and removes sources and layers, and it sets the changed
paint properties, layout properties (such as `visibility`) and filters. The style is not requested again. These changes replace the whole style instead,
so the style from a URL is requested again:

- a change of `terrain`;
- a source that changes, or a source of `sources` (new or removed) with the id of a source of the style;
- a layer whose `type`, `source`, `source-layer`, `minzoom`, `maxzoom` or `before` changes;
- layers that stay but change their order in `layers`, or a new layer that is earlier in `layers` than a layer that stays;
- a change of `style` in the same `update()`.

## Web fonts

The field `fonts` of the description gives web fonts for the labels, in the shape of `font-faces` of the style
specification: an object by `text-font` name, whose value is the URL of a font file or a list of
`{url, 'unicode-range'}`. It works with a style object and with a style from a URL.

```js
import {createMap} from '@map-jr/map-jr-gl';

createMap('map', {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  fonts: {
    'Noto Sans Regular': 'https://example.com/fonts/NotoSans-Regular.woff2',
    'Noto Sans Bold': [{url: 'https://example.com/fonts/NotoSans-Bold-Latin.woff2', 'unicode-range': ['U+0000-00FF']}],
  },
});
```

- **Which text uses them.** When the style has `glyphs`, the labels use the glyph files, and the web fonts draw only
  what the files do not have: a font stack or a range that the server does not have, a character missing from the
  files, and text that the browser must shape. A style without `glyphs` draws all text with the web fonts and the
  fonts of the browser.
- **Names.** A `text-font` name or a name of `fonts` becomes a CSS family, a weight and a style. Words such as `Bold`
  (700), `Semibold` (600), `Medium` (500), `Light` (300), `Black` (900) and `Italic` are taken out of the name, and the
  rest is the family. So `Open Sans Semibold Italic` is the family `Open Sans` at weight 600 in italic. A name without
  such a word has weight 400.
- **The style.** The `font-faces` of the style are loaded too. A name of `fonts` replaces the same name of the style. A
  relative URL in `fonts` is relative to the page, and one in the style is relative to the style.
- **`update`.** A name that is new or has a new value loads its font, and the labels are drawn again. A name that
  leaves `fonts` does not unload its font: the browser keeps a font that was added, so the labels keep it until the
  page is loaded again. Give another font for that name to replace it.
- **Failure.** A font file that does not load is an error of the map (`onError`) that names the font, for example
  `[map-jr-gl] fonts: the font "Noto Sans Bold" did not load from …`. The labels then use the next font of their
  `text-font`, then `fontFamily`, then the fonts of the browser.
- **Workers.** The map fetches each file and gives it to the thread that draws, so web fonts also work when the map
  draws in a worker, which does not see fonts that the CSS of the page loads.
- **`fontFamily`** (read only when the map is made) is the CSS family that the map tries after the family of the
  `text-font` name. The default is `"Noto Sans", "Helvetica Neue", Arial, sans-serif`. It has no equal in the style
  specification.

## Images for style layers

The field `images` gives images to the style layers by name. A symbol layer uses an image with `icon-image`.

```js
import {createMap} from '@map-jr/map-jr-gl';

const pin = '<svg viewBox="0 0 24 31"><path fill="#d6453d" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  images: {pin},
  sources: {places: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}}}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}}],
});
```

A value of `images` is one of these:

| Value | Meaning |
|---|---|
| A string that starts with `<` | An SVG document. The library draws it at the pixel density of the screen. Its size in CSS pixels is the size of its `viewBox`. Without a `viewBox`, the size comes from the `width` and `height` attributes of the `<svg>` element. An attribute that is missing, is a percentage or has a unit other than `px` counts as 24. With slots (`{{name}}`), it is a template: see [An image that is a template](#an-image-that-is-a-template). |
| Another string | The URL of an image. The server of the image must permit the request (CORS). |
| An `ImageBitmap`, a canvas, an image element or `ImageData` | The pixels of the object. |
| `{image, width, height, pixelRatio, ...}` | One of the values above as `image`, with options. `width` and `height` are the size in CSS pixels. `pixelRatio` is the number of image pixels for one CSS pixel (the default is 1). The options `stretchX`, `stretchY`, `content`, `textFitWidth`, `textFitHeight` and `sdf` are those of `addImage` in MapLibre GL JS. |

`update` follows the field:

- A name that is new gets its image. A name that the new description leaves out loses its image.
- A value that is a string, or that has a string as `image`, is compared by its content. Another value is compared
  by identity: give a new object to replace the image.
- An image of `images` is used in place of an image of the sprite of the style that has the same name.

An image that is a URL is requested through `transformRequest` with the kind `Image`.

### Images in the style

A style can carry its own images in `metadata["map-jr:images"]`: an object by name with an SVG document or the URL
of an image as text, or `{image, width, height, ...}` with such a text as `image`. The style specification permits
any key in `metadata`, so MapLibre GL JS reads the style and ignores the images.

```json
{
  "version": 8,
  "metadata": {"map-jr:images": {"pin": "<svg viewBox=\"0 0 24 31\"><path fill=\"#d6453d\" d=\"M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z\"/></svg>"}},
  "sources": {},
  "layers": []
}
```

- An image of `images` of the description is used in place of an image of the style with the same name, and an image
  of the style in place of an image of the sprite.
- The images belong to the style: a new style removes them, and an `update` that changes `images` keeps them.
- A style comes from another party, so the map takes at most 500 images from it, each at most 200,000 characters of
  text. An SVG of the style must not refer to another file (`href` or `url(...)` other than `#...` and `data:`). The
  map leaves out an image that breaks one of these rules and reports an error (`onError`) with its
  name.
- The map draws an image of the style when a layer asks for it, and requests an image that is a URL then. An image
  that no layer of the view names costs no time and no room in the texture, and an image that does not load is an
  error only when a layer asks for it. So a style with many images is ready as soon as a style with a sprite. An SVG
  template is known to the map at once, and each of its variants is drawn when a layer asks for it. The images that
  are drawn share the texture of the run-time images (see [An image that is a template](#an-image-that-is-a-template)):
  that texture is full after 961 icons of the size of those of OpenFreeMap (most are 21 by 21 CSS pixels) at a pixel
  ratio of 3.
- The server renderer (`renderToSVG`, `renderToImage`) draws the SVG images of the style, with the same rules.
- The compat entry (`@map-jr/map-jr-gl/maplibre-compat`) does not read the key, as MapLibre GL JS does not.

An image that does not load is an error of the map (`onError`) with the name of the image. The map
draws the layer without that image.

### A sprite of the description

The field `sprite` adds sprites to the sprite of the style. It has the list form of `sprite` in the style
specification: a list of `{id, url}`. An `icon-image` names an image of such a sprite as `id:name`, as MapLibre GL JS
names an image of a sprite with an id other than `default`.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  sprite: [{id: 'maki', url: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite'}],
  sources: {places: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}}}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'maki:circle_11'}}],
});
```

- The URL has no extension. The map loads `url + '.json'` and `url + '.png'`, and `url + '@2x.json'` and
  `url + '@2x.png'` on a screen with a pixel ratio above 1. Both requests go through `transformRequest` with the kinds
  `SpriteJSON` and `SpriteImage`. A relative URL is relative to the page.
- A sprite of a style is one URL (the id `default`) or a list. A sprite of the description replaces a sprite of the
  style with the same id, so the id `default` replaces the sprite of a style whose `sprite` is one URL.
- An image of `images` or of the style is used in place of an image of a sprite with the same name (`pins:hotel`).
- A sprite that does not load is an error of the map (`onError`) with its URL. The map draws the images
  of the other sprites.
- A change of `sprite` in `update()` loads the style again. A new style gets the sprites of the description.
- The server renderer (`renderToSVG`, `renderToImage`) has the option `sprite` with the same rule. There, a relative
  URL is relative to the URL of the style, and a sprite that does not load rejects the render, as the sprite of the
  style does.

### An image that the style asks for

When a layer names an image that the map does not have, the map reports the event `styleimagemissing` with the
name as `id`. Add an image with that name to `images`, and the map draws it. Use this for images that your code
makes from the name, for example a badge for each value of a property. The map reports a name one time for
each style: after a new style, it reports a name again that is still missing.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  images: {},
});
map.listen('styleimagemissing', event => {
  if (!event.id.startsWith('badge-')) return;   // a name that this code does not make
  const badge = `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#d6453d"/></svg>`;
  map.patch({images: {...map.description.images, [event.id]: badge}});
});
```

- The map reports each name one time. The listener can add the image later, for example after a request.
- The event also comes for a name that no code of yours makes, such as an icon that the sprite of the style does
  not have. Leave such a name out.
- The map asks for the image of each icon of a loaded tile, also for an icon outside the view.
- The Vue and React components pass the event on (`@styleimagemissing`, `onStyleimagemissing`). The server
  renderer has no events: give it the same images with its options `images` and `resolveImage`.

### An image that is a template

An SVG document with slots is a template. Write `{{name}}` where a value must go. The library draws the template
one time for each different set of values, and it makes each value safe for XML.

A slot gets its value in one of two ways:

- Without more, a slot gets the property of the feature that has the name of the slot. With the image
  `pin` below, `'icon-image': 'pin'` gives `{{color}}` the property `color` of each feature.
- A layer gives a slot a value with `params` in the `image` expression. Each parameter is an expression of the style.

```js
import {createMap} from '@map-jr/map-jr-gl';

const pin = '<svg viewBox="0 0 24 31"><path fill="{{color}}" stroke="{{stroke}}" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';
const places = {type: 'FeatureCollection', features: [
  {type: 'Feature', id: 1, properties: {kind: 'cafe'}, geometry: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  {type: 'Feature', id: 2, properties: {kind: 'park'}, geometry: {type: 'Point', coordinates: [-73.9857, 40.7484]}},
]};
const map = createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-73.996, 40.73], zoom: 11.5},
  images: {pin},
  sources: {places: {type: 'geojson', data: places}},
  layers: [{
    id: 'places', type: 'symbol', source: 'places',
    layout: {
      'icon-anchor': 'bottom',
      'icon-image': ['image', 'pin', {params: {
        color: ['match', ['get', 'kind'], 'cafe', '#d6453d', 'park', '#2e9d5b', '#2f7fd1'],
        stroke: ['case', ['boolean', ['feature-state', 'hover'], false], '#222', '#fff'],
      }}],
    },
  }],
});
```

What to know about a template:

- `icon-image` is a layout property. A parameter is evaluated when a tile is built, at a whole zoom level. For a
  value that changes without steps, use `icon-size`, `icon-opacity` or `icon-rotate`.
- A parameter can read `feature-state`, as `stroke` does in the example. Set the state with `setFeatureState` of
  the `MapInstance` (see [The state of a feature](#the-state-of-a-feature)), for example
  `map.setFeatureState({source: 'places', id: 1}, {hover: true})`. The map then builds the tiles of the source
  again. MapLibre GL JS does not permit `feature-state` in a layout property.
- A map draws 1,000 variants of one template at most. More different sets of values give one error of the map with
  the name of the image, and the other variants are not drawn. Give the slots values from a small set.
- All images that are added at runtime share one texture of at most 2048 by 2048 pixels, so large variants reach its end
  before the limit of 1,000: about 600 variants of 40 by 40 CSS pixels fit on a screen with a pixel ratio of 2. The
  map then reports one error, and later images are not drawn. An image that is removed or replaced, and a variant
  of a template that is replaced, gives its place back. When a new image finds no free place, the map places all of its images again in an empty
  texture, so the error comes only when the images that the map has, with the new one, do not fit together. After
  an image is removed, a later image that does not fit gives the error again. The map
  makes this texture with its first such image at 256 by 256 pixels (256 KB), and doubles its width and height, up
  to 2048 by 2048 pixels (16 MB), when the images do not fit. The texture does not become smaller again.
- A template works in `icon-image`, in an image of `format` text, and in `fill-pattern`, `line-pattern` and
  `background-pattern`. In a pattern property, a slot that has no parameter gets an empty text, because a pattern
  is the same for the whole layer and reads no property of a feature.
- A template that is not well-formed gives one error of the map with the name of the image.
- A slot in the `href` of an `<image>` element makes the page request the URL that a feature gives. Use such a
  slot only with data that you trust.
- A slot with no parameter and no property of that name gets an empty text.
- In the development build, a parameter whose name is not a slot of the image gives a warning.
- `params` is not part of the MapLibre style specification. Mapbox GL JS has the same form for the colours of an
  SVG icon. A style with `params` shows the icon in this library only.
- The server renderer draws a template that is given to it in its option `images`. See [Server rendering](server-rendering.md).

For points that only need a picture, give the points in `data` (with `points()`) and a symbol layer with the image
in `layers`. See [Markers](markers.md). [Which icons are fast](markers.md#which-icons-are-fast) says
when the cost of a frame does not grow with the number of icons.

## GeoJSON data that changes

Give the data in the field `data`, by the id of a source. A key that is not the id of a source of the style or of
`sources` makes a GeoJSON source with that id and the default options, so the layers can name it:

```js
import {createMap} from '@map-jr/map-jr-gl';

const container = document.getElementById('map');
const routes = id => ({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-74.01, 40.70], [-73.97, 40.75 + id / 100]]}}]});
const layers = [{id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#d6453d', 'line-width': 3}}];
const url = 'https://tiles.openfreemap.org/styles/liberty';

const map = createMap(container, {style: url, layers, data: {routes: routes(0)}});

// Later: other data. `layers` is the same array, so the style is not requested again.
map.update({style: url, layers, data: {routes: routes(1)}});
```

- The data of each source is compared by identity. Give a new object to change it.
- Only the data goes to the map. A style with the data inside it would be compared and sent as a whole.
- The data stays when the style changes, and the sources that keys of `data` made are made again in the new style.
- A source that needs options (`cluster`, `promoteId`, `attribution`) is declared in the style or in `sources`,
  with no features, and `data` gives it the features.
- A key that leaves `data` removes the source that the key made. A layer that still names it draws nothing, and the
  development build writes a warning.
- A key that is the id of a source of another type, such as a vector source, is an error of the map (`onError`), and
  the data has no effect.
- `renderToSVG` (`@map-jr/map-jr-gl/server`) follows the same rule, and throws for a key of a source of another type.

### Points from records

`points(records, options)` from `@map-jr/map-jr-gl` makes a GeoJSON `FeatureCollection` with a point for each
record. It needs no map, so a server can call it too.

```js
import {points} from '@map-jr/map-jr-gl';

const records = [{id: 'louvre', name: 'Louvre', lng: 2.3376, lat: 48.8606}];
const places = points(records, {lngLat: r => [r.lng, r.lat], id: r => r.id});
// {type: 'FeatureCollection', features: [{type: 'Feature', id: 'louvre', properties: records[0], geometry: {type: 'Point', coordinates: [2.3376, 48.8606]}}]}
map.update({style, data: {places}});
```

| Option | Meaning |
|---|---|
| `lngLat(record, index)` | Required. The position of the record as `[lng, lat]`. |
| `id(record, index)` | The id of the feature, a number or a string. A string of decimal digits that is a safe integer (`'12'`, `'012'`) becomes the number (`12`), as in MapLibre GL JS; any other string stays the string. `queryFeatures` and `state.hover` give the id in that form, and `setFeatureState` takes it. Without it, a feature has no id: the function does not use the index, because the index changes when a record is removed. |
| `properties(record, index)` | The properties of the feature. Without it, the properties are the record itself. |

A record whose position is not two finite numbers (a string such as `'2.3'` included) is left out. The development
build warns once on the page with the index of the first such record; the production build does not warn.

## Dark mode

`colorScheme` of the description gives the colours of the controls and the popup: `'light'` (the default), `'dark'`,
or `'auto'`, which follows the media query `prefers-color-scheme`. A map that follows the browser writes
`colorScheme: 'auto'`. The canvas follows the scheme in one of two ways.

| Way | What a change of scheme costs | Use it when |
|---|---|---|
| One style that reads the global state property `color-scheme` | No request. The map repaints the layers that read the property. | You write or can edit the style. |
| `style: {light, dark}`, two styles | A request of the other style. The map draws from the start. | A provider publishes a light style and a dark style. |

### One style for both schemes

The map sets the global state property `color-scheme` of the style to `'light'` or `'dark'`, the resolved scheme
(`state.colorScheme`), when the map is made and at each change of the scheme. Without `colorScheme` in the
description, the property is `'light'`. An expression of the style reads it
with `['global-state', 'color-scheme']`:

```js
import {createMap} from '@map-jr/map-jr-gl';

const scheme = (dark, light) => ['match', ['global-state', 'color-scheme'], 'dark', dark, light];
const pin = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="{{fill}}"/></svg>';
const map = createMap(document.getElementById('map'), {
  style: {
    version: 8,
    state: {'color-scheme': {default: 'light'}},
    sources: {spot: {type: 'geojson', data: {type: 'Point', coordinates: [2.35, 48.85]}}},
    layers: [
      {id: 'background', type: 'background', paint: {'background-color': scheme('#1b1b1d', '#f2efe9')}},
      {id: 'spot', type: 'symbol', source: 'spot', layout: {'icon-image': ['image', 'pin', {params: {fill: scheme('#ffd54a', '#d6453d')}}]}},
    ],
  },
  images: {pin},
  initialView: {center: [2.35, 48.85], zoom: 4},
  colorScheme: 'auto',
});
```

- A change of scheme requests neither the style nor tiles. A paint property that reads the property is applied
  when the map draws. A layout property, a filter, a value that varies per feature and a parameter of a template
  (see [An image that is a template](#an-image-that-is-a-template)) are part of the tiles: the map builds the tiles of
  the sources of such layers again, from the data that it has.
- A style that does not read the property draws as before. A change of scheme then rebuilds no tile.
- A value of `globalState` of the description with the name `color-scheme` wins over the scheme, for example
  `globalState: {'color-scheme': 'dark'}` for a map that is always dark while the controls follow the page. When the
  description leaves that name out again, the property follows the scheme again.
- Give the property a default in `state` of the style, as in the example. MapLibre GL JS and the compat entry
  (`@map-jr/map-jr-gl/maplibre-compat`) do not set it, and they show the style with that default.
- A style that already uses a state property `color-scheme` for something else gets the value of the map. Rename the
  property of the style, or give the value in `globalState`.

### Two styles

`style` also accepts `{light, dark}`, where each value is a style object or the URL of a style. The map uses the
style of the resolved scheme, and a change of scheme requests the other style and draws the map from the start.
[A light and a dark style](#a-light-and-a-dark-style) has an example and the details: what stays, the comparison in
`update()`, the messages of the development build and the server renderer.

## Controls

```js
import {navigation, scale, fullscreen, geolocate, terrain} from '@map-jr/map-jr-gl/controls';

createMap(container, {
  style,
  controls: [navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})],
});
```

Each function returns the description of a control. The map adds the control, and removes it when a later
description does not have it. Importing the functions loads about 0.5 KB gzip. The code of the controls (one file
for all of them) and of the map loads when the map adds its first control, so a page can import the functions before
it makes the map. A control appears a moment after `createMap` or `update` adds it, when that file has loaded.

The controls, the attribution, the scale and the popup of a map of `createMap` have a translucent background with
`backdrop-filter: blur(5px)`. A button is a circle and a group of buttons is a pill: the radius is half the size of a
button. The attribution and the scale have lighter text, the links of the attribution have a
faint underline until the pointer is over them, and the popup has a round close button. A map of
`@map-jr/map-jr-gl/maplibre-compat` keeps the look of MapLibre GL JS. The look needs Safari 18, Chrome 120 or Firefox
121 (`backdrop-filter` without a prefix, and CSS nesting); an older browser shows opaque controls with corners of 6
pixels. The rules have no specificity, so a rule of your page wins. Set these custom properties on the container of the
map or on an element above it:

| Custom property | What it sets | Default |
|---|---|---|
| `--map-control-opacity` | The opacity of the background of the controls, from 0 to 1. The popup has 0.1 more. | `.55`, dark `.45` |
| `--map-control-radius` | The radius of the controls. The popup has three quarters of it, and the attribution and the scale have half. | half of `--map-control-size` (`16px`, `22px` on a touch screen) |
| `--map-control-background` | The background of a group of buttons and of the compact attribution, in place of the colour that `--map-control-opacity` makes | white at `.55`, dark `rgb(30 30 34)` at `.45` |
| `--map-control-color` | The colour of the icons and the text | `#222`, dark `#e6e6e6` |
| `--map-control-size` | The width and the height of a button | `32px`, `44px` on a touch screen |
| `--map-control-focus` | The colour of the focus outline | `#2f7fd1` |
| `--map-attribution-background` | The background of the attribution and the scale | as the controls |
| `--map-popup-background`, `--map-popup-color` | The background and the text of a popup | white at `.65` and `#222`, dark `rgb(30 30 34)` at `.55` and `#e6e6e6` |

The compass is a round button below the zoom buttons. Its centre shows the nearest of `N`, `E`, `S` and `W` to the
direction that the map faces (a bearing of 45 degrees shows `E`), and a mark of north on a dial turns with the map. A
click turns the map to the north, and a drag sideways turns it by 0.8 degrees for each pixel. The scale sits at the
bottom edge of the map beside the attribution; with the compact attribution it keeps a distance of 10 pixels.

| Function | Control | Options (each also has `position`) |
|---|---|---|
| `navigation` | Zoom buttons and a compass. A click on the compass resets the bearing, and dragging it rotates the map by 0.4 degrees for each pixel sideways: a drag to the right decreases the bearing at every height, unlike the rotate drag on the map. With `visualizePitch: true`, the compass also shows the pitch, the drag also pitches the map, and a click resets the pitch (default false, as in MapLibre GL JS). | `showZoom`, `showCompass`, `visualizePitch` |
| `scale` | A scale bar | `maxWidth`, `unit` (`'metric'`, the default; `'imperial'`; or `'nautical'`) |
| `fullscreen` | A button for the full screen. Where the browser has no Fullscreen API (Safari on iPhone), the container gets the class `map-jr-pseudo-fullscreen` and fills the window. | |
| `geolocate` | A button that moves the map to the position of the user. With `trackUserLocation: true`, the button turns tracking on and off, the map follows the position until it is moved, and a dot shows the position (`showUserLocation: false` hides it). | `zoom`, `positionOptions`, `trackUserLocation`, `showUserLocation` |
| `terrain` | A button that turns 3D terrain on and off | `source` (required), `exaggeration` |
| `globe` | A button that switches the projection between `globe` and `mercator`. While the projection is `globe`, the button has the class `map-jr-ctrl-globe-enabled` and `aria-pressed="true"`. A click changes the map until a description with a different `projection` comes. See `projection` for what the globe draws. | |
| `colorScheme` | A prototype. A button that switches the colour scheme between light and dark. It shows the scheme that the map has (a sun or a moon), and its label names the action ("Use dark colours"). A click changes `colorScheme` of the description with `patch` and calls `onColorSchemeChange`. When the description has `'auto'`, a click sets the opposite of the system, and the click after it, which lands on the scheme of the system, sets `'auto'` again. With no value, `'light'` or `'dark'`, a click flips between `'light'` and `'dark'`. The code loads in a file of its own when the map adds the control. | |
| `custom` | A control of your own (see below) | `key` (required), and `element` or `onAdd` with `onRemove` |

### The texts of the controls

`locale` of the description gives the texts of the controls and of the other elements that the map adds, by the
keys of MapLibre GL JS (the option `locale` of its `Map`). A key that is left out keeps the English text.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, fullscreen} from '@map-jr/map-jr-gl/controls';

createMap('map', {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  controls: [navigation(), fullscreen()],
  locale: {'NavigationControl.ZoomIn': 'Zoom avant', 'NavigationControl.ZoomOut': 'Zoom arrière'},
});
```

| Key | English text |
|---|---|
| `AttributionControl.ToggleAttribution` | `Toggle map data credits` (the label) and `Map data credits` (the title) |
| `NavigationControl.ZoomIn` | `Zoom in` |
| `NavigationControl.ZoomOut` | `Zoom out` |
| `NavigationControl.ResetBearing` | `Reset bearing to north` |
| `FullscreenControl.Enter` | `Enter fullscreen` |
| `FullscreenControl.Exit` | `Exit fullscreen` |
| `GeolocateControl.FindMyLocation` | `Find my location` |
| `GeolocateControl.LocationNotAvailable` | `Location not available` |
| `ColorSchemeControl.Light` | `Use light colours` (a key of this library) |
| `ColorSchemeControl.Dark` | `Use dark colours` (a key of this library) |
| `Popup.Close` | `Close popup` |
| `Marker.Title` | `Map marker` |
| `CooperativeGesturesHandler.WindowsHelpText` | `Use Ctrl + scroll to zoom the map` |
| `CooperativeGesturesHandler.MacHelpText` | `Use ⌘ + scroll to zoom the map` |
| `CooperativeGesturesHandler.MobileHelpText` | `Use two fingers to move the map` |

A change of `locale` with `update()` adds the controls again, so that they show the new texts. An open popup takes the
new text of its close button. The development build warns once when `locale` is
not an object or a value is not a string.

### A control of your own

`custom` puts your own element into a corner, below or beside the other controls of that corner. `key` names the
control: while the descriptions have a control with that `key`, the map keeps it, and it removes the control when a
description does not have it. The map gives the element the class `map-jr-ctrl`, which makes it take clicks (the
corners themselves do not). The element of `custom` shows at once; it does not wait for a file to load.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const button = document.createElement('button');
button.textContent = 'Layers';
button.addEventListener('click', () => console.log('open the layer list'));

createMap(document.getElementById('map'), {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  controls: [navigation(), custom({key: 'layers', position: 'top-right', element: button})],
});
```

A control written for MapLibre GL JS (an object with `onAdd(map)` and `onRemove(map)`) also fits:
`custom({key: 'ruler', position: 'top-left', onAdd: map => ruler.onAdd(map), onRemove: map => ruler.onRemove(map)})`.
`onAdd` receives the core map of the library, not the object that `createMap` returns. This is the one place where an
application gets the core map. The default
`position` is `'top-right'`.

In React and Vue, make the element once and render your component into it. In React use a portal
(`@map-jr/map-jr-gl/react`):

```jsx
import {useMemo} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

export function App() {
  const corner = useMemo(() => document.createElement('div'), []);
  const controls = useMemo(() => [navigation(), custom({key: 'styles', position: 'top-right', element: corner})], [corner]);
  return <>
    <div style={{height: 400}}><MapJr mapStyle="https://tiles.openfreemap.org/styles/liberty" controls={controls} /></div>
    {createPortal(<button onClick={() => console.log('switch the style')}>Styles</button>, corner)}
  </>;
}
```

In Vue use `<Teleport>` (`@map-jr/map-jr-gl/vue`):

```vue
<script setup>
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const corner = document.createElement('div');
const controls = [navigation(), custom({key: 'styles', position: 'top-right', element: corner})];
</script>

<template>
  <div style="height: 400px"><MapJr map-style="https://tiles.openfreemap.org/styles/liberty" :controls="controls" /></div>
  <Teleport :to="corner"><button @click="console.log('switch the style')">Styles</button></Teleport>
</template>
```

With server rendering, make the element in the browser only (in `useEffect` or `onMounted`), because
`document` does not exist on the server.

The attribution of the data shows without a control of your own. To change it or to turn it off, see `attribution`
in [The description](#the-description).

## The state

`map.state` is a store. It has `get()` and `subscribe()`.

```js
map.state.get().view.zoom;

// Each change:
const stop = map.state.subscribe(state => { /* ... */ });

// Only when one part changes:
map.state.subscribe(state => state.hover, features => showTooltip(features[0]));

stop(); // stops the first subscription
```

| Field | Meaning |
|---|---|
| `loaded` | The style and the first tiles have loaded. |
| `idle` | Nothing moves and nothing loads. |
| `moving` | The camera moves. |
| `view` | `{center, zoom, bearing, pitch, bounds}`. `bounds` is `[[west, south], [east, north]]`: the smallest box that contains the visible map, also with bearing and pitch, as `getBounds()` gives it in MapLibre GL JS. It changes when the map moves and when the size of the map changes. |
| `hover` | The features of `interactiveLayers` under the pointer, the top one first. |
| `pointer` | Where the pointer is while it is over the map: `{point: {x, y}, lngLat: [lng, lat]}`, with `point` in CSS pixels from the top left corner of the map. It is `null` before the first move and after the pointer leaves the map. It changes at each move of the mouse, also without `interactiveLayers`, and a touch does not set it. |
| `renderer` | `'worker'` or `'main'`, when the map has started. |
| `colorScheme` | `'light'` or `'dark'`: `colorScheme` of the description, with `'auto'` resolved by `prefers-color-scheme`. |

The state has no field for errors. To get each error of the map, write `onError` in the description or call
`map.listen('error', fn)` (see [Events](#events)).

`loaded` becomes `true` before `idle` does, in the same task. A listener of the `load` event and a subscriber of
`loaded` see `idle: false`, so code there that waits for the first `idle` gets it.

`pointer` changes at each move of the mouse, so a subscriber without a selector is called at each move. Subscribe
with a selector to the part that you use, for example a tooltip that follows the pointer:

```js
map.state.subscribe(state => state.pointer, pointer => { if (pointer) moveTooltip(pointer.point.x, pointer.point.y); });
```

A state object never changes. Each change makes a new object, and a part that did not change is the same object as
before. This is the contract that frameworks use: `useSyncExternalStore` in React, a `shallowRef` in Vue, a store
in Svelte, `from` in Solid.

## A view that the application owns

```js
let view = {center: [-74.0065, 40.7085], zoom: 13.6, bearing: 0, pitch: 0};
const describe = () => ({style, view, onViewChange: next => { view = next; map.update(describe()); }});
const map = createMap(container, describe());

// To move the map, change the view:
view = {...view, zoom: 15};
map.update(describe());
```

The map draws in a worker, so it does not wait for your application. It reports each change of the view with
`onViewChange`. When your application gives a view back that the map reported, the map does not apply it again. Thus
a slow application does not pull the map back while the user moves it. A view that the map did not report moves the
map.

The map keeps the last 60 views that it reported, with no time limit. It ignores a `view` whose `center`, `zoom`,
`bearing` and `pitch` are all equal to those of one of them. So `update` with a view that your application stored a
moment ago (a button "back to where I was") can have no effect. For such a movement, call `map.moveTo(stored)`:
`moveTo` always moves the map.

### The camera

The camera takes the same fields in three places:

| Where | When it moves the map |
|---|---|
| `initialView` of the description | Once, when the map is made. The user then moves the map. |
| `view` of the description | At each `update()` with a view that the map did not report (see above). |
| `map.moveTo(target)` | Now, each time it is called. |

The fields are `center` (`[lng, lat]`), `zoom`, `bearing` (degrees) and `pitch` (degrees). In place of `center` and
`zoom`, `initialView` and `moveTo` take `bounds` (`[[west, south], [east, north]]` or `[west, south, east, north]`):
the map fits that box into the view, and turns to bearing 0 unless `bearing` is given. Two fields belong to the fit:

- `padding` is the space around the box in CSS pixels, a number or `{top, right, bottom, left}` (default 0). It adds
  to the `padding` of the description for this one fit, and it does not change the padding of the map.
- `maxZoom` is the largest zoom of the fit (default: the `maxZoom` of the map).

Without `bounds`, `padding` and `maxZoom` have no effect, and the development build warns once. The padding of the
map belongs to the description only (`padding`); `moveTo` does not change it.

`moveTo` also takes `duration` and `fly`. With `duration` (milliseconds, default 0), the camera eases to the target
(as `easeTo` of MapLibre GL JS). With `fly`, the camera moves as `flyTo` of MapLibre GL JS does: it zooms out and back
in on the way. `fly` is `true` or an object with the options of `flyTo`: `curve` (default 1.42), `speed` (default
1.2), `screenSpeed`, `minZoom` and `maxDuration` (milliseconds; a longer flight is a jump). Without `duration`, the
duration of a flight follows from the distance and the speed. When the system asks for reduced motion, the camera
jumps.

```js
// @map-jr/map-jr-gl
map.moveTo({zoom: 15, duration: 500});
map.moveTo({center: [2.35, 48.86], zoom: 12, fly: true});
map.moveTo({bounds: [[-74.05, 40.68], [-73.9, 40.82]], padding: 40, pitch: 30, duration: 800});
```

`map.fitBounds(bounds, options)` is the short form of `map.moveTo({bounds, ...options})`, with `duration` 800 by
default.

## Queries

There are two methods to find features:

| Method | Finds | Options | Result |
|---|---|---|---|
| `queryFeatures(at?, options?)` | The features that the style layers draw, the top one first. | `layers`, `filter`, `radius` | `RenderedFeature[]` |
| `querySource(sourceId, at?, options?)` | The features of the tile data of one source. They need no style layer, and at a position they need not be on the screen: the map fetches the tile if necessary. | `sourceLayers`, `filter`, `radius`, `geometry`, `zoom` | `QueriedFeature[]` |

`at` is where the method looks:

- for `queryFeatures`, a point of the screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two
  points), or nothing for the whole map;
- for `querySource`, a point of the screen or a position, or nothing for the tiles of the view. A rectangle of the
  screen also works: it gives the features of the tiles of the view within the rectangle.

A feature that several tiles hold is in the result one time when it has an id or comes from a GeoJSON source. Its
geometry is the part of the feature in one of the tiles. A feature of a vector tile source that has no id is in the
result once for each tile that holds it.

The options can come in the place of `at`. `map.queryFeatures({layers: ['places']})` asks the whole map, and it is the
same as `map.queryFeatures(undefined, {layers: ['places']})`. An object is a place when it has `x`, `y`, `lng`, `lat`
or `lon`, and the options otherwise.

`queryFeatures` never reads data that the style does not draw: it returns an empty array where no style layer draws a
feature. `querySource` takes the id of one source. To ask two sources, call it twice.

```js
// The features that style layers draw at a point of the screen:
const drawn = await map.queryFeatures({x: 200, y: 150}, {layers: ['roads', 'places']});

// The features that style layers draw within 8 pixels of the point:
const near = await map.queryFeatures({x: 200, y: 150}, {radius: 8});

// In a rectangle of the screen, and on the whole map:
const inBox = await map.queryFeatures([{x: 0, y: 0}, {x: 400, y: 300}], {layers: ['places']});
const all = await map.queryFeatures({layers: ['places']});

// The data of a source at a position. You do not need a style layer for this, and the position can be off screen:
const data = await map.querySource('rain', [-75.16, 39.92]);

// All the features of a source in the tiles of the view:
const inView = await map.querySource('rain', {sourceLayers: ['rain']});
```

The options of `queryFeatures` (`FeatureOptions`):

| Option | Meaning |
|---|---|
| `layers` | The ids of the style layers to look in. The default is all style layers. |
| `filter` | A filter expression of the MapLibre style specification, for example `['==', ['get', 'class'], 'park']`. The query returns only the features that pass it. |
| `radius` | At a point or a position: the query asks a square of that many pixels of the screen to each side of the place. The default is 0. |

The options of `querySource` (`SourceOptions`):

| Option | Meaning | Has an effect |
|---|---|---|
| `sourceLayers` | The names of the layers of a vector tile source to look in. The default is all of them. | In each query. |
| `filter` | A filter expression, as for `queryFeatures`. | In each query. |
| `radius` | The distance around the place, in pixels of the screen, within which a feature is found. The default is 3. | At a point or a position. |
| `geometry` | `true` to give each feature a `geometry` (GeoJSON, in longitude and latitude). The default is `false`, which keeps the answer small. | At a point or a position. In a query of the view, the features always have a `geometry`. |
| `zoom` | The zoom level of the tiles to read. The default is the zoom of the map. The query rounds it down to a whole number and keeps it between the `minzoom` and the `maxzoom` of the source: above the `maxzoom`, it reads the tile at the `maxzoom`, which is the deepest tile of the source. | At a point or a position. |

An option that has no effect is ignored, and the map writes one warning for it: an option of `querySource` in
`queryFeatures` (`sources`, `sourceLayers`, `geometry`, `zoom`), `layers` in `querySource`, `radius` in a query for a
rectangle or the whole map, and `geometry: false` or `zoom` in a `querySource` of the view. A place that is not one of
the forms (for example `{lng, lat}`) in `queryFeatures` rejects the promise with an error that names the forms. A
first argument of `querySource` that is not a string rejects the promise.

A feature of `queryFeatures` (`RenderedFeature`) has `id`, `properties`, `geometry`, `source`, `sourceLayer`, `layer`
(the style layer) and `state`. A feature of `querySource` (`QueriedFeature`) has `id`, `properties`, `source`,
`sourceLayer`, `type` (`'Point'`, `'LineString'` or `'Polygon'`) and, as the table says, `geometry`.

`watchFeatures(at, options, listener)` and `watchSource(sourceId, at, options, listener)` ask the question of
`queryFeatures` and of `querySource` and keep the answer up to date. The listener gets the answer now, and again each
time that it changes: new tiles, a change of the style, and (for a place on the screen) a movement of the map. Each
returns a function that stops it. Use them in place of listeners for `idle` and `sourcedata`:

```js
// The band of rain under a marker, also while the layers of the map change:
const stop = map.watchSource('rain', [-75.16, 39.92], {}, features => show(features[0]?.properties));
```

`useMapFeatures` and `useMapSource` of `@map-jr/map-jr-gl/vue` are the same watches as refs (see [Vue](vue.md)).

A query whose map goes away is rejected, so that code that awaits it does not wait for ever. This holds for
`queryFeatures`, `querySource` and `queryElevation`:

| When | The promise rejects with an `Error` whose message is |
|---|---|
| `destroy()` is called before the answer has come, or the query is asked after `destroy()`. | `[map-jr-gl] The query has no answer: the map was removed.` |
| The browser takes the WebGL context away before the answer has come. | `[map-jr-gl] The query has no answer: the map lost its WebGL context. Ask again.` A query that is asked again waits for the new context and is answered then. |

Catch the error where a query can be open while the map is removed, for example in a handler of a component that
can unmount. `watchFeatures` and `watchSource` need no such code: they do not call their listener after `destroy()`,
and after a lost context they ask again by themselves. When a listener throws, the browser reports the error as an
unhandled rejection, and the watch goes on. When the question itself is wrong (for example a place that is not
`{x, y}` or `[lng, lat]`), the rejection is an `error` event of the map (`onError`, or the console when there is no
`onError`), once until the answer changes.

For users of MapLibre GL JS: `queryRenderedFeatures` is `queryFeatures`, and `querySourceFeatures(id)` is close to
`querySource(id)`. The difference is that `querySourceFeatures` returns every feature of the tiles under the view, as
MapLibre does, and `querySource` returns only the features in the view. The two MapLibre methods are in the entry
`@map-jr/map-jr-gl/maplibre-compat`. The `Map` of that entry has the same
`queryFeatures` and `querySource` as the `MapInstance`, and it also accept a position as `{lng, lat}`.

The tile data is in a worker, so each query returns a promise.

## Clusters

A GeoJSON source with `cluster: true` has three methods on the `MapInstance` of `@map-jr/map-jr-gl`. Each takes the id of
the source and the id of a cluster (`properties.cluster_id` of a cluster feature, for example from `queryFeatures`), and
returns a promise:

| Method | Answer |
|---|---|
| `clusterExpansionZoom(sourceId, clusterId)` | The zoom level at which the cluster divides. |
| `clusterChildren(sourceId, clusterId)` | The clusters and points that the cluster divides into, as GeoJSON features (`ClusterFeature[]`). |
| `clusterLeaves(sourceId, clusterId, {limit, offset})` | The points of the cluster, as GeoJSON features. `limit` defaults to 10 and `offset` to 0. A `limit` of `Infinity` gives all of them. |

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap(document.getElementById('map'), {
    style: 'https://demotiles.maplibre.org/style.json',
    sources: {points: {type: 'geojson', cluster: true, data: 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson'}},
    layers: [{id: 'clusters', type: 'circle', source: 'points', paint: {'circle-radius': 12}}],
    interactiveLayers: ['clusters'],
    onClick: async e => {
        const cluster = e.features[0];
        if (!cluster?.properties.cluster) return;
        const zoom = await map.clusterExpansionZoom('points', cluster.properties.cluster_id);
        map.moveTo({center: cluster.geometry.coordinates, zoom, duration: 500});
    },
});
```

The promise rejects with an `Error` whose message starts with `[map-jr-gl]` and the name of the method when the source
is not a GeoJSON source of the style, when it has no clusters, or when no cluster has that id. These are the methods
`getClusterExpansionZoom`, `getClusterChildren` and `getClusterLeaves` of the source in MapLibre GL JS.

## The state of a feature

The `MapInstance` of `@map-jr/map-jr-gl` has two methods for the state of a feature, which `feature-state` expressions
in the style read (for example the highlight of a selected feature):

| Method | What it does |
|---|---|
| `setFeatureState(target, state)` | Merges the object `state` into the state of the feature. |
| `removeFeatureState(target, key?)` | Removes the key `key` of the state of the feature, its whole state without `key`, or the state of all features of the source when `target` has no `id`. |

`target` is `{source, sourceLayer, id}`. `id` is the `id` of the feature, as `queryFeatures` gives it, and
`sourceLayer` is required for a vector source. A vector source needs the numeric id of the feature in the tile; a
GeoJSON source takes the `id` of the feature or the property of `promoteId`, and each can be a number or a string. An `id` of the
feature that is a string of decimal digits and a safe integer (`'12'`) becomes the number (`12`), so `setFeatureState` takes `12`
for it; a property of `promoteId` stays as it is. `queryFeatures` gives the state of each
drawn feature in `state`. The methods have no effect after `destroy()`.

```js
import {createMap} from '@map-jr/map-jr-gl';

let selected;
const map = createMap(document.getElementById('map'), {
    style: 'https://demotiles.maplibre.org/style.json',
    sources: {points: {type: 'geojson', generateId: true, data: 'https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson'}},
    layers: [{id: 'points', type: 'circle', source: 'points',
        paint: {'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#e00', '#28f']}}],
    interactiveLayers: ['points'],
    onClick: e => {
        const feature = e.features[0];
        if (selected !== undefined) map.removeFeatureState({source: 'points', id: selected}, 'selected');
        selected = feature?.id;
        if (selected !== undefined) map.setFeatureState({source: 'points', id: selected}, {selected: true});
    },
});
```

The map keeps the state until it is removed, also when `update` gives a new `style`: a source of the new style with
the same id draws the state that was set for the old one (`test/host.mjs` checks this with a GeoJSON source of
`sources`). The state is not part
of the description, so `update` does not change it.

## Elements of the page on the map

```js
// A marker with your own content:
const el = document.createElement('img');
el.src = '/pin.svg';
const marker = map.overlay(el, {lngLat: [-74.0065, 40.7085], anchor: 'bottom'});

marker.update({lngLat: [-74.0, 40.71], anchor: 'bottom'}); // moves it
marker.remove();

// A popup: the element in a box with a pointer to the position.
const popup = map.overlay(content, {lngLat, popup: true, onClose: () => popup.remove()});
```

`overlay` puts an element of the page at a position of the map. The element moves with the map.

| Option | Meaning |
|---|---|
| `lngLat` | The position. Required. |
| `anchor` | The part of the element that is at the position: `'center'` (the default), `'bottom'`, `'top-left'` and others. |
| `offset` | A distance in pixels from the position, to the right and down. |
| `popup` | `true` to show the element in a box with a pointer to the position. |
| `onClose` | For a popup: the box gets a button to close it, and this function is called. The Escape key does the same while the keyboard focus is inside the popup. A popup without `onClose` does not react to the key. |
| `draggable` | `true` to let the user move the element with the mouse, a finger or a pen. The default is `false`. It has no effect on a popup. |
| `onDragStart`, `onDrag`, `onDragEnd` | For a draggable element: called when a drag starts, at each move, and when it ends, with the position of the element as `[lng, lat]`. |

A popup of `overlay()` does not take the keyboard focus when it opens, and it stays open when the map moves. The popup of `@map-jr/map-jr-gl/maplibre-compat` has the options `focusAfterOpen`, `closeOnMove` and `trackPointer` for that.

A drag starts once the pointer has moved 3 pixels, as in MapLibre GL JS. A click without that move stays a click
and calls no drag callback, and the click at the end of a drag does not reach the element. The map does not pan
under a drag of the element. In other cases, the pointer events of an overlay reach the page as usual, but the map
listens on its canvas only, so a press on an overlay does not pan the map.

After a drag, the element stays where the user dropped it. `update` moves it only when `lngLat` differs from the
`lngLat` of the last call, so pass the new position to `lngLat` in `onDragEnd` when your code keeps the position:

```js
import {defaultPin} from '@map-jr/map-jr-gl';

let home = [-74.0065, 40.7085];
const pin = map.overlay(defaultPin({color: '#c0392b'}), {
  lngLat: home, anchor: 'bottom', draggable: true,
  onDragEnd: lngLat => { home = lngLat; },
});
```

`defaultPin({color, scale})` makes the default pin of `Marker` of `@map-jr/map-jr-gl/maplibre-compat`: a new `div`
with an SVG drop of 27 by 41 pixels at `scale` 1 (the default), filled with `color` (the default is `'#3fb1ce'`). Its
tip is at the bottom, so use it with `anchor: 'bottom'`. It needs `document`, so call it in the browser, not during a
render on the server.

Use an overlay for some elements with content of the page (a photo, a form, a popup). For many markers, use a
symbol layer with an image: it is drawn on the canvas, and 100,000 markers cost about the same as ten. See
[Markers](markers.md).

## Other members of the map

| Member | Meaning |
|---|---|
| `update(description)` | Changes the map to a new description. Takes the complete description. See [Change the map](#change-the-map). |
| `patch(part)` | Changes only the fields of `part`; a field that is `undefined` is removed. See [Change the map](#change-the-map). |
| `description` | The description of the last `createMap`, `update` or `patch` (read only). |
| `destroy()` | Removes the map and frees its memory. It also removes the elements of `overlay()` from the page at once, without the closing animation of a popup, and it does not call `onClose`. It can be called while the map loads. Call it before you make another map in the same element: a second map in an element that has a map leaves two canvases in the element, and the library warns in the console. |
| `moveTo(target)` | Moves the camera now to a view or to `bounds` (with `padding` and `maxZoom` for the fit), with `bearing`, `pitch`, `duration` (milliseconds) and `fly`. It does not change the padding of the map. See [The camera](#the-camera). |
| `fitBounds(bounds, options)` | The short form of `moveTo({bounds, ...options})`: the options are those of `moveTo` other than `center` and `zoom`, and `duration` is 800 ms by default. |
| `queryFeatures(at, options)`, `watchFeatures(at, options, listener)` | Find the features that the style layers draw, one time or kept up to date. See [Queries](#queries). |
| `querySource(sourceId, at, options)`, `watchSource(sourceId, at, options, listener)` | Find the features of the tile data of one source, one time or kept up to date. See [Queries](#queries). |
| `queryElevation(at)` | The height of the ground in metres at a position (`[lng, lat]`) or a point of the screen (`{x, y}`), from the elevation source of the style. A promise; `null` where there is no data. |
| `toBlob(type, quality)` | The map as an image, for a download or for printing. It waits until the map is idle, draws one frame and resolves to a `Blob` of the canvas. `type` defaults to `'image/png'`; `quality` (0 to 1) applies to `'image/jpeg'` and `'image/webp'`. It works with both renderers. The image has the size of the canvas in device pixels (CSS size times `devicePixelRatio`) and does not contain markers, popups, controls or the attribution, because those are elements of the page. The promise rejects when the map is destroyed first. Example: `const url = URL.createObjectURL(await map.toBlob())`. To print, put that URL in an `<img>`: the canvas itself may print blank. |
| `project(lngLat)`, `unproject(point)` | Change between a position on the map and a point of the screen. |
| `listen(type, fn)` | Calls `fn` for each event of that type. Returns a function that stops it. See [Events](#events). |
| `once(type)` | A promise of the next event of that type. See [Events](#events). |
| `container` | The element of the map. |

Members whose names start with `_` are private. They are not in the type `MapInstance`, and they can change in each release.

## Events

`map.listen(type, fn)` calls `fn` for each event of that type and returns a function that stops it. The state
(`map.state`) and the callbacks of the description (`onClick`, `onViewChange`, `onError`) cover the common needs;
use `listen` for the rest.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {style: 'https://demotiles.maplibre.org/style.json'});
const stop = map.listen('moveend', event => console.log(map.state.get().view.zoom));
stop();
```

`map.once(type)` returns a promise that resolves with the next event of that type, and stops listening after it.
In TypeScript, the result has the type of that event.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {style: 'https://demotiles.maplibre.org/style.json'});
await map.once('idle');
```

- When the map is destroyed before the event comes, the promise rejects with
  `[map-jr-gl] once("idle"): the map was removed.` A call after `destroy()` rejects in the same way.
- `load` comes one time. `once('load')` on a map that has loaded resolves at once, with an event that has only
  `type` and `target`, so code that waits for `load` does not need to read `state.loaded` first.

A listener that throws does not stop the other listeners of the event. The map reports what it threw as an
`error` event (`onError` of the description gets it, or the console when there is no `onError`). What a listener
of `error` throws is written to the console.

Each event has `type` (the name of the event) and `target` (the `MapInstance` that `createMap` returned). The table
has the other members. A position in an event is `[lng, lat]` and a box is `[[west, south], [east, north]]`, as in
`onClick` and `state.view`. (The core map, the `map` member above, and `@map-jr/map-jr-gl/maplibre-compat` keep the
objects of MapLibre GL JS.) In TypeScript, the type `MapEvents` has the event of each name, so the parameter of `fn`
has the right type, and a name that is not in the table does not compile.

| Type | When | Other members of the event |
|---|---|---|
| `load` | The style and the first tiles have loaded. It comes once, before the first `idle`. | |
| `idle` | Nothing moves and nothing loads. A tile of the view whose request fails is requested again after 0.5 s, 1 s and 2 s, and `idle` waits for these requests; after the fourth failure the map is idle without the tile. Each failure gives an `error` event. | |
| `render` | The map has drawn a frame. | |
| `resize` | The size of the map has changed. | |
| `remove` | The map is removed. | |
| `movestart`, `move`, `moveend` | The view changes. | |
| `zoomstart`, `zoom`, `zoomend` | The zoom changes. | |
| `rotatestart`, `rotate`, `rotateend` | The bearing changes. | |
| `pitchstart`, `pitch`, `pitchend` | The pitch changes. | |
| `dragstart`, `drag`, `dragend` | The user starts to drag the map, drags it, and stops. | `originalEvent` (a `MouseEvent` or a `TouchEvent`). |
| `click`, `dblclick`, `contextmenu`, `mousedown`, `mousemove`, `mouseup`, `mouseover`, `mouseout` | An event of the mouse on the map. | `point` (`{x, y}` in CSS pixels), `lngLat` (`[lng, lat]`), `originalEvent`, `preventDefault()`, `defaultPrevented`. A listener that calls `preventDefault()` stops what the map does for the event (a drag, a zoom). |
| `wheel` | The user turns the wheel over the map. | The same as for the mouse; `originalEvent` is a `WheelEvent`. |
| `touchstart`, `touchmove`, `touchend`, `touchcancel` | An event of a touch on the map. | The same as for the mouse, and `points` and `lngLats` (a list of `[lng, lat]`): one entry for each finger on the map. |
| `boxzoomstart`, `boxzoomend`, `boxzoomcancel` | A zoom to a box (the Shift key and a drag). | `originalEvent`. `boxzoomend` also has `boxZoomBounds` (`[[west, south], [east, north]]`). |
| `styledata`, `style.load` | The style has changed; a complete style has loaded. | `styledata` has `dataType: 'style'`. |
| `sourcedata` | A source has new data. | `dataType: 'source'`, `sourceId`, `isSourceLoaded`, `source`. |
| `data` | Each time that `styledata` or `sourcedata` fires. | The members of that event. |
| `styledataloading`, `sourcedataloading`, `dataloading` | A style or a source starts to load. | `dataType`, and `sourceId` for a source. |
| `styleimagemissing` | The style names an image that the map does not have. | `id`. |
| `terrain` | The terrain has changed. | `terrain`: `{source, exaggeration}` or `null`. |
| `projectiontransition` | The projection has been put in place: by each new style, and when its name changes (`projection` in the description, the control `globe`). | `newProjection`: `'mercator'`, `'globe'` or `'vertical-perspective'` (an expression gives `'globe'`, and a name that the library does not know gives `'mercator'`, as in MapLibre GL JS). |
| `stats` | At most one time each second while the map draws. | `fps` (frames per second), `frameMs` (the CPU time of a frame in milliseconds), `labels` (the number of labels and icons that the last frame placed among the labels; icons that are drawn from buffers are not counted, see [Markers](markers.md#which-icons-are-fast)). |
| `geolocate` | The geolocate control has a position. | `coords`. |
| `webglcontextlost`, `webglcontextrestored` | The browser has taken the WebGL context away, or the map has it again. The map starts again on a new canvas with the same view and data. A map with the worker renderer starts again on the main thread and writes one warning when the worker loses the context before its first frame, loses it twice within 10 seconds, or does not draw in the 5 seconds after its start or a restart (it reports no first frame, or stops drawing after it). A worker that does not draw in that time also fires `webglcontextlost` first. When the main thread then loses the context again before its first frame, or does not draw in the 15 seconds after the restart, the map fires `error` and does not start again. The time that the page is hidden, or that the map has no size, does not count. | |
| `error` | An error of the map. `onError` has the same errors as an `Error`. | `error`. |

## Custom protocols

`addProtocol(name, fn)` of `@map-jr/map-jr-gl` makes every map of the page load each URL that starts with `name://`
through `fn`. It has the arguments of `addProtocol` of
MapLibre GL JS. `fn` gets `{url, type, headers}` and an `AbortController`, and returns a promise of `{data}`. The
`url` is the URL as the style or the TileJSON has it, also when it has another URL inside
(`cog://https://example.com/a.tif`). The map calls `abort()` of that controller when the map is removed, and when a newer `setData` of a GeoJSON source replaces the request (also the request of `updateData` whose diffs that `setData` drops). A tile request that is no longer needed is not aborted. After an abort, the map ignores the answer of `fn`. The
data can be an `ArrayBuffer`, a typed array, a string or an object (which the map turns into JSON).

| Request | `type` | `data` that `fn` can return |
|---|---|---|
| A tile of a `raster` or `raster-dem` source | `image`, and `headers.accept` is `image/webp,*/*` | The bytes of an image file (an `ArrayBuffer` or a typed array), an `ImageBitmap` or an `HTMLImageElement`. The map copies the image, so `fn` can keep it. |
| A tile of a `vector` source, an image of `addImage`, the image of a sprite | `arrayBuffer` | The bytes of the file. |
| Every other request (a style, a TileJSON, GeoJSON data, the JSON of a sprite, glyphs) | `json` | An object, a string or bytes. |

`removeProtocol(name)` removes it. The protocols are the same for every map of the page, and a map that exists
already uses a protocol added later.

```js
import {addProtocol, createMap} from '@map-jr/map-jr-gl';

addProtocol('local', async ({url}, abort) => {
  const response = await fetch(url.replace('local://', 'https://demotiles.maplibre.org/'), {signal: abort.signal});
  return {data: await response.arrayBuffer()};
});
const map = createMap('map', {style: 'local://style.json'});
```

## Other exports

| Export of `@map-jr/map-jr-gl` | Meaning |
|---|---|
| `configure(options)` | Sets how the library loads its workers (`workerUrl`, `createWorker`, `tileWorkers` and the others) for the maps made after the call. See [Loading](loading.md). |
| `points(records, options)` | Makes a GeoJSON `FeatureCollection` of points from records. See [Points from records](#points-from-records). |
| `createStore(value)` | Makes a store of the kind that `map.state` is (see [The state](#the-state)), with `get()`, `subscribe()` and `set(part)`. `set` makes a new object and calls the subscribers only when a field changes (compared with `Object.is`). |

## Types

The entry `@map-jr/map-jr-gl` has TypeScript types for the description (`MapDescription`), the map (`MapInstance`), the state
(`MapState`), the events (`MapEvents`) and the features (`RenderedFeature`, `QueriedFeature`).

- A position that you give (`center`, `lngLat`, the argument of `project`) has the type `Position`, which is
  `readonly number[]`. So an array that is declared apart from the call compiles without `as const`:
  `const NYC = [-74.0065, 40.7085]; createMap(el, {style, initialView: {center: NYC}})`. The map reads the first two
  numbers as `[lng, lat]`. A position that the map gives (`state.view.center`, the result of `unproject`, `lngLat`
  in `onClick` and in the events of `listen`) is `[number, number]`.
- A box that you give (`maxBounds`, `fitBounds`, `initialView.bounds`, `bounds` of `moveTo`) has the type `Bounds`:
  `[[west, south], [east, north]]` or `[west, south, east, north]`, with `readonly` arrays as `Position` has them.
  The map still reads `LngLat` and `LngLatBounds` objects and `{lng, lat}` corners at run time, but they do not
  compile.
- The types that the signatures use are exported: `Bounds`, `MoveToOptions` and `FlyOptions` (`moveTo`) and `Anchor`
  (`OverlayOptions.anchor`). `LngLatBoundsInput`, `LngLatBounds` (only the type, not the class) and `LngLatInput` are
  still exported, but no member of the main API uses them.
- The description uses the style types of this entry. `style` is a URL or a `StyleSpecification`. `sources` is a
  record of `SourceSpecification`. A layer of `layers` has the type `LayerInput`: a layer of one of the types that
  the library draws (`FillLayerSpecification` and the others) with `before`, so a layer with an unknown `type`, or a
  `paint` name of another layer type, does not compile. `data` takes `GeoJSON` (a feature collection, a feature or a
  geometry; the types of `@types/geojson` fit) or a URL. `filter` of `FeatureOptions` and `SourceOptions` is a
  `FilterSpecification`.
- TypeScript widens the literals of a value that is declared apart from its use. A style read from a JSON file
  (`version: number`), a layer in a variable without a type (`type: string`), a filter in a variable
  (`string[]`) and a value of the type `object` do not compile. Give the variable its type
  (`const layer: FillLayerSpecification = …`, `const style = json as StyleSpecification`).
- A feature of `state.hover` and of `onClick` has `layer`, the style layer that draws it, with the type `StyleLayer`
  (`id`, `type`, `source`, `paint` and the other members of a layer of the style). `queryFeatures` returns
  `RenderedFeature[]`, and `querySource` returns `QueriedFeature[]`: a `QueriedFeature` has no style layer.
- A style that you build in code can use the style types of this entry: `StyleSpecification`,
  `SourceSpecification`, `LayerSpecification`, one type for each kind of layer (`FillLayerSpecification`,
  `LineLayerSpecification`, `SymbolLayerSpecification` and the others, with the names of MapLibre GL JS),
  `ExpressionSpecification` and `FilterSpecification`. They need neither `maplibre-gl` nor
  `@maplibre/maplibre-gl-style-spec`. `LayerSpecification` checks the structure of a layer, but not its `type` or
  the names and values of `paint` and `layout`. A type of one kind of layer checks `type` and the prefix of each
  name in `paint` and `layout`, but not the rest of the name or the values.

## What is not in this entry yet

- The features under the pointer are found with one query for each pointer position, from the page. Later the
  engine will find them itself.
