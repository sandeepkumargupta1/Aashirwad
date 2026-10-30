import test from 'node:test';
import assert from 'node:assert/strict';
import { locateCurrentPlace, LocationError, parseFieldLocation, farmAtLocation, nearbyDistance } from '../lib/location';
import { defaultFarm } from '../lib/agronomy';
import { normalizePlaces, handlePlaces } from '../lib/places';
const fix = { latitude: 23.2032, longitude: 77.0844, accuracy: 24, timestamp: 1700000000000 };
function browserFix() { return { coords: { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: fix.timestamp } as GeolocationPosition; }
test('automatic location uses the device coordinates and reports accuracy', async () => {
    let options: PositionOptions | undefined;
    const geo = { getCurrentPosition(success: PositionCallback, _error?: PositionErrorCallback | null, opts?: PositionOptions) { options = opts; success(browserFix()); } };
    const result = await locateCurrentPlace(geo);
    assert.deepEqual(result, fix);
    assert.equal(options?.enableHighAccuracy, true);
    assert.equal(options?.timeout, 15000);
});
test('permission denial, timeout and unsupported browsers remain explicit failures', async () => {
    for (const [code, expected] of [[1, 'denied'], [3, 'timeout'], [2, 'unavailable']] as const) {
        const geo = { getCurrentPosition(_success: PositionCallback, error?: PositionErrorCallback | null) { error?.({ code, message: 'test fixture' } as GeolocationPositionError); } };
        await assert.rejects(locateCurrentPlace(geo), (e: unknown) => e instanceof LocationError && e.code === expected);
    }
    await assert.rejects(locateCurrentPlace(undefined), (e: unknown) => e instanceof LocationError && e.code === 'unsupported');
});
test('GPS outside the supported area is never replaced with a sample location', async () => {
    const geo = { getCurrentPosition(success: PositionCallback) { success({ ...browserFix(), coords: { ...browserFix().coords, latitude: 51, longitude: 0 } }); } };
    await assert.rejects(locateCurrentPlace(geo), (e: unknown) => e instanceof LocationError && e.code === 'outside');
});
test('saved field locations are validated before use', () => {
    const field = { ...fix, origin: 'map', label: 'Selected field' };
    assert.equal(parseFieldLocation(JSON.stringify(field))?.origin, 'map');
    assert.equal(parseFieldLocation(JSON.stringify({ ...field, latitude: 900 })), null);
    assert.equal(parseFieldLocation(JSON.stringify({ ...field, origin: 'assumed' })), null);
    assert.equal(parseFieldLocation('not JSON'), null);
});
test('moving to a different field preserves preferences but does not reuse its soil test', () => {
    const old = { ...defaultFarm, texture: 'Loam', soilTest: { ph: 6.8, date: '2025-01-01', lab: 'Test fixture', confirmed: true } };
    const moved = farmAtLocation(old, { latitude: 24, longitude: 78, origin: 'gps', label: 'Current area', timestamp: fix.timestamp });
    assert.equal(moved.soilTest, undefined);
    assert.equal(moved.texture, undefined);
    assert.equal(moved.area, old.area);
    assert.equal(moved.season, old.season);
    assert.equal(moved.location, 'Current area');
    const same = farmAtLocation(old, { ...fix, origin: 'map', label: 'Same field' });
    assert.equal(same.soilTest?.ph, 6.8);
    assert.equal(nearbyDistance(fix, same), 0);
    assert.equal(nearbyDistance(null, same), null);
});
test('place results retain names and distances, reject outside points, and handle incomplete data', () => {
    const results = normalizePlaces([{ place_id: 1, name: 'Fixture village', display_name: 'Fixture village, MP', lat: '23.2032', lon: '77.0844' }, { place_id: 2, name: 'Outside fixture', lat: '80', lon: '0' }, null], fix);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Fixture village');
    assert.equal(results[0].distanceKm, 0);
    assert.deepEqual(normalizePlaces({ error: 'bad response' }), []);
});
test('village searches are submitted explicitly, bounded when requested, cached and rate limited', async (t) => {
    let calls = 0;
    let requested: URL | undefined;
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => { calls++; requested = new URL(String(input)); return Response.json([{ place_id: 1, name: 'Fixture village', display_name: 'Fixture village, MP', lat: '23.2032', lon: '77.0844' }]); });
    const request = () => new Request('https://example.test/api/places/search?q=fixture&latitude=23.2032&longitude=77.0844&nearby=true');
    const response = await handlePlaces(request());
    assert.equal(response?.status, 200);
    assert.equal(requested?.searchParams.get('countrycodes'), 'in');
    assert.equal(requested?.searchParams.get('bounded'), '1');
    assert.ok(requested?.searchParams.has('viewbox'));
    await handlePlaces(request());
    assert.equal(calls, 1);
    const rapid = await handlePlaces(new Request('https://example.test/api/places/search?q=different-fixture'));
    assert.equal(rapid?.status, 503);
    assert.equal(calls, 1);
    const invalid = await handlePlaces(new Request('https://example.test/api/places/search?q=x'));
    assert.equal(invalid?.status, 400);
    assert.equal(calls, 1);
});
