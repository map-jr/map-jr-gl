// The server entry exports only its documented functions; renderSVG and cleanCredits are internal (#1206).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../../src/server.ts';

test('the server entry exports only its documented functions (#1206)', () => {
    assert.deepEqual(Object.keys(server).sort(), ['decodePNG', 'decodeWebPLossless', 'renderElement', 'renderFirstView', 'renderToImage', 'renderToSVG']);
});
