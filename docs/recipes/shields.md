# Draw highway shields

This example draws a highway shield for each route of a road: an SVG image with the number of the route, which the page
creates when a layer asks for it.

The style is an object in the code: a few layers of roads and water from the vector tiles of OpenFreeMap. The styles of
`styles.map-jr.org` draw shields of their own, so the example does not use one of them.

In a Nuxt app with the [module for Nuxt](../reference/nuxt.md), the Vue code works as it is.

<!-- example:shields:start -->
**Main API**

```js [Main API]
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

**MapLibre compat**

```js [MapLibre compat]
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

## How it works

- The layer `shields` asks for an image whose name it builds from the properties `route_1_network` and `route_1_ref`
  of each road, such as `shield|US:I|95`. No sprite has these images.
- When a layer asks for an image that the map does not have, the map fires the event
  [`styleimagemissing`](../reference/events.md#mapevents) with the name as `id`, once for each name. The page creates
  the SVG for that name and adds it to [`images`](../reference/description.md#images), and the map draws it.
- In Vue the event is `@styleimagemissing`, in React `onStyleimagemissing`, on `<map-jr>` `map-styleimagemissing`, and
  in Svelte and the main API `map.listen('styleimagemissing', …)`. The compat entry has `map.on` and `addImage`, as in
  MapLibre GL JS; an SVG document as the image of `addImage` is an addition of this library.
- The number of a route comes from the tiles, so `shield` escapes `&`, `<` and `>` before it puts the number into the
  SVG.
- The map also fires the event for a name that your code does not create, such as an icon that the sprite of a style
  does not have. The listener leaves such names out.
- The shield library of OSM Americana works with this library without changes.

## Variations

### One template for all shields of a network

An SVG image with a slot is a template, and `params` of the `image` expression fill the slot for each road. The map
draws one image for each number, and the page needs no listener. A template has one width, so it suits numbers of up
to three characters. In the description of the Main API example, remove the layer `shields` from the style and the
listener, and add `images` and `layers`:

```js
const interstate =
  '<svg viewBox="0 0 30 20"><rect x="1" y="1" width="28" height="18" rx="4" fill="#2a57a5" stroke="#222"/>' +
  '<text x="15" y="14.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#fff">{{ref}}</text></svg>';
const map = createMap(container, {
  style,
  initialView: {center: [-74.0, 40.75], zoom: 10.5},
  images: {interstate},
  layers: [
    {
      id: 'interstates',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      filter: ['==', ['get', 'route_1_network'], 'US:I'],
      layout: {
        'icon-image': [
          'image',
          'interstate',
          {params: {ref: ['get', 'route_1_ref']}},
        ],
        'symbol-placement': 'line',
      },
    },
  ],
});
```

`params` is not part of the MapLibre style specification, so MapLibre GL JS does not draw this layer.

## See also

- [Create an image when a layer asks for it](../guide/images-and-fonts.md#create-an-image-when-a-layer-asks-for-it) in
  the guide to images.
- [`images`](../reference/description.md#images) for the values that an image can have.
- [Draw an SVG icon with a label for each place](images.md) for a template with slots.
