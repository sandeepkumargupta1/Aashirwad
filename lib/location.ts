import type { Farm } from './types';
import { haversine } from './agronomy';
export type LocationOrigin = 'gps' | 'map' | 'search';
export type LocationFix = {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
};
export type FieldLocation = {
    latitude: number;
    longitude: number;
    origin: LocationOrigin;
    label: string;
    timestamp: number;
};
export type LocationProblem = 'denied' | 'timeout' | 'unavailable' | 'unsupported' | 'outside';
export class LocationError extends Error {
    constructor(public code: LocationProblem) { super(code); }
}
export function supportedLocation(latitude: number, longitude: number) {
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
}
export function locateCurrentPlace(geo?: Pick<Geolocation, 'getCurrentPosition'>): Promise<LocationFix> {
    if (!geo)
        return Promise.reject(new LocationError('unsupported'));
    return new Promise((resolve, reject) => {
        try {
            geo.getCurrentPosition(position => {
                const { latitude, longitude, accuracy } = position.coords;
                if (!supportedLocation(latitude, longitude)) {
                    reject(new LocationError('outside'));
                    return;
                }
                resolve({ latitude, longitude, accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0, timestamp: position.timestamp || Date.now() });
            }, error => reject(new LocationError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
        }
        catch {
            reject(new LocationError('unavailable'));
        }
    });
}
export function parseFieldLocation(raw: string | null): FieldLocation | null {
    try {
        if (!raw)
            return null;
        const value = JSON.parse(raw);
        if (!supportedLocation(value.latitude, value.longitude) || !['gps', 'map', 'search'].includes(value.origin) || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 150 || !Number.isFinite(value.timestamp))
            return null;
        return value as FieldLocation;
    }
    catch {
        return null;
    }
}
export function farmAtLocation(farm: Farm, selected: FieldLocation): Farm {
    const moved = haversine(farm.latitude, farm.longitude, selected.latitude, selected.longitude) > 0.1;
    return { ...farm, latitude: +selected.latitude.toFixed(6), longitude: +selected.longitude.toFixed(6), location: selected.label, boundary: [], ...(moved ? { soilTest: undefined, texture: undefined } : {}) };
}
export function nearbyDistance(fix: LocationFix | null, point: {
    latitude: number;
    longitude: number;
}) {
    return fix ? haversine(fix.latitude, fix.longitude, point.latitude, point.longitude) : null;
}
