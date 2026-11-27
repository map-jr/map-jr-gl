// The paragraphs of the codes (#2484): the comments `// E<code>: <text>` in src/. Used by scripts/messages.mjs.

/**
 * Reads the paragraphs of the sources, given as [file, text]. A paragraph starts at `// E<code>: ` and goes on in each `//` line
 * that follows directly. It ends at a line that is not a `//` comment, at an empty `//` line, or at the next `// E<code>:` line.
 * The lines are joined with one space. Returns a map from the code to the list of its paragraphs: {file, parts}.
 */
export function readParagraphs(sources) {
    const paragraphs = new Map();
    for (const [file, text] of sources) {
        let open = null;
        for (const line of text.split('\n')) {
            const start = line.match(/^\s*\/\/ E(\d+): ?(.*)$/), more = line.match(/^\s*\/\/ (\S.*)$/);
            if (start) { open = {code: +start[1], parts: [start[2].trim()], file}; (paragraphs.get(open.code) ?? paragraphs.set(open.code, []).get(open.code)).push(open); }
            else if (open && more) open.parts.push(more[1].trim());
            else open = null;
        }
    }
    return paragraphs;
}

/** The text of a paragraph. */
export const paragraphText = x => x.parts.join(' ').trim();

/** The problems of the paragraphs: a code that no message has (`known(code)` is false), two paragraphs for one code, no text. */
export function paragraphProblems(paragraphs, known) {
    const problems = [];
    for (const [code, list] of paragraphs) {
        if (!known(code)) problems.push(`${list[0].file}: the comment "// E${code}: ..." is a paragraph for a code that no message of src/ has. Use the code of the message that it explains.`);
        else if (list.length > 1) problems.push(`E${code} has ${list.length} paragraphs (${list.map(x => x.file).join(', ')}). Keep one comment "// E${code}: ..." in src/.`);
        for (const x of list) if (!x.parts.join('').length) problems.push(`${x.file}: the comment "// E${code}:" has no text. Write the paragraph after the colon.`);
    }
    return problems;
}
