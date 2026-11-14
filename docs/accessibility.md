# Accessibility

This document says what the library does for keyboard users and assistive technology, and what it does not do
yet. It applies to the two entries (`@map-jr/map-jr-gl` and `@map-jr/map-jr-gl/maplibre-compat`).

## What the library does

| Part | Behaviour |
|---|---|
| The map | The canvas has `tabindex="0"`, `role="region"` and `aria-label="Map"`. When it has the keyboard focus, the container of the map shows an outline of 2 pixels. The colour is the custom property `--map-control-focus` (the default is `#2f7fd1`). |
| Keyboard | With the focus on the map, the arrow keys move the map and `+` and `-` change the zoom. `map.keyboard.disable()` in `@map-jr/map-jr-gl/maplibre-compat` turns this off. |
| Camera animations | When the user asked the system for less motion (`prefers-reduced-motion: reduce`), `easeTo`, `flyTo`, `fitBounds` and `moveTo` with a `duration` show the new view at once. In `@map-jr/map-jr-gl/maplibre-compat`, the option `essential: true` keeps the animation, as in MapLibre GL JS. The animation of a popup follows the same setting. |
| Controls | Each button of a control has a name (`aria-label` and `title`) and shows the keyboard focus. The fullscreen button is named "Enter fullscreen" or "Exit fullscreen", and `aria-pressed` says whether the map fills the screen. A click on the compass resets the bearing and the pitch. Dragging the compass with the mouse or a finger rotates the map with the sideways movement and pitches it with the vertical movement, as in MapLibre GL JS. |
| `Marker` (`@map-jr/map-jr-gl/maplibre-compat`) | The default marker has `aria-label="Map marker"`. A marker with a popup has `role="button"` and `tabindex="0"`, and Enter or the space bar opens and closes the popup. An element of your own keeps a `role` or a `tabindex` that you gave it. |
| Popup | The close button is named "Close popup". When Enter or the space bar on a marker opens its popup, the focus moves to the first link, button, form field or element with a `tabindex` in the popup that takes the focus. The container of the map does not scroll. This is the close button when the content has none. When the popup closes while the focus is inside it, the focus returns to the marker. A popup that a click or your code opens does not take the focus. |
| Server renderer | The SVG has `role="img"` and an `aria-label`. The option `label` of `renderToSVG` and `renderFirstView` gives the text. The default is "Map". The Vue component does not pass a label for its `ssr` prop, so its SVG says "Map". An image from `renderToImage` has no label: give the `alt` text where you show the image. |

## What the library does not do yet

- **Marker layers and symbol layers are not visible to assistive technology.** They are drawn on the canvas. When the markers carry
  information that a user needs, give the same information in the page, for example as a list next to the map
  that moves the map to a place. For a small number of places, use `map.overlay` (`@map-jr/map-jr-gl`) or `Marker`
  (`@map-jr/map-jr-gl/maplibre-compat`): these are elements of the page.
- Shift with an arrow key moves the map. In MapLibre GL JS it rotates and tilts the map.
- On a page with `dir="rtl"`, the scale control shows the unit before the number. (Reported in the issue below; not checked again for this document.)
- The library has no styles for `forced-colors` and `prefers-contrast`.
- A popup with `closeButton: false` and no link, button or form field in its content does not take the focus.
  The focus stays on the marker.
- The labels of the SVG of the server renderer are not read as text, because the SVG is one image. Put the names
  that a user needs into `label` or into the page.

The issue [#16](https://github.com/map-jr/map-jr-gl/issues/16) has the comparison with MapLibre GL JS.
