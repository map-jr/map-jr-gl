// The map fills its parent element, so give the parent a height.
import {useState} from 'react';
import {MapJr, MapOverlay} from '@map-jr/map-jr-gl/react';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const NYC = [-74.0065, 40.7085];

export default function Draggable() {
  const [pin, setPin] = useState(NYC);
  const [moving, setMoving] = useState(false);
  return (
    <MapJr mapStyle={style} initialView={{center: NYC, zoom: 14}} attribution={{compact: true}}>
      {/* Without children, MapOverlay shows the default pin. The new position comes with onDragEnd. The pin stays where it was dropped until lngLat changes. */}
      <MapOverlay lngLat={pin} anchor="bottom" color="#d6453d" draggable onDragStart={() => setMoving(true)} onDragEnd={p => { setPin(p); setMoving(false); }} />
      <p className="note">{moving ? 'Moving' : `Pin at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`}</p>
    </MapJr>
  );
}
