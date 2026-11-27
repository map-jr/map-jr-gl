// Writes src/style-spec-values.ts: the types of the values of the paint and layout properties of the style
// specification that MapLibre GL JS of the devDependencies uses, for the check of the development build (#1748).
// Run it after an update of maplibre-gl: `node scripts/style-spec-values.mjs`. test/unit/validate-style.test.ts
// fails when the file differs from what this script writes.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const require = createRequire(createRequire(import.meta.url).resolve('maplibre-gl/package.json'));
const spec = JSON.parse(readFileSync(require.resolve('@maplibre/maplibre-gl-style-spec/package.json').replace(/package\.json$/, 'dist/latest.json'), 'utf8'));

/** The code of one value: n<min>,<max> (a number), c (a color), b (a boolean), e<values> (an enum; the values are
 * separated by commas), a<length> (an array of numbers), s (an array of strings), E<values> (an array of enum values),
 * p (padding), N (numberArray), C (colorArray). A leading ! marks a property that takes no expression. The other types
 * (images, formatted text, anchor offsets) are left out, because a value of the wrong type is an expression there. */
const code = v => {
    const enumOf = s => Object.keys(s.values).join(',');
    const c = v.type === 'number' ? `n${v.minimum ?? ''},${v.maximum ?? ''}` : v.type === 'color' ? 'c' : v.type === 'boolean' ? 'b'
        : v.type === 'enum' ? 'e' + enumOf(v) : v.type === 'padding' ? 'p' : v.type === 'numberArray' ? 'N' : v.type === 'colorArray' ? 'C'
        : v.type === 'array' ? (v.value === 'number' ? 'a' + (v.length ?? '') : v.value === 'string' ? 's' : v.value === 'enum' ? 'E' + enumOf(v) : '') : '';
    return c && (v.expression ? '' : '!') + c;
};
/** The code of the type that an expression of a property must have, as MapLibre's `getExpectedType` gives it: n
 * (number), S (string), e (an enum, a string), b, c (color), f (formatted), i (resolvedImage), p (padding), N
 * (numberArray), C (colorArray), v (variableAnchorOffsetCollection), P (projectionDefinition), or A<item><length> (an
 * array; the item is n, S, b or V for value). Then a space and the flags: d (data expressions), z (zoom expressions),
 * i (interpolate), or - for none. The fixtures of test/conformance/expressions.mjs use it for their propertySpec. */
export const expressionCode = v => {
    const t = {number: 'n', string: 'S', enum: 'e', boolean: 'b', color: 'c', formatted: 'f', resolvedImage: 'i', padding: 'p', numberArray: 'N', colorArray: 'C',
        variableAnchorOffsetCollection: 'v', projectionDefinition: 'P'};
    const type = v.type === 'array' ? 'A' + ({number: 'n', string: 'S', enum: 'S', boolean: 'b'}[v.value] ?? 'V') + (v.length ?? '') : t[v.type] ?? '';
    const flags = (['data-driven', 'cross-faded-data-driven'].includes(v['property-type']) ? 'd' : '') + (v.expression?.parameters?.includes('zoom') ? 'z' : '') + (v.expression?.interpolated ? 'i' : '');
    return type && `${type} ${flags || '-'}`;
};
/** The code of one property of a source, as `code` gives it, and also S (a string), # (a promoteId), F (a filter), K (the
 * four coordinates of an image or video) and - (not checked). The properties of a source take no expression, so each
 * code starts with !. */
const sourceCode = v => v.type === 'string' ? '!S' : v.type === 'promoteId' ? '#' : v.type === 'filter' ? 'F' : v.type === 'array' && v.value?.type === 'array' ? 'K' : code(v) || '-';
export function source() {
    const types = Object.keys(spec.layer.type.values);
    const group = g => types.flatMap(t => Object.entries(spec[`${g}_${t}`] ?? {}).map(([k, v]) => code(v) && `${t} ${k} ${code(v)}`).filter(Boolean)).join('|');
    const expressions = g => types.flatMap(t => Object.entries(spec[`${g}_${t}`] ?? {}).filter(([, v]) => v.expression && expressionCode(v)).map(([k, v]) => `${t} ${k} ${expressionCode(v)}`)).join('|');
    const sources = ['vector', 'raster', 'raster-dem', 'geojson', 'video', 'image'].flatMap(t => Object.entries(spec[`source_${t.replace('-', '_')}`]).filter(([k]) => k !== 'type').map(([k, v]) => `${t} ${k} ${sourceCode(v)}`)).join('|');
    const layout = types.map(t => `${t} ${Object.keys(spec[`layout_${t}`] ?? {}).join(' ')}`).join('|');
    return `// Written by scripts/style-spec-values.mjs from the style specification ${spec.$version} of @maplibre/maplibre-gl-style-spec. Do not edit.
// Each entry is "<layer type> <property> <code>"; the script says what the codes mean. (Development build only, #1748.)
export const layerTypes = ${JSON.stringify(types.join(' '))};
export const operators = ${JSON.stringify(Object.keys(spec.expression_name.values).join(' '))};
// The names of all layout properties of each layer type, also those that have no code ("<layer type> <names>"); the others are paint (#1683).
export const layoutNames = ${JSON.stringify(layout)};
export const paintValues = ${JSON.stringify(group('paint'))};
export const layoutValues = ${JSON.stringify(group('layout'))};
// The type and the flags of each property that takes an expression ("<layer type> <property> <type> <flags>").
export const paintExpressions = ${JSON.stringify(expressions('paint'))};
export const layoutExpressions = ${JSON.stringify(expressions('layout'))};
// The code of each property of a source ("<source type> <property> <code>"; a property "*" means that the type takes other properties).
export const sourceValues = ${JSON.stringify(sources)};
`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(new URL('../src/style-spec-values.ts', import.meta.url), source());
