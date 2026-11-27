// With 3D terrain, the far plane (`farZ`) is worked out for the lowest ground of the elevation tile under the center, as
// MapLibre GL JS's `_calculateNearFarZ` does with `minElevationForCurrentTile` (#2212).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';

/** `_calculateNearFarZ` of MapLibre GL JS 6.x (maplibre-gl-dev.mjs), with no roll and no padding. */
function maplibreFarZ(tr: Transform, minTile: number): number {
    const pitch = tr.pitch * Math.PI / 180, limited = Math.min(tr.pitch, 89.25) * Math.PI / 180, d = tr.cameraDistance, ppm = tr.pixelsPerMetre;
    const seaLevel = Math.max(d / 2, d + tr.elevation * ppm / Math.cos(limited));
    const altitude = Math.cos(pitch) * d / ppm + tr.elevation;
    const min = Math.min(tr.elevation, minTile, altitude - 100);
    const plane = min < 0 ? seaLevel - min * ppm / Math.cos(limited) : seaLevel;
    const ground = Math.PI / 2 + pitch, fov = tr.fov / 2;
    const clamp = (v: number) => Math.min(Math.max(v, 0.01), Math.PI - 0.01);
    const top = Math.sin(fov) * plane / Math.sin(clamp(Math.PI - ground - fov));
    const h = tr.horizon(), ha = Math.atan(h / d), toHorizon = ha > 0.75 * Math.PI / 180 ? ha : 0.75 * Math.PI / 180;
    const topHorizon = Math.sin(toHorizon) * plane / Math.sin(clamp(Math.PI - ground - toHorizon));
    return (Math.cos(Math.PI / 2 - limited) * Math.min(top, topHorizon) + plane) * 1.01;
}

test('farZ() takes the lowest ground of the elevation tile under the center', () => {
    for (const pitch of [40, 70, 85]) {
        const tr = new Transform();
        tr.width = 800; tr.height = 600; tr.zoom = 12; tr.pitch = pitch; tr.lat = 46; tr.lng = 8;
        tr.heightAt = () => 200; tr.groundRange = [-1800, 200]; tr.elevation = 200; tr.lowUnder = -1800;
        const ours = tr.farZ(), theirs = maplibreFarZ(tr, -1800);
        assert.ok(Math.abs(ours - theirs) < 1e-6 * theirs, `pitch ${pitch}: farZ() ${ours.toFixed(1)}, MapLibre GL JS ${theirs.toFixed(1)}`);
    }
});
