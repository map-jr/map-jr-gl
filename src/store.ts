/**
 * A value that code can read and watch. This is the contract that the frameworks have in common: React reads it with
 * `useSyncExternalStore`, Vue with a `shallowRef`, Svelte uses it as a store, Solid with `from`.
 * The value is never changed in place: each change makes a new object, and a part that did not change keeps its
 * identity.
 */
export interface Readable<T> {
    /** Returns the current value. */
    get(): T;
    /** Calls `fn` after each change. Returns a function that stops it. */
    subscribe(fn: (value: T) => void): () => void;
    /** Calls `fn` when the part that `select` returns has changed (compared with `Object.is`). */
    subscribe<S>(select: (value: T) => S, fn: (part: S, value: T) => void): () => void;
}
/** A store that code can also change, as `createStore` returns it. */
export interface Store<T> extends Readable<T> {
    /** Merges `part` into the value as a new object, and calls the subscribers when a field changed (compared with `Object.is`). */
    set(part: Partial<T>): void;
}

/**
 * Creates a store of the kind that `state` of a map is, with `get`, `subscribe` and `set`.
 * @param value The first value.
 * @returns The store.
 */
export function createStore<T extends object>(value: T): Store<T> {
    const listeners = new Set<(value: T) => void>();
    return {
        get: () => value,
        set(part) {
            let changed = false;
            for (const k in part) if (!Object.is(part[k], value[k])) changed = true;
            if (!changed) return;
            value = {...value, ...part};
            for (const fn of [...listeners]) fn(value);
        },
        subscribe(a: (value: T) => unknown, b?: (part: unknown, value: T) => void) {
            let last = b ? a(value) : undefined;
            const fn = b ? (v: T) => { const next = a(v); if (!Object.is(next, last)) b(last = next, v); } : a as (value: T) => void;
            listeners.add(fn);
            return () => { listeners.delete(fn); };
        },
    };
}
