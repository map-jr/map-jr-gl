// TypeScript code for the adapter for React (`@map-jr/map-jr-gl/react`).
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
// (The types of the Vue component are for templates. `vue-tsc` checks those, and the repository does not have it.)
import {MapImage} from '@map-jr/map-jr-gl/react';

// The parameters of an image are the argument of the function in its content.
export const pin = <MapImage name="pin" params={['color', 'stroke']}>
    {({color, stroke}) => <svg viewBox="0 0 4 4"><path fill={color} stroke={stroke} d="M0 0h4v4z"/></svg>}
</MapImage>;
// @ts-expect-error: `colour` is not a parameter of the image
export const wrong = <MapImage name="pin" params={['color']}>{({colour}) => <svg fill={colour}/>}</MapImage>;
export const plain = <MapImage name="dot"><svg viewBox="0 0 4 4"><circle cx="2" cy="2" r="2"/></svg></MapImage>;
export const photo = <MapImage name="photo" src="/photo.png" width={32} height={32}/>;
