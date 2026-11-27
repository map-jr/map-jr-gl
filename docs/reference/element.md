# The element `<map-jr>`

The entry `@map-jr/map-jr-gl/element` defines the custom element `<map-jr>`, a map of `@map-jr/map-jr-gl` that is
written as HTML. Its attributes and properties form one [description](description.md), and the element passes that
description to the map. It is for pages without a framework adapter: plain HTML, markup from a CMS, and frameworks
that set attributes and properties and listen for events.

```html
<!doctype html>
<meta charset="utf-8" />
<script
  type="module"
  src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"
></script>

<map-jr
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13.6"
  style="height: 400px"
></map-jr>
```

## Define the element

Importing the entry defines `<map-jr>`, unless the page has defined that name already. With a bundler, import it
once, for example in the main file of the application.

```js
import '@map-jr/map-jr-gl/element';
```

The entry also exports the class `MapJrElement`. To define the element under another name, define a subclass:
`customElements.define('city-map', class extends MapJrElement {});`.

The element is the container of the map, so give it a height in CSS. It has `display: block` from a rule with no
specificity, and a rule of the page overrides it. The element has no shadow root, so the CSS of the page styles the
controls, the popups and the elements of `overlay()`.

The element creates the map in the microtask after it is added to the page, and destroys the map in the microtask
after it is removed. An element that is moved in the page in one task keeps its map.

## Attributes

These fields of the description have an attribute. The name of an attribute is the name of its field in kebab case.
A field that is on by default has an attribute named `no-` and the field, which switches it off: `no-interactive`.
The fields with an object, a list or a function as value have no attribute: set them as [properties](#mapjrelement).

| Attribute | Field of the description | Value |
|---|---|---|
| `map-style` | `style` | The URL of a style. |
| `center` | `initialView.center` | The longitude and the latitude with a comma between them: `center="13.4,52.52"`. |
| `zoom`, `bearing`, `pitch` | `initialView.zoom`, `.bearing`, `.pitch` | A number. |
| `color-scheme` | `colorScheme` | `light`, `dark` or `auto`. |
| `cursor` | `cursor` | A CSS cursor. |
| `min-zoom`, `max-zoom`, `max-pitch`, `center-elevation` | `minZoom`, `maxZoom`, `maxPitch`, `centerElevation` | A number. |
| `padding` | `padding` | A number of CSS pixels for each side. |
| `interactive-layers` | `interactiveLayers` | The ids of style layers with spaces between them. |
| `projection` | `projection` | `globe` or `mercator`. |
| `hover-state`, `cooperative-gestures`, `antialias` | `hoverState`, `cooperativeGestures`, `antialias` | A boolean attribute: present is `true`. |
| `no-interactive` | `interactive` | A boolean attribute: present is `false`. |
| `no-render-world-copies` | `renderWorldCopies` | A boolean attribute: present is `false`. |
| `no-attribution` | `attribution` | A boolean attribute: present is `false`, which hides the attribution. |
| `attribution-compact` | `attribution.compact` | A boolean attribute: present is `attribution: {compact: true}`. `no-attribution` wins over it, and the property `attribution` wins over both. |
| `hash` | `hash` | Present with no value for `true`, or the name of the parameter of the URL: `hash="map"`. Each value is a name, so `hash="false"` uses the parameter `false`. |
| `renderer`, `font-family` | `renderer`, `fontFamily` | A string. |

The defaults and the meaning of each value are those of the field in [`MapDescription`](description.md#mapdescription).
The map reads `renderer`, `font-family`, `antialias`, `no-attribution`, `attribution-compact`,
`hash` and `nonce` only when it is created, as every field of [`MapSetup`](description.md#mapsetup). The `nonce` of
the element, set as an attribute or as a property, sets `nonce` of the description.

### Change an attribute

A change of `center`, `zoom`, `bearing` or `pitch` after the map is created moves the camera to the new value with no
animation, also when the element has the property `initialView`. A change of another attribute updates the map,
except a change of an attribute that the map reads only when it is created. The element writes nothing back to its attributes: the
view that the user moves is in [`state`](#mapjrelement) and in the event `map-viewchange`.

A boolean attribute takes effect when it is there, whatever its value, as in HTML: `hover-state="false"` switches
`hoverState` on, and `no-interactive="false"` switches `interactive` off. To undo a boolean attribute, remove it.

An attribute that the element cannot read, such as `zoom="near"`, is ignored.

When `map-style` is removed from an element whose map exists, and the element has no property `mapStyle`, the map
keeps the style that it has, and the element applies no other change to the map until it has a style again. To
change the style, set another URL in `map-style` or set `mapStyle`.

An element without a style creates no map: `map` stays `null`, and `map-ready` is not dispatched.

## `MapJrElement`

Each field of the description is a property of the element with the same name, except `style`, which is the
property `mapStyle`. The table lists the members that the description does not have.

- Objects, lists and functions are properties only: `initialView`, `view`, `sources`, `layers`, `terrain`, `data`,
  `images`, `sprite`, `fonts`, `controls`, `globalState`, `locale`, `maxBounds` and `transformRequest`. `center` and
  `zoom` are attributes only.
- A property overrides the attribute of the same field. When the map is created, the fields of the property
  `initialView` override the attributes `center`, `zoom`, `bearing` and `pitch`.
- A property returns the value that the page set, and not the value of the attribute.
- A property set to `undefined` is left out of the description, so its attribute applies.

<!-- ref:MapJrElement:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` | [`MapDescription`](description.md#mapdescription)`['style']` | | The `style` of the description: the URL of a style, a style object, or `{light, dark}`. |
| `map` (read only) | [`MapInstance`](map.md#mapinstance)` \| null` | | The map (`MapInstance`), from the microtask after the element is in the page with a style until it is removed, or else `null`. |
| `state` (read only) | [`MapInstance`](map.md#mapinstance)`['state'] \| null` | | The state of the map as a store (`map.state`), or `null` while there is no map. |
<!-- ref:MapJrElement:end -->

The element applies all changes of one task to the map with one `update`, in the next microtask. Properties that the
page sets right after it creates the element are part of the first description.

```js
import '@map-jr/map-jr-gl/element';
import {navigation} from '@map-jr/map-jr-gl/controls';

const el = document.createElement('map-jr');
el.style.height = '400px';
el.mapStyle = 'https://styles.map-jr.org/1/elevation-zero.json';
el.initialView = {center: [-74.0065, 40.7085], zoom: 13.6};
el.controls = [navigation()];
el.data = {
  offices: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]},
      },
    ],
  },
};
el.layers = [
  {
    id: 'offices',
    type: 'circle',
    source: 'offices',
    paint: {'circle-radius': 8, 'circle-color': '#d6453d'},
  },
];
document.body.append(el);
```

The element compares the description field by field, as [`update`](map.md#update) does. To change
`data` or `layers`, set a new object or list: a change inside the object that the element has is not applied.

A property that the page sets before the entry has loaded is applied when the element is defined.

## Events

Each event of the map is a `CustomEvent` that bubbles, named `map-` and the name of the event.

| Event | `detail` |
|---|---|
| `map-ready` | The map (`MapInstance`), right after the element has created it. |
| `map-load` | The map, once, when the style and the first tiles have loaded. |
| `map-idle` | `null`, each time the camera is still and nothing loads. |
| `map-click` | `{point, lngLat, features}`, with the features of `interactive-layers` at the point. |
| `map-hover` | The features of `interactive-layers` under the pointer, the top one first, when they change. |
| `map-viewchange` | The view, `{center, zoom, bearing, pitch, bounds}`: once with the first view before `map-load`, and then at each change of the view. |
| `map-colorschemechange` | The `colorScheme` that the control `colorScheme()` set. |
| `map-error` | Each error of the map, an `Error`. When the error belongs to a source, such as a tile or a GeoJSON URL that does not load, the `Error` has the property `sourceId` with the id of that source. |
| `map-` and the name of each other event | The event object of [`listen`](map.md#listen): `map-moveend`, `map-sourcedata` and the others. `style.load` is `map-styleload`. |

The element writes each error to the console, unless a listener of `map-error` calls `event.preventDefault()`.

The element dispatches every event of the table whenever the map fires it, also when no listener is on the element.
A listener on the document or on an ancestor receives it, whenever the listener was added. This includes the events
that come once per frame or per pointer move, such as `map-move`, `map-render` and `map-mousemove`.

`map-ready` and `map-load` are dispatched once. A listener added later does not receive them: check `el.map`, which
is not `null` once the map exists, and `el.state.get().loaded`. In the same way, a listener of `map-viewchange` that
is added later misses the first view: read `el.state` then.

```html
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="15"
  interactive-layers="poi_z14 poi_z15 poi_z16"
  style="height: 400px"
></map-jr>
<p id="where"></p>
<script type="module">
  import 'https://unpkg.com/@map-jr/map-jr-gl/dist/element.js';

  const el = document.getElementById('map');
  const where = document.getElementById('where');
  el.addEventListener('map-click', event => {
    where.textContent =
      event.detail.features[0]?.properties.name ?? 'No place here';
  });
  el.addEventListener('map-moveend', () =>
    console.log(el.state.get().view.zoom),
  );
</script>
```

## Markers and popups

The element has no component for a marker or a popup. Call [`overlay`](map.md#overlay) of
the map after `map-ready`.

```html
<map-jr
  id="office-map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="14"
  style="height: 400px"
></map-jr>
<script type="module">
  import 'https://unpkg.com/@map-jr/map-jr-gl/dist/element.js';

  const element = document.getElementById('office-map');
  element.addEventListener('map-ready', event => {
    const pin = Object.assign(document.createElement('div'), {
      className: 'pin',
      textContent: 'Office',
    });
    event.detail.overlay(pin, {lngLat: [-74.0065, 40.7085], anchor: 'bottom'});
  });
</script>
```

## A first view from the server

[`renderElement`](server.md#renderelement) of `@map-jr/map-jr-gl/server` returns the markup of `<map-jr>` for a
description, with the first view inside it. The map removes the first view when it has loaded the tiles of its first
view.

## See also

- [The description](description.md) for the meaning and the default of each field.
- [`renderElement`](server.md#renderelement) for the markup from a server.
