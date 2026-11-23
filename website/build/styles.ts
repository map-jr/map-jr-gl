// The section "Styles" of the site (/styles, #1129). Its text stays in the repositories that own it, and the site
// reads it when it builds:
//
//   map-jr/map-jr-styles (main)                 README.md and dist/styles/*.json: /styles, one map with a switch of the style
//   map-jr/maputnik (map-jr-main)               README.md, the note on the fork: /styles/editing
//   map-jr/maplibre-style-spec (map-jr-main)    docs/map-jr.md, the additions of the fork:     /styles/spec
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
export function sectionOf(markdown: string, heading: string, file = 'README.md of map-jr/map-jr-styles'): string {
    const lines = markdown.split('\n');
    const start = lines.findIndex(line => line === heading);
    if (start < 0) fail(`${file} has no heading "${heading}", which the site reads. Restore the heading there, or change website/build/styles.ts.`);
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

// The text of another repository is untrusted input (CLAUDE.md, "Definition of done" 8): outside code, `<`, `>` and `&`
// become entities, so that raw HTML shows as text, and a line that starts with `::` (a component block of Nuxt
// Content) starts with `\:`. The marks of a quote at the start of a line stay. Markdown links, tables and code stay as they are.
export function safeMarkdown(markdown: string): string {
    let fence = false;
    return markdown.split('\n').map(line => {
        if (/^\s*```/.test(line)) { fence = !fence; return line; }
        if (fence) return line;
        // The marks of a quote at the start of the line stay.
        const quote = /^(\s*>\s?)*/.exec(line)![0];
        const text = line.slice(quote.length).split(/(`+[^`]*`+)/).map((part, index) => index % 2 ? part : part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('');
        return quote + text.replace(/^(\s*):/, '$1\\:');
    }).join('\n');
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

// A style of map-jr-styles itself has its own version for MapLibre GL JS; a copy of a style of OpenFreeMap has not.
const isOwn = (row: StyleRow) => row.maplibre.includes(`${stylesBase}maplibre/`);
// A style as the switch of /styles shows it (website/app/components/content/StyleSwitch.vue). Every field is plain text,
// which the component shows as text, and a link is an https URL.
export interface StyleChoice {
    name: string;
    title: string;
    // The text of the style in the table of the README.
    text: string;
    url: string;
    // The style for MapLibre GL JS: the version of map-jr-styles (5.16.0 or later), or the style of OpenFreeMap that a
    // copy follows.
    maplibre?: {url: string; own: boolean};
    // The style reads the global state property `color-scheme`.
    schemes: boolean;
    // The properties of the global state that the style reads, with the values and the effect from the README.
    state: {property: string; values: string; effect: string}[];
    sources: {id: string; type: string; url: string; attribution: TextPart[] | 'tilejson' | null}[];
}

export interface TextPart {
    text: string;
    href?: string;
}

// A cell of the README after `safeMarkdown`, as plain text: a markdown link keeps its text.
export const plainText = (cell: string) => cell.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\\(.)/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

// The attribution of a source (HTML from the style) as parts of text: each link with an https href keeps its href, the
// other tags are removed, and the entities that attributions use become their characters.
export function attributionParts(html: string): TextPart[] {
    const plain = (text: string) => text.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|copy);/g, (_, name: string) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", copy: '©'})[name]!)
        .replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    const out: TextPart[] = [];
    let last = 0;
    for (const match of html.matchAll(/<a\s[^>]*?href\s*=\s*["'](https:\/\/[^"'\s<>]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        out.push({text: plain(html.slice(last, match.index))}, {text: plain(match[2]!), href: match[1]!});
        last = match.index! + match[0].length;
    }
    out.push({text: plain(html.slice(last))});
    return out.filter(part => part.text);
}

export function styleChoice(row: StyleRow, style: any, stateRows: string[][] = []): StyleChoice {
    const maplibreUrl = /\]\((https:\/\/[^)\s]+)\)/.exec(row.maplibre)?.[1];
    const read = Object.keys(style?.state ?? {});
    return {
        name: row.name, title: plainText(row.title), text: plainText(row.text), url: stylesBase + row.name + '.json',
        ...(maplibreUrl ? {maplibre: {url: maplibreUrl, own: isOwn(row)}} : {}),
        schemes: read.includes('color-scheme'),
        state: stateRows.filter(([property]) => read.includes(plainText(property!))).map(([property, values = '', effect = '']) => ({property: plainText(property!), values: plainText(values), effect: plainText(effect)})),
        sources: Object.entries<any>(style?.sources ?? {}).map(([id, source]) => ({
            id, type: String(source?.type ?? ''),
            url: String(source?.url ?? source?.tiles?.[0] ?? (typeof source?.data === 'string' ? source.data : '')).slice(0, 300),
            attribution: typeof source?.attribution === 'string' ? attributionParts(source.attribution.slice(0, 2000)) : source?.url ? 'tilejson' : null,
        })),
    };
}

// The address of a style on /styles.
export const styleAddress = (name: string) => `/styles?style=${encodeURIComponent(name)}`;

// The page /styles: the introduction, one map with a switch of the style and of the colour scheme, and the use of the
// styles, without the parts for those who release and build them.
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
        table([['Style', 'What it is'], ['---', '---'], ...own.map(row => [`[${row.title}](${styleAddress(row.name)})`, row.text])]),
        ...(copies.length ? ['', '### From OpenFreeMap', '', `${copies[0]!.text} The map above shows them: ${copies.map(row => `[${row.title.replace(/^OpenFreeMap /, '')}](${styleAddress(row.name)})`).join(', ')}.`] : []),
        ...lines.slice(last + 1)].join('\n');
    const body = ['# Styles', '', intro, '',
        '::style-switch', '::', '',
        'The buttons above the map choose the style and the colour scheme. The scheme sets the global state property `color-scheme`. A style that does not read `color-scheme` has one look, so its scheme buttons are off. The address of the page keeps the choice, for example `/styles?style=elevation&scheme=dark`.', '',
        '## The styles', '', styles, '', '## Use a style', '', sectionOf(readme, '## Use'), '',
        '## Sources and licences', '', sectionOf(readme, '## Sources and licences'), '',
        '## Editing a style', '', 'To change a style, open it in the Maputnik of Map Jr. GL. [Editing a style](/styles/editing) says how, and [the style specification of Map Jr. GL](/styles/spec) lists what Map Jr. GL reads beyond the MapLibre style specification.', ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.styles, 'README.md')}) + absoluteLinks(body, sources.styles);
}

// The page /styles/editing: the note on the fork of Maputnik, and the steps of map-jr-styles.
export function editingPage(maputnik: string, readme: string): string {
    const note = /^> \*\*This is the Map Jr\. GL fork of Maputnik\.\*\*[\s\S]*?(?=\n\n|\n[^>])/m.exec(maputnik)?.[0] ?? fail('README.md of map-jr/maputnik (branch map-jr-main) has no note "This is the Map Jr. GL fork of Maputnik."');
    const body = ['# Editing a style', '', '## The Maputnik of Map Jr. GL', '', absoluteLinks(note.replace(/^> ?/gm, ''), sources.maputnik), '',
        '## Editing a style of map-jr-styles', '', absoluteLinks(sectionOf(readme, '## Editing a style with Maputnik'), sources.styles), ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.maputnik, 'README.md')}) + body;
}

// The page /styles/spec, from docs/map-jr.md of the fork of the style specification: the additions of the fork. The
// heading of that file gives way to the heading of the page, and the rest is escaped.
export const specFile = 'docs/map-jr.md';
export function specPage(markdown: string): string {
    const lines = markdown.split('\n');
    let fence = false;
    const start = lines.findIndex(line => {
        if (/^\s*(```|~~~)/.test(line)) fence = !fence;
        return !fence && line.startsWith('# ');
    });
    if (start > 0 && lines.slice(0, start).some(line => line.trim())) fail(`${specFile} of map-jr/maplibre-style-spec (branch ${sources.spec.branch}) has text before its heading "# ...", which the site would leave out. Start the file with the heading.`);
    if (start < 0) fail(`${specFile} of map-jr/maplibre-style-spec (branch ${sources.spec.branch}) has no heading "# ...", which the site reads. Restore the heading there, or change website/build/styles.ts.`);
    const body = ['# The style specification of Map Jr. GL', '',
        `The [Maputnik of Map Jr. GL](/styles/editing) validates styles with a fork of the MapLibre style specification, [map-jr/maplibre-style-spec](${githubUrl(sources.spec)}) (branch \`${sources.spec.branch}\`). This page is \`${specFile}\` of the fork.`, '',
        safeMarkdown(lines.slice(start + 1).join('\n').trim()), ''].join('\n');
    return frontmatter({editUrl: githubUrl(sources.spec, specFile)}) + body;
}

// Fetches the three repositories and writes the pages. It runs once for each start of Nuxt,
// and returns the styles for the switch of /styles.
let written: StyleChoice[] | undefined;
export function writeStylePages(): StyleChoice[] {
    if (written) return written;
    const stylesDir = checkout(sources.styles);
    const readme = safeMarkdown(readFileSync(resolve(stylesDir, 'README.md'), 'utf8'));
    const maputnik = safeMarkdown(readFileSync(resolve(checkout(sources.maputnik), 'README.md'), 'utf8'));
    const specPath = resolve(checkout(sources.spec), specFile);
    if (!existsSync(specPath)) fail(`map-jr/maplibre-style-spec (branch ${sources.spec.branch}) has no ${specFile}, which the site reads for /styles/spec. Restore the file there, or change website/build/styles.ts.`);
    const spec = readFileSync(specPath, 'utf8');
    const rows = styleRows(readme);
    const stateRows = (/\*\*Global state\.\*\*[\s\S]*?\n((?:\|.*\n)+)/.exec(readme)?.[1] ?? fail('README.md of map-jr/map-jr-styles has no table under "**Global state.**".'))
        .trim().split('\n').slice(2).map(cells);
    const built = new Set(readdirSync(resolve(stylesDir, 'dist/styles')));
    const choices = rows.map(row => {
        if (!built.has(row.name + '.json')) fail(`the table of the styles names "${row.name}", and dist/styles/ has no ${row.name}.json.`);
        return styleChoice(row, JSON.parse(readFileSync(resolve(stylesDir, 'dist/styles', row.name + '.json'), 'utf8')), stateRows);
    });

    const out = resolve(generatedDir, stylesFolder);
    rmSync(out, {recursive: true, force: true});
    mkdirSync(out, {recursive: true});
    const pages: Record<string, string> = {'index.md': indexPage(readme, rows), 'editing.md': editingPage(maputnik, readme), 'spec.md': specPage(spec)};
    for (const [file, text] of Object.entries(pages)) writeFileSync(resolve(out, file), text);
    return written = choices;
}
