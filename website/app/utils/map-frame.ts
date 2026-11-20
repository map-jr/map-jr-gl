// The document of a map frame (components/MapFrame.vue): an iframe that runs code which the reader can change. The
// frame has the sandbox "allow-scripts", so the code runs in an opaque origin and cannot reach the page, its storage or
// its cookies. An import map gives the code the entries of the library from /lib/ of the site, the development build
// of this commit (nuxt.config.ts copies them there).
//
// The forms of the code:
// - "main" and "compat": the module script of a page that has <div id="map" style="height: 500px"></div>, as the
//   examples of docs/recipes/ are written.
// - "element": a complete HTML page, as the <map-jr> form of an example.
// - "description": a module whose default export is a description (`MapDescription`). The frame makes the map from it,
//   and the page sends each change of the code with `postMessage` (utils/map-frame-runtime.js).
import runtime from './map-frame-runtime.js?raw';

export type FrameForm = 'main' | 'compat' | 'element' | 'description';
export type FrameView = {center: [number, number]; zoom: number; bearing: number; pitch: number};
export type FrameMessage = {level: 'error' | 'warn'; text: string; line?: number; source: 'code' | 'console'};

/** Whether a variant of the code (build/variants.ts) runs in a frame. */
export const runsInFrame = (variant: string | undefined): variant is 'main' | 'compat' | 'element' => variant === 'main' || variant === 'compat' || variant === 'element';

/** The language of the editor for a form. */
export const languageOf = (form: FrameForm) => form === 'element' ? 'html' : 'js';

const entries = {
    '@map-jr/map-jr-gl': 'map-jr-gl.dev.js',
    '@map-jr/map-jr-gl/maplibre-compat': 'map-jr-gl-maplibre-compat.dev.js',
    '@map-jr/map-jr-gl/controls': 'controls.dev.js',
    '@map-jr/map-jr-gl/element': 'element.dev.js',
};

// Text in a <script> element: "</script" and "<!--" would end it or change how it is read.
const inScript = (text: string) => text.replace(/<(\/script|!--)/gi, '<\\$1');

const style = `<style>
:root { color-scheme: light; background: #fff; color: #1f2328; }
:root[data-scheme="dark"] { color-scheme: dark; background: #1c1d20; color: #e6edf3; }
body { margin: 0; padding-bottom: 8px; font: 14px/1.5 system-ui, sans-serif; }
p { margin: 8px 12px; }
button { font: inherit; margin: 0 0 8px 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid #8b949e; background: none; color: inherit; cursor: pointer; }
button[aria-pressed="true"] { background: #8b949e44; }
</style>`;

/**
 * The text of the document (`srcdoc`) of a frame that runs `code`. `library` is the absolute URL of /lib/ of the site,
 * `scheme` the colour scheme of the page when the frame starts, and `view` the first view of the form "description".
 */
export function frameDocument({form, code, library, scheme, view}: {form: FrameForm; code: string; library: string; scheme: 'light' | 'dark'; view?: FrameView}): string {
    const imports = Object.fromEntries(Object.entries(entries).map(([name, file]) => [name, library + file]));
    const config = {form, offset: 0, view};
    const head = (offset: number) => `<script type="importmap">${inScript(JSON.stringify({imports}))}</script>${style}<script>${inScript(runtime)}\nmapFrame(${inScript(JSON.stringify({...config, offset}))})</script>`;
    // The lines of the frame before the first line of the code, so that an error names the line of the code.
    const offset = (head(0).match(/\n/g) ?? []).length;
    const root = `<html data-scheme="${scheme}">`;
    if (form === 'element') {
        // The head of the frame goes after the doctype of the page, so that the document stays in standards mode.
        const doctype = /^\s*<!doctype[^>]*>/i.exec(code)?.[0] ?? '';
        return `<!doctype html>${root}${head(offset)}${code.slice(doctype.length)}`;
    }
    const container = `<div id="map" style="height: ${form === 'description' ? '100vh' : '500px'}"></div>`;
    const script = form === 'description' ? '' : `<script type="module">${inScript(code)}</script>`;
    return `<!doctype html>${root}${head(offset)}<body>${container}${script}</body></html>`;
}
