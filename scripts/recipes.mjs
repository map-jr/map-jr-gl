// Writes the code of each recipe from the files of its example, so that a recipe and its example cannot drift apart
// (#1119). A recipe of docs/recipes/ has a block `<!-- example:<id>:start -->` … `<!-- example:<id>:end -->`; this
// script fills it with the forms of examples/<id>.*, formatted as docs-lint formats a fence (website/build/format.mjs).
// The Nuxt form is left out when it differs from the Vue form only in its imports and its first comment, as the style
// guide asks; the page then says once that Nuxt needs no imports.
//
// Usage: node scripts/recipes.mjs [--check]
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

async function block(id) {
    const parts = [];
    const read = suffix => readFileSync(path.join(root, 'examples', id + suffix), 'utf8').replace(/\n+$/, '');
    for (const [label, suffix, language] of forms) {
        const code = read(suffix);
        if (label === 'Nuxt' && body(code) === body(read('.vue'))) continue;
        let formatted = await format.formatCode(code, language, format.desktopWidth);
        // The site does not re-flow the comments of a script in an HTML page, and the phone shows them at 38 columns.
        // The comments of the page are written at that width here, with a comment of several lines joined first.
        if (language === 'html') {
            const joined = code.replace(/<!--([\s\S]*?)-->/g, (_, text) => `<!-- ${text.trim().replace(/\s+/g, ' ')} -->`);
            formatted = format.reflowComments(await format.formatCode(joined, language, format.desktopWidth), 'vue', format.phoneWidth - 4);
        }
        const name = label.startsWith('<') ? '`' + label + '`' : label;
        parts.push(`**${name}**\n\n\`\`\`${language} [${label}]\n${formatted}\n\`\`\``);
    }
    return parts.join('\n\n');
}

const dir = path.join(root, 'docs', 'recipes');
let failures = 0;
for (const file of readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    let out = text;
    for (const match of text.matchAll(/^<!-- example:([\w-]+):start -->\n([\s\S]*?)^<!-- example:\1:end -->$/gm)) {
        const [whole, id, current] = match;
        if (!existsSync(path.join(root, 'examples', id + '.js'))) {
            console.log(`docs/recipes/${file}: the example "${id}" has no files in examples/.`);
            failures++;
            continue;
        }
        const wanted = await block(id);
        if (current.replace(/\n$/, '') === wanted) continue;
        if (check) {
            console.log(`docs/recipes/${file}: the code of "${id}" differs from examples/${id}.*. Change the example, then run node scripts/recipes.mjs.`);
            failures++;
        }
        out = out.replace(whole, `<!-- example:${id}:start -->\n${wanted}\n<!-- example:${id}:end -->`);
    }
    if (!check && out !== text) {
        writeFileSync(path.join(dir, file), out);
        console.log(`recipes: wrote docs/recipes/${file}`);
    }
}
if (failures) process.exitCode = 1;
