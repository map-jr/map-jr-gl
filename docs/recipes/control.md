# Add a control of your own

This example puts a button of your own into the top left corner of the map. Each click on the button shows the next of
three styles. The zoom buttons stay in the top right corner.

<!-- example:control:start -->
**Main API**

```js [Main API]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A button of your own in the top left corner of the map shows
// the next style, and a line of text below the map names the style.
import {createMap} from '@map-jr/map-jr-gl';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

const container = document.getElementById('map');
const readout = document.createElement('p');
container.after(readout);
readout.textContent = `Style: ${styles[current]}`;

// The element of the control. The map places it in its corner and gives it the
// class map-jr-ctrl, which lets it take clicks. Its look is yours.
const button = document.createElement('button');
button.textContent = 'Next style';
button.style.cssText =
  'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
button.addEventListener('click', () => {
  current = (current + 1) % styles.length;
  map.patch({style: styleUrl(styles[current])});
  readout.textContent = `Style: ${styles[current]}`;
});

const map = createMap(container, {
  style: styleUrl(styles[current]),
  initialView: {center: [-74.0065, 40.7085], zoom: 13},
  attribution: {compact: true},
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls: [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: button}),
  ],
});
```

**MapLibre compat**

```js [MapLibre compat]
// The module script of a page that has <div id="map" style="height:
// 500px"></div>. A button of your own in the top left corner of the map shows
// the next style, and a line of text below the map names the style.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const styleUrl = name => `https://styles.map-jr.org/1/${name}.json`;
let current = 0;

// A control of MapLibre GL JS: an object with onAdd, which returns the element
// of the control, and onRemove.
class NextStyleControl {
  onAdd(map) {
    this.container = document.createElement('div');
    // The class maplibregl-ctrl lets the element take clicks. Its look is
    // yours.
    this.container.className = 'maplibregl-ctrl';
    const button = this.container.appendChild(document.createElement('button'));
    button.textContent = 'Next style';
    button.style.cssText =
      'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
    button.addEventListener('click', () => {
      current = (current + 1) % styles.length;
      map.setStyle(styleUrl(styles[current]));
      readout.textContent = `Style: ${styles[current]}`;
    });
    return this.container;
  }
  onRemove() {
    this.container.remove();
  }
}

const map = new Map({
  container: 'map',
  style: styleUrl(styles[current]),
  center: [-74.0065, 40.7085],
  zoom: 13,
  attributionControl: {compact: true},
});
map.addControl(new NavigationControl());
map.addControl(new NextStyleControl(), 'top-left');
const readout = document.createElement('p');
map.getContainer().after(readout);
readout.textContent = `Style: ${styles[current]}`;
```

**Vue**

```vue [Vue]
<script setup>
import {onMounted, ref, shallowRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The element of the control, made in the browser only, because `document` does
// not exist during server rendering. The map places it in its corner, and
// <Teleport> renders the button into it.
const corner = shallowRef(null);
const controls = shallowRef([navigation()]);
onMounted(() => {
  corner.value = document.createElement('div');
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls.value = [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: corner.value}),
  ];
});
</script>

<template>
  <MapJr
    :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
    :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ styles[current] }}</p>
  <Teleport v-if="corner" :to="corner">
    <button
      style="
        padding: 6px 12px;
        border: 0;
        border-radius: 16px;
        background: #fff;
        color: #222;
        font:
          13px system-ui,
          sans-serif;
        box-shadow: 0 1px 4px #0004;
        cursor: pointer;
      "
      @click="current = (current + 1) % styles.length"
    >
      Next style
    </button>
  </Teleport>
</template>
```

**Nuxt**

```vue [Nuxt]
<script setup>
// A page of a Nuxt app whose nuxt.config.ts has modules:
// ['@map-jr/map-jr-gl/nuxt'].

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const current = ref(0);
// The element of the control, made in the browser only, because `document` does
// not exist during server rendering. The map places it in its corner, and
// <Teleport> renders the button into it.
const corner = shallowRef(null);
const controls = shallowRef([navigationControl()]);
onMounted(() => {
  corner.value = document.createElement('div');
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  controls.value = [
    navigationControl(),
    customControl({
      key: 'next-style',
      position: 'top-left',
      element: corner.value,
    }),
  ];
});
</script>

<template>
  <MapJr
    :map-style="`https://styles.map-jr.org/1/${styles[current]}.json`"
    :initial-view="{center: [-74.0065, 40.7085], zoom: 13}"
    :controls="controls"
    :attribution="{compact: true}"
  />
  <p>Style: {{ styles[current] }}</p>
  <Teleport v-if="corner" :to="corner">
    <button
      style="
        padding: 6px 12px;
        border: 0;
        border-radius: 16px;
        background: #fff;
        color: #222;
        font:
          13px system-ui,
          sans-serif;
        box-shadow: 0 1px 4px #0004;
        cursor: pointer;
      "
      @click="current = (current + 1) % styles.length"
    >
      Next style
    </button>
  </Teleport>
</template>
```

**React**

```jsx [React]
import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const button = {
  padding: '6px 12px',
  border: 0,
  borderRadius: '16px',
  background: '#fff',
  color: '#222',
  font: '13px system-ui,sans-serif',
  boxShadow: '0 1px 4px #0004',
  cursor: 'pointer',
};

export default function Control() {
  const [current, setCurrent] = useState(0);
  // The element of the control, made in the browser only, because `document`
  // does not exist during server rendering. The map places it in its corner,
  // and the portal renders the button into it.
  const [corner, setCorner] = useState(null);
  useEffect(() => setCorner(document.createElement('div')), []);
  // `key` names the control: the map keeps it while the list has a control with
  // this key.
  const controls = useMemo(
    () =>
      corner
        ? [
            navigation(),
            custom({key: 'next-style', position: 'top-left', element: corner}),
          ]
        : [navigation()],
    [corner],
  );

  return (
    <>
      <MapJr
        mapStyle={`https://styles.map-jr.org/1/${styles[current]}.json`}
        initialView={{center: [-74.0065, 40.7085], zoom: 13}}
        controls={controls}
        attribution={{compact: true}}
      />
      <p>Style: {styles[current]}</p>
      {corner &&
        createPortal(
          <button
            style={button}
            onClick={() => setCurrent((current + 1) % styles.length)}
          >
            Next style
          </button>,
          corner,
        )}
    </>
  );
}
```

**Svelte**

```svelte [Svelte]
<script>
  import {mapJr} from '@map-jr/map-jr-gl/svelte';
  import {navigation, custom} from '@map-jr/map-jr-gl/controls';

  const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
  let current = $state(0);
  // The element of the control. The map moves it into its corner once the
  // element exists. (The <div> around it stays where it is, so that Svelte
  // finds its own elements when it removes the component.)
  let button = $state(null);
  // A change is a new description. The map finds what is different.
  const description = $derived({
    style: `https://styles.map-jr.org/1/${styles[current]}.json`,
    initialView: {center: [-74.0065, 40.7085], zoom: 13},
    attribution: {compact: true},
    // `key` names the control: the map keeps it while the list has a control
    // with this key.
    controls: button
      ? [
          navigation(),
          custom({key: 'next-style', position: 'top-left', element: button}),
        ]
      : [navigation()],
  });
</script>

<div use:mapJr={{description}} style="height: 500px"></div>
<p>Style: {styles[current]}</p>
<div hidden>
  <button
    bind:this={button}
    class="next"
    onclick={() => (current = (current + 1) % styles.length)}>Next style</button
  >
</div>

<style>
  .next {
    padding: 6px 12px;
    border: 0;
    border-radius: 16px;
    background: #fff;
    color: #222;
    font:
      13px system-ui,
      sans-serif;
    box-shadow: 0 1px 4px #0004;
    cursor: pointer;
  }
</style>
```

**`<map-jr>`**

```html [<map-jr>]
<!doctype html>
<meta charset="utf-8" />
<title>A control of your own</title>
<!--
  A button of your own in the top
  left corner of the map shows the
  next style, and a line of text
  below the map names the style.
-->
<map-jr
  id="map"
  map-style="https://styles.map-jr.org/1/elevation-zero.json"
  center="-74.0065,40.7085"
  zoom="13"
  attribution-compact
  style="height: 500px"
></map-jr>
<p id="readout">Style: elevation-zero</p>
<script type="module">
  import '@map-jr/map-jr-gl/element';
  import {navigation, custom} from '@map-jr/map-jr-gl/controls';

  const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
  let current = 0;
  const map = document.getElementById('map');
  const readout = document.getElementById('readout');

  // The element of the control.
  // The map places it in its
  // corner and gives it the class
  // map-jr-ctrl, which lets it
  // take clicks. Its look is
  // yours.
  const button = document.createElement('button');
  button.textContent = 'Next style';
  button.style.cssText =
    'padding:6px 12px;border:0;border-radius:16px;background:#fff;color:#222;font:13px system-ui,sans-serif;box-shadow:0 1px 4px #0004;cursor:pointer';
  button.addEventListener('click', () => {
    current = (current + 1) % styles.length;
    map.setAttribute(
      'map-style',
      `https://styles.map-jr.org/1/${styles[current]}.json`,
    );
    readout.textContent = `Style: ${styles[current]}`;
  });
  // `key` names the control: the
  // map keeps it while the list
  // has a control with this key.
  map.controls = [
    navigation(),
    custom({key: 'next-style', position: 'top-left', element: button}),
  ];
</script>
```
<!-- example:control:end -->

## How it works

- [`custom({key, position, element})`](../reference/controls.md#custom) of `@map-jr/map-jr-gl/controls` puts an element
  of your page into a corner of the map.
- `key` names the control. The map keeps the control while the list of
  [`controls`](../reference/description.md#controls) has an item with this `key`, and removes it when a description
  does not have one.
- The map gives the element the class `map-jr-ctrl`, and only an element with this class receives clicks. Add your own
  classes with `classList.add`, because an assignment to `className` removes it.
- In Vue and React, the element is a `<div>` that the component creates once in the browser. `<Teleport>` or
  `createPortal` renders the button into it, so the button is part of the component. In Svelte, `bind:this` gives the
  button itself to `custom`.
- In the compat entry, a control is an object with `onAdd(map)` and `onRemove(map)`, which `addControl` adds, as in
  MapLibre GL JS.

## Variations

The variation replaces `controls` of the Main API example. `RulerControl` stands for a control class of a plugin.

### Use a control written for MapLibre GL JS

`custom` also accepts the methods of a control of MapLibre GL JS. `onAdd` receives the map on which the main API is
built, which has `on`, `off`, `getContainer`, `getCanvas`, `project`, `unproject`, `getZoom`, `getCenter` and
`getBearing`. A control that calls another method of MapLibre GL JS works only in the compat entry.

```js
const ruler = new RulerControl();
const controls = [
  navigation(),
  custom({key: 'next-style', position: 'top-left', element: button}),
  custom({
    key: 'ruler',
    onAdd: map => ruler.onAdd(map),
    onRemove: map => ruler.onRemove(map),
  }),
];
```

## See also

- [Add a control of your own](../guide/controls.md#add-a-control-of-your-own) in the guide to controls.
- [`custom`](../reference/controls.md#custom) in the reference of the controls.
