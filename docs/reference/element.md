# The element `<map-jr>`

The entry `@map-jr/map-jr-gl/element` defines the custom element `<map-jr>`, a map of `@map-jr/map-jr-gl` that is
written as HTML. Its attributes and properties form one [description](description.md), and the element passes that
description to the map. It is for pages without a framework adapter: plain HTML, markup from a CMS, and frameworks
that set attributes and properties and listen for events.

```html
<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"></script>

<map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085" zoom="13.6"
        style="height: 400px"></map-jr>
```

## Define the element

Loading `dist/element.js` with a `<script>` defines `<map-jr>`, unless the page has defined that name already. The
entry also exports the class `MapJrElement`. With a bundler, import the class and use it: the package declares that
its files have no side effects, so a bundler can remove `import '@map-jr/map-jr-gl/element'`, which imports no name,
and the element is then never defined.

```js
import {MapJrElement} from '@map-jr/map-jr-gl/element';

if (!customElements.get('map-jr')) customElements.define('map-jr', MapJrElement);
```

To define the element under another name, define a subclass: `customElements.define('city-map', class extends
MapJrElement {});`.

The element is the container of the map, so give it a height in CSS. It has `display: block` from a rule with no
specificity, and a rule of the page overrides it. The element has no shadow root, so the CSS of the page styles the
controls, the popups and the elements of `overlay()`.

The element creates the map in the microtask after it is added to the page, and destroys the map in the microtask
after it is removed. An element that is moved in the page in one task keeps its map.

## Attributes

A field of the description with a string, number or boolean value has an attribute. Its name is the name of the field
in kebab case.

| Attribute | Field of the description | Value |
|---|---|---|
| `map-style` | `style` | The URL of a style. |
| `center` | `initialView.center` | The longitude and the latitude with a comma between them: `center="13.4,52.52"`. |
| `zoom`, `bearing`, `pitch` | `initialView.zoom`, `.bearing`, `.pitch` | A number. |
| `color-scheme` | `colorScheme` | `light`, `dark` or `auto`. |
| `cursor` | `cursor` | A CSS cursor. |
| `min-zoom`, `max-zoom`, `max-pitch` | `minZoom`, `maxZoom`, `maxPitch` | A number. |
| `padding` | `padding` | A number of CSS pixels for each side. |
| `interactive-layers` | `interactiveLayers` | The ids of style layers with spaces between them. |
| `projection` | `projection` | `globe` or `mercator`. |
| `hover-state`, `cooperative-gestures` | `hoverState`, `cooperativeGestures` | A boolean attribute. |
| `hash` | `hash` | A boolean attribute, or the name of the parameter of the URL: `hash="map"`. |
| `renderer`, `font-family` | `renderer`, `fontFamily` | A string. |

The defaults and the meaning of each value are those of the field in [`MapDescription`](description.md#mapdescription).
The map reads `renderer`, `font-family` and `hash` only when it is created, as every field of
[`MapSetup`](description.md#mapsetup). The attribute `nonce` of every HTML element sets `nonce` of the description.

### Change an attribute

A change of `center`, `zoom`, `bearing` or `pitch` after the map is created moves the camera to the new value with no
animation. A change of another attribute updates the map. The element writes nothing back to its attributes: the
view that the user moves is in [`state`](#mapjrelement) and in the event `map-viewchange`.

A boolean attribute is on when it is there, whatever its value. To switch it off, remove the attribute.
`hover-state="false"` cannot be read, and the element ignores it.

An attribute that the element cannot read, such as `zoom="near"`, is ignored, and the
[development build](../api.md#make-a-map) warns once for each element:

```text
[map-jr-gl] <map-jr>: the attribute zoom="near" cannot be read, so the element ignores it. Write a number, for example zoom="11".
```

When `map-style` is removed from an element whose map exists, and the element has no property `mapStyle`, the map
keeps the style that it has. To change the style, set another URL in `map-style` or set `mapStyle`.

## `MapJrElement`

Each field of the description is a property of the element with the same name, except `style`, which is the
property `mapStyle`. Objects, lists and functions, such as `layers`, `data`, `controls` and `transformRequest`, are
properties only. A property overrides the attribute of the same field, and the fields of the property `initialView`
override the attributes `center`, `zoom`, `bearing` and `pitch`. The table lists the members that the description
does not have.

<!-- ref:MapJrElement:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `mapStyle` | [`MapDescription`](description.md#mapdescription)`['style']` | | The `style` of the description: the URL of a style, a style object, or `{light, dark}`. |
| `map` (read only) | `MapInstance \| null` | | The map (`MapInstance`), from the microtask after the element is added to the page until it is removed, or else `null`. |
| `state` (read only) | `MapInstance['state'] \| null` | | The state of the map as a store (`map.state`), or `null` while there is no map. |
| `addEventListener` | `(type: string, listener: EventListenerOrEventListenerObject, options?: boolean \| AddEventListenerOptions \| undefined) => void` | | Adds a listener, as on any element. |
<!-- ref:MapJrElement:end -->

The element applies all changes of one task to the map with one `update`, in the next microtask. Properties that the
page sets right after it creates the element are part of the first description.

```js
import {MapJrElement} from '@map-jr/map-jr-gl/element';
import {navigation} from '@map-jr/map-jr-gl/controls';

if (!customElements.get('map-jr')) customElements.define('map-jr', MapJrElement);

const map = document.createElement('map-jr');
map.style.height = '400px';
map.mapStyle = 'https://styles.map-jr.org/1/elevation-zero.json';
map.initialView = {center: [-74.0065, 40.7085], zoom: 13.6};
map.controls = [navigation()];
map.sources = {offices: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}};
map.data = {offices: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]}}]}};
map.layers = [{id: 'offices', type: 'circle', source: 'offices', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}}];
document.body.append(map);
```

The element compares the description field by field, as [`update`](../api.md#change-the-map) does. To change
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
| `map-viewchange` | The new view, `{center, zoom, bearing, pitch, bounds}`, at each change of the view. |
| `map-colorschemechange` | The `colorScheme` that the control `colorScheme()` set. |
| `map-error` | Each error of the map, an `Error`. |
| `map-` and the name of each other event | The event object of [`listen`](../api.md#events): `map-moveend`, `map-sourcedata` and the others. `style.load` is `map-styleload`. |

The element writes each error to the console, unless a listener of `map-error` calls `event.preventDefault()`.

The element forwards an event of the last row only after a listener for its name is added to the element itself with
`addEventListener`, after the entry has loaded. A listener on the document receives these events only when the
element also has one. To add a listener before the element is defined, first `await customElements.whenDefined('map-jr')`.

```html
<map-jr id="map" map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085" zoom="15"
        interactive-layers="poi_z14 poi_z15 poi_z16" style="height: 400px"></map-jr>
<p id="where"></p>
<script type="module">
  import 'https://unpkg.com/@map-jr/map-jr-gl/dist/element.js';

  const map = document.getElementById('map');
  const where = document.getElementById('where');
  map.addEventListener('map-click', event => {
    where.textContent = event.detail.features[0]?.properties.name ?? 'No place here';
  });
  map.addEventListener('map-moveend', () => console.log(map.state.get().view.zoom));
</script>
```

## Markers and popups

The element has no component for a marker or a popup. Call [`overlay`](../api.md#elements-of-the-page-on-the-map) of
the map after `map-ready`.

```html
<map-jr id="office-map" map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085"
        zoom="14" style="height: 400px"></map-jr>
<script type="module">
  import 'https://unpkg.com/@map-jr/map-jr-gl/dist/element.js';

  const element = document.getElementById('office-map');
  element.addEventListener('map-ready', event => {
    const pin = Object.assign(document.createElement('div'), {className: 'pin', textContent: 'Office'});
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
