// A template ref on `MapJr` has the exposed members `map` and `state` (#265).
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import type {MapInstance, MapState} from '@map-jr/map-jr-gl';

type Instance = InstanceType<typeof MapJr>;
export const instance: MapInstance | null = null as unknown as Instance['map'];
export const state: MapState | null = null as unknown as Instance['state'];
const map = useTemplateRef<Instance>('map');
export const zoom = () => map.value?.map?.moveTo({zoom: 15, duration: 500});
export const loaded = () => map.value?.state?.loaded;
// The props stay typed.
export const style: string | object = null as unknown as Instance['$props']['mapStyle'];
