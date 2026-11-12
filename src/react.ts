/**
 * The adapter for React 18 and 19: `import {MapJr, MapOverlay, useMapState} from 'map-jr-gl/react'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description after
 * each render, and the map finds what is different. Props that are made again with the same content do no work.
 * Marker data is compared by identity: keep the array (`useMemo`, state) until the markers change.
 */
import {createContext, createElement as h, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
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
     * The first view from a server, as HTML: the result of `renderFirstView` from `map-jr-gl/server`. The page shows it
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
    const spec: MapSpec = {...rest, style: mapStyle, onViewChange: view => last.current.onViewChange?.(view), onClick: event => last.current.onClick?.(event),
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
        h(Host.Provider, {value: host}, children));
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
export type {MapHost, MapPointer, MapSpec, MapState, OverlayOptions, View};
