import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';

export default function CityMap() {
  const [view, setView] = useState({center: [-74.0065, 40.7085], zoom: 13.6});
  return (
    <>
      <div style={{height: 400}}>
        <MapJr mapStyle="https://styles.map-jr.org/1/elevation-zero.json" view={view} onViewChange={setView} />
      </div>
      <p>Zoom {view.zoom.toFixed(1)}</p>
    </>
  );
}
