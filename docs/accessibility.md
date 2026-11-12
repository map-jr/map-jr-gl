# Accessibility

This document says what the library does for keyboard users and assistive technology, and what it does not do
yet. It applies to the two entries (`map-jr-gl` and `map-jr-gl/maplibre-compat`).

## What the library does

| Part | Behaviour |
|---|---|
| The map | The canvas has `tabindex="0"`, `role="region"` and `aria-label="Map"`. When it has the keyboard focus, the container of the map shows an outline of 2 pixels. The colour is the custom property `--map-control-focus` (the default is `#2f7fd1`). |
| Keyboard | With the focus on the map, the arrow keys move the map and `+` and `-` change the zoom. `map.keyboard.disable()` in `map-jr-gl/maplibre-compat` turns this off. |
| Camera animations | When the user asked the system for less motion (`prefers-reduced-motion: reduce`), `easeTo`, `flyTo`, `fitBounds` and `moveTo` with a `duration` show the new view at once. In `map-jr-gl/maplibre-compat`, the option `essential: true` keeps the animation, as in MapLibre GL JS. The animation of a popup follows the same setting. |
| Controls | Each button of a control has a name (`aria-label` and `title`) and shows the keyboard focus. The fullscreen button is named "Enter fullscreen" or "Exit fullscreen", and `aria-pressed` says whether the map fills the screen. |
| `Marker` (`map-jr-gl/maplibre-compat`) | The default marker has `aria-label="Map marker"`. A marker with a popup has `role="button"` and `tabindex="0"`, and Enter or the space bar opens and closes the popup. An element of your own keeps a `role` or a `tabindex` that you gave it. |
| Popup | The close button is named "Close popup". |

## What the library does not do yet

- **Marker layers are not visible to assistive technology.** They are drawn on the canvas. When the markers carry
  information that a user needs, give the same information in the page, for example as a list next to the map
  that moves the map to a place. For a small number of places, use `map.overlay` (`map-jr-gl`) or `Marker`
  (`map-jr-gl/maplibre-compat`): these are elements of the page.
- The focus does not move into a popup when it opens.
- The compass resets the bearing with a click. You cannot drag it to rotate the map. (Reported in the issue below; not checked again for this document.)
- Shift with an arrow key moves the map. In MapLibre GL JS it rotates and tilts the map.
- On a page with `dir="rtl"`, the scale control shows the unit before the number. (Reported in the issue below; not checked again for this document.)
- The library has no styles for `forced-colors` and `prefers-contrast`.
- The SVG of the server renderer has no `role` and no label. Give its container a label of your own.

The issue [#16](https://github.com/map-jr/map-jr-gl/issues/16) has the comparison with MapLibre GL JS.
