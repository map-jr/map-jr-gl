// The application that `pnpm test:package` builds with Vite against the packed tarball (see scripts/check-package.mjs).
// It imports both entries by the name of the package, as an application does.
import {createMap, supported} from '@map-jr/map-jr-gl';
import {navigation} from '@map-jr/map-jr-gl/controls';
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
if (supported()) {
    createMap(document.getElementById('main'), {style, initialView: {center: [-74.0065, 40.7085], zoom: 13.6}, controls: [navigation()]});
    new Map({container: 'compat', style, center: [-74.0065, 40.7085], zoom: 13.6});
}
