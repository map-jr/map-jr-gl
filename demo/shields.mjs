/**
 * Highway shields generated as SVG from a name like "shield|us-interstate|95". The style builds that name with an
 * expression; the same function serves the browser (setMissingStyleImageResolver) and the server (resolveImage).
 */
export function shield(name) {
    const [kind, network, ref] = name.split('|');
    if (kind !== 'shield' || !ref) return undefined;
    const esc = ref.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`);
    const width = Math.max(22, 10 + ref.length * 7), height = 22, mid = width / 2;
    const text = (fill, y = 15.500) => `<text x="${mid}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="${fill}">${esc}</text>`;
    let art;
    if (network === 'us-interstate') {
        art = `<path d="M2 3 Q${mid} -1 ${width - 2} 3 V11 Q${width - 2} 18 ${mid} 21 Q2 18 2 11Z" fill="#2a57a5" stroke="#fff" stroke-width="1.200"/>` +
            `<path d="M2 3 Q${mid} -1 ${width - 2} 3 V7.500 H2Z" fill="#c8303b"/>${text('#fff', 16.500)}`;
    } else if (network === 'us-highway') {
        art = `<path d="M3 2 H${width - 3} Q${width - 1} 8 ${width - 2} 13 Q${width - 4} 19 ${mid} 20.500 Q4 19 2 13 Q1 8 3 2Z" fill="#fff" stroke="#222" stroke-width="1.300"/>${text('#222')}`;
    } else if (network === 'us-state') {
        art = `<ellipse cx="${mid}" cy="11" rx="${mid - 1}" ry="9.500" fill="#fff" stroke="#222" stroke-width="1.300"/>${text('#222', 15)}`;
    } else {
        art = `<rect x="1" y="3" width="${width - 2}" height="16" rx="3" fill="#fdf6d8" stroke="#8a7a3c" stroke-width="1.200"/>${text('#5b4f1f', 15)}`;
    }
    return {svg: `<svg viewBox="0 0 ${width} ${height}">${art}</svg>`, width, height};
}
