/** The event methods of MapLibre's `Marker`, `Popup` and `GeolocateControl`: listeners on the object itself, not on the map. */
type Listener = (e: any) => void;
export class Evented {
    private listeners: Record<string, Listener[]> = {};
    on(type: string, fn: Listener) { (this.listeners[type] ??= []).push(fn); return this; }
    off(type: string, fn: Listener) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); return this; }
    once(type: string, fn: Listener) { const w: Listener = e => { this.off(type, w); fn(e); }; return this.on(type, w); }
    fire(type: string, data?: Record<string, unknown>) { for (const fn of [...this.listeners[type] ?? []]) fn({type, target: this, ...data}); return this; }
}
