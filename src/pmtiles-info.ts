// The one function of the PMTiles reader that the style resolver uses. The resolver loads this file on demand, so a
// built file that contains everything keeps only this function and what it uses.
export {archive} from './pmtiles.ts';
