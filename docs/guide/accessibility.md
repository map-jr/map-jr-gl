# Accessibility

This page says what a map offers to keyboard users and to assistive technology, and what the application must add.
It applies to both entries, `@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`.

## The keyboard

The canvas of the map has `tabindex="0"`, so the user can move the keyboard focus to it. With the focus on the map,
these keys work as in MapLibre GL JS:

| Key | Effect |
|---|---|
| Arrow keys | Move the map. |
| Shift with left or right | Rotate the map by 15°. |
| Shift with up or down | Change the pitch by 10°. |
| `+` or `=`, and `-` | Zoom in and out. |

The container of the map shows an outline of 2 pixels while the map has the keyboard focus. A click on the map
gives it the focus but shows no outline. The color is the custom property
`--map-control-focus`, and its default is `#2f7fd1`.

```js
import {createMap} from '@map-jr/map-jr-gl';

// The page has <div id="map" style="height: 400px"></div>.
document
  .getElementById('map')
  .style.setProperty('--map-control-focus', '#b00020');
const map = createMap('map', {
  style: 'https://styles.map-jr.org/1/elevation-zero.json',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
});
```

In `@map-jr/map-jr-gl/maplibre-compat`, `map.keyboard.disable()` turns the keys off. The main API has no setting that turns off only the keys.
[`interactive: false`](../reference/description.md) of the description turns off the keys, the mouse and touch.

## Names for assistive technology

| Part | Name and role |
|---|---|
| The canvas | `role="region"` and `aria-label="Map"`. The name cannot be changed. |
| A button of a control | An `aria-label` and a `title`. The fullscreen button is "Enter fullscreen" or "Exit fullscreen", with `aria-pressed`. |
| The close button of a popup | "Close popup". |
| The default marker of `@map-jr/map-jr-gl/maplibre-compat` | `aria-label="Map marker"`. |
| A marker with a popup in `@map-jr/map-jr-gl/maplibre-compat` | `role="button"` and `tabindex="0"`. Enter and the space bar open and close the popup. An element of your own keeps its own `role` and `tabindex`. |
| The SVG of the server renderer | `role="img"` and the `aria-label` from the option `label`. The default is "Map". |

To change the names of the controls, the popup and the marker, set [`locale`](../reference/description.md#locale) of the description, or the option
`locale` of `new Map()` in `@map-jr/map-jr-gl/maplibre-compat`. Both take the keys of MapLibre GL JS, such as
`'Popup.Close'`.

## Popups and the focus

When Enter or the space bar on a marker opens its popup, the focus moves into the popup: to the first link, button,
form field or element with a `tabindex`, or to the close button when the content has none. When the popup closes
while the focus is inside it, the focus returns to the marker. A popup that a click or the application opens does
not take the focus.

A popup with `closeButton: false` and nothing in its content that can take the focus leaves the focus on the marker.
To move the focus into such a popup, give an element of its content `tabindex="0"`.

## Less motion and more contrast

| Setting of the system | What the map does |
|---|---|
| `prefers-reduced-motion: reduce` | A camera animation with a `duration` shows the new view at once. The animation of a popup follows the same setting. In `@map-jr/map-jr-gl/maplibre-compat`, `essential: true` keeps the animation. |
| `forced-colors: active` | The controls, the attribution, the scale and popups have a border in the system text color. A focused button has an outline in the system highlight color. |
| `prefers-contrast: more` | The attribution has an opaque background, and the groups of controls have a black outline. |

## What the application must add

- **Symbol layers are part of the canvas.** Assistive technology cannot read them. When the places on the map carry
  information that a user needs, show the same information in the page, for example as a list next to the map. For
  a few places, use [`overlay`](markers-and-popups.md) in `@map-jr/map-jr-gl` or `Marker` in
  `@map-jr/map-jr-gl/maplibre-compat`, which are elements of the page.
- **The server renderer draws one image.** A screen reader reads its label and not the names on it. Pass a `label`
  that says what the map shows, such as "Map of the hotels in Bern". Without it, the SVG says "Map". An image of `renderToImage` has no label: set the `alt` text where the page shows it.
- **A page with `dir="rtl"` shows the unit of the scale before the number,** for example "km 100", as MapLibre GL JS
  does. To show "100 km", add the CSS rule `.map-jr-ctrl-scale { direction: ltr; }`.

## See also

- [Markers and popups](markers-and-popups.md) for elements of the page on the map.
- [Controls](controls.md) for the buttons of the map.
- [`RenderOptions`](../reference/server.md#renderoptions) for the option `label` of the server renderer.
