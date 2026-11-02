export type MapView = "streets" | "satellite" | "terrain";
export const MAP_VIEW_EVENT = "aashirwad:map-view";
export function isMapView(value: unknown): value is MapView { return value === "streets" || value === "satellite" || value === "terrain"; }
export function setMapPreference(value: MapView) {
    try { localStorage.setItem("aashirwad-map-layer", value); } catch { }
    window.dispatchEvent(new CustomEvent(MAP_VIEW_EVENT, { detail: value }));
}
