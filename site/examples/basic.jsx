import {MapJr, useMapState} from 'map-jr-gl/react';
import {navigation, scale, fullscreen} from 'map-jr-gl/controls';
import {style, NYC} from './shared.js';

function Renderer() {
  const renderer = useMapState(state => state.renderer);
  return <p className="note">{renderer ? `${renderer} rendering` : 'Starting'}</p>;
}

export default function Basic() {
  return (
    <MapJr
      mapStyle={style}
      initialView={{center: NYC, zoom: 13.6}}
      controls={[navigation(), scale({position: 'bottom-left'}), fullscreen({position: 'top-left'})]}
      attribution={{compact: true}}
    >
      <Renderer />
    </MapJr>
  );
}
