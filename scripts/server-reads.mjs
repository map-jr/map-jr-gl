// Finds the places where built code reads a method that the server build leaves out (`serverDrops` in build.mjs, #2041).
import {parseAst} from 'vite';

/** The key of a member access or of a property of a destructuring pattern, when it is a name or a constant string. */
function keyOf(key, computed) {
    if (!computed && key.type === 'Identifier') return key.name;
    if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
    if (key.type === 'TemplateLiteral' && key.expressions.length === 0) return key.quasis[0].value.cooked;
    return null;
}

/**
 * The reads in `code` of the methods `methods`, a map from each name in the built code to `{name, private}`, where
 * `name` is the name in src/. A read is `x.name`, `x['name']`, or the key `name` of a destructuring pattern. For a
 * private method, `x.name` counts only as `this.name`, because the name of a private method that the build does not
 * shorten can be the name of a method of the browser (`find` of an array). Returns the names in src/ that are read.
 */
export function removedReads(code, methods) {
    const found = new Set();
    const walk = node => {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'MemberExpression') {
            const m = methods.get(keyOf(node.property, node.computed));
            if (m && (node.computed || !m.private || node.object.type === 'ThisExpression')) found.add(m.name);
        } else if (node.type === 'ObjectPattern') {
            for (const p of node.properties) {
                const m = p.type === 'Property' ? methods.get(keyOf(p.key, p.computed)) : null;
                if (m) found.add(m.name);
            }
        }
        for (const key in node) {
            const v = node[key];
            if (Array.isArray(v)) for (const c of v) walk(c); else if (v && typeof v === 'object') walk(v);
        }
    };
    walk(parseAst(code));
    return [...found];
}
