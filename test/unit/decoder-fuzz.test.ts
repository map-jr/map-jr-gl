// Fuzz test for the decoders of untrusted bytes: Pbf, decodeVectorTile and readGlyphs (issue #24).
// Each input must decode or throw an Error, in bounded time, with output bounded by the size of the input.
// The seeds are fixed, so a failure is repeatable, and the message names the case.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Pbf, decodeVectorTile} from '../../src/mvt.ts';
import {readGlyphs} from '../../src/text.ts';

const TILE = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));

function rng(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
}

// A small protobuf writer for the hostile cases.
const varint = (n: number) => { const out: number[] = []; while (n >= 128) { out.push((n % 128) | 128); n = Math.floor(n / 128); } out.push(n); return out; };
const field = (num: number, body: number[]) => [...varint(num * 8 + 2), ...varint(body.length), ...body];
const lenOnly = (num: number, len: number) => [...varint(num * 8 + 2), ...varint(len)];
const nest = (num: number, depth: number, inner: number[]) => { let b = inner; for (let i = 0; i < depth; i++) b = field(num, b); return b; };

function hostile(): [string, Uint8Array][] {
    const huge = 2 ** 50;
    const feature = (body: number[]) => field(3, [...field(1, [0x61]), ...field(2, body)]);
    const list: [string, number[]][] = [
        ['empty', []],
        ['varint of 20 continuation bytes', Array(20).fill(0xff)],
        ['layer with a huge length', lenOnly(3, huge)],
        ['layer name with a huge length', field(3, lenOnly(1, huge))],
        ['feature geometry with a huge length', feature([0x18, 3, ...lenOnly(4, huge)])],
        ['feature tags with a huge length', feature(lenOnly(2, huge))],
        ['geometry: ClosePath with a huge count', feature([0x18, 3, ...field(4, varint((2 ** 28 - 1) * 8 + 7))])],
        ['geometry: LineTo with a huge count', feature([0x18, 2, ...field(4, [9, 2, 2, ...varint((2 ** 28 - 1) * 8 + 2)])])],
        ['geometry: unknown command', feature([0x18, 2, ...field(4, [5])])],
        ['value: float past the end', field(3, [...field(1, [0x61]), ...field(4, [0x15, 1])])],
        ['unsupported wire type', [0x0b, 0x0c]],
        ['deep nesting of layers', nest(3, 5000, [1, 2, 3])],
        ['glyph: stack with a huge length', lenOnly(1, huge)],
        ['glyph: bitmap with a huge length', field(1, field(3, lenOnly(2, huge)))],
        ['glyph: deep nesting', nest(1, 5000, [])],
    ];
    return list.map(([name, b]) => [name, Uint8Array.from(b)]);
}

function cases(): [string, Uint8Array][] {
    const r = rng(24), out = hostile();
    for (let i = 0; i < 200; i++) {
        const n = Math.floor(r() * 512), b = new Uint8Array(n);
        for (let j = 0; j < n; j++) b[j] = r() * 256;
        out.push([`random #${i} (${n} bytes)`, b]);
    }
    for (let i = 0; i < 60; i++) {
        const n = Math.floor(r() * TILE.length);
        out.push([`tile truncated to ${n} bytes`, TILE.slice(0, n)]);
    }
    for (let i = 0; i < 60; i++) {
        const b = TILE.slice(), flips = 1 + Math.floor(r() * 8);
        for (let j = 0; j < flips; j++) b[Math.floor(r() * b.length)] = r() * 256;
        out.push([`tile mutated #${i} (${flips} bytes)`, b]);
    }
    return out;
}

/** Runs `fn`, which may throw an Error but nothing else, and must finish within the limit. */
function bounded(name: string, fn: () => void, ms = 2000) {
    const t0 = performance.now();
    try { fn(); } catch (e) { assert.ok(e instanceof Error, `${name}: threw a non-Error ${String(e)}`); }
    const dt = performance.now() - t0;
    assert.ok(dt < ms, `${name}: took ${dt.toFixed(0)} ms`);
}

test('fuzz: decodeVectorTile and feature access stay bounded on hostile bytes', () => {
    for (const [name, bytes] of cases()) {
        bounded(name, () => {
            for (const layer of Object.values(decodeVectorTile(bytes))) {
                for (const f of layer.features) {
                    bounded(name + ' (properties)', () => void f.properties);
                    const coords: number[] = [], ends: number[] = [];
                    bounded(name + ' (geometry)', () => f.geometry(8192, coords, ends));
                    assert.ok(coords.length <= 2 * bytes.length + 2, `${name}: ${coords.length} coordinates from ${bytes.length} bytes`);
                    assert.ok(ends.length <= bytes.length + 1, `${name}: ${ends.length} rings from ${bytes.length} bytes`);
                }
            }
        });
    }
});

test('fuzz: readGlyphs stays bounded on hostile bytes', () => {
    for (const [name, bytes] of cases()) {
        bounded(name, () => {
            const glyphs = readGlyphs(bytes);
            assert.ok(glyphs.size <= bytes.length, `${name}: ${glyphs.size} glyphs`);
            for (const g of glyphs.values()) if (g.bitmap) assert.ok(g.bitmap.length <= bytes.length, `${name}: bitmap of ${g.bitmap.length}`);
        });
    }
});

test('fuzz: Pbf reads past the end without hanging', () => {
    const r = rng(40);
    for (let i = 0; i < 500; i++) {
        const b = new Uint8Array(Math.floor(r() * 64)).map(() => r() * 256), p = new Pbf(b);
        bounded(`pbf #${i}`, () => {
            for (let k = 0; k < 1000 && p.pos < p.end; k++) {
                const x = r();
                if (x < 0.4) p.varint(); else if (x < 0.7) p.sub(); else p.skip(Math.floor(r() * 6));
            }
        });
    }
});
