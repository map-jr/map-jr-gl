# Draw an SVG icon with a label for each place

This example draws an SVG pin with the name of the place beside it for four places, and colours each pin by the kind
of the place.

Each block below is a file of the gallery. The two `js` files are the module script of a page that has
`<div id="map" style="height: 500px"></div>`. The Vue and React components fill their parent element, so give the
parent a height. The Svelte component and the `<map-jr>` page give the element of the map a height of 500 pixels. In
Nuxt, the code is the Vue code without the imports, which the module for Nuxt does.

<!-- example:images:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows four places. Each has
// an SVG image of the description in the colour of its kind, and its name
// beside it.
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

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. The map shows four places. Each has
// an SVG image from addImage, and its name beside it.
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
  has an SVG image in the colour
  of its kind,
  and its name beside it.
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

## How it works

- [`images`](../reference/description.md#images) provides images by name to the style layers. The map draws an SVG
  document at the pixel density of the screen.
- An SVG document with slots (`{{color}}`) is a template. The `image` expression of `icon-image` fills the slots with
  its `params`, here a colour that `match` selects from the property `kind`.
- [`sources`](../reference/description.md#sources) and [`layers`](../reference/description.md#layers) add a GeoJSON
  source and a symbol layer to the style.
- `text-field` draws the name beside the icon. `text-font` names a font of the `glyphs` of the style; `Noto Sans
  Regular` is a font of this style.

In the compat entry, `addImage` accepts an SVG document as a string, which MapLibre GL JS does not. The compat
example adds one image for each colour and selects it with `match`, as an application for MapLibre GL JS does.

## Variations

Each variation changes `icon-image` in the layer of the Main API example.

### One image with no slots

Without slots, the image is drawn as it is written. Replace `{{color}}` in `pin` with a colour and write:

```js
'icon-image': 'pin',
```

### Fill the slots from the properties

Without `params`, each feature fills a slot from the property of the same name. With a property `color` on each
feature, write:

```js
'icon-image': 'pin',
```

## See also

- [Add an image for a style layer](../guide/images-and-fonts.md#add-an-image-for-a-style-layer).
- [An image that is a template](../api.md#an-image-that-is-a-template) for the parameters and the limits.
- [Draw labels with web fonts](../guide/images-and-fonts.md#draw-labels-with-web-fonts) for a font that the style
  does not have.
