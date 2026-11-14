import type {Map} from './map.ts';

/**
 * The option `cooperativeGestures` of the compat entry, as in MapLibre GL JS 6.17: the wheel zooms only with Ctrl
 * (⌘ on a Mac), one finger scrolls the page and two fingers move the map. A blocked gesture fires
 * `cooperativegestureprevented` and shows a hint over the map. Returns a function that stops it.
 * (The compat entry loads this file only when the option is on.)
 */
export function cooperate(map: Map) {
    const canvas = map.getCanvas(), mac = navigator.userAgent.includes('Mac'), touchAction = canvas.style.touchAction;
    const hint = map.getContainer().appendChild(document.createElement('div')), style = hint.style;
    hint.className = 'map-jr-cooperative-gesture-screen maplibregl-cooperative-gesture-screen';
    // (The look of the stylesheet of MapLibre GL JS, which this library does not need.)
    style.cssText = 'position:absolute;inset:0;display:flex;justify-content:center;align-items:center;background:rgb(0 0 0/.4);color:#fff;padding:1rem;font-size:1.4em;line-height:1.2;text-align:center;opacity:0;pointer-events:none;transition:opacity 1s ease 1s;z-index:99999';
    // (Screen readers cannot use the gestures.)
    hint.setAttribute('aria-hidden', 'true');
    let timer: ReturnType<typeof setTimeout> | undefined;
    // One finger scrolls the page. The browser still gives two fingers to the map.
    canvas.style.touchAction = 'pan-x pan-y';
    map.gate = (gestureType, e) => {
        if (gestureType === 'wheel_zoom' && (e as WheelEvent)[mac ? 'metaKey' : 'ctrlKey']) return false;
        map.fire('cooperativegestureprevented', {gestureType, originalEvent: e});
        // The message for touch screens is chosen by the media query of MapLibre GL JS.
        hint.textContent = matchMedia('(hover: none), (pointer: coarse)').matches ? 'Use two fingers to move the map' : `Use ${mac ? '⌘' : 'Ctrl'} + scroll to zoom the map`;
        style.opacity = '1';
        style.transition = 'opacity .05s';
        clearTimeout(timer);
        timer = setTimeout(() => { style.opacity = '0'; style.transition = 'opacity 1s ease 1s'; }, 100);
        return true;
    };
    return () => { clearTimeout(timer); hint.remove(); map.gate = undefined; canvas.style.touchAction = touchAction; };
}
