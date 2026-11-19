// The hook `content:file:afterParse` of Nuxt Content 3.17: `ctx` has `file`, `content` and `collection`.
// `ctx.content.body` is `{type: 'minimark', value: Node[]}`. A node is a string or `[tag, props, ...children]`.
// A fence ```js [Main API] is `['pre', {language: 'js', filename: 'Main API', code, meta, className, style}, ['code', …]]`.
//
// Two or more adjacent fences with a label become one group. SPIKE_GROUP chooses the tag of the group:
// `code-group` is the code group of Nuxt UI with `sync`, `form-group` is app/components/content/FormGroup.vue.
type Node = string | [string, Record<string, unknown>, ...Node[]];

const groupTag = process.env.SPIKE_GROUP || 'form-group';

function isLabelledFence(node: Node): boolean {
    return Array.isArray(node) && node[0] === 'pre' && typeof node[1]?.filename === 'string' && node[1].filename !== '';
}

function wrap(nodes: Node[]): Node[] {
    const out: Node[] = [];
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (!isLabelledFence(node)) {
            // (Fences inside a list item or a blockquote are children of that node.)
            if (Array.isArray(node) && node[0] !== 'pre' && node[0] !== 'code-group') out.push([node[0], node[1], ...wrap(node.slice(2) as Node[])]);
            else out.push(node);
            continue;
        }
        let end = i + 1;
        while (end < nodes.length && isLabelledFence(nodes[end]!)) end++;
        if (end - i < 2) out.push(node);
        else out.push([groupTag, groupTag === 'code-group' ? {sync: 'form'} : {}, ...nodes.slice(i, end)]);
        i = end - 1;
    }
    return out;
}

export function wrapFences(ctx: any) {
    const body = ctx.content?.body;
    if (process.env.SPIKE_LOG) console.log('[spike] afterParse', ctx.file.id, Object.keys(ctx), body?.type);
    if (body?.type !== 'minimark' || !Array.isArray(body.value)) return;
    body.value = wrap(body.value);
    if (process.env.SPIKE_LOG) console.log('[spike] top-level tags', ctx.file.id, body.value.map((n: Node) => (Array.isArray(n) ? n[0] : 'text')).join(' '));
}
