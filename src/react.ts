/**
 * The adapter for React 18 and 19: `import {MapJr, MapOverlay, useMapState} from '@map-jr/map-jr-gl/react'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description after
 * each render, and the map finds what is different. Props that are made again with the same content do no work.
 * The data of a source (`data`) is compared by identity: keep the object (`useMemo`, state) until the data changes.
 */
import {createContext, createElement as h, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
declare const __DEV__: boolean;
import {makeMap, type MapEvents, type MapInstance, type MapOverlay as Overlay, type MapPointer, type MapDescription, type MapState, type OverlayOptions, type View} from './host.ts';
import type {RenderedFeature} from './map.ts';

type Undotted<K extends string> = K extends `${infer A}.${infer B}` ? `${A}${B}` : K;
/**
 * A prop for each event of the map: `onMoveend`, `onStyleimagemissing` and the others (`on`, and the name of the event
 * with a capital first letter; `onStyleload` for `style.load`). The value is the event of `listen` of the main API.
 * (`onClick`, `onLoad`, `onIdle` and `onError` are props of the component with a value of their own.)
 */
export type MapEventProps = {[K in Exclude<keyof MapEvents, 'click' | 'load' | 'idle' | 'error'> as `on${Capitalize<Undotted<K>>}`]?: (event: MapEvents[K]) => void};
/** The props that are not an event of the map itself. */
const OWN = new Set(['onViewChange', 'onClick', 'onHover', 'onLoad', 'onIdle', 'onError']);

export interface MapJrProps extends Omit<MapDescription, 'style' | 'onViewChange'>, MapEventProps {
    /** The style: a style object, the URL of a style, or `{light, dark}`. The prop `style` is the CSS style of the element. */
    mapStyle: MapDescription['style'];
    /** Called with the new view at each change of the view. To control the view, pass the value back to `view`. */
    onViewChange?: (view: View) => void;
    /** Called with the features of `interactiveLayers` under the pointer, the top one first, when they change. */
    onHover?: (features: RenderedFeature[]) => void;
    /** Called when the style and the first tiles have loaded. */
    onLoad?: () => void;
    /** Called each time the camera is still and nothing loads. */
    onIdle?: () => void;
    /** Called with each error of the map. Without it, the map writes each error to the console. */
    onError?: (error: Error) => void;
    /**
     * The first view rendered on a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. The
     * page shows it until the map has rendered. Read only on the first render.
     */
    firstView?: string;
    /** A CSS class to add to the element, after the class `map-jr-react`. */
    className?: string;
    /** The CSS style of the element, merged over `{position: 'relative', width: '100%', height: '100%'}`. */
    style?: CSSProperties;
    /** Content over the map, and `MapOverlay` elements. */
    children?: ReactNode;
}

const Host = createContext<MapInstance | null>(null);
type GivenImage = [string, {image: string; width?: number; height?: number; pixelRatio?: number}];
/** How a `MapImage` gives its image to the `MapJr` that it is in: its name and the image, or null when it has none. */
const Images = createContext<((owner: object, image: GivenImage | null) => void) | null>(null);
/**
 * Returns the map of the `MapJr` that the component is in.
 * @returns The map, or `null` until the map has started.
 */
export const useMap = () => useContext(Host);
/**
 * Returns a part of the state of the map, and renders the component again when that part changes:
 * `const zoom = useMapState(s => s.view.zoom)`.
 * @param select A function that returns a part of the state. It can return a new plain object or array, such as `s => ({zoom: s.view.zoom, pitch: s.view.pitch})`: the hook compares the result with the last one, one level deep, and keeps the last one when each member is identical.
 * @param map The map to read. Without it, the map of the `MapJr` that the component is in.
 * @returns The part of the state, or `undefined` until the map has started.
 */
export function useMapState<T>(select: (state: MapState) => T, map?: MapInstance | null): T | undefined {
    const host = useContext(Host), from = map === undefined ? host : map, last = useRef<[MapState?, unknown?, T?]>([]);
    return useSyncExternalStore(fn => from ? from.state.subscribe(fn) : () => {}, () => {
        if (!from) return undefined;
        // (The same state and the same function give the last result; React calls this function more than once.)
        const s = from.state.get(), [was, by, old] = last.current;
        if (s === was && select === by) return old;
        const v = select(s);
        last.current = [s, select, same(v, old) ? old : v];
        return last.current[2];
    }, () => undefined);
}
/** Whether two results of a selector are equal: identical, or plain objects or arrays with identical members. */
const plain = (v: any) => v && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);
function same(a: any, b: any): boolean {
    if (Object.is(a, b)) return true;
    if (!plain(a) || !plain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}

/** The map as a component. It fills its parent element, so give the parent a height. A ref receives the map (`MapInstance`). */
export const MapJr = forwardRef<MapInstance | null, MapJrProps>(function MapJr(props, ref) {
    const {mapStyle, firstView, className, style, children, onHover, onLoad, onIdle, onError, ...rest} = props;
    const el = useRef<HTMLDivElement>(null), made = useRef<MapInstance | null>(null), [host, setHost] = useState<MapInstance | null>(null);
    // The functions of the last render are called, also from a map that an earlier render made.
    const last = useRef(props);
    last.current = props;
    // The images of the `MapImage` components in this map, by component. They come after the images of the prop: with
    // one name in both, the image of the component is used.
    const owners = useRef(new globalThis.Map<object, GivenImage>()), [, again] = useState(0);
    // One object for the life of the component: some React versions (the 18.3 canary of Next.js 14) set `innerHTML`
    // again for a new object, which deletes the canvas of the map (#188).
    const [html] = useState(() => ({__html: firstView ?? ''}));
    const give = useCallback((owner: object, image: GivenImage | null) => {
        if (JSON.stringify(owners.current.get(owner) ?? null) === JSON.stringify(image)) return;
        if (image) owners.current.set(owner, image); else owners.current.delete(owner);
        again(n => n + 1);
    }, []);
    const spec: MapDescription = {...rest, images: rest.images || owners.current.size ? {...rest.images, ...Object.fromEntries(owners.current.values())} : undefined, style: mapStyle, onViewChange: view => last.current.onViewChange?.(view), onClick: event => last.current.onClick?.(event),
        // (Without `onError`, the map writes each error to the console.)
        onError: onError && (error => last.current.onError?.(error))};
    // The props for the events of the map are no part of the description. Each one is a listener of its event.
    const events = Object.keys(rest).filter(k => /^on[A-Z]/.test(k) && !OWN.has(k));
    for (const k in spec) if ((spec as any)[k] === undefined || events.includes(k)) delete (spec as any)[k];
    useEffect(() => {
        if (!host) return;
        const stops = events.map(k => host.listen((k === 'onStyleload' ? 'style.load' : k.slice(2).toLowerCase()) as 'move', e => (last.current as any)[k]?.(e)));
        return () => { for (const stop of stops) stop(); };
    }, [host, events.join()]);
    useEffect(() => {
        const map = made.current = makeMap(el.current!, spec, '<MapJr>');
        setHost(map);
        const stops = [
            map.state.subscribe(s => s.loaded, v => { if (v) last.current.onLoad?.(); }),
            map.state.subscribe(s => s.idle, v => { if (v) last.current.onIdle?.(); }),
            map.state.subscribe(s => s.hover, v => last.current.onHover?.(v)),
        ];
        return () => { for (const stop of stops) stop(); made.current = null; map.destroy(); setHost(null); };
    }, []);
    useEffect(() => { made.current?.update(spec); });
    useImperativeHandle(ref, () => host as MapInstance, [host]);
    return h('div', {className: 'map-jr-react' + (className ? ' ' + className : ''), style: {position: 'relative', width: '100%', height: '100%', ...style}},
        // (The HTML of the server stays in this element until the map removes it: React does not look at its content.)
        h('div', {ref: el, style: {position: 'absolute', inset: 0}, suppressHydrationWarning: true, dangerouslySetInnerHTML: html}),
        h(Images.Provider, {value: give}, h(Host.Provider, {value: host}, children)));
});

/**
 * Places its React content at a position of the map, as a marker or a popup, inside `MapJr`. The props are the
 * options of `overlay` (`OverlayOptions`). For many points, a symbol layer in the prop `layers` renders much faster.
 */
export function MapOverlay({children, ...options}: OverlayOptions & {children?: ReactNode}) {
    const host = useContext(Host), [el] = useState(() => typeof document === 'undefined' ? null : document.createElement('div')), overlay = useRef<Overlay | null>(null);
    const last = useRef(options);
    last.current = options;
    const now = (): OverlayOptions => ({...last.current, onClose: last.current.onClose && (() => last.current.onClose?.())});
    useEffect(() => {
        if (!host || !el) return;
        const o = overlay.current = host.overlay(el, now());
        return () => { overlay.current = null; o.remove(); };
    }, [host, el]);
    useEffect(() => { overlay.current?.update(now()); });
    return el && host ? createPortal(children, el) : null;
}

/** The props of `MapImage`. `P` has the names of the parameters. */
export interface MapImageProps<P extends string = never> {
    /** The name of the image, for `icon-image` of a style layer. */
    name: string;
    /** The names of the parameters of the image. The function in `children` receives a value for each one. */
    params?: readonly P[];
    /** The URL of an image, in place of an SVG in `children`. */
    src?: string;
    /** The width in CSS pixels. Without it, an SVG has the width of its `viewBox`, or else of its `width` attribute, and another image has its own width. */
    width?: number;
    /** The height in CSS pixels. Without it, an SVG has the height of its `viewBox`, or else of its `height` attribute, and another image has its own height. */
    height?: number;
    /**
     * The number of image pixels for one CSS pixel, for example 2 for an image "@2x".
     * @default 1
     */
    pixelRatio?: number;
    /** An `<svg>` element, or a function that receives the parameters and returns one. */
    children?: ReactNode | ((params: Record<P, string>) => ReactNode);
}
/**
 * An image for the style layers of the map, for the inside of `MapJr`. The SVG is the content:
 * `<MapImage name="pin" params={['color']}>{({color}) => <svg viewBox="0 0 24 31"><path fill={color} d="..."/></svg>}</MapImage>`.
 * A layer uses the image with `'icon-image': 'pin'`. A parameter gets its value for each feature of the layer: from the
 * property of the feature with that name, or from `params` of the `image` expression of the layer. React renders the SVG
 * one time, not one time for each feature. `<MapImage name="photo" src="/photo.png" />` is an image from a URL.
 */
export function MapImage<const P extends string = never>({name, params, src, width, height, pixelRatio, children}: MapImageProps<P>) {
    // The image is a part of the description of the map, as an image of the prop `images` is: the `MapJr` of this
    // component gets it from `give`, and the map finds what is different. (Two components can then have one name,
    // and a component can go: the map has what the components that are there give.)
    const host = useContext(Host), give = useContext(Images), owner = useRef({});
    // The content is rendered into an element that is not in the page, and is read as a string of SVG after each
    // change, also a change that a component inside the SVG makes.
    const [el] = useState(() => typeof document === 'undefined' ? null : document.createElement('div')), [svg, setSvg] = useState('');
    useEffect(() => {
        if (!el) return;
        const read = () => { const node = el.querySelector('svg'); setSvg(node ? new XMLSerializer().serializeToString(node) : ''); };
        const changes = new MutationObserver(read);
        changes.observe(el, {subtree: true, childList: true, attributes: true, characterData: true});
        read();
        return () => changes.disconnect();
    }, [el]);
    const image = src ?? svg;
    useEffect(() => { give?.(owner.current, image ? [name, JSON.parse(JSON.stringify({image, width, height, pixelRatio}))] : null); }, [give, name, image, width, height, pixelRatio]);
    useEffect(() => () => give?.(owner.current, null), [give]);
    useEffect(() => {
        if (!__DEV__) return;
        if (!give) { console.warn(`[map-jr-gl] MapImage "${name}" is not inside MapJr, so no map gets the image. Put it into the children of MapJr.`); return; }
        const timer = setTimeout(() => { if (!src && !el?.querySelector('svg')) console.warn(`[map-jr-gl] MapImage "${name}" has no image: its content has no <svg> element. Give an <svg> element as the content, or the URL of an image as "src".`); }, 1000);
        return () => clearTimeout(timer);
    }, [give]);
    // (The value of a parameter in the SVG is the text of a slot of a template: `{{color}}`.)
    const slots = Object.fromEntries((params ?? []).map(p => [p, `{{${p}}}`])) as Record<P, string>;
    // (Nothing in the first render, as on the server: the map is not there yet.)
    return el && host ? createPortal(typeof children === 'function' ? children(slots) : children, el) : null;
}
export type {MapInstance, MapPointer, MapDescription, MapState, OverlayOptions, View};
