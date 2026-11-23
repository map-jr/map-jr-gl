// The section "Styles" of the site (/styles, #1129). Its text stays in the repositories that own it, and the site
// reads it when it builds:
//
//   map-jr/map-jr-styles (main)                 README.md and dist/styles/*.json: /styles and a page for each style
//   map-jr/maputnik (map-jr-main)               README.md, the note on the fork: /styles/editing
//   map-jr/maplibre-style-spec (map-jr-main)    src/reference/v8.json, the docs that name Map Jr. GL: /styles/spec
//
// `writeStylePages` clones each repository into website/.data/sources/ (or fetches it again when the clone is there),
// and writes the markdown of the pages to website/.data/generated/styles/. The collection `docs` reads that folder as
// it reads a folder of docs/. MAP_JR_SOURCES names a folder that has the three checkouts by their names, for work on
// the text of another repository: the build reads them as they are and fetches nothing.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const generatedDir = resolve(import.meta.dirname, '../.data/generated');
export const stylesFolder = 'styles';
const sourcesDir = process.env.MAP_JR_SOURCES ? resolve(process.env.MAP_JR_SOURCES) : resolve(import.meta.dirname, '../.data/sources');

interface Source {
    name: string;
    branch: string;
}
const sources = {
    styles: {name: 'map-jr-styles', branch: 'main'},
    maputnik: {name: 'maputnik', branch: 'map-jr-main'},
    spec: {name: 'maplibre-style-spec', branch: 'map-jr-main'},
} satisfies Record<string, Source>;

const githubUrl = (source: Source, path = '') => `https://github.com/map-jr/${source.name}${path ? `/blob/${source.branch}/${path}` : ''}`;
const stylesBase = 'https://styles.map-jr.org/1/';

function fail(message: string): never {
    throw new Error('[map-jr-gl site] Styles: ' + message);
}

// The checkout of a repository, cloned or brought up to date. A fetch that fails keeps the clone that is there.
function checkout(source: Source): string {
    const dir = resolve(sourcesDir, source.name);
    if (process.env.MAP_JR_SOURCES) {
        if (!existsSync(dir)) fail(`MAP_JR_SOURCES has no folder "${source.name}". Clone https://github.com/map-jr/${source.name} (branch ${source.branch}) there.`);
        return dir;
    }
    const git = (...args: string[]) => execFileSync('git', args, {stdio: ['ignore', 'ignore', 'pipe']});
    try {
        if (existsSync(resolve(dir, '.git'))) {
            git('-C', dir, 'fetch', '--depth', '1', 'origin', source.branch);
            git('-C', dir, 'reset', '--hard', 'FETCH_HEAD');
        } else {
            mkdirSync(sourcesDir, {recursive: true});
            git('clone', '--depth', '1', '--branch', source.branch, `https://github.com/map-jr/${source.name}.git`, dir);
        }
    } catch (error) {
        if (!existsSync(resolve(dir, '.git'))) fail(`git could not clone https://github.com/map-jr/${source.name} (branch ${source.branch}): ${String((error as any).stderr ?? error).trim()}`);
        console.warn(`[map-jr-gl site] Styles: git could not fetch ${source.name}, so the site uses the clone in ${dir}.`);
    }
    return dir;
}

// The part of the markdown from the heading `heading` to the next heading of the same level or higher, without the
// heading line itself.
export function sectionOf(markdown: string, heading: string): string {
    const lines = markdown.split('\n');
    const start = lines.findIndex(line => line === heading);
    if (start < 0) fail(`the markdown has no heading "${heading}".`);
    const level = heading.indexOf(' ');
    let fence = false;
    let end = start + 1;
    for (; end < lines.length; end++) {
        if (lines[end]!.startsWith('```')) fence = !fence;
        const match = !fence && /^(#+) /.exec(lines[end]!);
        if (match && match[1]!.length <= level) break;
    }
    return lines.slice(start + 1, end).join('\n').trim();
}

// A relative link of a file of another repository leads to the file on GitHub.
export function absoluteLinks(markdown: string, source: Source): string {
    return markdown.replace(/\]\((?![a-z][a-z0-9+.-]*:|\/|#)([^)\s]+)\)/gi, (_, path: string) => `](${githubUrl(source, path)})`);
}

// The cells of a row of a markdown table.
const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const table = (rows: string[][]) => rows.map(row => `| ${row.join(' | ')} |`).join('\n');

export interface StyleRow {
    // The file name without ".json", such as "elevation-zero".
    name: string;
    title: string;
    // The cell of MapLibre GL JS: a link to a style of map-jr-styles or of OpenFreeMap.
    maplibre: string;
    text: string;
}

// The rows of the table under "## The styles" of the README. "〃" repeats the text of the row above.
export function styleRows(readme: string): StyleRow[] {
    const rows = sectionOf(readme, '## The styles').split('\n').filter(line => line.startsWith('|')).slice(2).map(cells);
    let previous = '';
    return rows.map(([title = '', link = '', maplibre = '', text = '']) => {
        const name = /\/1\/([\w-]+)\.json\)/.exec(link)?.[1] ?? fail(`the row "${title}" of the table of the styles has no link to ${stylesBase}<name>.json.`);
        if (text !== '〃') previous = text;
        return {name, title, maplibre, text: previous};
    });
}

const frontmatter = (fields: Record<string, string>) => `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n`;

// The page of one style.
export function stylePage(row: StyleRow, style: any, readme: string, stateRows: string[][]): string {
    const url = stylesBase + row.name + '.json';
    const state = Object.keys(style.state ?? {});
    const schemes = state.includes('color-scheme');
    const ownMaplibre = isOwn(row);
    const maplibreUrl = /\]\(([^)]+)\)/.exec(row.maplibre)?.[1];
    const out = [`# ${row.title}`, '', absoluteLinks(row.text, sources.styles), ''];
    out.push(`::style-preview{style-url="${url}"${schemes ? '' : ' :single="true"'}}`, '::', '');
    if (!schemes) out.push('The style has one look. It does not read the global state property `color-scheme`, so the map is the same in light and in dark.', '');
    out.push('## URLs', '', table([
        ['Library', 'Style'],
        ['---', '---'],
        ['Map Jr. GL', `\`${url}\``],
        ['Map Jr. GL, from npm', `\`@map-jr/styles/${row.name}.json\``],
        ['MapLibre GL JS', ownMaplibre ? `\`${maplibreUrl}\` (5.16.0 or later)` : maplibreUrl ? `The style of OpenFreeMap: \`${maplibreUrl}\`` : 'none'],
    ]), '');
    out.push('With `@map-jr/map-jr-gl`:', '', '```js', `import {createMap} from '@map-jr/map-jr-gl';`, '', `createMap('map', {style: '${url}'});`, '```', '');
    if (ownMaplibre) out.push('With MapLibre GL JS:', '', '```js', `import maplibregl from 'maplibre-gl';`, '', `new maplibregl.Map({container: 'map', style: '${maplibreUrl}'});`, '```', '');
    out.push('The [styles page](/styles#use) says how the versions of `/1/` change and how to use the npm package `@map-jr/styles`.', '');
    out.push('## Global state', '');
    const rows = stateRows.filter(([property]) => state.includes(property!.replace(/`/g, '')));
    if (rows.length) out.push('The style reads these properties of the global state of the map:', '', table([['Property', 'Values', 'Effect'], ['---', '---', '---'], ...rows]), '');
    else out.push('The style reads no global state.', '');
    out.push('## Sources and attribution', '', table([
        ['Source', 'Type', 'URL', 'Attribution'],
        ['---', '---', '---', '---'],
        ...Object.entries<any>(style.sources ?? {}).map(([id, source]) => [
            `\`${id}\``,
            source.type,
            `\`${source.url ?? source.tiles?.[0] ?? source.data ?? ''}\``,
            source.attribution ? source.attribution.replace(/\|/g, '\\|') : source.url ? 'From its TileJSON' : 'none',
        ]),
    ]), '');
    out.push(`The licences, from the README of [map-jr-styles](${githubUrl(sources.styles)}):`, '', absoluteLinks(sectionOf(readme, '## Sources and licences'), sources.styles), '');
    return frontmatter({editUrl: githubUrl(sources.styles, 'README.md')}) + out.join('\n');
}

// A style of map-jr-styles itself has its own version for MapLibre GL JS; a copy of a style of OpenFreeMap has not.
const isOwn = (row: StyleRow) => row.maplibre.includes(`${stylesBase}maplibre/`);

// The page /styles: the introduction and the use of the styles, without the parts for those who release and build them.
export function indexPage(readme: string, rows: StyleRow[]): string {
    const intro = readme.slice(readme.indexOf('\n') + 1, readme.indexOf('\n## ')).trim();
    // The styles of map-jr-styles come first, in a table. The copies of the styles of OpenFreeMap follow as a short list
    // (the owner's decision in #1129): they are the styles of OpenFreeMap with the sprite inside.
    const lines = sectionOf(readme, '## The styles').split('\n');
    const first = lines.findIndex(line => line.startsWith('|'));
    const last = lines.findLastIndex(line => line.startsWith('|'));
    const own = rows.filter(row => isOwn(row));
    const copies = rows.filter(row => !isOwn(row));
    const styles = [...lines.slice(0, first),
        table([['Style', 'What it is'], ['---', '---'], ...own.map(row => [`[${row.title}](/styles/${row.name})`, row.text])]),
        ...(copies.length ? ['', '### From OpenFreeMap', '', `${copies[0]!.text} Their pages: ${copies.map(row => `[${row.title.replace(/^OpenFreeMap /, '')}](/styles/${row.name})`).join(', ')}.`] : []),
        ...lines.slice(last + 1)].join('\n');
    const body = ['# Styles', '', intro, '', '## The styles', '', styles, '', '## Use', '', sectionOf(readme, '## Use'), '',
        '## Editing a style', '', 'To change a style, open it in the Maputnik of Map Jr. GL. [Editing a style](/styles/editing) says how, and [the style specification of Map Jr. GL](/styles/spec) lists what Map Jr. GL reads beyond the MapLibre style specification.', ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.styles, 'README.md')}) + absoluteLinks(body, sources.styles);
}

// The page /styles/editing: the note on the fork of Maputnik, and the steps of map-jr-styles.
export function editingPage(maputnik: string, readme: string): string {
    const note = /^> \*\*This is the Map Jr\. GL fork of Maputnik\.\*\*[\s\S]*?(?=\n\n|\n[^>])/m.exec(maputnik)?.[0] ?? fail('the README of maputnik has no note "This is the Map Jr. GL fork of Maputnik."');
    const body = ['# Editing a style', '', '## The Maputnik of Map Jr. GL', '', absoluteLinks(note.replace(/^> ?/gm, ''), sources.maputnik), '',
        '## Editing a style of map-jr-styles', '', absoluteLinks(sectionOf(readme, '## Editing a style with Maputnik'), sources.styles), ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.maputnik, 'README.md')}) + body;
}

// The entries of the reference whose doc names Map Jr. GL: the additions of the fork, with the path of each.
export function specAdditions(reference: unknown): {path: string; doc: string}[] {
    const found: {path: string; doc: string}[] = [];
    const walk = (value: unknown, path: string[]) => {
        if (Array.isArray(value)) return value.forEach((item, index) => walk(item, [...path, String(index)]));
        if (!value || typeof value !== 'object') return;
        const doc = (value as any).doc;
        if (typeof doc === 'string' && doc.includes('Map Jr. GL')) found.push({path: path.join(' › '), doc});
        for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
    };
    walk(reference, []);
    return found;
}

// The heading of an addition: the expression and the key for the docs of an expression, and the key otherwise.
export function headingOf(path: string): string {
    const keys = path.split(' › ');
    const key = keys.at(-1)!;
    return keys[0] === 'expression_name' && keys[1] === 'values' && keys.length > 3 ? `\`${keys[2]}\` expression: \`${key}\`` : `\`${key}\``;
}

// The page /styles/spec.
export function specPage(reference: unknown): string {
    const additions = specAdditions(reference);
    if (!additions.length) fail('src/reference/v8.json of maplibre-style-spec has no doc that names Map Jr. GL.');
    const body = ['# The style specification of Map Jr. GL', '',
        `The [Maputnik of Map Jr. GL](/styles/editing) validates styles with a fork of the MapLibre style specification, [map-jr/maplibre-style-spec](${githubUrl(sources.spec)}) (branch \`${sources.spec.branch}\`), which adds what styles for Map Jr. GL use. This page lists the docs of the reference of the fork (\`src/reference/v8.json\`) that name Map Jr. GL.`, '',
        ...additions.flatMap(({path, doc}) => [`## ${headingOf(path)}`, '', `In the reference: \`${path}\`.`, '', doc, '']),
        `The rest of the specification is the [MapLibre style specification](https://maplibre.org/maplibre-style-spec/).`, ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.spec, 'src/reference/v8.json')}) + body;
}

// Fetches the three repositories and writes the pages. It runs once for each start of Nuxt.
let written: string[] | undefined;
export function writeStylePages(): string[] {
    if (written) return written;
    const stylesDir = checkout(sources.styles);
    const readme = readFileSync(resolve(stylesDir, 'README.md'), 'utf8');
    const maputnik = readFileSync(resolve(checkout(sources.maputnik), 'README.md'), 'utf8');
    const reference = JSON.parse(readFileSync(resolve(checkout(sources.spec), 'src/reference/v8.json'), 'utf8'));
    const stateRows = (/\*\*Global state\.\*\*[\s\S]*?\n((?:\|.*\n)+)/.exec(readme)?.[1] ?? fail('the README of map-jr-styles has no table under "**Global state.**".'))
        .trim().split('\n').slice(2).map(cells);

    const out = resolve(generatedDir, stylesFolder);
    rmSync(out, {recursive: true, force: true});
    mkdirSync(out, {recursive: true});
    const pages: Record<string, string> = {'index.md': indexPage(readme, styleRows(readme)), 'editing.md': editingPage(maputnik, readme), 'spec.md': specPage(reference)};
    const built = new Set(readdirSync(resolve(stylesDir, 'dist/styles')));
    for (const row of styleRows(readme)) {
        if (!built.has(row.name + '.json')) fail(`the table of the styles names "${row.name}", and dist/styles/ has no ${row.name}.json.`);
        pages[row.name + '.md'] = stylePage(row, JSON.parse(readFileSync(resolve(stylesDir, 'dist/styles', row.name + '.json'), 'utf8')), readme, stateRows);
    }
    for (const [file, text] of Object.entries(pages)) writeFileSync(resolve(out, file), text);
    return written = Object.keys(pages);
}
