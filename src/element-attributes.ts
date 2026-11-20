/**
 * The attributes of the element `<map-jr>` (src/element.ts), which `renderElement` of the server entry (src/server.ts)
 * writes too, so that the two cannot disagree. Each field of the description (`MapDescription`) with a string, number
 * or boolean value has an attribute: the name of the field in kebab case, and `map-style` for `style` (`style` is the
 * CSS attribute of every element). `center`, `zoom`, `bearing` and `pitch` are the fields of `initialView`.
 *
 * How the value is read: `s` a string, `n` a number, `b` a boolean attribute (present is `true`, whatever its value, as
 * in HTML), `o` a boolean attribute named `no-` and the field, for a field that is on by default (present is `false`),
 * `c` a position `lng,lat`, `l` ids separated by spaces, `p` a projection (`globe` or `mercator`), `h` the hash (present
 * with no value is `true`, a value is the name of the parameter). `attributionCompact` is no field: it is
 * `attribution: {compact: true}` (#1258).
 */
export const ATTRIBUTES = {
    style: 's', center: 'c', zoom: 'n', bearing: 'n', pitch: 'n', colorScheme: 's', cursor: 's', renderer: 's', fontFamily: 's',
    minZoom: 'n', maxZoom: 'n', maxPitch: 'n', padding: 'n', interactiveLayers: 'l', projection: 'p', hoverState: 'b', cooperativeGestures: 'b', hash: 'h',
    interactive: 'o', antialias: 'b', attribution: 'o', attributionCompact: 'b',
} as const;
export type AttributeKind = typeof ATTRIBUTES[keyof typeof ATTRIBUTES];
/** The fields of `initialView` among the attributes. */
export const VIEW_FIELDS = ['center', 'zoom', 'bearing', 'pitch'];

/** The name of the attribute of a field. */
export const attributeOf = (field: string) => field === 'style' ? 'map-style'
    : (ATTRIBUTES[field as keyof typeof ATTRIBUTES] === 'o' ? 'no-' : '') + field.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

/** The value of an attribute, or `undefined` when it cannot be read. */
export function readAttribute(kind: AttributeKind, text: string): unknown {
    const number = (t: string) => t.trim() && Number.isFinite(+t) ? +t : undefined;
    if (kind === 'n') return number(text);
    if (kind === 'c') { const p = text.split(',').map(number); return p.length === 2 && p.every(n => n !== undefined) ? p : undefined; }
    // (An HTML boolean attribute is on when it is there, whatever its value: `hover-state="false"` is `true`, and the
    // development build warns, #1258.)
    if (kind === 'b') return true;
    if (kind === 'o') return false;
    if (kind === 'h') return text || true;
    if (kind === 'l') return text.split(/\s+/).filter(Boolean);
    if (kind === 'p') return text === 'globe' || text === 'mercator' ? {type: text} : undefined;
    return text;
}
