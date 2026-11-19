# The description

The description (`MapDescription`) is the object that says what a map of `@map-jr/map-jr-gl` shows. `createMap` takes
it, and `update` and `patch` take it again to change the map: see [Change the map](../api.md#change-the-map).

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

These rules hold for every field:

- A field that a later description leaves out goes back to its default. `patch` keeps the fields that it is not
  given.
- A name that is not in the tables below has no effect.
- The development build writes one warning to the console for each mistake that this page names. The production
  build does not check.

## `MapDescription`

<!-- ref:MapDescription:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`style`](#style) **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: the URL of a style, a style object, or one style for each colour scheme. |
| [`sources`](#sources) | `Record<string, SourceSpecification>` | | Sources to add to the sources of the style, by id. |
| [`layers`](#layers) | `LayerInput[]` | | Layers to add to the layers of the style. |
| [`terrain`](#terrain) | `TerrainSpecification \| null` | | 3D terrain from an elevation source, in place of the terrain of the style. |
| [`fonts`](#fonts) | `FontFaces` | | Web fonts for the labels, by `text-font` name. |
| [`initialView`](#initialview) | `InitialView` | | The view at the start: a centre and a zoom, or bounds to fit. |
| [`view`](#view-and-onviewchange) | `ViewInput` | | A view that the application owns. |
| [`onViewChange`](#view-and-onviewchange) | `(view: View) => void` | | Called with the new view each time that the view changes. |
| [`data`](#data) | `Record<string, GeoJSON \| string>` | | GeoJSON data for GeoJSON sources, by the id of the source. |
| [`images`](#images) | `Record<string, ImageInput>` | | Images for `icon-image` and the pattern properties of the style layers, by name. |
| [`sprite`](#sprite) | `{id: string; url: string}[]` | | Sprites to add to the sprite of the style. |
| [`controls`](#controls) | `ControlSpec[]` | | The controls of the map, from the functions of `@map-jr/map-jr-gl/controls`. |
| [`projection`](#projection) | `ProjectionSpecification \| null` | | The projection, in place of the projection of the style. |
| [`globalState`](#globalstate) | `Record<string, unknown>` | | Values for the `global-state` expressions of the style, by name. |
| [`interactiveLayers`](#interactivelayers) | `string[]` | | The ids of the style layers whose features `state.hover` and `onClick` report. |
| [`hoverState`](#hoverstate) | `boolean` | `false` | `true` gives the top feature under the pointer the feature state `hover: true`. |
| [`onClick`](#onclick) | `(event: MapPointer) => void` | | Called for a click on the map. |
| `onError` | `(error: Error) => void` | | Called for each error of the map. Without it, the map writes each error to the console. |
| `minZoom` | `number` | `-2` | The lowest zoom that the camera reaches. |
| `maxZoom` | `number` | `22` | The highest zoom that the camera reaches. |
| `maxPitch` | `number` | `60` | The largest pitch that the camera reaches, in degrees. A value above 90 gives 90 and one warning. |
| [`maxBounds`](#maxbounds) | `Bounds \| null` | | The box that the view stays inside. |
| `cursor` | `string` | | The CSS cursor over the map. Without it, the cursor is `pointer` over a feature of `interactiveLayers`. |
| [`cooperativeGestures`](#cooperativegestures) | `boolean` | `false` | `true` makes the wheel zoom the map only with Ctrl (⌘ on a Mac), and lets one finger scroll the page. |
| [`colorScheme`](#colorscheme-and-oncolorschemechange) | `'auto' \| 'light' \| 'dark'` | `'light'` | The colour scheme of the controls, the popup and the attribution. |
| [`onColorSchemeChange`](#colorscheme-and-oncolorschemechange) | `(colorScheme: 'auto' \| 'light' \| 'dark') => void` | | Called with the new value when the control `colorScheme()` changes the colour scheme. |
| [`locale`](#locale) | `Record<string, string>` | | The texts of the controls and of the other elements that the map adds, by the keys of MapLibre GL JS. |
| [`padding`](#padding) | `PaddingInput` | `0` | Space in CSS pixels at the sides of the map that the view keeps free. |
| [`transformRequest`](#transformrequest) | `RequestTransform \| null` | | Changes a request before the map makes it. |
<!-- ref:MapDescription:end -->

## `MapSetup`

`MapDescription` extends `MapSetup`, so these fields are written in the same object. The map reads them only when it
is made. A change of one of them in `update` or `patch` has no effect: destroy the map and make a new one.

<!-- ref:MapSetup:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`renderer`](#renderer) | `'auto' \| 'worker' \| 'main'` | `'auto'` | The thread that draws the map. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for text that has no glyph file and no web font, after the names of `text-font`. |
| `interactive` | `boolean` | `true` | `false` makes a map that the user cannot move. `onClick` and `state.hover` still work. |
| `antialias` | `boolean` | `false` | `true` turns on multisample antialiasing for the canvas. |
| [`attribution`](#attribution) | `false \| {compact?: boolean; customAttribution?: string \| string[]}` | | Options for the attribution, or `false` for a map without it. |
| [`hash`](#hash) | `boolean \| string` | `false` | Keeps the view in the fragment of the URL of the page. |
| `nonce` | `string` | | The nonce of a [Content Security Policy](../loading.md#content-security-policy) with `style-src 'nonce-…'`. |
<!-- ref:MapSetup:end -->

## `style`

`style` takes one of three forms. A description with no `style` throws an error in `createMap`, `update` and `patch`.

| Form | What the map does |
|---|---|
| A string | Requests the style from that URL. |
| A style object of the MapLibre style specification | Draws it. |
| `{light, dark}`, each a URL or a style object | Draws the style of the resolved [`colorScheme`](#colorscheme-and-oncolorschemechange), and loads the other one when the scheme changes. |

```js
createMap('map', {
  style: {light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark'},
  colorScheme: 'auto',
});
```

A new URL or a new object loads that style: the map draws from the start, and the view and the other fields of the
description stay. Two cases load nothing:

- An object or a pair with the same content as the last one is the same style.
- An object that differs from the last one only in its `layers` changes the layers in place, by the rule of
  [`layers`](#layers).

An object that is neither a style nor a pair is an error of the map (`onError`), and the map draws nothing. A pair
with only one of `light` and `dark` uses that style in both schemes and warns.

## `sources`

A source of `sources` replaces the source of the style that has the same id. The map adds the sources when the style
has loaded, so they work with a style from a URL. [`layers`](#layers) has an example.

`update` adds a source with a new id and removes a source that the description leaves out, in place. A source whose
content changes, and a source with the id of a source of the style, load the style again. To change the features of
a GeoJSON source, use [`data`](#data).

## `layers`

A layer of `layers` is a layer of the style specification with one more member, `before`: the id of the layer of
the style that it goes below. A layer without `before` goes on top. The layers do not replace layers of the style.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  sources: {routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
  layers: [{id: 'routes', type: 'line', source: 'routes', before: 'water_name_line', paint: {'line-color': '#d6453d', 'line-width': 3}}],
});
```

| A change in `update` | What the map does |
|---|---|
| `paint`, `layout`, `filter`, `minzoom`, `maxzoom` or `before` of a layer | Changes the layer in place. |
| A new layer, a removed layer, another order | Changes the layers in place. |
| `type`, `source`, `source-layer` or another member of a layer | Loads the style again. |

A new paint value moves from the old value to the new one: see
[Paint transitions](../api.md#paint-transitions).

Mistakes that warn: a `before` that is not the id of a layer of the style (the layer goes on top), and a `source`
that is not in the style, in `sources` or in `data`.

## `terrain`

| Value | The map draws |
|---|---|
| `{source, exaggeration}` | 3D terrain from that `raster-dem` source of the style or of `sources`. `exaggeration` is 1 by default. |
| `null` | A flat map, also when the style has a `terrain`. |
| No field, or `undefined` | The terrain of the style. |

A change of `terrain` loads the style again. See [Terrain and elevation](../terrain-and-elevation.md).

## `fonts`

`fonts` has the shape of `font-faces` of the style specification: for each `text-font` name, the URL of a font file
or a list of `{url, 'unicode-range'}`.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  fonts: {
    'Noto Sans Regular': 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-400-normal.woff2',
    'Noto Sans Bold': [{
      url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-700-normal.woff2',
      'unicode-range': ['U+0000-00FF'],
    }],
  },
});
```

- When the style has `glyphs`, the labels use the glyph files, and a web font draws only the text that the files do
  not have. A style without `glyphs` draws all text with the web fonts and the fonts of the browser.
- A name gives the CSS family, the weight and the style of its font. The map takes words such as `Bold`, `Semibold`,
  `Light` and `Italic` out of the name, and the rest is the family: `Open Sans Semibold Italic` is the family
  `Open Sans` at weight 600 in italic.
- A name of `fonts` replaces the same name in the `font-faces` of the style. A relative URL is relative to the page.
- A font file that does not load is an error of the map (`onError`). The labels then use the next name of their
  `text-font`, then `fontFamily`.
- A name that leaves `fonts` keeps its font until the page is loaded again. To replace a font, give another URL for
  the same name.

## `initialView`

`initialView` (`InitialView`) places the camera once, when the map is made. The user then moves the map. A change of
it in `update` has no effect and warns: change [`view`](#view-and-onviewchange) or call `moveTo`.

| Name | Type | Default | Description |
|---|---|---|---|
| `center` | `Position` | `[0, 0]` | The centre as `[lng, lat]`. |
| `zoom` | `number` | `0` | The zoom. |
| `bearing` | `number` | `0` | The bearing in degrees. |
| `pitch` | `number` | `0` | The pitch in degrees. |
| `bounds` | `Bounds` | | A box to fit into the map, in place of `center` and `zoom`: `[[west, south], [east, north]]` or `[west, south, east, north]`. |
| `padding` | `PaddingInput` | `0` | Space around `bounds` in CSS pixels: a number, or `{top, right, bottom, left}`. |
| `maxZoom` | `number` | `maxZoom` of the description | The highest zoom of the fit to `bounds`. |

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {bounds: [[-74.05, 40.68], [-73.9, 40.82]], padding: 40},
});
```

Two other fields come before `initialView`. With `view` in the description, the map starts at `view`, and `bounds`
has no effect. With [`hash`](#hash), a view in the URL of the page comes first.

## `view` and `onViewChange`

With `view`, the application owns the view: it stores each view that `onViewChange` reports and gives it back, and it
moves the map by giving another view.

```js
let view = {center: [-74.0065, 40.7085], zoom: 13.6};
const describe = () => ({
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  view,
  onViewChange: next => { view = next; map.update(describe()); },
});
const map = createMap('map', describe());

// Move the map: change the view.
view = {...view, zoom: 15};
map.update(describe());
```

`view` (`ViewInput`) has `center`, `zoom`, `bearing` and `pitch`, each optional. The map jumps to it with no
animation. `onViewChange` gets a `View`: the same four members and `bounds`, the smallest box
`[[west, south], [east, north]]` that contains the visible map.

The map does not wait for the application, so a view that the map reported does not move the map when it comes back.
This holds for the last 60 views that the map reported. To go back to a view that the application stored a moment
ago, call `map.moveTo(stored)`, which always moves the map.

## `data`

Each key of `data` is the id of a GeoJSON source, and its value is the GeoJSON for that source or the URL of a
GeoJSON file. A key that is not the id of a source of the style or of `sources` makes a GeoJSON source with that id
and the default options.

```js
const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const layers = [{id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#d6453d', 'line-width': 3}}];
const route = to => ({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-74.01, 40.70], to]}});

const map = createMap('map', {style, layers, data: {routes: route([-73.97, 40.75])}});

// Other data: a new object for the key.
map.update({style, layers, data: {routes: route([-73.95, 40.78])}});
```

- The map compares the value of a key by identity. Give a new object to change the data: a change inside the old
  object has no effect.
- A change of `data` alone sends only the data to the map, and the data stays when the style changes.
- A source that needs options (`cluster`, `promoteId`, `attribution`) is written in `sources` or in the style with
  no features, and `data` gives it the features.
- A key that leaves `data` removes the source that the key made. A layer that still names the source draws nothing
  and warns.
- A key that is the id of a source of another type, such as a vector source, is an error of the map (`onError`), and
  the data has no effect.

## `images`

A symbol layer names an image of `images` in `icon-image`. An image here is used in place of an image of the sprite
that has the same name.

```js
const pin = '<svg viewBox="0 0 24 31"><path fill="#d6453d" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  images: {pin},
  data: {places: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}}],
});
```

A value (`ImageInput`) is one of these:

| Value | The image |
|---|---|
| A string that starts with `<` | An SVG document, drawn at the pixel density of the screen. Its size in CSS pixels is that of its `viewBox`, or else of its `width` and `height` attributes. |
| Another string | The image at that URL. The server of the image must permit the request (CORS). |
| An `ImageBitmap`, a canvas, an image element or `ImageData` | The pixels of the object. |
| `{image, width, height, pixelRatio}` | One of the values above as `image`, with its size in CSS pixels. The object also takes the options of `addImage` of MapLibre GL JS for an icon that fits text. |

An SVG document with slots (`{{name}}`) is a template: each feature fills the slots from its properties. See
[An image that is a template](../api.md#an-image-that-is-a-template) for the parameters and the limits.

The map compares a string by its content and any other value by identity, so give a new object to replace a bitmap.
An image that does not load is an error of the map (`onError`) with the name of the image, and the layer is drawn
without it.

## `sprite`

`sprite` has the list form of `sprite` in the style specification. An `icon-image` names an image of such a sprite as
`id:name`.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  sprite: [{id: 'maki', url: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite'}],
  data: {places: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'maki:circle_11'}}],
});
```

- The URL has no extension: the map requests `url + '.json'` and `url + '.png'`, with `@2x` before the extension on
  a screen with a pixel ratio above 1. A relative URL is relative to the page.
- A sprite here replaces the sprite of the style with the same id. The id `default` replaces the sprite of a style
  whose `sprite` is one URL.
- A sprite that does not load is an error of the map (`onError`) with its URL, and the map draws the images of the
  other sprites.
- A change of `sprite` loads the style again.
- A value that is not a list of `{id, url}` warns.

## `controls`

Each function of `@map-jr/map-jr-gl/controls` returns the description of a control (`ControlSpec`). The map adds the
controls of the list, and removes a control when a later description does not have it.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  controls: [navigation(), scale({position: 'bottom-left'})],
});
```

[Controls](../api.md#controls) lists the functions and their options.

## `projection`

| Value | The map draws |
|---|---|
| `{type: 'mercator'}` | The flat map. |
| `{type: 'globe'}` | A globe, which turns into the flat map between zoom 11 and 12, as in MapLibre GL JS. |
| `{type: 'vertical-perspective'}` | A globe at every zoom. |
| `null`, or no field | The projection of the style. |

A change in `update` switches the projection and loads no style.

On a globe:

- The map does not draw 3D terrain and `fill-extrusion` layers. It writes one warning, and they show past zoom 12.
- `maxBounds` has no effect.
- A move to a new centre with no `zoom` keeps the size of the globe on the screen, so `state.view.zoom` changes with
  the latitude. A `zoom` that is given is used as it is.

## `globalState`

A value of `globalState` is used in place of the default of the same name in `state` of the style. A layer reads it
with `['global-state', name]`.

```js
const map = createMap('map', {
  style: {
    version: 8,
    state: {season: {default: 'summer'}},
    sources: {},
    layers: [{id: 'background', type: 'background', paint: {'background-color': ['match', ['global-state', 'season'], 'winter', '#eef3f7', '#dfe8d5']}}],
  },
  globalState: {season: 'winter'},
});
```

- A name that a later description leaves out, or gives `null`, goes back to the default of the style.
- A change repaints the layers that read the name, and loads no style. A new style gets the values of the
  description.
- A value is JSON: a string, a number, a boolean, an array or a plain object. Another value, such as a function or
  `NaN`, warns.
- The map sets the name `color-scheme` itself (see [`colorScheme`](#colorscheme-and-oncolorschemechange)). A value
  for that name here comes first.

## `interactiveLayers`

The features of these layers under the pointer are in `state.hover`, and those under a click are in `features` of
[`onClick`](#onclick), the top one first. The cursor is `pointer` over such a feature, unless the description has
`cursor`. An id that is not a layer of the style or of `layers` warns.

## `hoverState`

With `hoverState: true`, the top feature of `interactiveLayers` under the pointer has the feature state
`hover: true`, and loses it when the pointer leaves the feature or the map. A layer reads the state with
`feature-state`:

```js
const block = {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.009, 40.707], [-74.004, 40.707], [-74.004, 40.71], [-74.009, 40.71], [-74.009, 40.707]]]}};

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 15},
  data: {blocks: block},
  layers: [{
    id: 'blocks', type: 'fill', source: 'blocks',
    paint: {'fill-color': '#2f7fd1', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.5]},
  }],
  interactiveLayers: ['blocks'],
  hoverState: true,
});
```

A feature needs an id. A feature with no id gets no state, and the map warns for its layer: give the features ids,
or set `promoteId` of the source, or `generateId: true` for a GeoJSON source.

## `onClick`

`onClick` gets one object (`MapPointer`) for each click on the map. A click on a control, or on an element that
`overlay` placed, does not call it.

| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The place of the click in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position of the click as `[lng, lat]`. |
| `features` | `RenderedFeature[]` | The features of [`interactiveLayers`](#interactivelayers) at the click, the top one first. It is empty when the description has no `interactiveLayers`. |

## `maxBounds`

`maxBounds` keeps the whole view inside a box: `[[west, south], [east, north]]` or `[west, south, east, north]`.
When the box is smaller than the view, the zoom rises until the box fills the view. A west edge east of the east
edge, such as `[[150, -50], [-120, 10]]`, gives a box that crosses the antimeridian. `null` or no field means no
limit. `maxBounds` has no effect on a globe.

## `cooperativeGestures`

For a map in a page that scrolls. With `true`, the wheel zooms the map only with Ctrl (⌘ on a Mac), one finger
scrolls the page, and two fingers move the map. A gesture that the map blocks shows a hint over the map, whose text
comes from [`locale`](#locale).

## `colorScheme` and `onColorSchemeChange`

| Value | The scheme |
|---|---|
| `'light'` | Light. |
| `'dark'` | Dark. |
| `'auto'` | That of the browser (`prefers-color-scheme`). It changes while the page is open. |

A value that is not one of these gives the light scheme and warns. The resolved scheme is `state.colorScheme`, and
it has these effects:

- The controls, the popup and the attribution have the colours of the scheme, and the container has the class
  `map-jr-dark` while the scheme is dark.
- The global state property `color-scheme` of the style is `'light'` or `'dark'`, so a style can read
  `['global-state', 'color-scheme']`. A value of that name in [`globalState`](#globalstate) comes first.
- A [`style`](#style) that is a pair `{light, dark}` draws the style of the scheme.

The control `colorScheme()` changes the map itself and then calls `onColorSchemeChange` with the new value. An
application that keeps the description in its state writes the value back there. Otherwise its next `update` has the
old value and changes the map back.

See [Dark mode](../api.md#dark-mode).

## `locale`

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  locale: {'NavigationControl.ZoomIn': 'Zoom avant', 'NavigationControl.ZoomOut': 'Zoom arrière'},
});
```

The keys are those of the option `locale` of MapLibre GL JS:
[The texts of the controls](../api.md#the-texts-of-the-controls) lists them. A key that is left out keeps the
English text, and the library ships no translations. `locale` does not change the language of the labels of the map.
A value that is not an object of strings warns.

## `padding`

`padding` is one number for all sides, or `{top, right, bottom, left}`, where a side that is left out is 0. The centre
of the view is the centre of the part of the map that stays free, for example beside a side panel. A change moves
the camera at once.

```js
map.patch({padding: {left: 320}});
```

It is not the `padding` of [`initialView`](#initialview) and of `moveTo`, which is space around `bounds` for one fit.

## `transformRequest`

The function gets the URL of a request and the kind of resource, and returns `{url, headers, credentials}`, or
`undefined` to leave the request as it is. It has the signature of `transformRequest` of MapLibre GL JS.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  transformRequest: (url, resourceType) =>
    resourceType === 'Tile' && url.startsWith('https://tiles.example.com/') ? {url, headers: {Authorization: 'Bearer ' + token}} : undefined,
});
```

The kinds are `Style`, `Source`, `Tile`, `Glyphs`, `SpriteJSON`, `SpriteImage`, `Image` and `Font`. The map always
calls the function of the last description, so a framework can pass a new function in each render at no cost.

## `renderer`

| Value | The map draws |
|---|---|
| `'auto'` | In a worker when the browser can draw there, and on the main thread otherwise. |
| `'worker'` | As `'auto'`, and the map warns once when it draws on the main thread instead. |
| `'main'` | On the main thread. |

`state.renderer` says which thread draws. See [Loading](../loading.md).

## `attribution`

Without this field, the map shows the attribution of its sources in the bottom right corner.

| Value | The attribution |
|---|---|
| `{compact: true}` | A button that opens and closes the text. |
| `{compact: false}` | The text, always. |
| No `compact` | Compact when the map is at most 640 CSS pixels wide. |
| `{customAttribution}` | The attribution of the sources and then this text, or each text of a list. |
| `false` | None. |

> **Note**
> Most sources require their attribution. With `attribution: false`, show it elsewhere on the page.

## `hash`

With `hash: true`, the fragment of the URL of the page has the view as `#zoom/lat/lng`, or
`#zoom/lat/lng/bearing/pitch` when the map is turned or pitched. The map writes it when a movement ends, and moves
when the fragment changes. A fragment with a view places the camera at the start, before
[`initialView`](#initialview).

A string gives the view a name, so that the fragment can hold other values: `hash: 'map'` writes
`#map=zoom/lat/lng`.

## See also

- [Change the map](../api.md#change-the-map) for `update`, `patch` and the builds that have the warnings.
- [Types](../api.md#types) for `Position`, `Bounds`, `LayerInput` and the style types.
- [Vue and Nuxt](../vue.md), [React](../react.md) and [Svelte](../svelte.md): the components take the fields of the
  description as props.
