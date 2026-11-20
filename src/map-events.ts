/**
 * The events of `listen` that the Vue component (src/vue.ts) and the element `<map-jr>` (src/element.ts) pass on as
 * they are. `click`, `load`, `idle` and `error` are not in the list: the component and the element give them a value
 * of their own.
 */
import type {MapEvents} from './host.ts';

export type Forwarded = Exclude<keyof MapEvents, 'click' | 'load' | 'idle' | 'error'>;
export const FORWARDED = ['render', 'resize', 'remove', 'style.load', 'webglcontextlost', 'webglcontextrestored', 'movestart', 'move', 'moveend', 'zoomstart', 'zoom', 'zoomend',
    'rotatestart', 'rotate', 'rotateend', 'pitchstart', 'pitch', 'pitchend', 'dragstart', 'drag', 'dragend', 'dblclick', 'contextmenu', 'mousedown', 'mousemove', 'mouseup', 'mouseover', 'mouseout',
    'touchstart', 'touchmove', 'touchend', 'touchcancel', 'styledata', 'sourcedata', 'data', 'styledataloading', 'sourcedataloading', 'dataloading', 'wheel',
    'boxzoomstart', 'boxzoomcancel', 'boxzoomend', 'stats', 'styleimagemissing', 'terrain', 'projectiontransition', 'geolocate'] as const satisfies readonly Forwarded[];
// (The type check fails here when the map gets an event that the list does not have.)
true satisfies (Forwarded extends typeof FORWARDED[number] ? true : false);
