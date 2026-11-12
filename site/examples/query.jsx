import {useRef, useState} from 'react';
import {MapJr, MapOverlay} from 'map-jr-gl/react';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function Query() {
  const map = useRef(null);
  const [found, setFound] = useState(null);
  const clicks = useRef(0);

  async function ask(event) {
    const click = ++clicks.current;
    // The features of the tile data near the point. You do not need a style layer.
    const features = await map.current.queryFeatures(event.point, {radius: 8});
    // An earlier click can get its answer after a later click. Only the last click is shown.
    if (click === clicks.current) setFound({lngLat: event.lngLat, features});
  }

  return (
    <MapJr ref={map} mapStyle={style} initialView={{center: NYC, zoom: 16.2}} cursor="crosshair" onClick={ask}>
      {found && (
        <MapOverlay lngLat={found.lngLat} popup onClose={() => setFound(null)}>
          {found.features.slice(0, 8).map((f, i) => <div key={i}><b>{f.sourceLayer}</b> {f.properties.name ?? f.properties.class}</div>)}
          {!found.features.length && 'Nothing here'}
        </MapOverlay>
      )}
    </MapJr>
  );
}
