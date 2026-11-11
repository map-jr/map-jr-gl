// A small stand-in for the Node.js `events` module, which some plugins expect their bundler to supply.
export class EventEmitter {
    constructor() { this.listeners = {}; }
    on(type, fn) { (this.listeners[type] ??= []).push(fn); return this; }
    off(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); return this; }
    removeListener(type, fn) { return this.off(type, fn); }
    emit(type, ...args) { for (const fn of this.listeners[type] ?? []) fn(...args); return true; }
    listenerCount(type) { return (this.listeners[type] ?? []).length; }
}
export default EventEmitter;
