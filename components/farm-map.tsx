"use client";
import { useLocale } from "./locale";
import { useEffect, useRef, useState } from "react";
import { Info, Loader2, Map as MapIcon, Mountain, RotateCcw, Satellite } from "lucide-react";
import type { Farm } from "../lib/types";
import type { LocationFix } from "../lib/location";
import type * as Leaflet from "leaflet";
type Basemap = "streets" | "satellite" | "terrain";
const basemaps = [
    { id: "streets", label: "Streets", icon: MapIcon },
    { id: "satellite", label: "Satellite", icon: Satellite },
    { id: "terrain", label: "Terrain", icon: Mountain },
] as const;
const descriptions: Record<Basemap, string> = {
    streets: "Roads and village names help you find your field.",
    satellite: "Satellite images may be older; this is not a live view.",
    terrain: "Hills, paths and elevation contours. Zoom out to see the terrain.",
};
export default function FarmMap({ farm, onPick, draw = false, compact = false, currentPosition, overview = false, showCoordinates = false }: {
    farm: Farm;
    onPick?: (lat: number, lng: number) => void;
    draw?: boolean;
    compact?: boolean;
    currentPosition?: LocationFix | null;
    overview?: boolean;
    showCoordinates?: boolean;
}) {
    const { t } = useLocale();
    const element = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), layers = useRef<Leaflet.LayerGroup | null>(null), LRef = useRef<typeof Leaflet | null>(null);
    const callback = useRef(onPick);
    callback.current = onPick;
    const [ready, setReady] = useState<Leaflet.Map | null>(null), [tileError, setTileError] = useState(false);
    const [basemap, setBasemap] = useState<Basemap>("streets"), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
    useEffect(() => {
        try {
            const saved = localStorage.getItem("aashirwad-map-layer");
            if (saved === "streets" || saved === "satellite" || saved === "terrain") setBasemap(saved);
        } catch { }
    }, []);
    useEffect(() => {
        let cancelled = false;
        import("leaflet").then(L => {
            if (cancelled || !element.current)
                return;
            LRef.current = L;
            const m = L.map(element.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, minZoom: 3, maxZoom: 19, maxBounds: [[5, 67], [39, 99]], maxBoundsViscosity: 0.9 }).setView(overview ? [22.6, 79] : [farm.latitude, farm.longitude], overview ? 5 : compact ? 12 : 14);
            map.current = m;
            layers.current = L.layerGroup().addTo(m);
            m.on("click", e => callback.current?.(e.latlng.lat, e.latlng.lng));
            const resize = new ResizeObserver(() => m.invalidateSize({ pan: false }));
            resize.observe(element.current);
            m.once("unload", () => resize.disconnect());
            setReady(m);
        });
        return () => { cancelled = true; map.current?.remove(); map.current = null; layers.current = null; LRef.current = null; };
    }, []);
    useEffect(() => {
        const L = LRef.current, m = map.current;
        if (!ready || !L || !m) return;
        let cancelled = false, active: Leaflet.Layer | undefined;
        setTileError(false);
        setLoading(true);
        const loaded = () => { if (!cancelled) { setLoading(false); setTileError(false); } };
        const failed = () => { if (!cancelled) { setLoading(false); setTileError(true); } };
        const timeout = window.setTimeout(failed, 20000);
        const finished = () => { window.clearTimeout(timeout); loaded(); };
        const addRaster = (url: string, attribution: string, maxNativeZoom: number) => {
            if (cancelled) return;
            let errors = false;
            const raster = L.tileLayer(url, { maxZoom: 19, maxNativeZoom, referrerPolicy: "strict-origin-when-cross-origin", attribution, keepBuffer: 2 });
            raster.on("loading", () => { errors = false; if (!cancelled) setLoading(true); });
            raster.on("tileerror", () => { errors = true; failed(); });
            raster.on("load", () => { window.clearTimeout(timeout); if (errors) failed(); else finished(); });
            active = raster;
            raster.addTo(m);
        };
        if (basemap === "satellite") {
            addRaster("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 'Tiles &copy; <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a> · Esri, Vantor, Earthstar Geographics, and the GIS User Community', 19);
        } else if (basemap === "terrain") {
            addRaster("https://tile.opentopomap.org/{z}/{x}/{y}.png", 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · Map style: &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA</a>)', 17);
        } else {
            const fallback = () => addRaster("https://tile.openstreetmap.de/{z}/{x}/{y}.png", '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.fossgis.de/">FOSSGIS</a>', 18);
            import("./map-layer").then(({ addBasemap }) => {
                if (cancelled) return;
                try {
                    const layer = addBasemap(m);
                    active = layer;
                    const vectorMap = layer.getMaplibreMap();
                    vectorMap.on("error", failed);
                    vectorMap.on("load", finished);
                    if (vectorMap.loaded()) finished();
                } catch { fallback(); }
            }).catch(fallback);
        }
        return () => { cancelled = true; window.clearTimeout(timeout); if (active && m.hasLayer(active)) m.removeLayer(active); };
    }, [ready, basemap, retry]);
    useEffect(() => {
        if (!ready || compact || !map.current || !LRef.current) return;
        const zoom = LRef.current.control.zoom({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") }).addTo(map.current);
        return () => { zoom.remove(); };
    }, [ready, compact, t]);
    useEffect(() => {
        const L = LRef.current, m = map.current, g = layers.current;
        if (!ready || !L || !m || !g)
            return;
        g.clearLayers();
        m.setView(overview ? [22.6, 79] : [farm.latitude, farm.longitude], overview ? 5 : Math.max(13, m.getZoom()), { animate: false });
        if (currentPosition) {
            if (currentPosition.accuracy > 0)
                L.circle([currentPosition.latitude, currentPosition.longitude], { radius: currentPosition.accuracy, color: "#5c91be", weight: 1, fillColor: "#6da3ce", fillOpacity: .12 }).addTo(g);
            L.circleMarker([currentPosition.latitude, currentPosition.longitude], { radius: 7, color: "white", weight: 3, fillColor: "#398ac5", fillOpacity: 1 }).bindTooltip(t("Your current location")).addTo(g);
        }
        if (overview)
            return;
        if (farm.boundary.length >= 3)
            L.polygon(farm.boundary, { className: "farm-boundary", color: "#2e654b", fillColor: "#7ca66b", fillOpacity: 0.25, weight: 2, dashArray: draw ? "6 5" : undefined }).addTo(g);
        else
            L.circle([farm.latitude, farm.longitude], { className: "farm-boundary", radius: farm.radiusKm * 1000, color: "#43745b", weight: 2, fillColor: "#7d9a58", fillOpacity: 0.17, dashArray: "7 5" }).addTo(g);
        if (draw && farm.boundary.length)
            L.polyline(farm.boundary, { color: "#234f3c", weight: 3 }).addTo(g);
        const icon = L.divIcon({ className: "farm-marker", html: '<span><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V10M12 14C4 15 2 8 4 5c7 0 9 4 8 9Zm0-4C11 3 17 2 21 3c1 6-3 9-9 7Z"/></svg></span>', iconSize: [42, 48], iconAnchor: [21, 45] });
        L.marker([farm.latitude, farm.longitude], { icon, title: t("Selected farm location"), alt: t("Farm location pin") }).addTo(g);
        farm.boundary.forEach(p => L.circleMarker(p, { radius: 4, color: "#fff", fillColor: "#234f3c", fillOpacity: 1, weight: 2 }).addTo(g));
    }, [ready, farm.latitude, farm.longitude, farm.radiusKm, farm.boundary, draw, currentPosition, overview, t]);
    function changeBasemap(value: Basemap) {
        setBasemap(value);
        try { localStorage.setItem("aashirwad-map-layer", value); } catch { }
    }
    return <div className={`map-frame map-view-${basemap}`}>
        <div className={`map-shell ${compact ? "compact" : ""} ${draw ? "drawing" : ""}`}>
            <div ref={element} className="leaflet-map" role="region" aria-label={t("Farm location map")}/>
            <div className="map-layer-switch" role="group" aria-label={t("Map layers")}>
                {basemaps.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={basemap === id} onClick={() => changeBasemap(id)}><Icon size={16} aria-hidden="true"/><span>{t(label)}</span></button>)}
            </div>
            {!compact && <button type="button" className="map-reset" title={t("Reset map view")} aria-label={t("Reset map view")} onClick={() => map.current?.setView(overview ? [22.6, 79] : [farm.latitude, farm.longitude], overview ? 5 : 15)}><RotateCcw size={17}/></button>}
            {showCoordinates && <div className="map-coordinate">{t(farm.latitude.toFixed(4))}{t("° N") + " · "}{t(farm.longitude.toFixed(4))}{t("\u00B0 E")}</div>}
            {draw && <div className="drawing-note">{t("Click to add boundary points \u00B7 ")}{farm.boundary.length}{t(" points")}</div>}
        </div>
        <div className={`map-caption ${tileError ? "has-error" : ""}`} role="status" aria-live="polite">
            {loading ? <Loader2 size={14} className="spin"/> : <Info size={14}/>}
            <span>{t(tileError ? "This layer could not load. Try another view or retry." : loading ? "Loading map…" : descriptions[basemap])}</span>
            {tileError && <button type="button" onClick={() => setRetry(v => v + 1)}>{t("Retry")}</button>}
        </div>
    </div>;
}
