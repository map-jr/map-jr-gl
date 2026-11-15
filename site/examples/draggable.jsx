import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const NYC = [-74.0065, 40.7085];

export default function Draggable() {
  const [pin, setPin] = useState(NYC);
  const [moving, setMoving] = useState(false);
  return (
    <MapJr mapStyle={style} initialView={{center: NYC, zoom: 14}} attribution={{compact: true}}>
      {/* The new position comes with onDragEnd. The pin stays where it was dropped until lngLat changes. */}
      <MapOverlay lngLat={pin} anchor="bottom" draggable onDragStart={() => setMoving(true)} onDragEnd={p => { setPin(p); setMoving(false); }}>
        <svg width="27" height="41" viewBox="0 0 27 41"><path d="M13.5 0C6 0 0 6 0 13.5 0 23 13.5 41 13.5 41S27 23 27 13.5C27 6 21 0 13.5 0z" fill="#d6453d" /><circle cx="13.5" cy="13.5" r="5.5" fill="#fff" /></svg>
      </MapOverlay>
      <p className="note">{moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`}</p>
    </MapJr>
  );
}
