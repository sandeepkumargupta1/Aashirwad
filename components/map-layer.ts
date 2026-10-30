import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Map } from 'leaflet';
setWorkerUrl(workerUrl);
export function addBasemap(map: Map) {
    const layer = maplibreGL({ style: 'https://tiles.openfreemap.org/styles/liberty', interactive: false, attributionControl: false });
    try {
        layer.addTo(map);
    }
    catch (error) {
        const originalRemove = layer.onRemove.bind(layer);
        layer.onRemove = (m) => { if (layer.getMaplibreMap())
            originalRemove(m);
        else
            layer.getContainer()?.remove(); return layer; };
        if (map.hasLayer(layer))
            map.removeLayer(layer);
        throw error;
    }
    map.attributionControl.addAttribution('<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
    return layer;
}
