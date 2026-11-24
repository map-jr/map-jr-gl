# CSS

A map of `@map-jr/map-jr-gl` adds its own style sheet, so a page loads no CSS file for it. To change the look of the
controls, the attribution, the scale and the popup, set the custom properties below on the container of the map or
on an element above it.

The rules of the library that style a button, a link or an icon inside a control (`button`, `a`, `path`, including the button of the compact attribution) have the specificity of one class, for example `.map-jr-ctrl-group button`. A rule of the page for `button`, `a`, `svg` or `div`, such as a CSS reset, does not change them. A rule with one class on a button (`.my-button {width: 50px}`) does not win either, as in MapLibre GL JS: use two classes or the custom properties.

All other rules of the library (the container of the map, the control groups, the attribution, the scale, the icons and the dark and glass looks) have no specificity, so a rule of the page with one class wins. Prefer the custom properties.

```css
#map {
  height: 400px;
  --map-control-opacity: 0.8;
  --map-control-color: #1b3a57;
  --map-popup-background: rgb(255 255 255 / 0.9);
}
```

The controls, the attribution, the scale and the popup have a translucent background with a blur, and the buttons
are round. A browser that lacks `backdrop-filter` or CSS nesting (before Safari 18, Chrome 120 and Firefox 121) shows opaque controls with
corners of 6 pixels. A map of `@map-jr/map-jr-gl/maplibre-compat` keeps the look of MapLibre GL JS.

## Custom properties

| Custom property | What it sets | Default |
|---|---|---|
| `--map-control-opacity` | The opacity of the background of the controls, from 0 to 1. The popup has 0.1 more. | `.55`, dark `.45` |
| `--map-control-radius` | The radius of the controls. The popup has three quarters of it, and the attribution and the scale have half. | half of `--map-control-size` |
| `--map-control-background` | The background of a group of buttons and of the compact attribution. It overrides `--map-control-opacity`. | white at `.55`, dark `rgb(30 30 34)` at `.45` |
| `--map-control-color` | The color of the icons and the text of the controls. | `rgb(0 0 0 / .62)`, dark `rgb(255 255 255 / .66)`; without `backdrop-filter`, `#222` and dark `#e6e6e6` |
| `--map-control-size` | The width and the height of a button. | `32px`, `44px` on a touch screen |
| `--map-control-focus` | The color of the focus outline of a button and of the map. | `#2f7fd1` |
| `--map-attribution-background` | The background of the attribution and the scale. | as the controls |
| `--map-popup-background` | The background of a popup. | white at `.65`, dark `rgb(43 43 43)` at `.55` |
| `--map-popup-color` | The color of the text of a popup. | `#222`, dark `#e6e6e6` |

The dark defaults apply while the resolved [`colorScheme`](description.md#colorscheme-and-oncolorschemechange) is
`'dark'`. A custom property that the page sets overrides both schemes.

## Classes

The map sets these classes, which a rule of the page can select:

| Class | Element | When |
|---|---|---|
| `map-jr-dark` | The container | While the resolved `colorScheme` is `'dark'`. |
| `map-jr-unavailable` | An element that fills the container | The browser has no WebGL2: see [A browser without WebGL2](create-map.md#a-browser-without-webgl2). |
| `map-jr-pseudo-fullscreen` | The container | The control `fullscreen()` fills the window in a browser without the Fullscreen API. |
| `map-jr-ctrl-shrink` | The button of the control `fullscreen()` | While the map fills the screen. |
| `map-jr-ctrl-terrain-enabled` | The button of the control `terrain()` | While the map has terrain. |
| `map-jr-ctrl-globe-enabled` | The button of the control `globe()` | While the projection is `globe`. |

The elements of the map also have classes `maplibregl-*` for code written for MapLibre GL JS. Their names and their
structure can change in any release, so do not select them.

## See also

- [Controls](../guide/controls.md) for the controls that these properties style.
- [Content Security Policy](../guide/loading.md#content-security-policy) for `nonce`, which a strict `style-src` needs for the
  style sheet of the map.
