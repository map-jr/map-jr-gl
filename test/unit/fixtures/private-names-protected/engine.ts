// The engine has a private member with the name of a protected method of another class (#2049).
export class Engine {
    private sourceLoaded = new Map<string, number>();
    state(id: string) { return this.sourceLoaded.get(id); }
}
