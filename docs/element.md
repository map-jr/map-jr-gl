# The web component

The entry `@map-jr/map-jr-gl/element` defines the custom element `<map-jr>`. It is for pages without an adapter:
plain HTML, a CMS where an editor writes markup, and applications in Angular, Lit, Solid or another framework that
sets attributes and properties and listens for events. The element is a thin layer over [the main API](api.md): its
attributes and properties make one description (`MapDescription`), and the element gives that description to the map.

The entry is new: it is in the first release after version 0.7.0.

## The element

```html
<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"></script>

<map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="-74.0065,40.7085" zoom="13.6"
        color-scheme="auto" style="height: 400px"></map-jr>
```

With a bundler, import the entry once, for example in the main file of the application:

```js
import '@map-jr/map-jr-gl/element';
```

Importing the entry defines `<map-jr>`, unless the page has defined that name already. The entry also exports the
class `MapJrElement`, which defines the element under another name:

```js
import {MapJrElement} from '@map-jr/map-jr-gl/element';

customElements.define('city-map', class extends MapJrElement {});
```

The element is the container of the map, so give it a height in CSS. It has `display: block` from a rule with no
specificity, so a rule of the page wins. The map is in the light DOM of the element: there is no shadow root, and the
CSS of the page reaches the controls, the popups and the elements of `overlay()`. The element makes the map in the
microtask after it is put into the page, and destroys the map in the microtask after it is removed. An element that is
moved to another place in the page keeps its map. The development build warns about an element with a height of 0,
and about an element that has no style a second after it was put into the page.

## Attributes

A field of the description with a string, number or boolean value has an attribute. The name of the attribute is the
name of the field in kebab case, and a field that is on by default has an attribute named `no-` and the field, which
switches it off (`no-interactive`). The element reads the attributes when it makes the map, and again after each change.

| Attribute | Field of the description | Value |
|---|---|---|
| `map-style` | `style` | The URL of a style. (`style` is the CSS attribute of every element, so the attribute has this name.) |
| `center` | `initialView.center` | The longitude and the latitude with a comma between them: `center="13.4,52.52"`. |
| `zoom`, `bearing`, `pitch` | `initialView.zoom`, `.bearing`, `.pitch` | A number. |
| `color-scheme` | `colorScheme` | `light` (the default), `dark` or `auto`. |
| `cursor` | `cursor` | A CSS cursor. |
| `min-zoom`, `max-zoom`, `max-pitch` | `minZoom`, `maxZoom`, `maxPitch` | A number. |
| `padding` | `padding` | A number of CSS pixels for each side. For different sides, set the property `padding`. |
| `interactive-layers` | `interactiveLayers` | The ids of style layers with spaces between them. |
| `projection` | `projection` | `globe` or `mercator`. |
| `hover-state`, `cooperative-gestures`, `antialias` | `hoverState`, `cooperativeGestures`, `antialias` | A boolean attribute: present is `true`. |
| `no-interactive` | `interactive` | A boolean attribute: present is `false`, so the user cannot move the map. |
| `no-attribution` | `attribution` | A boolean attribute: present is `false`, which hides the attribution. |
| `attribution-compact` | `attribution.compact` | A boolean attribute: present is `attribution: {compact: true}`. `no-attribution` wins over it. |
| `hash` | `hash` | A boolean attribute, or the name of the parameter of the URL: `hash="map"`. |
| `renderer`, `font-family`, `nonce` | `renderer`, `fontFamily`, `nonce` | A string. These are read when the map is made only. |

A change of `center`, `zoom`, `bearing` or `pitch` after the map is made moves the map to the new value with
`moveTo`, as the fields of `initialView` cannot change the view of a map that exists. A change of another attribute
updates the map.

An attribute that the element cannot read, such as `zoom="near"` or `center="Berlin"`, is
ignored, and the development build warns once for each element:

```
[map-jr-gl] <map-jr>: the attribute zoom="near" cannot be read, so the element ignores it. Write a number, for example zoom="11".
```

A boolean attribute takes effect when it is there, whatever its value, as in HTML: `hover-state="false"` switches
`hoverState` on. To undo a boolean attribute, remove it. The development build warns once for each element and
attribute with the value `"false"`, and names the attribute to remove.

Removing `map-style` from an element whose map exists, with no property `mapStyle`, keeps the style that the map has,
and the development build warns. To change the style, give another URL or set `mapStyle`.

The element writes nothing back to its attributes. The view that the user moves is in the property `state` and in the
event `map-viewchange`, not in `center` and `zoom`.

## Properties

Each field of the description is a property of the element with the same name, except `style`, which is the
property `mapStyle`. Objects, lists and functions are properties only. A property wins over its attribute.

| Property | Meaning |
|---|---|
| `mapStyle` | A style object or the URL of a style, or a pair `{light, dark}`. |
| `initialView` | The view at the start: a view, or `{bounds, fitPadding}`. Its fields come before those of the attributes `center`, `zoom`, `bearing` and `pitch`. Read when the map is made only. |
| `view` | A view that the application owns. Write each `map-viewchange` back to it, or change it to move the map. |
| `sources`, `layers`, `terrain` | Sources, layers and terrain to add to the style. See [Your own layers on a style from a URL](api.md#your-own-layers-on-a-style-from-a-url). |
| `data` | GeoJSON data for sources, by the id of the source. Each value is compared by identity: give a new object to change it. |
| `images`, `sprite` | Images and sprites for the style layers. See [Images for style layers](api.md#images-for-style-layers). |
| `fonts` | Web fonts for labels. See [Web fonts](api.md#web-fonts). |
| `controls` | Controls from `@map-jr/map-jr-gl/controls`: `[navigation(), scale()]`. |
| `projection`, `globalState`, `locale`, `maxBounds`, `padding`, `transformRequest` | As in [the description](api.md#the-description). `locale` is an object of texts by the keys of MapLibre GL JS, not a language tag. |
| `interactiveLayers`, `hoverState`, `minZoom`, `maxZoom`, `maxPitch`, `cursor`, `cooperativeGestures`, `colorScheme` | As the attributes of the same name. |
| `renderer`, `fontFamily`, `interactive`, `antialias`, `attribution`, `hash`, `nonce` | Read when the map is made only (`MapSetup` in [the main API](api.md)). The property `attribution` wins over `no-attribution` and `attribution-compact`. `nonce` is the property of every HTML element. |
| `map` | The map (`MapInstance`), read only. `null` until the event `map-ready`, and again after the element is removed. Its methods (`queryFeatures`, `moveTo`, `overlay` and the others) are those of [the main API](api.md). |
| `state` | The state of the map as a store (`map.state`), read only, or `null` while there is no map. |

All changes in one task give the map one `update`, one microtask later. The first description waits for the same
microtask, so properties that are set right after the element is created are part of the first style:

```js
import '@map-jr/map-jr-gl/element';
import {navigation} from '@map-jr/map-jr-gl/controls';

const map = document.createElement('map-jr');
map.style.height = '400px';
map.mapStyle = 'https://styles.map-jr.org/1/elevation-zero.json';
map.initialView = {center: [-74.0065, 40.7085], zoom: 13.6};
map.controls = [navigation()];
map.data = {places: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]}}]}};
map.layers = [{id: 'places', type: 'circle', source: 'places', paint: {'circle-radius': 8, 'circle-color': '#d6453d'}}];
document.body.append(map);
```

A property that the page sets on the element before the entry has loaded is taken over when the element is defined.
The description is compared field by field, as with `update` of the main API: to change `data` or `layers`, give a
new object or list, because a change inside the object that the element has is not seen.

## Events

Each event is a `CustomEvent` that bubbles. Its name is `map-` and the name of the event of the
[Vue component](vue.md#events), and its `detail` is the value of that event.

| Event | `detail` |
|---|---|
| `map-ready` | The map (`MapInstance`), right after the element has made it. `el.map` has it from then on. |
| `map-load` | The map. It comes once, before the first `map-idle`. |
| `map-idle` | `null`. |
| `map-click` | `{point, lngLat, features}`: `features` has the features of `interactive-layers` at the point. |
| `map-hover` | The features of `interactive-layers` under the pointer. |
| `map-viewchange` | The view (`{center, zoom, bearing, pitch, bounds}`), after each change. It is the event `update:view` of Vue. |
| `map-colorschemechange` | The `colorScheme` that the control `colorScheme()` chose. It is the event `update:colorScheme` of Vue. |
| `map-error` | Each error of the map (an `Error`). The error also goes to the console unless a listener calls `event.preventDefault()`, as for the event `error` of `window`. |
| Each other event of the map | The event of `listen` of the main API: `map-moveend`, `map-zoomend`, `map-styleimagemissing`, `map-sourcedata` and the others. See [Events](api.md#events) for the list. The event `style.load` is `map-styleload`. |

The names have the prefix so that they cannot be the native events of the canvas, such as `click` and `wheel`. The
element dispatches every event of the table whenever the map fires it, whoever listens: a listener on the element, on
an ancestor or on the document receives it, also when it was added before the entry loaded. The events that come once
per frame or per pointer move, such as `map-move`, `map-render` and `map-mousemove`, are dispatched too.

```html
<map-jr id="map" map-style="https://styles.map-jr.org/1/elevation-zero.json" center="13.4,52.52" zoom="11"
        interactive-layers="poi_z14" style="height: 400px"></map-jr>
<p id="where"></p>
<script type="module">
  import 'https://unpkg.com/@map-jr/map-jr-gl/dist/element.js';

  const map = document.getElementById('map'), where = document.getElementById('where');
  map.addEventListener('map-click', event => {
    const [lng, lat] = event.detail.lngLat;
    where.textContent = `${lng.toFixed(4)}, ${lat.toFixed(4)}: ${event.detail.features[0]?.properties.name ?? 'no place'}`;
  });
  map.addEventListener('map-moveend', () => console.log(map.state.get().view.zoom));
</script>
```

## Elements of the page on the map

A marker or a popup is an element of the page that `overlay()` of the map places. Call it after `map-ready`:

```js
const map = document.querySelector('map-jr');
map.addEventListener('map-ready', () => {
  const pin = Object.assign(document.createElement('div'), {className: 'pin', textContent: 'Office'});
  map.map.overlay(pin, {lngLat: [-74.0065, 40.7085], anchor: 'bottom'});
});
```

The element is in the light DOM of `<map-jr>`, so the CSS of the page styles it. See
[Elements of the page on the map](api.md#elements-of-the-page-on-the-map).

## Server rendering

`renderElement(description, options)` of `@map-jr/map-jr-gl/server` returns the markup of the element for a
description: an attribute for each field that has one, and the first view (the result of `renderFirstView`) as the
children of the element. The browser shows the first view before any script runs, and the map removes it after its
first frame, as with the Vue and React components.

```js
import {renderElement} from '@map-jr/map-jr-gl/server';

const html = await renderElement(
  {style: 'https://styles.map-jr.org/1/elevation-zero.json', initialView: {center: [13.4, 52.52], zoom: 11}},
  {width: 800, height: 400, attributes: {id: 'map', style: 'height: 400px'}},
);
// <map-jr map-style="https://styles.map-jr.org/1/elevation-zero.json" center="13.4,52.52" zoom="11" id="map"
//   style="display:block;position:relative;overflow:hidden;height: 400px"><svg data-map-jr-ssr="" …>…</svg>…</map-jr>
```

| Option | Meaning |
|---|---|
| `width`, `height` | The size in CSS pixels that the element has on most screens. The default is 800 by 500. |
| `attributes` | More attributes of the element, by name. A name that starts with `on` (an event handler attribute) throws. The text of `style` comes after `display:block;position:relative;overflow:hidden`, which the first view needs before the script runs. |
| `attribution` | The credits to show, when the server must not take them from the sources of the style. |
| `overrides`, `timeout`, `requestTimeout`, `maxBytes`, `allowHosts` and the other options of `renderToSVG` | See [Server rendering](server-rendering.md#options). |

The description can have every field: the server renders `sources`, `layers`, `terrain`, `data`, `images` and
`sprite` too. A field that has no attribute (a style object, `layers`, `data`) is not in the markup, so the page sets
it as a property of the element with the same value. A render that fails does not fail the page: the result is the
element without the first view, and the console has the error. The map then draws in the browser as it does without
a server.

## What is not in this entry

- A shadow root. The element is in the light DOM so that the CSS of the page reaches the elements of `overlay()`.
  A shadow mode can follow when the controls have `part` names and `overlay()` has slots (#826).
- Object fields in markup. `layers`, `data` and the other objects are properties only.
- The components `MapOverlay` and `MapImage` of Vue and React. Use `map.overlay()` and the property `images`.
