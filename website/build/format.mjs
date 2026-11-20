// Formats the code of a fence with Prettier (#1250). The site shows each JavaScript, TypeScript, Vue and JSX fence in
// two forms: the desktop form at 80 columns, and the phone form at 38 columns, which fits a 390 px screen. A code
// block never wraps its lines. scripts/docs-lint.mjs uses the same options to check that the fences of docs/ are in
// the desktop form.
//
// Prettier does not shorten comments or strings, so such a line can stay longer than the width; the block then
// scrolls sideways.
import * as prettier from 'prettier';

export const desktopWidth = 80;
export const phoneWidth = 38;

// The style of the code in docs/.
const options = {tabWidth: 2, singleQuote: true, bracketSpacing: false, arrowParens: 'avoid', trailingComma: 'all'};

const parsers = {js: 'babel', javascript: 'babel', jsx: 'babel', ts: 'typescript', typescript: 'typescript', tsx: 'typescript', vue: 'vue'};

// The parser of Prettier for the language of a fence, or undefined when the site does not format that language.
export const parserOf = language => parsers[language?.toLowerCase()];

// The code at `width` columns, without the newline at the end, or undefined when Prettier cannot parse it.
export async function formatCode(code, language, width) {
    const parser = parserOf(language);
    if (!parser) return undefined;
    const format = async text => (await prettier.format(text, {...options, parser, printWidth: width})).replace(/\n$/, '');
    try {
        return await format(code);
    } catch {}
    // A list of signatures, as in the reference pages ("decodePNG(bytes: Uint8Array): Promise<…>"), parses as
    // declarations of functions.
    const declare = 'declare function ';
    if (parser !== 'typescript' || !code.split('\n').every(line => !line.trim() || /^[A-Za-z_$][\w$]*\s*[(<]/.test(line))) return undefined;
    try {
        const out = await format(code.split('\n').map(line => line.trim() ? declare + line : line).join('\n'));
        // Prettier ends each declaration with ";", which the signatures of the page do not have.
        const ends = /;\s*$/m.test(code);
        return out.split('\n').map(line => line.startsWith(declare) ? line.slice(declare.length) : line)
            .map(line => ends || /^\s/.test(line) && !/^\)/.test(line.trim()) ? line : line.replace(/;$/, '')).join('\n');
    } catch {
        return undefined;
    }
}
