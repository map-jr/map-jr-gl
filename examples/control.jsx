// The map fills its parent element, so give the parent a height.
import {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {MapJr} from '@map-jr/map-jr-gl/react';
import {navigation, custom} from '@map-jr/map-jr-gl/controls';

const styles = ['elevation-zero', 'openfreemap-positron', 'openfreemap-dark'];
const button = {padding: '6px 12px', border: 0, borderRadius: '16px', background: '#fff', color: '#222', font: '13px system-ui,sans-serif', boxShadow: '0 1px 4px #0004', cursor: 'pointer'};

export default function Control() {
  const [current, setCurrent] = useState(0);
  // The element of the control, made in the browser only, because `document` does not exist during server rendering.
  // The map places it in its corner, and the portal renders the button into it.
  const [corner, setCorner] = useState(null);
  useEffect(() => setCorner(document.createElement('div')), []);
  // `key` names the control: the map keeps it while the list has a control with this key.
  const controls = useMemo(() => corner ? [navigation(), custom({key: 'next-style', position: 'top-left', element: corner})] : [navigation()], [corner]);

  return <>
    <MapJr mapStyle={`https://styles.map-jr.org/1/${styles[current]}.json`} initialView={{center: [-74.0065, 40.7085], zoom: 13}}
      controls={controls} attribution={{compact: true}} />
    <p>Style: {styles[current]}</p>
    {corner && createPortal(<button style={button} onClick={() => setCurrent((current + 1) % styles.length)}>Next style</button>, corner)}
  </>;
}
