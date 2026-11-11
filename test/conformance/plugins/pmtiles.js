// pmtiles: register its protocol, as its documentation says. (This library also reads pmtiles:// URLs itself.)
import {Protocol} from 'pmtiles';
export async function run({lib, wait}) {
    const protocol = new Protocol();
    lib.addProtocol('pmtiles', protocol.tile);
    await wait(100);
    lib.removeProtocol('pmtiles');
    return {ok: true, detail: 'addProtocol and removeProtocol accepted the protocol'};
}
