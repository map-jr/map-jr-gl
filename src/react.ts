/**
 * The adapter for React 18 and 19: `import {MapJr, MapOverlay, useMapState} from '@map-jr/map-jr-gl/react'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description after
 * each render, and the map finds what is different. Props that are made again with the same content do no work.
 * Marker data is compared by identity: keep the array (`useMemo`, state) until the markers change.
 */
import {createContext, createElement as h, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
declare const __DEV__: boolean;
import {createMap, type MapHost, type MapOverlay as Overlay, type MapPointer, type MapSpec, type MapState, type OverlayOptions, type View} from './host.ts';
import type {RenderedFeature} from './map.ts';

export interface MapJrProps extends Omit<MapSpec, 'style' | 'onViewChange'> {
    /** A style object or the URL of a style. (`style` is the CSS style of the element.) */
    mapStyle: string | object;
    /** Called with the view after each change. With `view`, write the value back to own the view. */
    onViewChange?: (view: View) => void;
    onHover?: (features: RenderedFeature[]) => void;
    onLoad?: () => void;
    onIdle?: () => void;
    onError?: (error: Error) => void;
    /**
     * The first view from a server, as HTML: the result of `renderFirstView` from `@map-jr/map-jr-gl/server`. The page shows it
     * before a script has run, and the map takes it over. In the browser the prop is not read again.
     */
    firstView?: string;
    className?: string;
    /** The CSS style of the element. The element fills its parent by default. */
    style?: CSSProperties;
    /** Content over the map, and `MapOverlay` elements. */
    children?: ReactNode;
}

const Host = createContext<MapHost | null>(null);
type GivenImage = [string, {image: string; width?: number; height?: number; pixelRatio?: number}];
/** How a `MapImage` gives its image to the `MapJr` that it is in: its name and the image, or null when it has none. */
const Images = createContext<((owner: object, image: GivenImage | null) => void) | null>(null);
/** The map of the `MapJr` that this component is in, when the map has started. */
export const useMap = () => useContext(Host);
/**
 * A part of the state of the map, for a component inside `MapJr` (or with a map given as the second argument):
 * `const zoom = useMapState(s => s.view.zoom)`. The component renders again when that part changes.
 * Return a part of the state as it is, not a new object.
 */
export function useMapState<T>(select: (state: MapState) => T, map?: MapHost | null): T | undefined {
    const host = useContext(Host), from = map === undefined ? host : map;
    return useSyncExternalStore(fn => from ? from.state.subscribe(fn) : () => {}, () => from ? select(from.state.get()) : undefined, () => undefined);
}

/** The map as a component. It fills its parent element, so give the parent a height. A ref gets the map (`MapHost`). */
export const MapJr = forwardRef<MapHost | null, MapJrProps>(function MapJr(props, ref) {
    const {mapStyle, firstView, className, style, children, onHover, onLoad, onIdle, onError, ...rest} = props;
    const el = useRef<HTMLDivElement>(null), made = useRef<MapHost | null>(null), [host, setHost] = useState<MapHost | null>(null);
    // The functions of the last render are called, also from a map that an earlier render made.
    const last = useRef(props);
    last.current = props;
    // The images of the `MapImage` components in this map, by component. They come after the images of the prop: with
    // one name in both, the image of the component is used.
    const owners = useRef(new globalThis.Map<object, GivenImage>()), [, again] = useState(0);
    const give = useCallback((owner: object, image: GivenImage | null) => {
        if (JSON.stringify(owners.current.get(owner) ?? null) === JSON.stringify(image)) return;
        if (image) owners.current.set(owner, image); else owners.current.delete(owner);
        again(n => n + 1);
    }, []);
    const spec: MapSpec = {...rest, images: rest.images || owners.current.size ? {...rest.images, ...Object.fromEntries(owners.current.values())} : undefined, style: mapStyle, onViewChange: view => last.current.onViewChange?.(view), onClick: event => last.current.onClick?.(event),
        // (Without `onError`, the map writes each error to the console.)
        onError: onError && (error => last.current.onError?.(error))};
    for (const k in spec) if ((spec as any)[k] === undefined) delete (spec as any)[k];
    useEffect(() => {
        const map = made.current = createMap(el.current!, spec);
        setHost(map);
        const stops = [
            map.state.subscribe(s => s.loaded, v => { if (v) last.current.onLoad?.(); }),
            map.state.subscribe(s => s.idle, v => { if (v) last.current.onIdle?.(); }),
            map.state.subscribe(s => s.hover, v => last.current.onHover?.(v)),
        ];
        return () => { for (const stop of stops) stop(); made.current = null; map.destroy(); setHost(null); };
    }, []);
    useEffect(() => { made.current?.update(spec); });
    useImperativeHandle(ref, () => host as MapHost, [host]);
    return h('div', {className: 'map-jr-react' + (className ? ' ' + className : ''), style: {position: 'relative', width: '100%', height: '100%', ...style}},
        // (The HTML of the server stays in this element until the map removes it: React does not look at its content.)
        h('div', {ref: el, style: {position: 'absolute', inset: 0}, suppressHydrationWarning: true, dangerouslySetInnerHTML: {__html: firstView ?? ''}}),
        h(Images.Provider, {value: give}, h(Host.Provider, {value: host}, children)));
});

/**
 * An element of the page at a position of the map, for the inside of `MapJr`: a marker with your own content, or a
 * popup (`popup`; with `onClose` it has a button to close it). The content is React content.
 * For many markers, use the `markers` prop of `MapJr`: those are drawn on the canvas.
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
    /** The names of the parameters of the image. The function in `children` gets a value for each one. */
    params?: readonly P[];
    /** The URL of an image, in place of an SVG in `children`. */
    src?: string;
    /** The size in CSS pixels. Without it, an SVG has the size of its `viewBox`, and another image has its own size. */
    width?: number; height?: number;
    /** The number of image pixels for one CSS pixel (2 for an image "@2x"). */
    pixelRatio?: number;
    /** An `<svg>` element, or a function that gets the parameters and returns one. */
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
export type {MapHost, MapPointer, MapSpec, MapState, OverlayOptions, View};
