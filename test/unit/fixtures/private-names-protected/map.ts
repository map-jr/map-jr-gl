export class BaseMap {
    protected sourceLoaded(id: string) { return id; }
    loaded(id: string) { return this.sourceLoaded(id); }
}
