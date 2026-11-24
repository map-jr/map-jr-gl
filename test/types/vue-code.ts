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

// The composables take refs or getters and return refs of the documented feature types (#710).
import {ref, type ShallowRef} from 'vue';
import {useMapFeatures, useMapSource} from '@map-jr/map-jr-gl/vue';
import type {RenderedFeature, QueriedFeature, FeaturePlace} from '@map-jr/map-jr-gl';
const place = ref<FeaturePlace | undefined>([13.4, 52.5]);
export const atPoint: ShallowRef<RenderedFeature[]> = useMapFeatures(() => [13.4, 52.5], {layers: ['building'], radius: 4});
export const atBox: RenderedFeature[] = useMapFeatures([{x: 0, y: 0}, {x: 100, y: 100}]).value;
export const fromSource: ShallowRef<QueriedFeature[]> = useMapSource('openmaptiles', place, {sourceLayers: ['building'], geometry: true});
export const wholeSource: QueriedFeature[] = useMapSource(ref('openmaptiles')).value;
// @ts-expect-error: `layers` is an option of useMapFeatures; useMapSource takes `sourceLayers`
useMapSource('openmaptiles', place, {layers: ['building']});
