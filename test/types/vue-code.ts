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

// Each optional prop of `MapJr` accepts `null`, as the field of the description does (#1304).
export const nulls: Partial<Instance['$props']> = {
    view: null, initialView: null, sources: null, layers: null, terrain: null, images: null, sprite: null, data: null,
    interactiveLayers: null, hoverState: null, minZoom: null, maxZoom: null, maxPitch: null, maxBounds: null, cursor: null,
    cooperativeGestures: null, colorScheme: null, locale: null, padding: null, controls: null, projection: null,
    globalState: null, transformRequest: null, renderer: null, fonts: null, fontFamily: null, interactive: null,
    antialias: null, nonce: null, attribution: null, hash: null,
};
