/**
 * The error that a map reports when it cannot start, usually because the browser has no WebGL2. MapLibre GL JS exports
 * a class of this name with the same constructor, and `@map-jr/map-jr-gl/maplibre-compat` exports this one, so `new`
 * and `instanceof` work. (The library itself passes its message in place of the attributes.)
 */
export class GPUInitializationError extends Error {
    readonly requestedAttributes: WebGLContextAttributes;
    readonly statusMessage: string | null;
    constructor(requestedAttributes: WebGLContextAttributes | string = {}, creationEvent?: {statusMessage?: string} | null, options?: ErrorOptions) {
        const own = typeof requestedAttributes == 'string', status = creationEvent?.statusMessage || null;
        super(own ? requestedAttributes : '[map-jr-gl] The map cannot start: WebGL2 is not available' + (status ? ` (${status}).` : '.'), options);
        this.name = 'GPUInitializationError';
        this.requestedAttributes = own ? {} : requestedAttributes;
        this.statusMessage = status;
    }
}
