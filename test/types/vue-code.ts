// A template ref on `MapJr` has the members of the map (#265, #1151).
import {useTemplateRef} from 'vue';
import {MapJr} from '@map-jr/map-jr-gl/vue';
import type {MapInstance, MapState, Readable} from '@map-jr/map-jr-gl';

type Instance = InstanceType<typeof MapJr>;
export const query: MapInstance['queryFeatures'] = null as unknown as Instance['queryFeatures'];
export const state: Readable<MapState> = null as unknown as Instance['state'];
// @ts-expect-error: the ref has no member `map` (#1151)
export const old = null as unknown as Instance['map'];
const map = useTemplateRef<Instance>('map');
export const zoom = () => map.value?.moveTo({zoom: 15, duration: 500});
export const loaded = () => map.value?.state.get().loaded;
// The props stay typed.
export const style: string | object = null as unknown as Instance['$props']['mapStyle'];
