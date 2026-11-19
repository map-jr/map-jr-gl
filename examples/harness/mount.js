// Runs one form of one example in an element. The harness page (examples/run.html) and the gallery (site/gallery.js)
// both mount an example through this file, so a form runs in the same way in both.
//
// An example file has a default export `(container, tools) => map`. The tools are `show(text)` for a line of text
// beside the map, `button(label, onClick)` for a button beside the map, and `legend(heading, items, note)` for a legend
// on the map.
const modules = import.meta.glob('../*.js');

/** The forms of an example: the name in the address, the label, and the ending of the file (examples/<id><ending>). */
export const FORMS = [['core', 'Main API', '.js'], ['vue', 'Vue', '.vue'], ['react', 'React', '.jsx'], ['compat', 'MapLibre compatible', '.compat.js']];

// How each form that runs is mounted: `(load, stage, tools) => map`, where `load()` imports the file of the form. A
// form with no entry here is shown as text only. To run a framework form, add its entry and let the glob above find
// its files.
const runners = {
    core: async (load, stage, tools) => (await load()).default(stage, tools),
    compat: async (load, stage, tools) => (await load()).default(stage, tools),
};

/** Whether the harness can run this form. */
export const runs = form => Object.hasOwn(runners, form);

/** Adds a button to the element `actions`. */
export const button = (actions, label, onClick) => { const b = Object.assign(document.createElement('button'), {textContent: label}); b.onclick = () => onClick(b); actions.append(b); return b; };

/**
 * Runs the form `form` of the example `id`, and resolves with its map. The map is drawn in `stage`, the buttons of the
 * example go into `actions`, and `out(text)` shows a line of text. It rejects when the form does not run here, or when
 * no example has that id.
 */
export async function mount(id, form, {stage, actions, out}) {
    if (!runs(form)) throw new Error(`[map-jr-gl] examples: the form "${form}" does not run here. Use one of: ${Object.keys(runners).join(', ')}.`);
    const load = modules[`../${id}${FORMS.find(f => f[0] === form)[2]}`];
    if (!load) throw new Error(`[map-jr-gl] examples: no example has the id "${id}". The examples are the files examples/<id>.js.`);
    return runners[form](load, stage, {
        show: out,
        button: (label, onClick) => button(actions, label, onClick),
        legend: (heading, items, note) => stage.insertAdjacentHTML('beforeend', `<div class="legend"><b>${heading}</b>${items.map(([line, text]) => `<span><i style="border-top:${line}"></i>${text}</span>`).join('')}<small>${note}</small></div>`),
    });
}
