// Builds website/public/data/natural-earth.pmtiles, the PMTiles file of the PMTiles example (examples/pmtiles.*).
// The data is Natural Earth 5.1.2 (public domain): the countries and the states and provinces at the scale 1:50m.
// The tiles are made with @maplibre/geojson-vt and @maplibre/vt-pbf, which the installed MapLibre GL JS depends on,
// and this script writes the PMTiles version 3 archive itself (one root directory, gzip everywhere).
//   node scripts/natural-earth-pmtiles.mjs
import {createRequire} from 'node:module';
import {realpathSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';

const require = createRequire(realpathSync('node_modules/maplibre-gl/package.json'));
// The CommonJS file of geojson-vt is a browser bundle that exports nothing to Node, so this takes the ES module next to it.
const {GeoJSONVT} = await import(pathToFileURL(require.resolve('@maplibre/geojson-vt').replace(/\.js$/, '.mjs')).href);
const {fromGeojsonVt} = require(require.resolve('@maplibre/vt-pbf'));

const MAXZOOM = 6;
const base = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
// The properties that the file keeps, with their new names.
const layers = {
    countries: {file: 'ne_50m_admin_0_countries.geojson', keep: {NAME: 'name', ISO_A3: 'iso_a3', CONTINENT: 'continent'}},
    states: {file: 'ne_50m_admin_1_states_provinces.geojson', keep: {name: 'name', admin: 'country', iso_3166_2: 'iso_3166_2'}},
};

const indexes = {};
for (const [id, {file, keep}] of Object.entries(layers)) {
    const response = await fetch(base + file);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const data = await response.json();
    for (const f of data.features) {
        const p = {};
        for (const [from, to] of Object.entries(keep)) if (f.properties[from] != null) p[to] = f.properties[from];
        f.properties = p;
    }
    indexes[id] = new GeoJSONVT(data, {maxZoom: MAXZOOM, indexMaxZoom: MAXZOOM, indexMaxPoints: 0, tolerance: 3, extent: 4096, buffer: 64});
}

// The tile ID of the PMTiles specification: the tiles of lower zooms first, then the Hilbert curve.
function tileId(z, x, y) {
    let acc = 0;
    for (let i = 0; i < z; i++) acc += 4 ** i;
    let d = 0;
    for (let s = 2 ** (z - 1); s >= 1; s /= 2) {
        const rx = (x & s) > 0 ? 1 : 0;
        const ry = (y & s) > 0 ? 1 : 0;
        d += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
            [x, y] = [y, x];
        }
    }
    return acc + d;
}

const tiles = [];
for (let z = 0; z <= MAXZOOM; z++) {
    for (let x = 0; x < 2 ** z; x++) {
        for (let y = 0; y < 2 ** z; y++) {
            const found = {};
            for (const [id, index] of Object.entries(indexes)) {
                const t = index.getTile(z, x, y);
                if (t && t.features.length) found[id] = t;
            }
            if (Object.keys(found).length) tiles.push({id: tileId(z, x, y), data: gzipSync(fromGeojsonVt(found, {version: 2}), {level: 9})});
        }
    }
}
tiles.sort((a, b) => a.id - b.id);

function varint(out, n) {
    while (n >= 0x80) { out.push((n % 0x80) | 0x80); n = Math.floor(n / 0x80); }
    out.push(n);
}
const dir = [];
varint(dir, tiles.length);
let last = 0;
for (const t of tiles) { varint(dir, t.id - last); last = t.id; }
for (const t of tiles) varint(dir, 1);
for (const t of tiles) varint(dir, t.data.length);
let size = 0;
// A stored offset is the offset in the tile data plus 1 (0 would mean "right after the previous tile").
for (const t of tiles) { varint(dir, size + 1); size += t.data.length; }
const root = gzipSync(Uint8Array.from(dir), {level: 9});
const metadata = gzipSync(JSON.stringify({
    name: 'Natural Earth countries and states',
    attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
    description: 'Natural Earth 5.1.2, admin 0 countries and admin 1 states and provinces at 1:50m. Public domain.',
    vector_layers: Object.entries(layers).map(([id, {keep}]) => ({
        id, minzoom: 0, maxzoom: MAXZOOM, fields: Object.fromEntries(Object.values(keep).map(k => [k, 'String'])),
    })),
}), {level: 9});

const header = Buffer.alloc(127);
header.write('PMTiles', 0);
header[7] = 3;
const u64 = (at, v) => header.writeBigUInt64LE(BigInt(v), at);
const rootOffset = 127, metaOffset = rootOffset + root.length, dataOffset = metaOffset + metadata.length;
u64(8, rootOffset); u64(16, root.length); u64(24, metaOffset); u64(32, metadata.length);
u64(40, dataOffset); u64(48, 0); u64(56, dataOffset); u64(64, size);
u64(72, tiles.length); u64(80, tiles.length); u64(88, tiles.length);
header[96] = 1; // clustered
header[97] = 2; // internal compression: gzip
header[98] = 2; // tile compression: gzip
header[99] = 1; // tile type: MVT
header[100] = 0;
header[101] = MAXZOOM;
header.writeInt32LE(-180e7, 102); header.writeInt32LE(-85e7, 106); header.writeInt32LE(180e7, 110); header.writeInt32LE(85e7, 114);
header[118] = 2; header.writeInt32LE(0, 119); header.writeInt32LE(20e7, 123);

const out = 'website/public/data/natural-earth.pmtiles';
writeFileSync(out, Buffer.concat([header, root, metadata, ...tiles.map(t => t.data)]));
console.log(`${out}: ${tiles.length} tiles, zoom 0 to ${MAXZOOM}, ${dataOffset + size} bytes`);
