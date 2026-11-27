# Images and fonts

This page shows how to give the style layers the images that they draw, from your code, from a sprite and from the
style itself, and how to draw labels with web fonts.

## Add an image for a style layer

[`images`](../reference/description.md#images) sets images by name. A symbol layer draws an image with
`icon-image`, and a fill, line or background layer draws one as a pattern with `fill-pattern`, `line-pattern` or
`background-pattern`.

A `fill-pattern` or `line-pattern` can be an expression that reads the properties of the feature, such as
`['get', 'surface']`, and then each feature draws its own image. An SDF image (an image with `sdf: true`) as
`fill-pattern` takes the color of `fill-color`.

This example draws an SVG pin with the name of the place beside it for four places, and colors each pin by the kind
of the place.

<!-- example:images:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows four places. Each has an SVG image of the
// description in the color of its kind, and its name beside it.
import {createMap} from '@map-jr/map-jr-gl';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// An SVG image with a slot ({{color}}). The symbol layer fills the slot for
// each feature.
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {name: 'City Hall', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      properties: {name: 'Washington Square', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
    },
    {
      type: 'Feature',
      properties: {name: 'Battery Park', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
    },
    {
      type: 'Feature',
      properties: {name: 'Brooklyn Bridge', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
    },
  ],
};

const map = createMap(document.getElementById('map'), {
  style,
  initialView: {center: [-74.006, 40.7175], zoom: 12.7},
  attribution: {compact: true},
  images: {pin},
  // Additions to the style: a GeoJSON source and a symbol layer.
  sources: {places: {type: 'geojson', data: places}},
  // A symbol layer draws the image and a label beside it.
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': [
          'image',
          'pin',
          {
            params: {
              color: ['match', ['get', 'kind'], 'park', '#2e9d5b', '#d6453d'],
            },
          },
        ],
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [0.9, -1.1],
      },
      paint: {
        'text-color': '#222',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
});
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows four places. Each has an SVG image from
// addImage, and its name beside it.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// addImage in MapLibre GL JS takes pixels. This library also takes an SVG
// document as a string.
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="#d6453d" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const parkPin = pin.replace('#d6453d', '#2e9d5b');
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {name: 'City Hall', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      properties: {name: 'Washington Square', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
    },
    {
      type: 'Feature',
      properties: {name: 'Battery Park', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
    },
    {
      type: 'Feature',
      properties: {name: 'Brooklyn Bridge', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
    },
  ],
};

const map = new Map({
  container: 'map',
  style,
  center: [-74.006, 40.7175],
  zoom: 12.7,
  attributionControl: {compact: true},
});
map.on('load', () => {
  map.addImage('pin', pin);
  map.addImage('pin-park', parkPin);
  map.addSource('places', {type: 'geojson', data: places});
  // A symbol layer draws the image and a label beside it.
  map.addLayer({
    id: 'places',
    type: 'symbol',
    source: 'places',
    layout: {
      'icon-image': ['match', ['get', 'kind'], 'park', 'pin-park', 'pin'],
      'icon-anchor': 'bottom',
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 13,
      'text-anchor': 'left',
      'text-offset': [0.9, -1.1],
    },
    paint: {
      'text-color': '#222',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
    },
  });
});
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {MapJr} from '@map-jr/map-jr-gl/vue';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// An SVG image with a slot ({{color}}). The symbol layer fills the slot for
// each feature.
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {name: 'City Hall', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      properties: {name: 'Washington Square', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
    },
    {
      type: 'Feature',
      properties: {name: 'Battery Park', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
    },
    {
      type: 'Feature',
      properties: {name: 'Brooklyn Bridge', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
    },
  ],
};
// Additions to the style: a GeoJSON source and a symbol layer.
const additions = {
  sources: {places: {type: 'geojson', data: places}},
  // A symbol layer draws the image and a label beside it.
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': [
          'image',
          'pin',
          {
            params: {
              color: ['match', ['get', 'kind'], 'park', '#2e9d5b', '#d6453d'],
            },
          },
        ],
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [0.9, -1.1],
      },
      paint: {
        'text-color': '#222',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
};
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: [-74.006, 40.7175], zoom: 12.7}"
    :attribution="{compact: true}"
    :images="{pin}"
    v-bind="additions"
  />
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {MapJr} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
// An SVG image with a slot ({{color}}). The symbol layer fills the slot for
// each feature.
const pin =
  '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
// (The objects are outside the component, so each render gives the map the same
// description.)
const images = {pin};
const places = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {name: 'City Hall', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
    },
    {
      type: 'Feature',
      properties: {name: 'Washington Square', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
    },
    {
      type: 'Feature',
      properties: {name: 'Battery Park', kind: 'park'},
      geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
    },
    {
      type: 'Feature',
      properties: {name: 'Brooklyn Bridge', kind: 'civic'},
      geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
    },
  ],
};
// Additions to the style: a GeoJSON source and a symbol layer.
const additions = {
  sources: {places: {type: 'geojson', data: places}},
  // A symbol layer draws the image and a label beside it.
  layers: [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': [
          'image',
          'pin',
          {
            params: {
              color: ['match', ['get', 'kind'], 'park', '#2e9d5b', '#d6453d'],
            },
          },
        ],
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [0.9, -1.1],
      },
      paint: {
        'text-color': '#222',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ],
};

export default function Images() {
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: [-74.006, 40.7175], zoom: 12.7}}
      attribution={{compact: true}}
      images={images}
      {...additions}
    />
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  // An SVG image with a slot ({{color}}). The symbol layer fills the slot for
  // each feature.
  const pin =
    '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
  const places = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {name: 'City Hall', kind: 'civic'},
        geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
      },
      {
        type: 'Feature',
        properties: {name: 'Washington Square', kind: 'park'},
        geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
      },
      {
        type: 'Feature',
        properties: {name: 'Battery Park', kind: 'park'},
        geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
      },
      {
        type: 'Feature',
        properties: {name: 'Brooklyn Bridge', kind: 'civic'},
        geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
      },
    ],
  };

  const description = {
    style: 'https://styles.map-jr.org/1/elevation-zero.json',
    initialView: {center: [-74.006, 40.7175], zoom: 12.7},
    attribution: {compact: true},
    images: {pin},
    // Additions to the style: a GeoJSON source and a symbol layer.
    sources: {places: {type: 'geojson', data: places}},
    // A symbol layer draws the image and a label beside it.
    layers: [
      {
        id: 'places',
        type: 'symbol',
        source: 'places',
        layout: {
          'icon-image': [
            'image',
            'pin',
            {
              params: {
                color: ['match', ['get', 'kind'], 'park', '#2e9d5b', '#d6453d'],
              },
            },
          ],
          'icon-anchor': 'bottom',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
          'text-anchor': 'left',
          'text-offset': [0.9, -1.1],
        },
        paint: {
          'text-color': '#222',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5,
        },
      },
    ],
  };
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>SVG images for symbol layers, with a label beside each</title>
<!--
  The map shows four places. Each
  has an SVG image in the color of
  its kind, and its name beside
  it.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.006,40.7175"
  zoom="12.7"
  style="height: 500px"
></map-jr>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  // An SVG image with a slot
  // ({{color}}). The symbol layer
  // fills the slot for each
  // feature.
  const pin =
    '<svg viewBox="0 0 24 31"><path d="M12 30C12 30 2 19 2 11.5a10 10 0 1 1 20 0C22 19 12 30 12 30z" fill="{{color}}" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
  const places = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {name: 'City Hall', kind: 'civic'},
        geometry: {type: 'Point', coordinates: [-74.006, 40.7128]},
      },
      {
        type: 'Feature',
        properties: {name: 'Washington Square', kind: 'park'},
        geometry: {type: 'Point', coordinates: [-73.9973, 40.7308]},
      },
      {
        type: 'Feature',
        properties: {name: 'Battery Park', kind: 'park'},
        geometry: {type: 'Point', coordinates: [-74.017, 40.7033]},
      },
      {
        type: 'Feature',
        properties: {name: 'Brooklyn Bridge', kind: 'civic'},
        geometry: {type: 'Point', coordinates: [-73.9969, 40.7061]},
      },
    ],
  };

  const map = document.getElementById('map');
  map.attribution = {compact: true};
  map.images = {pin};
  // Additions to the style: a
  // GeoJSON source and a symbol
  // layer, which draws the image
  // and a label beside it.
  map.sources = {places: {type: 'geojson', data: places}};
  map.layers = [
    {
      id: 'places',
      type: 'symbol',
      source: 'places',
      layout: {
        'icon-image': [
          'image',
          'pin',
          {
            params: {
              color: ['match', ['get', 'kind'], 'park', '#2e9d5b', '#d6453d'],
            },
          },
        ],
        'icon-anchor': 'bottom',
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-anchor': 'left',
        'text-offset': [0.9, -1.1],
      },
      paint: {
        'text-color': '#222',
        'text-halo-color': '#fff',
        'text-halo-width': 1.5,
      },
    },
  ];
</script>
```
<!-- example:images:end -->

- [`sources`](../reference/description.md#sources) and [`layers`](../reference/description.md#layers) add a GeoJSON
  source and a symbol layer to the style. `text-field` draws the name beside the icon, and `text-font` names a font of
  the `glyphs` of the style.
- The SVG document `pin` has a slot (`{{color}}`), so it is a template. The `image` expression of `icon-image` fills
  the slot with its `params`, here a color that `match` selects from the property `kind`. Without `params`, each
  feature fills a slot from its property of the same name.
- In the compat entry, `addImage` accepts an SVG document as a string, which MapLibre GL JS does not. The compat
  example adds one image for each color and selects it with `match`, as an application for MapLibre GL JS does.

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

See [An image that is a template](../reference/description.md#images) for the parameters and the limits of slots.

## Use the images of a sprite

A sprite is one image file with many small images, and a JSON file with the name and the place of each.
[`sprite`](../reference/description.md#sprite) adds sprites to the sprite of the style. Each sprite has an `id`, and an
`icon-image` names one of its images as `id:name`.

**Map Jr**

```js [Map Jr]
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

**MapLibre**

```js [MapLibre]
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

This example draws a highway shield for each route of a road: an SVG image with the number of the route. The style is
an object in the code, with a few layers of roads and water from the vector tiles of OpenFreeMap, because the styles
of `styles.map-jr.org` draw shields of their own.

<!-- example:shields:start -->
**Map Jr**

```js [Map Jr]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map draws a highway shield for each route, and a line of
// text below the map counts the shields that the page made.
import {createMap} from '@map-jr/map-jr-gl';

// A small style of roads and water. Its layer "shields" asks for an image named
// from the network and the number of the first route of each road, such as
// "shield|US:I|95", and no sprite has such images.
const style = {
  version: 8,
  sources: {
    openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
  },
  layers: [
    {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {'fill-color': '#aad3df'},
    },
    {
      id: 'roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary'],
        true,
        false,
      ],
      paint: {
        'line-color': '#e3a04f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
      },
    },
    {
      id: 'shields',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      filter: ['has', 'route_1_ref'],
      layout: {
        'icon-image': [
          'concat',
          'shield|',
          ['coalesce', ['get', 'route_1_network'], ''],
          '|',
          ['get', 'route_1_ref'],
        ],
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'icon-rotation-alignment': 'viewport',
      },
    },
  ],
};

// The SVG of the shield for an image name such as "shield|US:I|95": blue for an
// Interstate, white for a US highway and yellow for other routes. The width
// grows with the number. The number comes from the tiles, so the characters
// that XML reserves are escaped.
function shield(name) {
  const [, network, ref] = name.split('|');
  const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
  const width = 10 + 7 * ref.length;
  const [fill, color] =
    network === 'US:I'
      ? ['#2a57a5', '#fff']
      : network === 'US:US'
        ? ['#fff', '#222']
        : ['#fdf6d8', '#5b4f1f'];
  return (
    `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
    `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
  );
}

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);

const map = createMap(container, {
  style,
  initialView: {center: [-74.0, 40.75], zoom: 10.5},
  attribution: {compact: true},
});

// The map reports each image name that a layer asks for and that it does not
// have. The page adds the image to `images`, and the map draws it.
map.listen('styleimagemissing', e => {
  if (!e.id.startsWith('shield|')) return;
  map.patch({images: {...map.description.images, [e.id]: shield(e.id)}});
  const made = Object.keys(map.description.images).length;
  readout.textContent = `${made} shields made so far`;
});
```

**MapLibre**

```js [MapLibre]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map draws a highway shield for each route, and a line of
// text below the map counts the shields that the page made.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

// A small style of roads and water. Its layer "shields" asks for an image named
// from the network and the number of the first route of each road, such as
// "shield|US:I|95", and no sprite has such images.
const style = {
  version: 8,
  sources: {
    openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
  },
  layers: [
    {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {'fill-color': '#aad3df'},
    },
    {
      id: 'roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary'],
        true,
        false,
      ],
      paint: {
        'line-color': '#e3a04f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
      },
    },
    {
      id: 'shields',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      filter: ['has', 'route_1_ref'],
      layout: {
        'icon-image': [
          'concat',
          'shield|',
          ['coalesce', ['get', 'route_1_network'], ''],
          '|',
          ['get', 'route_1_ref'],
        ],
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'icon-rotation-alignment': 'viewport',
      },
    },
  ],
};

// The SVG of the shield for an image name such as "shield|US:I|95": blue for an
// Interstate, white for a US highway and yellow for other routes. The width
// grows with the number. The number comes from the tiles, so the characters
// that XML reserves are escaped.
function shield(name) {
  const [, network, ref] = name.split('|');
  const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
  const width = 10 + 7 * ref.length;
  const [fill, color] =
    network === 'US:I'
      ? ['#2a57a5', '#fff']
      : network === 'US:US'
        ? ['#fff', '#222']
        : ['#fdf6d8', '#5b4f1f'];
  return (
    `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
    `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
  );
}

const map = new Map({
  container: 'map',
  style,
  center: [-74.0, 40.75],
  zoom: 10.5,
  attributionControl: {compact: true},
});
const readout = document.createElement('p');
map.getContainer().after(readout);

// The map reports each image name that a layer asks for and that it does not
// have, and draws the image that the page adds. An SVG document as the image is
// an addition of this library: MapLibre GL JS needs pixels.
let made = 0;
map.on('styleimagemissing', e => {
  if (!e.id.startsWith('shield|')) return;
  map.addImage(e.id, shield(e.id));
  readout.textContent = `${++made} shields made so far`;
});
```

**Vue**

```vue [Vue]
<script setup>
// The map fills its parent element, so give the parent a height.
import {shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';

// A small style of roads and water. Its layer "shields" asks for an image named
// from the network and the number of the first route of each road, such as
// "shield|US:I|95", and no sprite has such images.
const style = {
  version: 8,
  sources: {
    openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
  },
  layers: [
    {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {'fill-color': '#aad3df'},
    },
    {
      id: 'roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary'],
        true,
        false,
      ],
      paint: {
        'line-color': '#e3a04f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
      },
    },
    {
      id: 'shields',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      filter: ['has', 'route_1_ref'],
      layout: {
        'icon-image': [
          'concat',
          'shield|',
          ['coalesce', ['get', 'route_1_network'], ''],
          '|',
          ['get', 'route_1_ref'],
        ],
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'icon-rotation-alignment': 'viewport',
      },
    },
  ],
};

// The SVG of the shield for an image name such as "shield|US:I|95": blue for an
// Interstate, white for a US highway and yellow for other routes. The width
// grows with the number. The number comes from the tiles, so the characters
// that XML reserves are escaped.
function shield(name) {
  const [, network, ref] = name.split('|');
  const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
  const width = 10 + 7 * ref.length;
  const [fill, color] =
    network === 'US:I'
      ? ['#2a57a5', '#fff']
      : network === 'US:US'
        ? ['#fff', '#222']
        : ['#fdf6d8', '#5b4f1f'];
  return (
    `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
    `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
  );
}

// The images that the page made, by name. A new object is a change of the prop.
const images = shallowRef({});
// The map reports each image name that a layer asks for and that it does not
// have, and draws the image when the page adds it to `images`.
function addShield(e) {
  if (e.id.startsWith('shield|'))
    images.value = {...images.value, [e.id]: shield(e.id)};
}
</script>

<template>
  <MapJr
    :map-style="style"
    :initial-view="{center: [-74.0, 40.75], zoom: 10.5}"
    :images="images"
    :attribution="{compact: true}"
    @styleimagemissing="addShield"
  />
  <p>{{ Object.keys(images).length }} shields made so far</p>
</template>
```

**React**

```jsx [React]
// The map fills its parent element, so give the parent a height.
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

// A small style of roads and water. Its layer "shields" asks for an image named
// from the network and the number of the first route of each road, such as
// "shield|US:I|95", and no sprite has such images.
const style = {
  version: 8,
  sources: {
    openmaptiles: {type: 'vector', url: 'https://tiles.openfreemap.org/planet'},
  },
  layers: [
    {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {'fill-color': '#aad3df'},
    },
    {
      id: 'roads',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: [
        'match',
        ['get', 'class'],
        ['motorway', 'trunk', 'primary'],
        true,
        false,
      ],
      paint: {
        'line-color': '#e3a04f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
      },
    },
    {
      id: 'shields',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      filter: ['has', 'route_1_ref'],
      layout: {
        'icon-image': [
          'concat',
          'shield|',
          ['coalesce', ['get', 'route_1_network'], ''],
          '|',
          ['get', 'route_1_ref'],
        ],
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'icon-rotation-alignment': 'viewport',
      },
    },
  ],
};

// The SVG of the shield for an image name such as "shield|US:I|95": blue for an
// Interstate, white for a US highway and yellow for other routes. The width
// grows with the number. The number comes from the tiles, so the characters
// that XML reserves are escaped.
function shield(name) {
  const [, network, ref] = name.split('|');
  const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
  const width = 10 + 7 * ref.length;
  const [fill, color] =
    network === 'US:I'
      ? ['#2a57a5', '#fff']
      : network === 'US:US'
        ? ['#fff', '#222']
        : ['#fdf6d8', '#5b4f1f'];
  return (
    `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
    `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
  );
}

export default function Shields() {
  // The images that the page made, by name.
  const [images, setImages] = useState({});
  // The map reports each image name that a layer asks for and that it does not
  // have, and draws the image when the page adds it to `images`.
  function addShield(e) {
    if (e.id.startsWith('shield|'))
      setImages(made => ({...made, [e.id]: shield(e.id)}));
  }

  return (
    <>
      <MapJr
        mapStyle={style}
        initialView={{center: [-74.0, 40.75], zoom: 10.5}}
        images={images}
        attribution={{compact: true}}
        onStyleimagemissing={addShield}
      />
      <p>{Object.keys(images).length} shields made so far</p>
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';

  // A small style of roads and water. Its layer "shields" asks for an image
  // named from the network and the number of the first route of each road, such
  // as "shield|US:I|95", and no sprite has such images.
  const style = {
    version: 8,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {'fill-color': '#aad3df'},
      },
      {
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary'],
          true,
          false,
        ],
        paint: {
          'line-color': '#e3a04f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
        },
      },
      {
        id: 'shields',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        filter: ['has', 'route_1_ref'],
        layout: {
          'icon-image': [
            'concat',
            'shield|',
            ['coalesce', ['get', 'route_1_network'], ''],
            '|',
            ['get', 'route_1_ref'],
          ],
          'symbol-placement': 'line',
          'symbol-spacing': 300,
          'icon-rotation-alignment': 'viewport',
        },
      },
    ],
  };

  // The SVG of the shield for an image name such as "shield|US:I|95": blue for
  // an Interstate, white for a US highway and yellow for other routes. The
  // width grows with the number. The number comes from the tiles, so the
  // characters that XML reserves are escaped.
  function shield(name) {
    const [, network, ref] = name.split('|');
    const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
    const width = 10 + 7 * ref.length;
    const [fill, color] =
      network === 'US:I'
        ? ['#2a57a5', '#fff']
        : network === 'US:US'
          ? ['#fff', '#222']
          : ['#fdf6d8', '#5b4f1f'];
    return (
      `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
      `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
    );
  }

  // The images that the page made, by name. (`$state.raw`: the map gets the
  // object itself, not a proxy of it.)
  let images = $state.raw({});
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style,
    initialView: {center: [-74.0, 40.75], zoom: 10.5},
    images,
    attribution: {compact: true},
  });

  // The map reports each image name that a layer asks for and that it does not
  // have, and draws the image when the page adds it to `images`.
  function ready(map) {
    map.listen('styleimagemissing', e => {
      if (e.id.startsWith('shield|'))
        images = {...images, [e.id]: shield(e.id)};
    });
  }
</script>

<div use:mapJr={{description, ready}} style="height: 500px"></div>
<p>{Object.keys(images).length} shields made so far</p>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>Highway shields that the page draws</title>
<!--
  The map draws a highway shield
  for each route, and a line of
  text below the map counts the
  shields that the page made.
-->
<map-jr
  id="map"
  center="-74.0,40.75"
  zoom="10.5"
  attribution-compact
  style="height: 500px"
></map-jr>
<p id="readout"></p>
<script type="module">
  import '@map-jr/map-jr-gl/element';

  // A small style of roads and
  // water. Its layer "shields"
  // asks for an image named from
  // the network and the number of
  // the first route of each road,
  // such as "shield|US:I|95", and
  // no sprite has such images.
  const style = {
    version: 8,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      {id: 'land', type: 'background', paint: {'background-color': '#f2efe9'}},
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {'fill-color': '#aad3df'},
      },
      {
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary'],
          true,
          false,
        ],
        paint: {
          'line-color': '#e3a04f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 4],
        },
      },
      {
        id: 'shields',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        filter: ['has', 'route_1_ref'],
        layout: {
          'icon-image': [
            'concat',
            'shield|',
            ['coalesce', ['get', 'route_1_network'], ''],
            '|',
            ['get', 'route_1_ref'],
          ],
          'symbol-placement': 'line',
          'symbol-spacing': 300,
          'icon-rotation-alignment': 'viewport',
        },
      },
    ],
  };

  // The SVG of the shield for an
  // image name such as
  // "shield|US:I|95": blue for an
  // Interstate, white for a US
  // highway and yellow for other
  // routes. The width grows with
  // the number. The number comes
  // from the tiles, so the
  // characters that XML reserves
  // are escaped.
  function shield(name) {
    const [, network, ref] = name.split('|');
    const text = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
    const width = 10 + 7 * ref.length;
    const [fill, color] =
      network === 'US:I'
        ? ['#2a57a5', '#fff']
        : network === 'US:US'
          ? ['#fff', '#222']
          : ['#fdf6d8', '#5b4f1f'];
    return (
      `<svg viewBox="0 0 ${width} 20"><rect x="1" y="1" width="${width - 2}" height="18" rx="4" fill="${fill}" stroke="#222" stroke-width="1.2"/>` +
      `<text x="${width / 2}" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${color}">${text}</text></svg>`
    );
  }

  const map = document.getElementById('map');
  const readout = document.getElementById('readout');
  // A style object is a property:
  // the attribute map-style takes
  // only a URL.
  map.mapStyle = style;
  map.images = {};

  // The map reports each image
  // name that a layer asks for
  // and that it does not have,
  // and draws the image when the
  // page adds it to `images`.
  map.addEventListener('map-styleimagemissing', event => {
    const name = event.detail.id;
    if (!name.startsWith('shield|')) return;
    map.images = {...map.images, [name]: shield(name)};
    const made = Object.keys(map.images).length;
    readout.textContent = `${made} shields made so far`;
  });
</script>
```
<!-- example:shields:end -->

[`map.patch`](../reference/map.md#patch) replaces the field `images` whole, so the listener passes the images that the
map has (`map.description.images`, the `images` of the last description) with the new one. Where the description
has no `images`, `map.description.images` is `undefined`, and the spread adds nothing.

**MapLibre**

```js [MapLibre]
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
- In Vue, listen with `@styleimagemissing`. In React, pass `onStyleimagemissing`. On `<map-jr>`, listen for
  `map-styleimagemissing`.
- When the images differ only in a short text, such as numbers of up to three characters, a template with a slot
  needs no listener: `params` of the `image` expression fill the slot for each feature. MapLibre GL JS does not
  draw such a layer, because `params` is not part of the MapLibre style specification.

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

**Map Jr**

```js [Map Jr]
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

**MapLibre**

```js [MapLibre]
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
`[map-jr-gl] E494 fonts: the font "Inter Semibold" did not load from …`. The labels then use the next name of their
`text-font` list, then `fontFamily`, and then the fonts of the browser.

`fontFamily` is a CSS font family list, a field of the description of
the main API and an option of `Map` in the compat entry. Its default is `"Noto Sans", "Helvetica Neue", Arial,
sans-serif`. The map reads it only when it is created: to change it, destroy the map and create a new one.

- In the compat entry, the option `fonts` of `Map` and the method `addFonts` take the same object as `fonts` of the
  main API. The array of `{family, src, weight}` of earlier versions is removed.
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
- [An image that is a template](../reference/description.md#images) for images whose colors each feature sets.
- [Server rendering](server-rendering.md) for images and fonts in an image that a server renders.
