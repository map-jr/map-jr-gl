/**
 * A value that code can read and watch. This is the contract that the frameworks have in common: React reads it with
 * `useSyncExternalStore`, Vue with a `shallowRef`, Svelte uses it as a store, Solid with `from`.
 * The value is never changed in place: each change makes a new object, and a part that did not change keeps its
 * identity.
 */
export interface Readable<T> {
    get(): T;
    /** Calls `fn` after each change. Returns a function that stops it. */
    subscribe(fn: (value: T) => void): () => void;
    /** Calls `fn` when the part that `select` returns has changed (compared with `Object.is`). */
    subscribe<S>(select: (value: T) => S, fn: (part: S, value: T) => void): () => void;
}
export interface Store<T> extends Readable<T> { set(part: Partial<T>): void }

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
