// Draws the contour lines of the site, public/contours.svg. Run it with `pnpm contours` and commit the result.
//
// The lines are the contours of a height field that is a sum of a few waves. Each wave has a whole number of periods
// across the tile, so the left edge of the tile continues the right edge, and the top continues the bottom. The CSS
// uses the file as a mask and repeats it (see `.contours` in app/assets/css/main.css), so the lines take the color
// of the theme. Every fifth line is an index contour and is thicker, as on a topographic map.
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const width = 1200, height = 800, step = 20, levels = 14, seed = 1116;

// A small generator of random numbers with a seed (mulberry32), so that each run draws the same lines.
let state = seed;
function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const waves = [];
for (let kx = -3; kx <= 3; kx++) {
    for (let ky = 0; ky <= 3; ky++) {
        if (ky === 0 && kx <= 0) continue;
        const k = Math.hypot(kx, ky * 1.5);
        waves.push({kx, ky, amplitude: (0.4 + random()) / k ** 1.9, phase: random() * 2 * Math.PI});
    }
}
const field = (x, y) => waves.reduce((sum, wave) => sum + wave.amplitude * Math.cos(2 * Math.PI * (wave.kx * x / width + wave.ky * y / height) + wave.phase), 0);

const columns = width / step, rows = height / step;
const values = [];
let low = Infinity, high = -Infinity;
for (let row = 0; row <= rows; row++) {
    values.push([]);
    for (let column = 0; column <= columns; column++) {
        const value = field(column * step, row * step);
        values[row].push(value);
        low = Math.min(low, value);
        high = Math.max(high, value);
    }
}

// Marching squares: the segments of one contour, then the segments joined into lines.
function contour(level) {
    const segments = [];
    const cross = (x1, y1, v1, x2, y2, v2) => {
        const t = (level - v1) / (v2 - v1);
        return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    };
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const x = column * step, y = row * step;
            const corners = [[x, y, values[row][column]], [x + step, y, values[row][column + 1]], [x + step, y + step, values[row + 1][column + 1]], [x, y + step, values[row + 1][column]]];
            const points = [];
            for (let side = 0; side < 4; side++) {
                const a = corners[side], b = corners[(side + 1) % 4];
                if ((a[2] < level) !== (b[2] < level)) points.push(cross(a[0], a[1], a[2], b[0], b[1], b[2]));
            }
            if (points.length === 2) segments.push(points);
            else if (points.length === 4) {
                // A saddle: the height of the middle of the cell says which corners belong together.
                const middle = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
                if ((middle < level) === (corners[0][2] < level)) segments.push([points[0], points[1]], [points[2], points[3]]);
                else segments.push([points[3], points[0]], [points[1], points[2]]);
            }
        }
    }
    const key = point => Math.round(point[0] * 100) + ',' + Math.round(point[1] * 100);
    const ends = new Map();
    for (const segment of segments) for (const point of segment) ends.set(key(point), [...(ends.get(key(point)) ?? []), segment]);
    const used = new Set(), lines = [];
    const follow = (line, forward) => {
        for (;;) {
            const tip = forward ? line[line.length - 1] : line[0];
            const next = (ends.get(key(tip)) ?? []).find(segment => !used.has(segment));
            if (!next) return;
            used.add(next);
            const other = key(next[0]) === key(tip) ? next[1] : next[0];
            if (forward) line.push(other); else line.unshift(other);
        }
    };
    for (const segment of segments) {
        if (used.has(segment)) continue;
        used.add(segment);
        const line = [...segment];
        follow(line, true);
        follow(line, false);
        if (line.length > 3) lines.push(line);
    }
    return lines;
}

// A smooth path through the middles of the segments, with each point of the line as the control point of a curve.
function path(line) {
    const closed = line.length > 2 && Math.hypot(line[0][0] - line[line.length - 1][0], line[0][1] - line[line.length - 1][1]) < 0.01;
    const n = value => String(Math.round(value));
    const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const points = closed ? line.slice(0, -1) : line;
    let d;
    if (closed) {
        const start = middle(points[points.length - 1], points[0]);
        d = `M${n(start[0])} ${n(start[1])}`;
        for (let i = 0; i < points.length; i++) {
            const end = middle(points[i], points[(i + 1) % points.length]);
            d += `Q${n(points[i][0])} ${n(points[i][1])} ${n(end[0])} ${n(end[1])}`;
        }
        return d + 'Z';
    }
    d = `M${n(points[0][0])} ${n(points[0][1])}`;
    for (let i = 1; i < points.length - 1; i++) {
        const end = i === points.length - 2 ? points[i + 1] : middle(points[i], points[i + 1]);
        d += `Q${n(points[i][0])} ${n(points[i][1])} ${n(end[0])} ${n(end[1])}`;
    }
    return d;
}

const thin = [], index = [];
for (let i = 1; i <= levels; i++) {
    const level = low + (high - low) * i / (levels + 1);
    (i % 5 === 0 ? index : thin).push(...contour(level).map(path));
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none" stroke="#000">`
    + `<path stroke-width="1" d="${thin.join('')}"/><path stroke-width="2" d="${index.join('')}"/></svg>\n`;
const file = resolve(import.meta.dirname, '../public/contours.svg');
writeFileSync(file, svg);
console.log(`${file}: ${thin.length + index.length} lines, ${(svg.length / 1024).toFixed(1)} KB`);
