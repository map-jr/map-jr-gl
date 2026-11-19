// Runs one form of one example in an element. The harness page (examples/run.html) and the gallery (site/gallery.js)
// both mount an example through this file, so a form runs in the same way in both.
//
// An example file is the module script of a page that has <div id="map">, and it runs as it is written there. It finds
// its container by the id "map" when its code starts (`document.getElementById('map')`, or `container: 'map'` in the
// compat entry), it names its map `map`, and it puts what it shows beside the map directly after the container: a <p>
// for a line of text and <button> elements. The build loads each file with `?mount` as a function that runs the code
// of the file and resolves with its `map` (the plugin `examplesAsFunctions` in site/vite.config.mjs), so the harness
// can run a file again, and on a page with several maps.
const modules = import.meta.glob('../*.js', {query: '?mount'});

/** The forms of an example: the name in the address, the label, and the ending of the file (examples/<id><ending>). */
export const FORMS = [['core', 'Main API', '.js'], ['vue', 'Vue', '.vue'], ['react', 'React', '.jsx'], ['compat', 'MapLibre compatible', '.compat.js']];

// How each form that runs is mounted: `(module, stage) => map`, where `module` is the imported file of the form. A form
// with no entry here is shown as text only. To run a framework form, add its entry and let the glob above find its
// files.
const runners = {
    core: (module, stage) => runPageScript(module.default, stage),
    compat: (module, stage) => runPageScript(module.default, stage),
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
        else throw new Error(`[map-jr-gl] examples: the example "${id}" puts a <${node.nodeName.toLowerCase()}> after its container. Put one <p> for a line of text and <button> elements there.`);
        node = next;
    }
    return await map;
}
