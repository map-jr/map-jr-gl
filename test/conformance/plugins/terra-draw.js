// terra-draw with its MapLibre adapter: draw a point with a click.
import {TerraDraw, TerraDrawPointMode} from 'terra-draw';
import {TerraDrawMapLibreGLAdapter} from 'terra-draw-maplibre-gl-adapter';
export async function run({map, mouse, wait}) {
    const draw = new TerraDraw({adapter: new TerraDrawMapLibreGLAdapter({map}), modes: [new TerraDrawPointMode()]});
    draw.start();
    draw.setMode('point');
    await wait(500);
    await mouse.click(400, 300);
    await wait(800);
    const n = draw.getSnapshot().length;
    return {ok: n === 1, detail: `features after one click: ${n}`};
}
