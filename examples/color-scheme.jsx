// The map fills its parent element, so give the parent a height.
import {useState} from 'react';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, colorScheme} from '@map-jr/map-jr-gl/controls';

const style = 'https://styles.map-jr.org/1/elevation-zero.json';
const controls = [navigation(), colorScheme()];

export default function SchemeMap() {
  // Store the value that the button sets, or the next render passes the old one and the map changes back.
  const [scheme, setScheme] = useState('auto');
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: [-74.0065, 40.7085], zoom: 13}}
      controls={controls}
      attribution={{compact: true}}
      colorScheme={scheme}
      onColorSchemeChange={setScheme}
    >
      <p className="note">Scheme: {scheme}</p>
    </MapJr>
  );
}
