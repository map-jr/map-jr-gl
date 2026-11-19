// A throwaway file for the spike. It gives the script names to ask for, and an interface with TSDoc tags, because
// src/host.ts has none yet.
import type {MapDescription, MapEvents} from '../../../src/host.ts';
import type {MapJr} from '../../../src/vue.ts';

export type Description = MapDescription;
export type Events = MapEvents;
export type Props = InstanceType<typeof MapJr>['$props'];

export interface Tagged {
    /**
     * The smallest zoom.
     * @default 0
     * @example
     * createMap(el, {style, minZoom: 2});
     * @since 0.9.0
     */
    minZoom?: number;
    /** @deprecated Use `minZoom`. */
    lowestZoom?: number;
}
