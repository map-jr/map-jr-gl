import type {MapDescription} from './host.ts';

/** A description after `unset`: no field is `null`, except `terrain`, where `null` turns off the terrain of the style. */
export type Given = {[K in keyof MapDescription]: K extends 'terrain' ? MapDescription[K] : Exclude<MapDescription[K], null>};

/**
 * Removes the fields that are `null`, which means "not set" (#1146), so that the map reads `null` as a missing field.
 * It keeps `terrain: null`, and it returns the same object when no field is removed.
 */
export function unset(spec: MapDescription): Given {
    let out: Record<string, unknown> | undefined;
    for (const k in spec) if ((spec as unknown as Record<string, unknown>)[k] === null && k !== 'terrain') delete (out ??= {...spec})[k];
    return (out ?? spec) as Given;
}
