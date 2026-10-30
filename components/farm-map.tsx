"use client";
import { useEffect, useRef, useState } from "react";
import type { Farm } from "../lib/types";
import type { LocationFix } from "../lib/location";
import type * as Leaflet from "leaflet";
export default function FarmMap({ farm, onPick, draw = false, compact = false, currentPosition, overview = false, showCoordinates = false }: {
    farm: Farm;
    onPick?: (lat: number, lng: number) => void;
    draw?: boolean;
    compact?: boolean;
    currentPosition?: LocationFix | null;
    overview?: boolean;
    showCoordinates?: boolean;
}) {
    const element = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), layers = useRef<Leaflet.LayerGroup | null>(null), LRef = useRef<typeof Leaflet | null>(null);
    const callback = useRef(onPick);
    callback.current = onPick;
    const [ready, setReady] = useState(false), [tileError, setTileError] = useState(false);
    useEffect(() => {
        let cancelled = false;
        import("leaflet").then(L => {
            if (cancelled || !element.current)
                return;
            const addRasterFallback = () => {
                if (cancelled)
                    return;
                const raster = L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", { maxZoom: 18, referrerPolicy: "strict-origin-when-cross-origin", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.fossgis.de/">FOSSGIS</a>' });
                raster.on("tileerror", () => setTileError(true));
                raster.on("load", () => setTileError(false));
                raster.addTo(m);
            };
            LRef.current = L;
            const m = L.map(element.current, { zoomControl: !compact, scrollWheelZoom: false, attributionControl: true, minZoom: 3, maxZoom: 18, maxBounds: [[5, 67], [39, 99]], maxBoundsViscosity: 0.9 }).setView(overview ? [22.6, 79] : [farm.latitude, farm.longitude], overview ? 5 : compact ? 12 : 14);
            map.current = m;
            import("./map-layer").then(({ addBasemap }) => {
                if (cancelled)
                    return;
                try {
                    const gl = addBasemap(m);
                    gl.getMaplibreMap().on("error", () => setTileError(true));
                    gl.getMaplibreMap().on("load", () => setTileError(false));
                }
                catch (error) {
                    console.warn("Basemap initialization:", error);
                    addRasterFallback();
                }
            }).catch(error => { console.warn("Basemap module:", error); addRasterFallback(); });
            layers.current = L.layerGroup().addTo(m);
            m.on("click", e => callback.current?.(e.latlng.lat, e.latlng.lng));
            setReady(true);
            setTimeout(() => {
                if (!cancelled)
                    m.invalidateSize();
            }, 100);
        });
        return () => { cancelled = true; map.current?.remove(); map.current = null; };
    }, []);
    useEffect(() => {
        const L = LRef.current, m = map.current, g = layers.current;
        if (!ready || !L || !m || !g)
            return;
        g.clearLayers();
        m.setView(overview ? [22.6, 79] : [farm.latitude, farm.longitude], overview ? 5 : Math.max(13, m.getZoom()), { animate: false });
        if (currentPosition) {
            if (currentPosition.accuracy > 0) L.circle([currentPosition.latitude, currentPosition.longitude], { radius: currentPosition.accuracy, color: "#5c91be", weight: 1, fillColor: "#6da3ce", fillOpacity: .12 }).addTo(g);
            L.circleMarker([currentPosition.latitude, currentPosition.longitude], { radius: 7, color: "white", weight: 3, fillColor: "#398ac5", fillOpacity: 1 }).bindTooltip("Your current location").addTo(g);
        }
        if (overview)
            return;
        if (farm.boundary.length >= 3)
            L.polygon(farm.boundary, { color: "#2e654b", fillColor: "#7ca66b", fillOpacity: 0.25, weight: 2, dashArray: draw ? "6 5" : undefined }).addTo(g);
        else
            L.circle([farm.latitude, farm.longitude], { radius: farm.radiusKm * 1000, color: "#43745b", weight: 2, fillColor: "#7d9a58", fillOpacity: 0.17, dashArray: "7 5" }).addTo(g);
        if (draw && farm.boundary.length)
            L.polyline(farm.boundary, { color: "#234f3c", weight: 3 }).addTo(g);
        const icon = L.divIcon({ className: "farm-marker", html: '<span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V10M12 14C4 15 2 8 4 5c7 0 9 4 8 9Zm0-4C11 3 17 2 21 3c1 6-3 9-9 7Z"/></svg></span>', iconSize: [42, 48], iconAnchor: [21, 45] });
        L.marker([farm.latitude, farm.longitude], { icon, title: "Selected farm location", alt: "Farm location pin" }).addTo(g);
        farm.boundary.forEach(p => L.circleMarker(p, { radius: 4, color: "#fff", fillColor: "#234f3c", fillOpacity: 1, weight: 2 }).addTo(g));
    }, [ready, farm.latitude, farm.longitude, farm.radiusKm, farm.boundary, draw, currentPosition, overview]);
    return <div className={`map-shell ${compact ? "compact" : ""} ${draw ? "drawing" : ""}`}><div ref={element} className="leaflet-map" aria-label="Farm location map"/>{showCoordinates && <div className="map-coordinate">{farm.latitude.toFixed(4)}° N &nbsp; {farm.longitude.toFixed(4)}° E</div>}{tileError && <div className="map-offline">Map tiles unavailable · pin and boundary controls still work</div>}{draw && <div className="drawing-note">Click to add boundary points · {farm.boundary.length} points</div>}</div>;
}
