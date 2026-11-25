import {BaseMap} from './map';

export class CompatMap extends BaseMap {
    protected override sourceLoaded(id: string) { return 'compat ' + id; }
}
