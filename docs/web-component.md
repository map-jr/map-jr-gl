# A web component: design proposal

This document proposes a custom element `<map-jr>` in a new entry, `@map-jr/map-jr-gl/element`. Nothing here exists
yet. Section 8 lists what the owner has decided and what is open (#826).

## 1. What it gives users

The element gives a map to pages without an adapter: plain HTML, a CMS where an editor writes markup but no script,
and applications in Angular, Lit or Solid, which all set attributes and properties and listen for events. Today such
a page calls `createMap`, `update` and `destroy` from `@map-jr/map-jr-gl` in its own script and subscribes to
`map.state` itself. An editor of a CMS cannot do that.

## 2. The API

The element is the container of the map, so give it a height.

```html
<script type="module" src="https://unpkg.com/@map-jr/map-jr-gl/dist/element.js"></script>
<map-jr map-style="https://tiles.openfreemap.org/styles/liberty" center="13.4,52.52" zoom="11"
        color-scheme="auto" style="display:block;height:400px"></map-jr>
```

**Attributes.** A field of the description (`MapDescription`) with a string, number or boolean value has an attribute
in kebab case, and the element converts the string.

| Attribute | Field | Value |
|---|---|---|
| `map-style` | `style` | the URL of a style (`style` is the CSS attribute of every element) |
| `center`, `zoom`, `bearing`, `pitch` | `initialView` | `center="lng,lat"` and numbers; a later change calls `moveTo` |
| `color-scheme`, `cursor`, `renderer`, `font-family`, `nonce` | the same name | a string |
| `min-zoom`, `max-zoom`, `max-pitch`, `padding` | the same name | a number |
| `interactive-layers` | `interactiveLayers` | ids separated by spaces |
| `projection` | `projection` | `globe` or `mercator` |
| `hover-state`, `cooperative-gestures`, `hash` | the same name | a boolean attribute |

A value that cannot be converted, such as `zoom="near"`, gets a warning in the development build.

**Properties.** Each field of the description is a property of the same name, except `style`, which is `mapStyle`.
Objects, arrays and functions are properties only: `layers`, `sources`, `data`, `images`, `controls`, `locale` (a
dictionary of texts, not a language tag), `view`, `transformRequest` and the others. A property wins over its
attribute. The element reflects nothing back to attributes, so the moving view does not change the DOM in each frame.

**Updates.** A change marks the description, and one microtask later the element calls `map.update` once with the
complete description. The map finds the fields that differ, as it does for the adapters. The first description waits
for the same microtask, so `layers` set right after the element is created are part of the first style. A property set
before the element is defined is taken over when it upgrades.

**Events.** Each event is a `CustomEvent` that bubbles, named with the prefix `map-` and the name of the Vue event, with
the same `detail`: `map-load`, `map-idle`, `map-click` (`{point, lngLat, features}`), `map-hover`, `map-error`,
`map-viewchange` (Vue's `update:view`), `map-colorschemechange`, and each event of `listen` without its dot
(`map-moveend`, `map-styleload`). Without the prefix, `click` or `wheel` would collide with the native events from the
canvas. The element listens to the map for an event only after a listener for that name is added.

**Methods and state.** `el.map` is the `MapInstance` (`null` until `map-ready`), and its methods (`queryFeatures`,
`moveTo`, `overlay`) are not repeated on the element. `el.state` is the store `map.state`. Removing the element destroys
the map one microtask later, so moving it keeps the map.

## 3. Shadow DOM or not

**Recommended: no shadow root.** The map's nodes are light-DOM children of `<map-jr>`. The element offers no shadow
root in the first version, and an opt-in can follow once the three changes at the end of this section exist.

### What other map elements and component libraries do

| Project | Shadow root | CSS of the map library | Evidence |
|---|---|---|---|
| `<gmp-map>`, Maps JavaScript API (Google) | closed | `<style>` elements and an adopted sheet in the root; no `part` names or custom properties found. Markers and controls are child elements in slots | ran (a hook on `attachShadow` in headless Chromium); [reference](https://developers.google.com/maps/documentation/javascript/reference/map) read |
| `<arcgis-map>`, `@arcgis/map-components` (Esri) | open, with `delegatesFocus` | about 78 KB of CSS as Lit styles, themed with `--arcgis-*` | source read |
| `<ol-map>`, [`@openlayers-elements/core`](https://github.com/openlayers-elements/openlayers-elements) | open | a `<link>` to a CDN copy of `ol.css`. `<ol-overlay>` hands OpenLayers a `<slot>`, which a comment in the code calls a hack | source read |
| `<mapml-viewer>`, `@maps4html/mapml` (Leaflet) | open | a `<link>` from `import.meta.url`; reads `document.activeElement.shadowRoot.activeElement` for focus | source read |
| `<map-libre>`, [`@trailstash/maplibre-component`](https://gitlab.com/trailstash/maplibre-component) (33 downloads a week) | open | `maplibre-gl.css` in an adopted sheet | source read |
| Shoelace, Web Awesome, Material Web | open | `::part` and custom properties are the API for styles | docs read |
| [Catalyst](https://github.com/github/catalyst/blob/main/docs/_guide/rendering.md) (GitHub) | none by default; opt-in from a server-rendered template | not applicable | docs read |

MapLibre GL JS fixed its fullscreen control for a shadow root in 2024
([#3572](https://github.com/maplibre/maplibre-gl-js/issues/3572)), and Mapbox says that Mapbox GL JS does not support
shadow DOM ([#12796](https://github.com/mapbox/mapbox-gl-js/issues/12796)).

Every map element in the table uses a shadow root. In each of them, markers and popups are the element's own child
elements that it places through slots, and the page styles them through custom properties. Here, `overlay()` takes an
element of the page and moves it into the map, so a shadow root separates that element from the page's CSS. The
component libraries can use a shadow root because they own all of their markup. A popup of this library holds the
page's markup.

### What the prototype showed

These results are from a run. A prototype `<map-jr>` of about 20 lines, kept outside the repository, ran on `main` at
`733c605` in headless Chromium and WebKit from Playwright. The page had CSS rules for the controls, for a marker and
for the content of a popup. Both browsers gave the same results.

| Check | Light DOM | Open shadow root |
|---|---|---|
| The library's CSS reaches the controls | yes | yes, adopted into the shadow root (#47) |
| `--map-control-size: 50px` on `map-jr` | applies (50 px) | applies (50 px) |
| A page rule `.map-jr-ctrl button {…}` | applies | does not apply. A page would write `map-jr::part(ctrl-button) {…}`, which works only after the library puts `part` names on its nodes (the prototype added them by hand) |
| A marker of `overlay()` with the page class `.pin` | shown and styled | moved into the shadow root, unstyled, 0 px wide, so not visible |
| The content of a popup of `overlay()` | shown and styled | shown, without the page's CSS |
| `queryFeatures({x, y})` from a page `click` listener | 1 feature; `event.target` is the canvas | 1 feature; `event.target` is the host |
| Escape, with the focus on the close button (#728) | closes; the focus goes to the canvas | closes; the focus is lost (#828) |
| Escape, with the focus on a button in the content | closes; the focus goes to `body` | closes; the focus is lost |
| The fullscreen control | fullscreen; `aria-pressed="true"` | fullscreen; `aria-pressed` stays `false` (#828) |
| Size of the prototype, gzip | 241 bytes | 384 bytes |

The focus that goes to `body` in light DOM is a fault of the main API in every container. It is not a fault of the
element, and it needs its own issue.

**An opt-in shadow root.** One prototype with an attribute `shadow` ran both columns from one file, at 423 bytes gzip,
which is 182 bytes more than light DOM alone. The shadow column becomes usable only after three changes to the core:

- the fix of #828, for the focus and the fullscreen state;
- `part` names on the controls and the popup, in the page script that loads up front (not measured);
- a way for the elements of `overlay()` to keep the page's CSS, for example a slot for each overlay as in `<ol-overlay>`.

Until those exist, an opt-in would offer a mode in which markers can disappear. The recommendation is therefore light
DOM only. Light DOM has two costs. A broad page rule such as `button {padding: 1em}` reaches the controls, as it does
for every entry today, and the element gives the page no encapsulation.

## 4. Server rendering

The server writes the result of `renderFirstView` from `@map-jr/map-jr-gl/server` as the children of the element:

```html
<map-jr map-style="…" center="13.4,52.52" zoom="11" style="display:block;height:400px">
  <svg data-map-jr-ssr="" …>…</svg><div data-map-jr-ssr="">© OpenStreetMap</div>
</map-jr>
```

The browser shows it before any script runs. On upgrade the element makes the map in itself without clearing its
children, and the map removes the nodes with `data-map-jr-ssr` after its first frame (`src/map.ts:704`), as for Vue and
React. There is no framework state to hydrate. A helper `renderElement(description, options)` in the server entry would
write the attributes and the first view from one description, so that they cannot disagree.

Declarative shadow DOM works only with a shadow root, and the first view of a map needs no style encapsulation, so it
adds nothing here.

## 5. Where it lives

`src/element.ts` becomes `dist/element.js` and `dist/element.dev.js`. It imports `makeMap` statically, as
`src/svelte.ts` does: a page with the element always needs the map, and `import()` would add a request before it
starts. Importing the entry defines `map-jr` unless the name is taken, and exports the class `MapJrElement` for
another name.

`scripts/check-consistency.mjs` gets a rule like rule 2: each field of the description is in the property list of
`src/element.ts` or in a list of exceptions (the callbacks are events), and is mentioned in a new `docs/element.md`.
Rule 5b expects `map-moveend` in that document. The list of forwarded events uses the `satisfies` check of
`src/vue.ts`, so the type check fails when the map gets a new event.

## 6. Size

A rough sketch of the element (about 60 lines, kept outside the project) minifies to 1,742 bytes gzip. With the
warnings in `src/mistakes.ts`, the estimate for `dist/element.js` is 1.5 to 2.5 KB gzip, not measured from a build.
The element imports the page script and changes no file that loads up front, and the worker file does not change.
`scripts/size-check.mjs` would get a ceiling of 4 KB for it.

## 7. Tests

A new suite `test/element.mjs`, like `test/vue.mjs`, in the `browser` job of CI, checks that:

- attributes become the description, and a change of `zoom` moves the map;
- properties set in one task give one `update`, and early `layers` load the style once;
- a property set before definition is applied;
- `map-load`, `map-click` and `map-viewchange` fire with their `detail`;
- removing the element destroys the map, and moving it does not;
- two elements on one page do not see each other;
- a server-rendered first view shows before the script and goes after the first frame;
- a wrong attribute value warns in the development build.

`test/loading.mjs` also loads `dist/element.js` by URL.

## 8. Decisions

The owner decided three points on 2026-11-17 (#826):

- **Event names:** the prefix `map-` for all events.
- **Registration:** importing the entry defines `map-jr`, and the entry exports the class `MapJrElement`.
- **Server rendering:** a helper `renderElement` in `@map-jr/map-jr-gl/server`.

These points are open:

1. **Shadow root.** Recommended: none in the first version (section 3). The alternatives are an open shadow root with
   `part` names, or an opt-in attribute `shadow` once #828, `part` names and slots for overlays exist.
2. **Object fields in markup.** Recommended: properties only at first. The alternative is a child
   `<script type="application/json">` with a part of the description, for a CMS editor who needs `layers`.
