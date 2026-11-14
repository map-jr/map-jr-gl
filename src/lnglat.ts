// LngLat and LngLatBounds, with the methods of the MapLibre classes of the same names.

export type LngLatInput = LngLat | [number, number] | {lng: number; lat: number} | {lon: number; lat: number};
export type LngLatBoundsInput = LngLatBounds | [LngLatInput, LngLatInput] | [number, number, number, number];

export class LngLat {
    constructor(public lng: number, public lat: number) {}
    /** The same position with the longitude between -180 and 180. */
    wrap() { return new LngLat(((this.lng + 180) % 360 + 360) % 360 - 180, this.lat); }
    toArray(): [number, number] { return [this.lng, this.lat]; }
    toString() { return `LngLat(${this.lng}, ${this.lat})`; }
    /** The distance to another position in metres, on a sphere. */
    distanceTo(other: LngLatInput) {
        const o = LngLat.convert(other), rad = Math.PI / 180, lat1 = this.lat * rad, lat2 = o.lat * rad;
        const a = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((o.lng - this.lng) * rad);
        return 6371008.8 * Math.acos(Math.min(a, 1));
    }
    static convert(v: LngLatInput): LngLat {
        if (v instanceof LngLat) return v;
        if (Array.isArray(v)) return new LngLat(v[0], v[1]);
        return new LngLat('lng' in v ? v.lng : v.lon, v.lat);
    }
}

export class LngLatBounds {
    private sw?: LngLat;
    private ne?: LngLat;
    constructor(sw?: LngLatInput | LngLatBoundsInput, ne?: LngLatInput) {
        if (sw === undefined) return;
        // As in MapLibre GL JS, the corners are kept as given: a west edge east of the east edge crosses the antimeridian.
        if (ne !== undefined) { this.setSouthWest(sw as LngLatInput).setNorthEast(ne); return; }
        if (sw instanceof LngLatBounds) { this.extend(sw); return; }
        const b = sw as unknown[];
        if (b.length === 4) this.setSouthWest([b[0], b[1]] as [number, number]).setNorthEast([b[2], b[3]] as [number, number]);
        else this.setSouthWest(b[0] as LngLatInput).setNorthEast(b[1] as LngLatInput);
    }
    setSouthWest(sw: LngLatInput) { this.sw = LngLat.convert(sw); return this; }
    setNorthEast(ne: LngLatInput) { this.ne = LngLat.convert(ne); return this; }
    /** Makes the bounds larger so that they contain a position or other bounds. */
    extend(v: LngLatInput | LngLatBoundsInput): this {
        if (v instanceof LngLatBounds) { if (v.sw && v.ne) { this.extend(v.sw); this.extend(v.ne); } return this; }
        if (Array.isArray(v) && (v.length === 4 || typeof v[0] !== 'number')) {
            const b = v as unknown[];
            if (b.length === 4) { this.extend([b[0], b[1]] as [number, number]); this.extend([b[2], b[3]] as [number, number]); }
            else { this.extend(b[0] as LngLatInput); this.extend(b[1] as LngLatInput); }
            return this;
        }
        const p = LngLat.convert(v as LngLatInput);
        this.sw = this.sw ? new LngLat(Math.min(this.sw.lng, p.lng), Math.min(this.sw.lat, p.lat)) : new LngLat(p.lng, p.lat);
        this.ne = this.ne ? new LngLat(Math.max(this.ne.lng, p.lng), Math.max(this.ne.lat, p.lat)) : new LngLat(p.lng, p.lat);
        return this;
    }
    getSouthWest() { return this.sw!; }
    getNorthEast() { return this.ne!; }
    getNorthWest() { return new LngLat(this.getWest(), this.getNorth()); }
    getSouthEast() { return new LngLat(this.getEast(), this.getSouth()); }
    getWest() { return this.sw!.lng; }
    getSouth() { return this.sw!.lat; }
    getEast() { return this.ne!.lng; }
    getNorth() { return this.ne!.lat; }
    getCenter() { return new LngLat((this.getWest() + this.getEast()) / 2, (this.getSouth() + this.getNorth()) / 2); }
    isEmpty() { return !(this.sw && this.ne); }
    contains(v: LngLatInput) {
        const p = LngLat.convert(v), w = this.getWest(), e = this.getEast();
        // As MapLibre GL JS does, bounds whose west edge is east of the east edge contain the longitudes from east to west.
        return (w > e ? p.lng <= w && p.lng >= e : p.lng >= w && p.lng <= e) && p.lat >= this.getSouth() && p.lat <= this.getNorth();
    }
    toArray(): [[number, number], [number, number]] { return [this.sw!.toArray(), this.ne!.toArray()]; }
    toString() { return `LngLatBounds(${this.sw}, ${this.ne})`; }
    static convert(v: LngLatBoundsInput): LngLatBounds { return v instanceof LngLatBounds ? v : new LngLatBounds(v); }
    // The four sides as plain values, which earlier versions of this library returned from getBounds().
    get west() { return this.getWest(); }
    get south() { return this.getSouth(); }
    get east() { return this.getEast(); }
    get north() { return this.getNorth(); }
}
