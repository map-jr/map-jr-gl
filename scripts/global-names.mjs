// The edits of the plugin `global-names` of build.mjs, in a module of their own so that test/unit can check them.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// (On Windows, a module can be imported by a file URL only, not by a path with a drive letter.)
const {parseAst} = await import(pathToFileURL(createRequire(createRequire(import.meta.url).resolve('vite')).resolve('rolldown/parseAst')).href);

/** The module that holds the members of the globals below under local names. Each module that reads one imports it from here. */
export const GLOBALS_MODULE = '\0map-jr-globals';

/**
 * The members that get a local name: all members of `Math`, and `Array.isArray`. None of these functions reads `this`,
 * so a call through the local name is the same call. (`Promise.all` and `Array.from` read `this`. The members of
 * `Object` and `JSON` made the gzip of the worker file larger: they are used too seldom.)
 */
export const GLOBALS = {Math: null, Array: ['isArray']};

/**
 * Finds each read of a member of a global of `GLOBALS` in `code` (`Math.floor`, `Math.PI`, `Array.isArray`) and gives
 * the edits that replace it with a name that the module `GLOBALS_MODULE` exports (`Math_floor`). The minifier gives each
 * such name one or two letters, which it cannot do for `Math.floor` (#1948).
 * @returns The edits as `[start, end, text]`, in the order of `code`, and the import to append to the module, or `null`.
 */
export function aliasGlobals(code, file = 'x.ts') {
    const edits = [], names = new Set();
    const walk = (node, parent) => {
        if (!node || typeof node.type !== 'string') return;
        const o = node.type === 'MemberExpression' && !node.computed && node.object.type === 'Identifier' && node.property.type === 'Identifier' ? node.object.name : null;
        if (o && Object.hasOwn(GLOBALS, o) && (!GLOBALS[o] || GLOBALS[o].includes(node.property.name))) {
            if (parent?.type === 'AssignmentExpression' && parent.left === node || parent?.type === 'UpdateExpression') throw new Error(`global-names: ${file} assigns to ${o}.${node.property.name}.`);
            const name = `${o}_${node.property.name}`;
            if (new RegExp(`\\b${name}\\b`).test(code)) throw new Error(`global-names: ${file} has the name ${name}, which the plugin global-names gives to ${o}.${node.property.name}. Rename it.`);
            edits.push([node.start, node.end, name]);
            names.add(name);
            return;
        }
        for (const key in node) {
            const v = node[key];
            if (Array.isArray(v)) for (const c of v) walk(c, node); else if (v && typeof v === 'object') walk(v, node);
        }
    };
    walk(parseAst(code, {lang: 'ts'}, file), null);
    return {edits, import: names.size ? `\nimport {${[...names].join(', ')}} from ${JSON.stringify(GLOBALS_MODULE)};\n` : null};
}

/** The text of the module `GLOBALS_MODULE`: one export for each member. The bundler leaves out the ones that no module imports. */
export const globalsModule = () => Object.entries(GLOBALS).flatMap(([o, list]) => (list ?? Object.getOwnPropertyNames(globalThis[o]).filter(n => /^[A-Za-z]\w*$/.test(n)))
    .map(n => `export const ${o}_${n} = ${o}.${n};`)).join('\n') + '\n';
