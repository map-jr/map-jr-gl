# Markers

The library has two types of marker.

| Type | Use it for | How it is drawn |
|---|---|---|
| Marker layer | Many markers that look the same or almost the same | On the map canvas, by the graphics processor |
| `Marker` and `Popup` | A small number of markers with HTML content, or markers that the user moves | As HTML elements above the map |

## Marker layers

A marker layer has an SVG template and a list of markers. The library draws the template one time for each
different set of values. It then draws all the markers in one operation. The number of markers has almost no effect
on speed.

```js
const layer = map.addMarkerLayer({
  id: 'places',
  svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>',
  width: 24,
  height: 31,
  anchor: 'bottom',
  data: [
    {lngLat: [-74.006, 40.7128], props: {color: '#d6453d', name: 'City Hall'}},
  ],
});
```

### The template

- Write `{{name}}` where a value from `props` must go. The library makes the value safe for XML.
- The template can contain an `<image>` element with a photograph.
- Keep the number of different value sets small. Each different set uses space in a texture.

### Options

| Option | Default | Effect |
|---|---|---|
| `width`, `height` | Necessary | The size of a marker in CSS pixels |
| `anchor` | `'center'` | The part of the marker that is on the position, for example `'bottom'` |
| `collide` | `false` | When `true`, map labels do not go below the markers |
| `minZoom`, `maxZoom` | None | The zoom range in which the layer shows. The layer fades at the two ends of the range. |
| `overlap` | `'show'` | When `'hide'`, a marker that would cover an earlier marker does not show |

To change how a marker looks with zoom, make two layers with the same data and different zoom ranges. For example,
make small dots below zoom 12 and full pins from zoom 12.

### Change the markers

```js
layer.setData(newMarkers);                    // replace all markers
layer.setProps(3, {color: '#2f7fd1'});        // change the values of marker 3
layer.select(3);                              // make marker 3 larger
layer.select(null);                           // make it the usual size again
map.removeMarkerLayer('places');
```

### Events

```js
map.on('markerclick', event => console.log(event.marker.props, event.index, event.layer));
map.on('markerenter', event => event.layer.setProps(event.index, {stroke: '#222'}));
map.on('markerleave', event => event.layer.setProps(event.index, {stroke: '#fff'}));
```

`map.queryMarkers(point)` gives the marker at a screen position, or `null`.

### Callouts

`openPopup` makes the marker larger and opens a callout that points at it. Map labels move away from the marker and
from the callout.

```js
map.on('markerclick', event => {
  event.layer.openPopup(event.index, event.marker.props.name);
});
```

The content can be text or an HTML element.

### Groups of markers (clustering)

Clustering is not part of the library. Calculate the groups in your application and give the result to a marker
layer with `setData`. Do this again when the `moveend` event occurs.

### Markers on the server

`renderToSVG` and `renderToImage` accept the same marker layer options. See [Server rendering](server-rendering.md).

## `Marker` and `Popup`

These classes have the API of MapLibre GL JS.

```js
import {Marker, Popup} from 'tessera-map';

const marker = new Marker({draggable: true})
  .setLngLat([-74.006, 40.7128])
  .setPopup(new Popup().setHTML('<strong>City Hall</strong>'))
  .addTo(map);

marker.on('dragend', () => console.log(marker.getLngLat()));
```

Each `Marker` is an HTML element. The browser becomes slow with thousands of them. Use a marker layer for large
numbers.

## 3D terrain

With 3D terrain, the two types of marker stay on the ground surface.
