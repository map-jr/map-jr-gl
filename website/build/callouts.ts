// The GitHub alerts that a page of docs/ may use, and the callout of Nuxt UI that each one becomes on the site.
const alerts: Record<string, string> = {NOTE: 'note', TIP: 'tip', WARNING: 'warning'};

// Turns each GitHub alert at the start of a line (`> [!NOTE]` and the quoted lines after it) into a callout block of
// MDC (`::note`), outside code fences. GitHub shows the alert itself, so the page stays readable there. An alert in
// a page of another repository becomes one of these three fixed components too; `safeMarkdown` (styles.ts) has escaped
// its text before, so the text starts no other component.
export function callouts(markdown: string): string {
    const lines = markdown.split('\n');
    const out: string[] = [];
    let fence = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const marker = /^ *(```+|~~~+)/.exec(line)?.[1];
        if (marker && (!fence || marker.startsWith(fence))) fence = fence ? '' : marker;
        const kind = fence ? undefined : /^> \[!(\w+)\]\s*$/.exec(line)?.[1];
        if (!kind || !alerts[kind]) { out.push(line); continue; }
        out.push(`::${alerts[kind]}`);
        while (i + 1 < lines.length && lines[i + 1]!.startsWith('>')) out.push(lines[++i]!.replace(/^> ?/, ''));
        out.push('::');
    }
    return out.join('\n');
}
