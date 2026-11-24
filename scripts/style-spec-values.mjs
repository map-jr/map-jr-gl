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
export function source() {
    const types = Object.keys(spec.layer.type.values);
    const group = g => types.flatMap(t => Object.entries(spec[`${g}_${t}`] ?? {}).map(([k, v]) => code(v) && `${t} ${k} ${code(v)}`).filter(Boolean)).join('|');
    return `// Written by scripts/style-spec-values.mjs from the style specification ${spec.$version} of @maplibre/maplibre-gl-style-spec. Do not edit.
// Each entry is "<layer type> <property> <code>"; the script says what the codes mean. (Development build only, #1748.)
export const layerTypes = ${JSON.stringify(types.join(' '))};
export const paintValues = ${JSON.stringify(group('paint'))};
export const layoutValues = ${JSON.stringify(group('layout'))};
`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(new URL('../src/style-spec-values.ts', import.meta.url), source());
