// The start timeline of the benchmark page (#371).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the demo, without types)
import {startSteps, timelineLine} from '../../demo/start-timeline.mjs';

const STYLE = 'https://tiles.example.com/styles/liberty';
const e = (name: string, startTime: number, responseEnd: number) => ({name, startTime, responseEnd});

test('start timeline: steps from resource timings and events, in ms after the map was made', () => {
    const entries = [
        e(STYLE, 900, 960),
        e('https://tiles.example.com/old/14/1/1.pbf', 100, 200), // answered before this map was made: left out
        e('https://x.org/ml/maplibre-gl-worker.mjs', 1001, 1030),
        e('https://tiles.example.com/planet/14/4823/6160.pbf', 1095, 1180),
        e('https://tiles.example.com/planet/14/4824/6160.pbf', 1090, 1200),
        e('https://tiles.example.com/fonts/Noto Sans Regular/0-255.pbf', 1150, 1210),
        e('https://tiles.example.com/sprites/ofm_f384/ofm@2x.png', 1050, 1120),
    ];
    const s = startSteps(entries, 1000, {frame: 1100, load: 1250, idle: 1343}, STYLE);
    assert.deepEqual(s, {style: -40, tileReq: 90, tileAns: 180, tileLast: 200, tiles: 2, sprite: 120, glyphs: 210, glyphLast: 210, worker: 30, frame: 100, lastFrame: undefined, load: 250, idle: 343});
    assert.equal(timelineLine('MapLibre GL JS', [s]),
        'MapLibre GL JS: style -40, first tile req 90 / ans 180, last tile ans 200 (2 tiles), sprite 120, glyphs 210 / last 210, worker file 30, first frame 100 / last –, load 250, idle 343');
});

test('start timeline: medians of several starts, and a dash for a step that did not happen', () => {
    const runs = [{idle: 300, frame: 90}, {idle: 500, frame: 110}, {idle: 400.4}];
    assert.equal(timelineLine('This library, worker', runs),
        'This library, worker (median of 3): style –, first tile req – / ans –, last tile ans – (– tiles), sprite –, glyphs – / last –, worker file –, first frame 110 / last –, load –, idle 400');
});

test('start timeline: the tile events, when given, come before the resource timings', () => {
    const s = startSteps([{name: 'https://t.example.com/14/1/1.pbf', startTime: 1010, responseEnd: 1020}], 1000, {tileReq: 1050, tileAns: 1150});
    assert.equal(s.tileReq, 50);
    assert.equal(s.tileAns, 150);
    assert.equal(s.style, undefined);
});

test('start timeline: the last answers and the last frame before idle', () => {
    const entries = [
        e('https://t.example.com/fonts/A/0-255.pbf', 1010, 1100),
        e('https://t.example.com/fonts/A/256-511.pbf', 1010, 1300),
        e('https://t.example.com/fonts/A/512-767.pbf', 1400, 1500), // answered after idle: left out
    ];
    const s = startSteps(entries, 1000, {tileAns: 1150, tileLast: 1380, tiles: 12, frame: 1100, lastFrame: 1420, idle: 1430});
    assert.equal(s.glyphLast, 300);
    assert.equal(s.tileLast, 380);
    assert.equal(s.tiles, 12);
    assert.equal(s.lastFrame, 420);
});
