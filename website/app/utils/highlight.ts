// A small highlighter for the code of the home page: JavaScript, and HTML with JavaScript in it (Vue, Svelte, JSX). It
// gives each piece of a text a kind, and components/home/HomeCode.vue colors the kinds as the code blocks of the docs
// are colored. It is not a parser: it knows comments, strings, tags, keywords, numbers, keys and calls.
export type Piece = {text: string; kind: '' | 'comment' | 'string' | 'tag' | 'keyword' | 'number' | 'key' | 'call' | 'added' | 'removed'};

const pattern = new RegExp([
    /(?<comment>\/\/.*|<!--[\s\S]*?-->)/,
    /(?<string>'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/,
    /(?<tag><\/?[A-Za-z][\w-]*|\/?>)/,
    /(?<keyword>\b(?:import|from|export|default|const|let|function|return|new|if|await|async)\b)/,
    /(?<number>\b\d+(?:\.\d+)?\b)/,
    /(?<key>[A-Za-z_$][\w$-]*(?=\s*[:=](?!=)))/,
    /(?<call>[A-Za-z_$][\w$]*(?=\())/,
].map(part => part.source).join('|'), 'g');

/** The pieces of one line of code. A line that starts with "+ " or "- " is a line of a diff and has one kind. */
export function highlight(line: string): Piece[] {
    if (line.startsWith('+ ')) return [{text: line, kind: 'added'}];
    if (line.startsWith('- ')) return [{text: line, kind: 'removed'}];
    const pieces: Piece[] = [];
    let last = 0;
    for (const match of line.matchAll(pattern)) {
        if (match.index > last) pieces.push({text: line.slice(last, match.index), kind: ''});
        const kind = Object.entries(match.groups!).find(([, value]) => value !== undefined)![0] as Piece['kind'];
        pieces.push({text: match[0], kind});
        last = match.index + match[0].length;
    }
    if (last < line.length) pieces.push({text: line.slice(last), kind: ''});
    return pieces;
}
