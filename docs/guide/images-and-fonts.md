# Images and fonts

This page shows how to give the style layers the images that they draw, from your code, from a sprite and from the
style itself, and how to draw labels with web fonts.

## Add an image for a style layer

[`images`](../reference/description.md#images) sets images by name. A symbol layer draws an image with
`icon-image`, and a fill, line or background layer draws one as a pattern with `fill-pattern`, `line-pattern` or
`background-pattern`.

A `fill-pattern` or `line-pattern` can be an expression that reads the properties of the feature, such as
`['get', 'surface']`, and then each feature draws its own image. An SDF image (an image with `sdf: true`) as
`fill-pattern` takes the colour of `fill-color`.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const station =
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#0b6e4f" stroke="#fff" stroke-width="2"/></svg>';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.9855, 40.758], zoom: 13},
  images: {station},
  data: {stations: {type: 'Point', coordinates: [-73.9855, 40.758]}},
  layers: [
    {
      id: 'stations',
      type: 'symbol',
      source: 'stations',
      layout: {'icon-image': 'station'},
    },
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const station =
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#0b6e4f" stroke="#fff" stroke-width="2"/></svg>';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.9855, 40.758],
  zoom: 13,
});

map.on('load', async () => {
  // addImage of this library also accepts an SVG document as a string. It
  // returns a promise.
  await map.addImage('station', station);
  map.addSource('stations', {
    type: 'geojson',
    data: {type: 'Point', coordinates: [-73.9855, 40.758]},
  });
  map.addLayer({
    id: 'stations',
    type: 'symbol',
    source: 'stations',
    layout: {'icon-image': 'station'},
  });
});
```

The map draws a green circle with a white ring at Times Square.

An image is an SVG document as a string, the URL of an image, an `ImageBitmap`, a canvas, an image element or
`ImageData`. See [`images`](../reference/description.md#images) for each form and its size.

- An SVG document is drawn sharp at the pixel density of the screen. Its size in CSS pixels is the size of its
  `viewBox`. For another size, write `{image: station, width: 30, height: 30}`.
- The server of an image URL must permit the request (CORS).
- An image of `images` overrides the image with the same name in the sprite of the style.
- An image that does not load is reported to [`onError`](../reference/description.md#mapdescription) with its name.
  The map draws the layer without that image.
- In `update` and `patch`, an image as a string is compared by its content. To replace a bitmap or a canvas, pass a
  new object.

An SVG document can have slots (`{{color}}`) that each feature fills from its properties. See
[Markers and popups](markers-and-popups.md#draw-markers-with-a-symbol-layer) for an example, and
[An image that is a template](../reference/description.md#images) for the parameters and the limits.

## Use the images of a sprite

A sprite is one image file with many small images, and a JSON file with the name and the place of each.
[`sprite`](../reference/description.md#sprite) adds sprites to the sprite of the style. Each sprite has an `id`, and an
`icon-image` names one of its images as `id:name`.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.9855, 40.758], zoom: 13},
  sprite: [
    {
      id: 'maki',
      url: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
    },
  ],
  data: {stations: {type: 'Point', coordinates: [-73.9855, 40.758]}},
  layers: [
    {
      id: 'stations',
      type: 'symbol',
      source: 'stations',
      layout: {'icon-image': 'maki:rail_metro_11'},
    },
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.9855, 40.758],
  zoom: 13,
});

map.on('load', () => {
  map.addSprite(
    'maki',
    'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
  );
  map.addSource('stations', {
    type: 'geojson',
    data: {type: 'Point', coordinates: [-73.9855, 40.758]},
  });
  map.addLayer({
    id: 'stations',
    type: 'symbol',
    source: 'stations',
    layout: {'icon-image': 'maki:rail_metro_11'},
  });
});
```

The official styles at `https://styles.map-jr.org/1/` have no sprite, so this example uses a sprite of the MapLibre
demo tiles. The names of the images of a sprite are the keys of its JSON file, here
`https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite.json`.

- `url` has no file extension. The map requests `url + '.json'` and `url + '.png'`, and `url + '@2x.json'` and
  `url + '@2x.png'` on a screen with a pixel ratio above 1.
- A sprite of `sprite` overrides the sprite of the style with the same `id`. The sprite of a style whose `sprite` is
  one URL has the id `default`.
- A sprite that does not load is reported to `onError` with its URL. The map still draws the images of the other
  sprites.
- In the main API, a change of `sprite` loads the style again: the map requests the style and draws it from the start.
  The view, and the `sources`, `layers`, `data` and `images` of the description, stay.

## Create an image when a layer asks for it

When a layer names an image that the map does not have, the map fires the event `styleimagemissing` with the name as
`id`. Create the image in the listener, and the map draws it. Use this for images that your code creates from the
name, such as a badge for each number.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.99, 40.735], zoom: 12},
  data: {
    lines: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {line: 4},
          geometry: {type: 'Point', coordinates: [-73.9903, 40.7359]},
        },
        {
          type: 'Feature',
          properties: {line: 6},
          geometry: {type: 'Point', coordinates: [-73.9772, 40.7516]},
        },
      ],
    },
  },
  // Each feature asks for the image "line-4", "line-6" and so on.
  layers: [
    {
      id: 'lines',
      type: 'symbol',
      source: 'lines',
      layout: {'icon-image': ['concat', 'line-', ['get', 'line']]},
    },
  ],
});

map.listen('styleimagemissing', event => {
  // Leave out names that this code does not create, such as an icon that the
  // sprite of the style lacks.
  if (!event.id.startsWith('line-')) return;
  const number = event.id.slice(5);
  const badge = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#00933c"/><text x="12" y="17" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">${number}</text></svg>`;
  map.patch({images: {...map.description.images, [event.id]: badge}});
});
```

[`map.patch`](../reference/map.md#patch) replaces the field `images` whole, so the listener passes the images that the
map has (`map.description.images`, the `images` of the last description) with the new one. Where the description
has no `images`, `map.description.images` is `undefined`, and the spread adds nothing.

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.99, 40.735],
  zoom: 12,
});

map.on('styleimagemissing', event => {
  if (!event.id.startsWith('line-')) return;
  const number = event.id.slice(5);
  const badge = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#00933c"/><text x="12" y="17" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">${number}</text></svg>`;
  map.addImage(event.id, badge);
});

map.on('load', () => {
  map.addSource('lines', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {line: 4},
          geometry: {type: 'Point', coordinates: [-73.9903, 40.7359]},
        },
        {
          type: 'Feature',
          properties: {line: 6},
          geometry: {type: 'Point', coordinates: [-73.9772, 40.7516]},
        },
      ],
    },
  });
  map.addLayer({
    id: 'lines',
    type: 'symbol',
    source: 'lines',
    layout: {'icon-image': ['concat', 'line-', ['get', 'line']]},
  });
});
```

The map shows a green badge with "4" and one with "6".

- The map fires the event once for each name and each style. After a new style, it fires the event again for a name
  that is still missing. The listener can add the image later, for example after a request.
- The map fires the event for each icon of a loaded tile, also for an icon outside the view.
- In Vue, listen with `@styleimagemissing`. In React, pass `onStyleimagemissing`.

## Put images into a style

A style that you write can carry its own images in `metadata["map-jr:images"]`, by name. Both entries of this library
draw them, and MapLibre GL JS ignores the key.

```json
{
  "version": 8,
  "metadata": {
    "map-jr:images": {
      "station": "<svg viewBox=\"0 0 20 20\"><circle cx=\"10\" cy=\"10\" r=\"8\" fill=\"#0b6e4f\"/></svg>",
      "station-large": {
        "image": "<svg viewBox=\"0 0 20 20\"><circle cx=\"10\" cy=\"10\" r=\"8\" fill=\"#0b6e4f\"/></svg>",
        "width": 30,
        "height": 30
      }
    }
  },
  "sources": {},
  "layers": []
}
```

A value is an SVG document or the URL of an image, as a string, or `{image, width, height}` with such a string as
`image`. The official styles at `https://styles.map-jr.org/1/` carry their icons in this way.

- The map takes at most 500 images from a style, and each image has at most 200,000 characters. An SVG image of the
  style must not refer to another file: an `href` or a `url(...)` may only point to `#...` or to a `data:` URL. The
  map leaves out each image that breaks one of these rules and reports one error for each to `onError`, with the name
  of the image. These limits apply only to the images of a style.
- The map draws an image of the style only when a layer asks for it. An image that no layer in view uses costs no
  time.
- An image of `images` of the description, or of `addImage` in the compat entry, overrides the image of the style with
  the same name. An image of the style overrides the image of the sprite with the same name. The order is: `images`
  of the description (or `addImage`), then the images of the style, then the sprite.
- In the browser, a name that the style lists is never taken from the sprite, also when the map leaves the image of the style out
  because it breaks one of the rules above. The icon is then missing.
- A new style removes the images of the old style.

## Draw labels with web fonts

[`fonts`](../reference/description.md#fonts) sets a font file for each `text-font` name.

**Main API**

```js [Main API]
import {createMap} from '@map-jr/map-jr-gl';

const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-73.9855, 40.758], zoom: 13},
  fonts: {
    'Inter Semibold':
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-600-normal.woff2',
  },
  data: {stations: {type: 'Point', coordinates: [-73.9855, 40.758]}},
  layers: [
    {
      id: 'stations',
      type: 'symbol',
      source: 'stations',
      layout: {
        'text-field': 'Times Sq–42 St',
        'text-font': ['Inter Semibold'],
        'text-size': 16,
      },
    },
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  center: [-73.9855, 40.758],
  zoom: 13,
});

map.on('load', () => {
  // `font-faces` of the style: the same shape as `fonts` of the main API.
  map.setFontFaces({
    ...map.getFontFaces(),
    'Inter Semibold':
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-600-normal.woff2',
  });
  map.addSource('stations', {
    type: 'geojson',
    data: {type: 'Point', coordinates: [-73.9855, 40.758]},
  });
  map.addLayer({
    id: 'stations',
    type: 'symbol',
    source: 'stations',
    layout: {
      'text-field': 'Times Sq–42 St',
      'text-font': ['Inter Semibold'],
      'text-size': 16,
    },
  });
});
```

The map draws the label "Times Sq–42 St" in Inter at weight 600.

A value of `fonts` is the URL of one font file, or a list with one item for each file of the font:

```ts
type FontFaces = Record<
  string,
  string | {url: string; 'unicode-range'?: string[]}[]
>;
```

`unicode-range` lists the characters that a file covers, such as `['U+0000-00FF']`, so that the browser loads only the
files that a text needs.

### Which text uses the web fonts

- A style without `glyphs`, such as [`elevation-zero.json`](https://map-jr.org/styles?style=elevation-zero), draws all of its text with the web fonts and the fonts of
  the browser.
- A style with `glyphs` draws its text from the glyph files of its server. A web font then draws only the text that
  the glyph files do not have: a font or a character that the server does not have, and text that the browser must
  shape, such as Arabic or Devanagari.

### How the map reads a font name

The map converts each `text-font` name to a CSS family, a weight and a style. It takes the words for the weight and
the style out of the name, and the rest of the name is the family.

| Word in the name | CSS |
|---|---|
| `Light` | weight 300 |
| `Regular`, `Normal`, `Book`, or no word | weight 400 |
| `Medium` | weight 500 |
| `Semibold`, `Demibold` | weight 600 |
| `Bold` | weight 700 |
| `Extra Bold` | weight 800 |
| `Black`, `Heavy` | weight 900 |
| `Italic`, `Oblique` | style italic |

`Thin` and `Extra Light` have no weight of their own: the map draws them at 400 and 300.

So `Open Sans Semibold Italic` is the family `Open Sans` at weight 600 in italic. A label uses each family of its
`text-font` list in order, with the weight and the style of the first name, and then `fontFamily`. A family that
appears twice is used once. A CSS generic family uses the fonts of the system: `['system-ui Semibold', 'sans-serif']`
draws in the font of the operating system at weight 600 (SF Pro on Apple systems, Segoe UI on Windows, Roboto on
Android).

The generic families are `system-ui`, `sans-serif`, `serif`, `monospace`, `cursive`, `fantasy`, `math`,
`emoji`, `fangsong`, `ui-sans-serif`, `ui-serif`, `ui-monospace` and `ui-rounded`; the map quotes every other family.
The family list does not change which glyph files a style with `glyphs` requests: `{fontstack}` is still the names of
the list as they are written, joined by commas.

### When a font does not load

A font file that does not load is reported to `onError`, for example
`[map-jr-gl] fonts: the font "Inter Semibold" did not load from …`. The labels then use the next name of their
`text-font` list, then `fontFamily`, and then the fonts of the browser.

`fontFamily` is a CSS font family list, a field of the description of
the main API and an option of `Map` in the compat entry. Its default is `"Noto Sans", "Helvetica Neue", Arial,
sans-serif`. The map reads it only when it is created: to change it, destroy the map and create a new one.

- An entry of `fonts` overrides the entry with the same name in the `font-faces` of the style.
- A relative URL in `fonts` is resolved against the URL of the page. A relative URL in the style is resolved against
  the URL of the style.
- In `update` and `patch`, a new name or a new URL loads its font, and the map draws the labels again. A name that is
  removed from `fonts` keeps its font until the page is loaded again, because the browser keeps a font that a page
  added. To change the font of a name, set another URL for the name.

## See also

- [`images`](../reference/description.md#images), [`sprite`](../reference/description.md#sprite) and
  [`fonts`](../reference/description.md#fonts) in the reference of the description.
- [Markers and popups](markers-and-popups.md) for markers drawn with an image.
- [An image that is a template](../reference/description.md#images) for images whose colours each feature sets.
- [Server rendering](server-rendering.md) for images and fonts in an image that a server renders.
