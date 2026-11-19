# The description

The description (`MapDescription`) is one object that states everything that a map of `@map-jr/map-jr-gl` shows: the
style, the data, the view and the controls. To change the map, pass a new description to
[`update`](../api.md#change-the-map), and the map applies what is different.

```js
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

## `MapDescription`

<!-- ref:MapDescription:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`style`](#style) **required** | `string \| StyleSpecification \| {light: string \| StyleSpecification; dark: string \| StyleSpecification}` | | The style: the URL of a style, a style object, or one style for each colour scheme. |
| [`sources`](#sources) | `Record<string, SourceSpecification>` | | Sources to add to the sources of the style, by id. |
| [`layers`](#layers) | `LayerInput[]` | | Layers to add to the layers of the style. |
| [`terrain`](#terrain) | `TerrainSpecification \| null` | | 3D terrain from an elevation source. It overrides the terrain of the style. |
| [`fonts`](#fonts) | `FontFaces` | | Web fonts for the labels, by `text-font` name. |
| [`initialView`](#initialview) | `InitialView` | | The view when the map is created: a centre and a zoom, or bounds to fit. |
| [`view`](#view-and-onviewchange) | `ViewInput` | | The view of the map, controlled by the application. |
| [`onViewChange`](#view-and-onviewchange) | `(view: View) => void` | | Called with the new view each time that the view changes. |
| [`data`](#data) | `Record<string, GeoJSON \| string>` | | GeoJSON data for GeoJSON sources, by the id of the source. |
| [`images`](#images) | `Record<string, ImageInput>` | | Images for `icon-image` and the pattern properties of the style layers, by name. |
| [`sprite`](#sprite) | `{id: string; url: string}[]` | | Sprites to add to the sprite of the style. |
| [`controls`](#controls) | `ControlSpec[]` | | The controls of the map, from the functions of `@map-jr/map-jr-gl/controls`. |
| [`projection`](#projection) | `ProjectionSpecification \| null` | | The projection. It overrides the projection of the style. |
| [`globalState`](#globalstate) | `Record<string, unknown>` | | Values for the `global-state` expressions of the style, by name. |
| [`interactiveLayers`](#interactivelayers) | `string[]` | | The ids of the style layers whose features `state.hover` and `onClick` report. |
| [`hoverState`](#hoverstate) | `boolean` | `false` | `true` sets the feature state `hover: true` on the top feature under the pointer. |
| [`onClick`](#onclick) | `(event: MapPointer) => void` | | Called for a click on the map. |
| `onError` | `(error: Error) => void` | | Called for each error of the map. Without it, the map writes each error to the console. |
| `minZoom` | `number` | `-2` | The lowest zoom that the camera reaches. |
| `maxZoom` | `number` | `22` | The highest zoom that the camera reaches. |
| `maxPitch` | `number` | `60` | The largest pitch that the camera reaches, in degrees. The limit is 90. |
| [`maxBounds`](#maxbounds) | `Bounds \| null` | | The box that the view stays inside. |
| `cursor` | `string` | | The CSS cursor over the map. Without it, the cursor is `pointer` over a feature of `interactiveLayers`. |
| [`cooperativeGestures`](#cooperativegestures) | `boolean` | `false` | `true` requires Ctrl (⌘ on a Mac) for a zoom with the wheel, and lets one finger scroll the page. |
| [`colorScheme`](#colorscheme-and-oncolorschemechange) | `'auto' \| 'light' \| 'dark'` | `'light'` | The colour scheme of the controls, the popup and the attribution. |
| [`onColorSchemeChange`](#colorscheme-and-oncolorschemechange) | `(colorScheme: 'auto' \| 'light' \| 'dark') => void` | | Called with the new value when the control `colorScheme()` changes the colour scheme. |
| [`locale`](#locale) | `Record<string, string>` | | The texts of the controls and of the other elements that the map adds, by the keys of MapLibre GL JS. |
| [`padding`](#padding) | `PaddingInput` | `0` | Space in CSS pixels at the sides of the map that the view keeps free. |
| [`transformRequest`](#transformrequest) | `RequestTransform \| null` | | Changes a request before the map sends it. |
<!-- ref:MapDescription:end -->

## `MapSetup`

The map reads these fields only when it is created. To change one, destroy the map and create a new one.

<!-- ref:MapSetup:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| [`renderer`](#renderer) | `'auto' \| 'worker' \| 'main'` | `'auto'` | The thread that draws the map. |
| `fontFamily` | `string` | `'"Noto Sans", "Helvetica Neue", Arial, sans-serif'` | The CSS font family for text that has no glyph file and no web font, after the names of `text-font`. |
| `interactive` | `boolean` | `true` | `false` disables every gesture that moves the map. `onClick` and `state.hover` still work. |
| `antialias` | `boolean` | `false` | `true` turns on multisample antialiasing for the canvas. |
| [`attribution`](#attribution) | `false \| {compact?: boolean; customAttribution?: string \| string[]}` | | Options for the attribution, or `false` for a map without it. |
| [`hash`](#hash) | `boolean \| string` | `false` | Keeps the view in the fragment of the URL of the page. |
| `nonce` | `string` | | The nonce of a [Content Security Policy](../loading.md#content-security-policy) with `style-src 'nonce-…'`. |
<!-- ref:MapSetup:end -->

## `style`

| Form | What the map does |
|---|---|
| A string | Loads the style from that URL. |
| A style object of the MapLibre style specification | Draws it. |
| `{light, dark}`, each a URL or a style object | Draws the style that matches the resolved [`colorScheme`](#colorscheme-and-oncolorschemechange), and loads the other style when the scheme changes. |

```js
createMap('map', {
  style: {
    light: 'https://styles.map-jr.org/1/openfreemap-positron.json',
    dark: 'https://styles.map-jr.org/1/openfreemap-dark.json',
  },
  colorScheme: 'auto',
});
```

The map applies a changed `style` in place where it can. When only the layers of a style object changed, the map
updates those layers. For any other change, the map loads the new style and draws it from the start. The view and
the other fields of the description stay.

## `sources`

A source in `sources` overrides the source of the style that has the same id. See [`layers`](#layers) for an example
of a source with its layer.

To change the features of a GeoJSON source, set them in [`data`](#data). A changed source in `sources` loads the
style again.

## `layers`

`layers` adds layers to the style. It does not replace the layers of the style.

Each item is a layer of the MapLibre style specification, with one more optional member: `before`. `before` is the
id of a style layer, and the map inserts the new layer below that layer. Without `before`, the map adds the new
layer above all other layers.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  sources: {routes: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
  layers: [{id: 'routes', type: 'line', source: 'routes', before: 'water_name_line', paint: {'line-color': '#d6453d', 'line-width': 3}}],
});
```

The map applies a change of `layers` in place. A new paint value transitions from the old value: see
[Paint transitions](../api.md#paint-transitions). Only a new `type`, `source` or `source-layer` of a layer loads the
style again.

## `terrain`

| Value | The map draws |
|---|---|
| `{source, exaggeration}` | 3D terrain from the `raster-dem` source with the id `source`. It overrides the `terrain` of the style. `exaggeration` is 1 by default. |
| `null` | No 3D terrain. `null` overrides the `terrain` of the style. |
| `undefined`, or no field | The terrain of the style. |

A change of `terrain` loads the style again. See [Terrain and elevation](../terrain-and-elevation.md).

## `fonts`

`fonts` sets web fonts for the `text-font` names of the style.

```ts
type FontFaces = Record<string, string | {url: string; 'unicode-range'?: string[]}[]>;
```

- Each key is a `text-font` name of the style, such as `Noto Sans Bold`.
- A string is the URL of the font file for that name.
- A list has one item for each font file. `url` is the file, and `unicode-range` is the list of the character
  ranges that the file covers.

This is the type of `font-faces` in the MapLibre style specification.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/openfreemap-liberty.json',
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
- The map reads the weight and the style of a font from words such as `Bold`, `Semibold`, `Light` and `Italic` in
  its name. The rest of the name is the CSS family. So `Open Sans Semibold Italic` is the family `Open Sans` at
  weight 600 in italic.
- An entry in `fonts` overrides the entry with the same name in the `font-faces` of the style.
- A relative URL is resolved against the URL of the page.
- The map reports a font file that does not load to `onError`. The labels then use the next name in their
  `text-font`, and then `fontFamily`.

## `initialView`

`initialView` (`InitialView`) sets the camera once, when the map is created. After that, the user moves the map. To
move it from code, call `moveTo` or set [`view`](#view-and-onviewchange).

| Name | Type | Default | Description |
|---|---|---|---|
| `center` | `Position` | `[0, 0]` | The centre as `[lng, lat]`. |
| `zoom` | `number` | `0` | The zoom. |
| `bearing` | `number` | `0` | The bearing in degrees. |
| `pitch` | `number` | `0` | The pitch in degrees. |
| `bounds` | `Bounds` | | A box that the map fits into the view: `[[west, south], [east, north]]` or `[west, south, east, north]`. It overrides `center` and `zoom`. |
| `padding` | `PaddingInput` | `0` | Space around `bounds` in CSS pixels: a number, or `{top, right, bottom, left}`. |
| `maxZoom` | `number` | `maxZoom` of the description | The highest zoom of the fit to `bounds`. |

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {bounds: [[-74.05, 40.68], [-73.9, 40.82]], padding: 40},
});
```

Two other fields can override `initialView`:

- When the description also has [`view`](#view-and-onviewchange), each member of `view` overrides the same member of
  `initialView`, and the map ignores `bounds`.
- With [`hash`](#hash), a view in the URL of the page overrides `center`, `zoom`, `bearing` and `pitch`. It does not
  override `bounds`.

## `view` and `onViewChange`

When the description has `view`, the application controls the view. The application stores each view that
`onViewChange` reports and passes it back in the next description. To move the map, it passes a different view.

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

`view` (`ViewInput`) has `center`, `zoom`, `bearing` and `pitch`. Each is optional. The map applies a new `view`
with no animation. To animate the camera, call `map.moveTo({...view, duration: 500})` or
`map.moveTo({...view, fly: true})`.

`onViewChange` receives a `View`: the same four members and `bounds`. `bounds` is the smallest box
`[[west, south], [east, north]]` that contains the visible map.

The map ignores a `view` that it reported itself. So to return to a view that the application stored a moment ago,
call `map.moveTo(stored)`.

## `data`

Each key of `data` is the id of a GeoJSON source. Its value is the GeoJSON for that source, or the URL of a GeoJSON
file. When neither the style nor `sources` has a source with that id, the map creates one: `{type: 'geojson'}` with
no other option.

```js
const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const layers = [{id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#d6453d', 'line-width': 3}}];
const route = to => ({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-74.01, 40.70], to]}});

const map = createMap('map', {style, layers, data: {routes: route([-73.97, 40.75])}});

// Other data: a new object for the key.
map.update({style, layers, data: {routes: route([-73.95, 40.78])}});
```

- The map compares each value by identity. To change the data, pass a new object: a change inside the old object has
  no effect.
- To set options of the source (`cluster`, `promoteId`, `attribution`), declare the source in `sources` or in the
  style, with no features. `data` then sets its features.
- When a key is removed from `data`, the map removes the source that it created for that key. Remove the layers that
  use the source in the same description.

## `images`

A symbol layer refers to an image in `images` by its name, in `icon-image`. An image here overrides the image of the
sprite that has the same name.

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
| `{image, width, height, pixelRatio}` | One of the values above as `image`, with its size in CSS pixels. `stretchX`, `stretchY`, `content`, `textFitWidth` and `textFitHeight` work as in `addImage` of MapLibre GL JS. |

An SVG document with slots (`{{name}}`) is a template: each feature fills the slots from its properties. See
[An image that is a template](../api.md#an-image-that-is-a-template) for the parameters and the limits.

To replace a bitmap or a canvas, pass a new object. The map reports an image that does not load to `onError`, with
the name of the image, and draws the layer without it.

## `sprite`

`sprite` is a list of `{id, url}`, as the list form of `sprite` in the MapLibre style specification. An `icon-image`
refers to an image of such a sprite as `id:name`.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.006, 40.7128], zoom: 12},
  sprite: [{id: 'maki', url: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite'}],
  data: {places: {type: 'Point', coordinates: [-74.006, 40.7128]}},
  layers: [{id: 'places', type: 'symbol', source: 'places', layout: {'icon-image': 'maki:circle_11'}}],
});
```

- `url` has no file extension. The map requests `url + '.json'` and `url + '.png'`, and the `@2x` files on a screen
  with a pixel ratio above 1. A relative URL is resolved against the URL of the page.
- A sprite here overrides the sprite of the style that has the same id. The sprite of a style whose `sprite` is one
  URL has the id `default`.
- The map reports a sprite that does not load to `onError`, with its URL, and still draws the images of the other
  sprites.

## `controls`

`controls` is the list of the controls that the map shows. Create each item with a function of
`@map-jr/map-jr-gl/controls`.

```js
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, scale} from '@map-jr/map-jr-gl/controls';

createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  controls: [navigation(), scale({position: 'bottom-left'})],
});
```

See [Controls](../api.md#controls) for the functions and their options.

## `projection`

| Value | The map draws |
|---|---|
| `{type: 'mercator'}` | The flat map. |
| `{type: 'globe'}` | A globe, which turns into the flat map between zoom 11 and 12, as in MapLibre GL JS. |
| `{type: 'vertical-perspective'}` | A globe at every zoom. |
| `null`, or no field | The projection of the style. |

On a globe:

- The map does not draw 3D terrain and `fill-extrusion` layers. They show past zoom 12.
- `maxBounds` has no effect.
- A move to a new centre with no `zoom` keeps the size of the globe on the screen, so `state.view.zoom` changes with
  the latitude. A `zoom` that is passed is applied unchanged.

## `globalState`

A value in `globalState` overrides the default with the same name in `state` of the style. A layer reads the value
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

A value is JSON: a string, a number, a boolean, an array or a plain object. The map sets the name `color-scheme`
itself (see [`colorScheme`](#colorscheme-and-oncolorschemechange)). A value for `color-scheme` in `globalState`
overrides it.

## `interactiveLayers`

`state.hover` has the features of these layers under the pointer, and `features` of [`onClick`](#onclick) has those
under a click. In both, the top feature is first. Over such a feature the cursor is `pointer`, unless the
description sets `cursor`.

## `hoverState`

With `hoverState: true`, the map sets the feature state `hover: true` on the top feature of `interactiveLayers` under
the pointer. It removes the state when the pointer leaves the feature or the map. A layer reads the state with
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

The map can set the state only on a feature that has an id. Set ids on the features, or set `promoteId` on the
source, or `generateId: true` on a GeoJSON source.

## `onClick`

The map calls `onClick` with one object (`MapPointer`) for each click on the map. It does not call `onClick` for a
click on a control or on an element that `overlay` placed.

| Name | Type | Description |
|---|---|---|
| `point` | `{x: number; y: number}` | The place of the click in CSS pixels from the top left corner of the map. |
| `lngLat` | `[number, number]` | The position of the click as `[lng, lat]`. |
| `features` | `RenderedFeature[]` | The features of [`interactiveLayers`](#interactivelayers) at the click, the top one first. It is empty when the description has no `interactiveLayers`. |

## `maxBounds`

`maxBounds` keeps the whole view inside a box: `[[west, south], [east, north]]` or `[west, south, east, north]`.
When the box is smaller than the view, the map zooms in until the box fills the view. A box whose west edge is east
of its east edge, such as `[[150, -50], [-120, 10]]`, crosses the antimeridian. `maxBounds` has no effect on a globe.

## `cooperativeGestures`

Set `cooperativeGestures` for a map in a page that scrolls. With `true`, the wheel zooms the map only while Ctrl (⌘
on a Mac) is pressed, one finger scrolls the page, and two fingers move the map. When the map blocks a gesture, it
shows a hint. Set the text of the hint in [`locale`](#locale).

## `colorScheme` and `onColorSchemeChange`

`'auto'` follows the browser (`prefers-color-scheme`) and changes while the page is open. The resolved scheme is
`state.colorScheme`, and it has these effects:

- The controls, the popup and the attribution have the colours of the scheme, and the container has the class
  `map-jr-dark` while the scheme is dark.
- The global state property `color-scheme` of the style is `'light'` or `'dark'`, so a style can read
  `['global-state', 'color-scheme']`. A value for `color-scheme` in [`globalState`](#globalstate) overrides it.
- For a [`style`](#style) that is a pair `{light, dark}`, the map draws the style that matches the scheme.

The control `colorScheme()` changes the scheme of the map and then calls `onColorSchemeChange` with the new value.
An application that keeps the description in its state must store the value there. Otherwise its next `update`
passes the old value and changes the map back.

See [Dark mode](../api.md#dark-mode) for a style that follows the scheme.

## `locale`

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  locale: {'NavigationControl.ZoomIn': 'Zoom avant', 'NavigationControl.ZoomOut': 'Zoom arrière'},
});
```

`locale` sets the texts of the controls, of the popup and of the hint of `cooperativeGestures`. The keys are those
of the option `locale` of MapLibre GL JS: see [The texts of the controls](../api.md#the-texts-of-the-controls) for
the list. A key that is not set keeps the English text, and the library includes no translations. `locale` does not
change the language of the labels of the map.

## `padding`

`padding` is one number for all sides, or `{top, right, bottom, left}`. A side that is not set is 0. The map centres
the view in the area that the padding leaves free, for example beside a side panel. A change of `padding` moves the
camera immediately.

```js
map.patch({padding: {left: 320}});
```

The `padding` of [`initialView`](#initialview) and of `moveTo` is a different value: the space around `bounds` for
one fit.

## `transformRequest`

The map calls the function with the URL of a request and the kind of resource. The function returns
`{url, headers, credentials}`, or `undefined` to leave the request unchanged. The signature is that of
`transformRequest` of MapLibre GL JS.

```js
createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  transformRequest: (url, resourceType) =>
    resourceType === 'Tile' && url.startsWith('https://tiles.example.com/') ? {url, headers: {Authorization: 'Bearer ' + token}} : undefined,
});
```

The kinds are `Style`, `Source`, `Tile`, `Glyphs`, `SpriteJSON`, `SpriteImage`, `Image` and `Font`. A framework can
pass a new function in each render at no cost.

## `renderer`

| Value | The map draws |
|---|---|
| `'auto'` | In a worker when the browser can draw there, and on the main thread otherwise. |
| `'worker'` | As `'auto'`, and the map warns once when it draws on the main thread instead. |
| `'main'` | On the main thread. |

`state.renderer` is the thread that draws. See [Loading](../loading.md) for the worker file and how the map loads it.

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

With `hash: true`, the map writes the view into the fragment of the URL of the page: `#zoom/lat/lng`, or
`#zoom/lat/lng/bearing/pitch` when the map is rotated or pitched. The map updates the fragment when a movement ends,
and moves when the fragment changes. When the page loads with a view in the fragment, that view overrides `center`,
`zoom`, `bearing` and `pitch` of [`initialView`](#initialview) and of [`view`](#view-and-onviewchange). It does not
override `bounds` of `initialView`.

With a string, the map writes the view under that name, so that the fragment can hold other values: `hash: 'map'`
writes `#map=zoom/lat/lng`.

## See also

- [Change the map](../api.md#change-the-map) for `update` and `patch`.
- [Types](../api.md#types) for `Position`, `Bounds`, `LayerInput` and the style types.
- [Vue and Nuxt](../vue.md), [React](../react.md) and [Svelte](../svelte.md): the components accept the fields of the
  description as props.
