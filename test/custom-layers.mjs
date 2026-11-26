// Custom layers of the compat entry (#45): test/interact.mjs runs these checks, and a script can run them in a browser
// with a GPU (Chromium with a window). `page` is a page of the demo server.

/** Runs the page part and reports each check with `check(name, ok, detail)`. */
export async function checkCustomLayers(page, check, label = '[main]') {
    const r = await page.evaluate(run);
    // (The values of MercatorCoordinate are those of MapLibre GL JS 6.17 for the same calls.)
    const near = (a, b, d = 1e-9) => Math.abs(a - b) <= d * Math.max(1, Math.abs(b));
    check(`${label} maplibre-compat: a custom layer between two style layers draws in its place, with the matrix of MapLibre GL JS (flat, and with bearing and pitch)`,
        r.flat.inside === 'red' && r.flat.covered === 'blue' && r.flat.outside === 'white' && r.flat.edgeIn === 'red' && r.flat.edgeOut === 'white' && r.flat.fillOnly === 'blue'
        && r.tilted.inside.every(c => c === 'red') && r.tilted.outside.every(c => c === 'white') && r.tilted.covered === 'blue' && r.matrix < 0.05 && r.close < 0.05, JSON.stringify({flat: r.flat, tilted: r.tilted, matrix: r.matrix, close: r.close}));
    check(`${label} maplibre-compat: the custom layer is in the order of the style, getStyle() leaves it out, and getLayer() gives its implementation`,
        r.order === 'bg,red,top' && r.style === 'bg,top' && r.implementation, JSON.stringify({order: r.order, style: r.style, implementation: r.implementation}));
    check(`${label} maplibre-compat: onAdd runs once with the context, prerender comes before render, triggerRepaint draws again, and the state of the user does not reach the map`,
        r.calls.onAdd === 1 && r.sameGl && r.calls.firstTwo === 'prerender,render' && r.repainted && r.args.fov > 0.64 && r.args.fov < 0.65 && r.args.nearZ > 0 && r.args.farZ > r.args.nearZ
        && r.args.variant === 'mercator' && r.args.prelude && r.args.f64 && r.args.tile, JSON.stringify({calls: r.calls, sameGl: r.sameGl, repainted: r.repainted, args: r.args}));
    check(`${label} maplibre-compat: after a lost WebGL context the custom layer keeps its place, gets onAdd with the new context, and draws again`,
        r.lost.onAdd === 2 && r.lost.onRemove === 0 && r.lost.newGl && r.lost.implementation && r.lost.order === 'bg,red,top' && r.lost.colours === 'red,blue', JSON.stringify(r.lost));
    check(`${label} maplibre-compat: setStyle keeps a custom layer in its place with diff (the default) and drops it with diff: false, without onRemove, as MapLibre GL JS`,
        r.diff.onRemove === 0 && r.diff.order === 'bg,red,top' && r.diff.colours === 'red,blue' && r.noDiff.onRemove === 0 && r.noDiff.order === 'bg,top', JSON.stringify({diff: r.diff, noDiff: r.noDiff}));
    check(`${label} maplibre-compat: removeLayer() calls onRemove and the layer is gone from the picture, and remove() calls onRemove of the layers that are left`,
        r.removed.calls === 1 && r.removed.gl && r.removed.after === 'white' && r.removed.order === 'bg,top' && r.removedByMap === 1, JSON.stringify({removed: r.removed, removedByMap: r.removedByMap}));
    check(`${label} maplibre-compat: with the worker renderer (asked for, and the default), the first custom layer moves the map to the main thread; onAdd runs once with its context, the layer draws, and the camera, image, feature state, sky, marker and listeners stay (#1730), and isStyleLoaded() stays true (#1992)`,
        r.worker.length === 2 && r.worker.every(w => w.after === 'main' && !w.errors.length && !w.events.length && w.order === 'bg,red,top' && w.adds === 1 && w.sameGl && w.inside === 'red' && w.covered === 'blue'
            && w.camera === '2,1,10' && w.image && w.state && w.sky && w.marker && w.moves > 0 && w.notLoaded === 0), JSON.stringify(r.worker));
    check(`${label} maplibre-compat: a context lost before the first frame after the move to the main thread for a custom layer restarts the map once more, and it draws (#1993)`,
        !r.retry.errors.length && r.retry.events === 'webglcontextlost,webglcontextrestored' && r.retry.renderer === 'main' && r.retry.renders > 0, JSON.stringify(r.retry));
    check(`${label} maplibre-compat: a query of rendered features that the worker engine has not answered when a custom layer moves the map to the main thread gets the features from the new engine (#1998)`,
        !r.pendingQuery.error && r.pendingQuery.ids === 'top' && r.pendingQuery.renderer === 'main' && !r.pendingQuery.errors.length, JSON.stringify(r.pendingQuery));
    const m = r.mercator;
    check(`${label} maplibre-compat: MercatorCoordinate gives the values of MapLibre GL JS`,
        near(m.origin[0], 0.5) && near(m.origin[1], 0.5) && m.origin[2] === 0 && near(m.ny[0], 0.29444444444444445) && near(m.ny[1], 0.3760277015186852) && near(m.ny[2], 3.295078460614361e-6)
        && near(m.altitude, 100) && near(m.back[0], -74) && near(m.back[1], 40.7) && near(m.meter, 3.295078460614361e-8), JSON.stringify(m));
}

/** In the page. A white background, the custom layer with a red square, and a blue fill over the east part of the square. */
async function run() {
    const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const square = [[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]];
    const style = {version: 8, sources: {g: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[5, -60], [60, -60], [60, 60], [5, 60], [5, -60]]]}}}},
        layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'top', type: 'fill', source: 'g', paint: {'fill-color': '#00f', 'fill-antialias': false}}]};
    const make = renderer => {
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:300px;height:200px'}));
        return new mod.Map({container: el, ...(renderer && {renderer}), center: [0, 0], zoom: 1, attributionControl: false, fadeDuration: 0, style});
    };
    const pad = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d', {willReadFrequently: true});
    const name = ([r, g, b]) => r > 200 && g < 60 && b < 60 ? 'red' : r < 60 && g < 60 && b > 200 ? 'blue' : r > 200 && g > 200 && b > 200 ? 'white' : `${r},${g},${b}`;
    // The colour at a position in the next `idle` event (the drawing buffer can be cleared after a frame).
    const colours = (m, where) => new Promise(resolve => {
        m.once('idle', () => {
            const c = m.getCanvas(), k = c.width / m.getContainer().clientWidth;
            resolve(where.map(p => { const q = Array.isArray(p) ? m.project(p) : p; pad.drawImage(c, Math.floor(q.x * k), Math.floor(q.y * k), 1, 1, 0, 0, 1, 1); return name(pad.getImageData(0, 0, 1, 1).data); }));
        });
        m.triggerRepaint();
        setTimeout(() => resolve(['no idle']), 8000);
    });

    const calls = {onAdd: 0, onRemove: 0, log: []}, out = {};
    let addGl, removeGl, lastArgs, renders = 0;
    const layer = {
        id: 'red', type: 'custom',
        onAdd(map, gl) {
            calls.onAdd++; addGl = gl;
            const shader = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); return s; };
            this.program = gl.createProgram();
            gl.attachShader(this.program, shader(gl.VERTEX_SHADER, '#version 300 es\nuniform mat4 u_matrix; in vec2 a_pos; void main() { gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0); }'));
            gl.attachShader(this.program, shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 colour; void main() { colour = vec4(1.0, 0.0, 0.0, 1.0); }'));
            gl.linkProgram(this.program);
            const [a, b] = [mod.MercatorCoordinate.fromLngLat([-20, -20]), mod.MercatorCoordinate.fromLngLat([20, 20])];
            this.vao = gl.createVertexArray();
            gl.bindVertexArray(this.vao);
            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([a.x, a.y, b.x, a.y, a.x, b.y, b.x, b.y]), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.bindAttribLocation(this.program, 0, 'a_pos');
            gl.linkProgram(this.program);
        },
        prerender() { calls.log.push('prerender'); },
        render(gl, args) {
            calls.log.push('render'); renders++; lastArgs = args;
            gl.useProgram(this.program);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, args.defaultProjectionData.mainMatrix);
            gl.bindVertexArray(this.vao);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            // State that three.js and other libraries leave behind: the map must not draw with it.
            gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT_AND_BACK); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 1, 1);
            gl.blendFunc(gl.ZERO, gl.ZERO); gl.colorMask(true, false, true, false); gl.depthMask(false); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.NEVER, 1, 255);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 8); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.activeTexture(gl.TEXTURE3); gl.viewport(0, 0, 2, 2);
        },
        onRemove(map, gl) { calls.onRemove++; removeGl = gl; },
    };

    const m = make('main');
    await new Promise(r => m.once('load', r));
    m.addLayer(layer, 'top');
    out.order = m.getLayersOrder().join();
    out.style = m.getStyle().layers.map(l => l.id).join();
    out.implementation = m.getLayer('red').implementation === layer;
    await wait(300);
    let [inside, covered, outside, edgeIn, edgeOut, fillOnly] = await colours(m, [[-10, 0], [12, 0], [-40, 0], [-19, 0], [-21, 0], [12, 25]]);
    out.flat = {inside, covered, outside, edgeIn, edgeOut, fillOnly};
    // The matrix maps a position to the same pixel as project() (in pixels of the map).
    const clip = (M, x, y) => { const v = [0, 1, 2, 3].map(i => M[i] * x + M[4 + i] * y + M[12 + i]); return {x: (v[0] / v[3] + 1) / 2 * 300, y: (1 - v[1] / v[3]) / 2 * 200}; };
    const err = (M, lngLat) => { const c = mod.MercatorCoordinate.fromLngLat(lngLat), a = clip(M, c.x, c.y), b = m.project(lngLat); return Math.hypot(a.x - b.x, a.y - b.y); };
    const mvp = (lngLat) => { const c = mod.MercatorCoordinate.fromLngLat(lngLat), ws = 512 * 2 ** m.getZoom(), a = clip(lastArgs.modelViewProjectionMatrix, c.x * ws, c.y * ws), b = m.project(lngLat); return Math.hypot(a.x - b.x, a.y - b.y); };
    out.matrix = Math.max(err(lastArgs.defaultProjectionData.mainMatrix, [-20, 10]), err(lastArgs.defaultProjectionData.mainMatrix, [30, -15]), mvp([-20, 10]));
    out.calls = {onAdd: calls.onAdd, firstTwo: calls.log.slice(0, 2).join()};
    out.sameGl = addGl === m.getCanvas().getContext('webgl2');
    const tile = lastArgs.getProjectionData({tileID: {canonical: {z: 1, x: 0, y: 1}}});
    out.args = {fov: lastArgs.fov, nearZ: lastArgs.nearZ, farZ: lastArgs.farZ, variant: lastArgs.shaderData.variantName, prelude: lastArgs.shaderData.vertexShaderPrelude.includes('vec4 projectTile(vec2 p)'),
        f64: lastArgs.defaultProjectionData.mainMatrix instanceof Float64Array && lastArgs.projectionMatrix instanceof Float64Array,
        // (The south-west tile of zoom 1: its corner 8192, 0 in tile units is the position 0, 0.)
        tile: tile.mainMatrix instanceof Float32Array && Math.abs(clip(tile.mainMatrix, 8192, 0).x - m.project([0, 0]).x) < 0.05 && String(tile.tileMercatorCoords) === String([0, 0.5, 1 / 2 / 8192, 1 / 2 / 8192])};
    const before = renders;
    m.triggerRepaint();
    await wait(200);
    out.repainted = renders > before;

    // With bearing and pitch: the corners of the square, a little inside and a little outside.
    m.jumpTo({bearing: 30, pitch: 40});
    await wait(100);
    const inner = [[-17, -17], [-17, 17], [3, 17], [3, -17]], outer = [[-23, -23], [-23, 23], [0, 23], [0, -23]];
    const tilted = await colours(m, [...inner, ...outer, [12, 0]]);
    out.tilted = {inside: tilted.slice(0, 4), outside: tilted.slice(4, 8), covered: tilted[8]};
    // At zoom 18 the matrix is still exact to a small part of a pixel (MapLibre GL JS gives 64-bit matrices for this).
    m.jumpTo({center: [-74.0060, 40.7128], zoom: 18, bearing: 20, pitch: 50});
    await colours(m, [[0, 0]]);
    out.close = Math.max(err(lastArgs.defaultProjectionData.mainMatrix, [-74.0058, 40.7129]), err(lastArgs.defaultProjectionData.mainMatrix, [-74.0063, 40.7126]));
    m.jumpTo({center: [0, 0], zoom: 1, bearing: 0, pitch: 0});

    // A lost WebGL context: the map restores it, the layer keeps its place, gets onAdd with the new context, and draws again.
    const oldGl = addGl, restored = new Promise(r => m.once('webglcontextrestored', r));
    oldGl.getExtension('WEBGL_lose_context').loseContext();
    await Promise.race([restored, wait(15000)]);
    await wait(300);
    out.lost = {onAdd: calls.onAdd, onRemove: calls.onRemove, newGl: addGl !== oldGl && addGl === m.getCanvas().getContext('webgl2'), implementation: m.getLayer('red')?.implementation === layer,
        order: m.getLayersOrder().join(), colours: (await colours(m, [[-10, 0], [12, 0]])).join()};
    // setStyle keeps the custom layer with diff (the default) and drops it with diff: false, without onRemove both times (as MapLibre GL JS 6.17).
    await new Promise(r => { m.once('style.load', r); m.setStyle({...JSON.parse(JSON.stringify(style)), metadata: {changed: 1}}); });
    await wait(300);
    out.diff = {onRemove: calls.onRemove, order: m.getLayersOrder().join(), colours: (await colours(m, [[-10, 0], [12, 0]])).join()};

    m.removeLayer('red');
    await wait(100);
    out.removed = {calls: calls.onRemove, gl: removeGl === addGl, order: m.getLayersOrder().join(), after: (await colours(m, [[-10, 0]]))[0]};
    let dropped = 0;
    m.addLayer({id: 'dropped', type: 'custom', render() {}, onRemove() { dropped++; }});
    await wait(300);
    await new Promise(r => { m.once('style.load', r); m.setStyle(JSON.parse(JSON.stringify(style)), {diff: false}); });
    await wait(300);
    out.noDiff = {onRemove: dropped, order: m.getLayersOrder().join()};
    // remove() calls onRemove of the custom layers that the map still has.
    let removedByMap = 0;
    m.addLayer({id: 'other', type: 'custom', render() {}, onRemove() { removedByMap++; }});
    await wait(300);
    const el = m.getContainer(); m.remove(); el.remove();
    out.removedByMap = removedByMap;

    // The worker renderer (asked for, and the default): the first custom layer moves the engine to the main thread, as
    // after a lost context, and the map keeps its camera, style, images, feature state, sky, markers and listeners (#1730).
    out.worker = [];
    for (const renderer of ['worker', undefined]) {
        const w = make(renderer), errors = [], events = [];
        w.on('error', e => errors.push(e.error.message));
        await new Promise(r => w.once('load', r));
        const before = w.renderer;
        w.jumpTo({center: [2, 1], zoom: 1.5, bearing: 10});
        w.addImage('dot', {width: 1, height: 1, data: new Uint8Array([255, 0, 0, 255])});
        w.setFeatureState({source: 'g', id: 1}, {hover: true});
        w.setSky({'sky-color': '#123456'});
        const marker = new mod.Marker().setLngLat([0, 0]).addTo(w);
        let moves = 0;
        w.on('move', () => moves++);
        for (const type of ['webglcontextlost', 'webglcontextrestored']) w.on(type, () => events.push(type));
        let adds = 0, gl;
        w.addLayer({...layer, onAdd(map, g) { adds++; gl = g; layer.onAdd.call(this, map, g); }}, 'top');
        const order = w.getLayersOrder().join();
        // (isStyleLoaded() stays true through the move, as in MapLibre GL JS, where a custom layer does not change it: no
        // `style.load` follows the move, so code that waits for one after a false would wait for ever; #1992.)
        // (The false window is a few ms: a timer of 5 ms can miss it. A message loop samples between every two tasks.)
        let notLoaded = 0, sampling = true;
        const ch = new MessageChannel();
        ch.port1.onmessage = () => { if (!w.isStyleLoaded()) notLoaded++; if (sampling) ch.port2.postMessage(0); };
        ch.port2.postMessage(0);
        await new Promise(r => w.once('idle', r));
        await wait(300);
        sampling = false; ch.port1.close();
        const [inside, covered] = await colours(w, [[-10, 0], [12, 0]]);
        w.jumpTo({zoom: 1.6});
        out.worker.push({renderer: renderer ?? 'default', before, after: w.renderer, errors, events, order, adds, sameGl: !!gl && gl === w.getCanvas().getContext('webgl2'), inside, covered,
            camera: [w.getCenter().lng, w.getCenter().lat, w.getBearing()].map(v => Math.round(v * 100) / 100).join(), image: w.hasImage('dot'), state: w.getFeatureState({source: 'g', id: 1}).hover === true,
            sky: w.getSky()?.['sky-color'] === '#123456', marker: w.getContainer().contains(marker.getElement()), moves, notLoaded});
        const e = w.getContainer(); w.remove(); e.remove();
    }
    // #1993: the move for a custom layer is not a lost context, so it does not use up the one restart after a loss.
    // (The context of the new canvas is lost at once, before the engine on this thread draws its first frame.)
    {
        const w = make('worker'), errors = [], events = [];
        w.on('error', e => errors.push(e.error.message));
        for (const type of ['webglcontextlost', 'webglcontextrestored']) w.on(type, () => events.push(type));
        await new Promise(r => w.once('load', r));
        const get = HTMLCanvasElement.prototype.getContext;
        let armed = true, renders = 0;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
            const gl = get.call(this, kind, ...rest);
            if (armed && gl && /webgl/.test(kind)) { armed = false; gl.getExtension('WEBGL_lose_context').loseContext(); }
            return gl;
        };
        try {
            w.addLayer({id: 'retry', type: 'custom', render() { renders++; }}, 'top');
            const until = Date.now() + 15000;
            while (Date.now() < until && !errors.length && !(events.length === 2 && renders)) await wait(100);
        } finally { HTMLCanvasElement.prototype.getContext = get; }
        out.retry = {errors, events: events.join(), renderer: w.renderer, renders};
        const e = w.getContainer(); w.remove(); e.remove();
    }
    // #1998: a query that the worker engine has not answered when the move begins is answered by the new engine. (The
    // worker here answers a query only after a second, as a slow worker would: the move comes first.)
    {
        const slow = URL.createObjectURL(new Blob([`self.addEventListener('message', e => { let text = ''; try { text = JSON.stringify(e.data); } catch {} if (!e.late && text.includes('"type":"queryRendered"')) { e.stopImmediatePropagation(); setTimeout(() => { const later = new MessageEvent('message', {data: e.data}); later.late = true; self.dispatchEvent(later); }, 1000); } }); importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`], {type: 'text/javascript'}));
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:300px;height:200px'}));
        const w = new mod.Map({container: el, renderer: 'worker', createWorker: () => new Worker(slow), center: [0, 0], zoom: 1, attributionControl: false, fadeDuration: 0, style}), errors = [];
        w.on('error', e => errors.push(e.error.message));
        await new Promise(r => w.once('load', r));
        await new Promise(r => { w.once('idle', r); setTimeout(r, 5000); });
        const query = Promise.resolve(w.queryRenderedFeatures(w.project([30, 0])));
        w.addLayer({id: 'moved', type: 'custom', render() {}});
        let ids, error;
        try { ids = (await Promise.race([query, wait(15000).then(() => 'no answer')])); ids = Array.isArray(ids) ? ids.map(f => f.layer.id).join() : ids; } catch (e) { error = e.message; }
        out.pendingQuery = {ids, error, errors, renderer: w.renderer};
        w.remove(); el.remove(); URL.revokeObjectURL(slow);
    }
    const c = mod.MercatorCoordinate.fromLngLat([-74, 40.7], 100);
    out.mercator = {origin: Object.values(mod.MercatorCoordinate.fromLngLat({lng: 0, lat: 0})), ny: [c.x, c.y, c.z], altitude: c.toAltitude(), back: c.toLngLat().toArray(), meter: c.meterInMercatorCoordinateUnits()};
    return out;
}
