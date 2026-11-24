/**
 * The part of the library for elevation data (#1849), which loads on demand: the contour lines, which the tile workers
 * make (contour.ts), and 3D terrain, which the engine draws (terrain.ts). A map with a `contour` source or with
 * `terrain` loads it, and each thread uses its half. The two are one file because both wait for the same elevation tiles.
 */
export * from './contour.ts';
export * from './terrain.ts';
