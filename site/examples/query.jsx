import {useRef, useState} from 'react';
import {MapJr} from 'map-jr-gl/react';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];
// The answer shows in a box in a corner of the map. The box takes no pointer events, so a click on it reaches the map.
const box = {position: 'absolute', top: '8px', left: '8px', zIndex: 1, pointerEvents: 'none', maxWidth: '240px', padding: '8px 10px', borderRadius: '8px', background: '#fff', color: '#222', font: '12px/1.5 system-ui,sans-serif', boxShadow: '0 1px 6px #0004'};

export default function Query() {
  const map = useRef(null);
  const [found, setFound] = useState(null);
  const clicks = useRef(0);

  async function ask(event) {
    const click = ++clicks.current;
    // With `sources`, the query reads the tile data of these sources within 8 pixels of the click. It also finds
    // features that the style does not draw. "openmaptiles" is the id of the vector source in this style.
    // A query fails when its tile cannot be loaded: the answer is then `null` here.
    const features = await map.current.queryFeatures(event.lngLat, {sources: ['openmaptiles'], radius: 8}).catch(() => null);
    // An earlier click can get its answer after a later click. Only the last click is shown.
    if (click === clicks.current) setFound({features});
  }

  return (
    <MapJr ref={map} mapStyle={style} initialView={{center: NYC, zoom: 16.2}} cursor="crosshair" onClick={ask}>
      {found && (
        <div style={box}>
          {found.features?.slice(0, 8).map((f, i) => <div key={i}><b>{f.sourceLayer}</b> {f.properties.name ?? f.properties.class}</div>)}
          {!found.features ? 'The tile data did not load' : !found.features.length && 'Nothing here'}
        </div>
      )}
    </MapJr>
  );
}
