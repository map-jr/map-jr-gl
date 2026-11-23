// Runs one form of one example in an element. The harness page (examples/run.html) mounts an example through this file.
//
// An example file is the module script of a page that has <div id="map">, and it runs as it is written there. It finds
// its container by the id "map" when its code starts (`document.getElementById('map')`, or `container: 'map'` in the
// compat entry), it names its map `map`, and it puts what it shows beside the map directly after the container: a <p>
// for a line of text and <button> elements. The build loads each file with `?mount` as a function that runs the code
// of the file and resolves with its `map` (the plugin `examplesAsFunctions` in site/vite.config.mjs), so the harness
// can run a file again, and on a page with several maps.
//
// A <map-jr> form (examples/<id>.html) is a page with the element <map-jr id="map">, the elements beside it and one
// module script. The build loads it with `?mount` as its markup and its script as a function (the same plugin), and
// the harness puts the element into the container, the other elements after it, and then runs the script. A Svelte
// form (examples/<id>.svelte) is compiled by the plugin `svelteExamples` of site/vite.config.mjs, which also gives it
// examples/harness/svelte.js as `@map-jr/map-jr-gl/svelte`, so that the harness gets the map that the action makes.
import {mount as mountSvelte, flushSync} from 'svelte';
import {made} from './svelte.js';

const modules = import.meta.glob(['../*.js', '../*.svelte', '../*.html', '!../run.html'], {query: '?mount'});

/** The forms of an example: the name in the address, the label, and the ending of the file (examples/<id><ending>). */
export const FORMS = [['core', 'Main API', '.js'], ['compat', 'MapLibre compat', '.compat.js'], ['vue', 'Vue', '.vue'], ['nuxt', 'Nuxt', '.nuxt.vue'], ['react', 'React', '.jsx'], ['svelte', 'Svelte', '.svelte'], ['element', '<map-jr>', '.html']];

// How each form that runs is mounted: `(module, stage) => map`, where `module` is the imported file of the form. A form
// with no entry here is shown as text only: the Vue, Nuxt and React forms need an application of their framework.
const runners = {
    core: (module, stage) => runPageScript(module.default, stage),
    compat: (module, stage) => runPageScript(module.default, stage),
    svelte: (module, stage) => runSvelte(module.default, stage),
    element: (module, stage) => runElementPage(module.default, stage),
};

/**
 * Runs the code of a plain example file with `stage` as its <div id="map">. The id is on `stage` only while the code
 * of the file starts (until its first `await`), so that the stages of a page with several maps do not share it.
 */
function runPageScript(run, stage) {
    const id = stage.getAttribute('id');
    stage.id = 'map';
    try { return run(); } finally { if (id === null) stage.removeAttribute('id'); else stage.id = id; }
}

/**
 * Runs a <map-jr> form: its element goes into `stage` and fills it, its other elements go after `stage`, and then its
 * script runs. The ids of the page are there only while the script starts, as in `runPageScript`. Resolves with the
 * map, which the element gives with the event `map-ready`.
 */
function runElementPage({markup, run}, stage) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const nodes = [...template.content.children], element = nodes.find(n => n.localName === 'map-jr');
    if (!element) throw new Error('[map-jr-gl] examples: the <map-jr> form has no <map-jr> element.');
    const ready = new Promise(resolve => element.addEventListener('map-ready', e => resolve(e.detail), {once: true}));
    element.style.height = '100%';
    stage.append(element);
    stage.after(...nodes.filter(n => n !== element));
    try { run(); } finally { for (const n of nodes) for (const el of [n, ...n.querySelectorAll('[id]')]) el.removeAttribute('id'); }
    return ready;
}

/**
 * Runs a Svelte form: the component is mounted directly after `stage`, and its first element, the element of the
 * action `mapJr`, moves into `stage` and fills it. The elements after it (its <p> and buttons) stay after `stage`.
 */
function runSvelte(Component, stage) {
    const before = made.length;
    mountSvelte(Component, {target: stage.parentNode, anchor: stage.nextSibling});
    flushSync();
    const element = stage.nextElementSibling, map = made[before];
    if (!map) throw new Error('[map-jr-gl] examples: the Svelte form made no map with use:mapJr.');
    element.style.height = '100%';
    stage.append(element);
    return map;
}

/** Whether the harness can run this form. */
export const runs = form => Object.hasOwn(runners, form);

/** Adds a button to the element `actions`. */
export const button = (actions, label, onClick) => { const b = Object.assign(document.createElement('button'), {textContent: label}); b.onclick = () => onClick(b); actions.append(b); return b; };

/**
 * Runs the form `form` of the example `id`, and resolves with its map. The map is drawn in `stage`. The line of text
 * of the example (its <p>) replaces the element `readout` and takes its classes, and its buttons go into `actions`. It
 * rejects when the form does not run here, when no example has that id, and when the example puts another element
 * after its container.
 */
export async function mount(id, form, {stage, actions, readout}) {
    if (!runs(form)) throw new Error(`[map-jr-gl] examples: the form "${form}" does not run here. Use one of: ${Object.keys(runners).join(', ')}.`);
    const load = modules[`../${id}${FORMS.find(f => f[0] === form)[2]}`];
    if (!load) throw new Error(`[map-jr-gl] examples: no example has the id "${id}". The examples are the files examples/<id>.js.`);
    const module = await load(), end = stage.nextSibling, map = runners[form](module, stage);
    // The code of the file has run up to its first `await`, so the elements that the example puts after its container
    // are there now. They move before the page is painted again.
    for (let node = stage.nextSibling; node && node !== end;) {
        const next = node.nextSibling;
        if (node.nodeName === 'P' && readout) { node.classList.add(...readout.classList); readout.replaceWith(node); readout = null; }
        else if (node.nodeName === 'BUTTON') actions.append(node);
        // (A Svelte form also leaves comments and spaces there.)
        else if (node.nodeType !== Node.ELEMENT_NODE && !node.textContent.trim()) { /* left where it is */ }
        else throw new Error(`[map-jr-gl] examples: the example "${id}" puts a <${node.nodeName.toLowerCase()}> after its container. Put one <p> for a line of text and <button> elements there.`);
        node = next;
    }
    return await map;
}
