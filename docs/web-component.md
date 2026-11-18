# A web component: design proposal

This document proposes a custom element `<map-jr>` in a new entry, `@map-jr/map-jr-gl/element`. Nothing here exists
yet. The owner decides the points of section 8 (#826).

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

**Recommended: no shadow root.** The map's nodes are light-DOM children of the element.

| | Light DOM | Shadow root |
|---|---|---|
| CSS of the library | in the document, as today | adopted into the shadow root (`src/map.ts:1405`, #47) |
| Page CSS for controls and popups | class rules and `--map-control-*` work as `docs/api.md` documents | only custom properties cross; class rules need a new `::part` API |
| Overlays | `overlay(element)` moves the element into the map, and page CSS still reaches it | the element moves into the shadow root, away from page CSS and from the framework that rendered it |
| Page listeners | `event.target` is the canvas or the control | retargeted to the host; code needs `composedPath()` |
| ARIA | an `id` on the page can name a node of the map | `id` references cannot cross the boundary |

In light DOM a broad page rule such as `button {padding: 1em}` reaches the controls, as it does for every entry today.
`queryFeatures` at a pointer position works in both cases, because `map-click` carries `point` and `features`.

Focus inside a shadow root has faults today, found by reading and not run. `focusFirst` (`src/overlays.ts:185`) and
the return of focus after Escape closes a popup (`src/overlays.ts:231`, #728) compare with `document.activeElement`,
which is the host there, and the fullscreen control does the same with `document.fullscreenElement`
(`src/controls-more.ts:204`). This affects any map in an application's shadow root and needs its own issue.

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

## 8. Open decisions for the owner

1. **Shadow root.** Recommended: none (section 3). The alternative is an open shadow root with `::part` names.
2. **Event names.** Recommended: the prefix `map-` for all events. The alternative drops it where no native event
   collides.
3. **Registration.** Recommended: the import defines `map-jr`. The alternative is an explicit `define()`, which a CMS
   page would have to call in a script.
4. **Object fields in markup.** Recommended: properties only at first. The alternative is a child
   `<script type="application/json">` with a part of the description, for a CMS editor who needs `layers`.
5. **`renderElement` in the server entry.** Recommended: yes.
