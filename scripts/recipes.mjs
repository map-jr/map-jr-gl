// Writes the code of each recipe from the files of its example, so that a recipe and its example cannot drift apart
// (#1119). A recipe of docs/recipes/ has a block `<!-- example:<id>:start -->` … `<!-- example:<id>:end -->`; this
// script fills it with the forms of examples/<id>.*, formatted as docs-lint formats a fence (website/build/format.mjs).
// The Nuxt form is left out when it differs from the Vue form only in its imports and its first comment, as the style
// guide asks.
// A recipe can also have a block `<!-- file:<path>:start -->` … `<!-- file:<path>:end -->`, which this script fills
// with one fence of the file examples/<path>, such as a component test of examples/tests/.
//
// Usage: node scripts/recipes.mjs [--write | --check]   (writing is the default)
//   --check  writes nothing, and fails when a block differs from its files or names an example that does not exist.
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const format = await import('../website/build/format.mjs').catch(() => undefined);
if (!format) {
    console.log('recipes: the recipes are not checked, because website/ has no packages. Run pnpm install in website/.');
    process.exit(0);
}

// The forms in the order of the style guide: the label, the file suffix and the language of the fence.
const forms = [
    ['Main API', '.js', 'js'],
    ['MapLibre compat', '.compat.js', 'js'],
    ['Vue', '.vue', 'vue'],
    ['Nuxt', '.nuxt.vue', 'vue'],
    ['React', '.jsx', 'jsx'],
    ['Svelte', '.svelte', 'svelte'],
    ['<map-jr>', '.html', 'html'],
];

// The Vue code without its imports and the comment lines at the start of the script, to compare with Nuxt.
const body = code => code.split('\n').filter(l => !/^\s*import\s/.test(l)).join('\n').replace(/(<script[^>]*>\n)(\/\/.*\n)+/, '$1');

/** The code of a file of examples/ as a fence of the docs: formatted as docs-lint formats it, at the width of the site. */
async function formatted(raw, language) {
    // A comment of several lines is one paragraph: its lines are joined, so that the re-flow breaks it only where the
    // width needs (the re-flow breaks each long line on its own).
    const code = raw.replace(/^([ \t]*)\/\/ (.*)\n(?:\1\/\/ .*\n?)+/gm, (run, indent) =>
        indent + '// ' + run.split('\n').filter(Boolean).map(l => l.trim().slice(3)).join(' ') + (run.endsWith('\n') ? '\n' : ''));
    if (language !== 'html') return format.formatCode(code, language, format.desktopWidth);
    // The site does not re-flow the comments of a script in an HTML page, and the phone shows them at 38 columns.
    // The comments of the page are written at that width here, with a comment of several lines joined first.
    const joined = code.replace(/<!--([\s\S]*?)-->/g, (_, text) => `<!-- ${text.trim().replace(/\s+/g, ' ')} -->`);
    return format.reflowComments(await format.formatCode(joined, language, format.desktopWidth), 'vue', format.phoneWidth - 4);
}

const read = name => readFileSync(path.join(root, 'examples', name), 'utf8').replace(/\n+$/, '');

async function block(id) {
    const parts = [];
    for (const [label, suffix, language] of forms) {
        const raw = read(id + suffix);
        if (label === 'Nuxt' && body(raw) === body(read(id + '.vue'))) continue;
        const name = label.startsWith('<') ? '`' + label + '`' : label;
        parts.push(`**${name}**\n\n\`\`\`${language} [${label}]\n${await formatted(raw, language)}\n\`\`\``);
    }
    return parts.join('\n\n');
}

/** One fence with the file examples/<name>. */
async function fileBlock(name) {
    const language = name.endsWith('.jsx') ? 'jsx' : 'js';
    return `\`\`\`${language}\n${await formatted(read(name), language)}\n\`\`\``;
}

const dir = path.join(root, 'docs', 'recipes');
let failures = 0;
for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    let out = text;
    const blocks = [
        ...[...text.matchAll(/^<!-- (example):([\w-]+):start -->\n([\s\S]*?)^<!-- example:\2:end -->$/gm)],
        ...[...text.matchAll(/^<!-- (file):([\w./-]+):start -->\n([\s\S]*?)^<!-- file:\2:end -->$/gm)],
    ];
    for (const [whole, kind, id, current] of blocks) {
        if (!existsSync(path.join(root, 'examples', kind === 'file' ? id : id + '.js'))) {
            console.log(`docs/recipes/${file}: ${kind === 'file' ? `the file examples/${id} does not exist` : `the example "${id}" has no files in examples/`}.`);
            failures++;
            continue;
        }
        const wanted = kind === 'file' ? await fileBlock(id) : await block(id);
        if (current.replace(/\n$/, '') === wanted) continue;
        if (check) {
            console.log(`docs/recipes/${file}: the code of "${id}" differs from examples/${kind === 'file' ? id : id + '.*'}. Change the example, then run node scripts/recipes.mjs.`);
            failures++;
        }
        out = out.replace(whole, `<!-- ${kind}:${id}:start -->\n${wanted}\n<!-- ${kind}:${id}:end -->`);
    }
    if (!check && out !== text) {
        writeFileSync(path.join(dir, file), out);
        console.log(`recipes: wrote docs/recipes/${file}`);
    }
}
if (failures) process.exitCode = 1;
