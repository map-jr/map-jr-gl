import {useEffect, useMemo, useRef, useState} from 'react';
import {MapJr, MapOverlay} from 'map-jr-gl/react';
import {style, NYC} from './shared.js';
import {manyMarkers, dot, pin} from '../../demo/markers.mjs';

export default function Markers() {
  const map = useRef(null);
  const [selected, setSelected] = useState(null);
  // Marker data is compared by identity: these layers are made one time.
  const layers = useMemo(() => {
    const places = manyMarkers(50000, NYC, 0.35).data, some = places.slice(0, 500);
    return [
      {id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)},
      {id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some},
      {id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some},
    ];
  }, []);

  // The click on a marker is an event of the map.
  const started = () => map.current.listen('markerclick', e => setSelected(e.marker));

  return (
    <MapJr ref={map} mapStyle={style} initialView={{center: NYC, zoom: 11.4}} markers={layers} onLoad={started}>
      {selected && (
        <MapOverlay lngLat={selected.lngLat} offset={[0, -30]} popup onClose={() => setSelected(null)}>
          Marker at {selected.lngLat.map(v => v.toFixed(3)).join(', ')}
        </MapOverlay>
      )}
    </MapJr>
  );
}
