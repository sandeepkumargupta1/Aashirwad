import { z } from 'zod';
import { haversine } from './agronomy';
import { supportedLocation } from './location';
export interface PlaceResult {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceKm: number | null;
}
const cache = new Map<string, {
    time: number;
    value: unknown;
}>();
let nextRequestAt = 0;
async function geocode(path: string, params: URLSearchParams): Promise<unknown> {
    const base = process.env.GEOCODER_BASE_URL || 'https://nominatim.openstreetmap.org';
    const url = new URL(path, base);
    url.search = params.toString();
    const key = url.toString(), hit = cache.get(key);
    if (hit && Date.now() - hit.time < 86400000)
        return hit.value;
    if (Date.now() < nextRequestAt)
        throw new Error('Please wait a moment before searching again.');
    nextRequestAt = Date.now() + 1100;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en,hi', 'User-Agent': 'Aashirwad/1.1 (+https://aashirwad-farm.spunkymoss1.chatgpt.site)' }, signal: AbortSignal.timeout(7000) });
    if (!response.ok)
        throw new Error('Place search is temporarily unavailable. You can still choose your field on the map.');
    const value: unknown = await response.json();
    if (cache.size >= 200)
        cache.delete(cache.keys().next().value!);
    cache.set(key, { time: Date.now(), value });
    return value;
}
export function normalizePlaces(raw: unknown, near?: {
    latitude: number;
    longitude: number;
}): PlaceResult[] {
    if (!Array.isArray(raw))
        return [];
    return raw.flatMap((row: Record<string, unknown>) => {
        if (!row || typeof row !== 'object')
            return [];
        const latitude = Number(row.lat), longitude = Number(row.lon);
        if (!supportedLocation(latitude, longitude))
            return [];
        const address = typeof row.display_name === 'string' ? row.display_name.slice(0, 350) : '';
        const name = typeof row.name === 'string' && row.name ? row.name : address.split(',')[0];
        if (!name)
            return [];
        return [{ id: String(row.place_id ?? `${latitude}:${longitude}`), name, address, latitude, longitude, distanceKm: near ? haversine(near.latitude, near.longitude, latitude, longitude) : null }];
    }).slice(0, 5);
}
export async function handlePlaces(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!['/api/places/search', '/api/places/reverse'].includes(url.pathname))
        return null;
    try {
        if (url.pathname.endsWith('/search')) {
            const input = z.object({ q: z.string().trim().min(2).max(100), latitude: z.coerce.number().min(6).max(38).optional(), longitude: z.coerce.number().min(68).max(98).optional(), nearby: z.enum(['true', 'false']).default('false') }).parse(Object.fromEntries(url.searchParams));
            const params = new URLSearchParams({ q: input.q, format: 'jsonv2', limit: '5', countrycodes: 'in', addressdetails: '1' });
            const near = input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : undefined;
            if (near) {
                const dx = .45 / Math.cos(near.latitude * Math.PI / 180);
                params.set('viewbox', `${near.longitude - dx},${near.latitude + .45},${near.longitude + dx},${near.latitude - .45}`);
                if (input.nearby === 'true')
                    params.set('bounded', '1');
            }
            return Response.json({ places: normalizePlaces(await geocode('/search', params), near), attribution: '© OpenStreetMap contributors' });
        }
        const point = z.object({ latitude: z.coerce.number().min(6).max(38), longitude: z.coerce.number().min(68).max(98) }).parse(Object.fromEntries(url.searchParams));
        const raw = await geocode('/reverse', new URLSearchParams({ lat: point.latitude.toFixed(3), lon: point.longitude.toFixed(3), zoom: '12', format: 'jsonv2', addressdetails: '1' })) as {
            address?: Record<string, string>;
            name?: string;
        };
        const a = raw.address ?? {};
        const label = [a.village || a.town || a.city || a.municipality || a.county || raw.name, a.state].filter(Boolean).join(', ').slice(0, 150);
        return Response.json({ label: label || null, attribution: '© OpenStreetMap contributors' });
    }
    catch (error) {
        return Response.json({ error: error instanceof z.ZodError ? 'Enter a village or town name and a valid area.' : error instanceof Error && !error.message.includes('internal error') ? error.message : 'Place search could not connect. Tap your field on the map instead.' }, { status: error instanceof z.ZodError ? 400 : 503 });
    }
}
