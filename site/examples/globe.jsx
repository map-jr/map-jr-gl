import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {globe, navigation} from '@map-jr/map-jr-gl/controls';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const controls = [navigation(), globe()];

export default function Globe() {
  const [projection, setProjection] = useState('globe');
  // The globe turns into Mercator between zoom 11 and 12, as in MapLibre GL JS.
  return (
    <MapJr
      mapStyle={style}
      projection={{type: 'globe'}}
      initialView={{center: [10, 30], zoom: 1.5}}
      controls={controls}
      attribution={{compact: true}}
      onProjectiontransition={e => setProjection(e.newProjection)}
    >
      <p className="note">Projection: {projection}</p>
    </MapJr>
  );
}
