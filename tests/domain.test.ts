import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, soilFor, demoWeather } from '../lib/analysis';
import { defaultFarm, recommend, hectares, haversine, irrigationEstimate } from '../lib/agronomy';
import { aggregateWeather, unavailableWeather } from '../lib/weather';
import { farmSchema, soilTestSchema } from '../lib/validation';
test('all scores are bounded and nonseason crops cannot outrank seasonal candidates', async () => {
    const a = await analyze(defaultFarm, 'demo');
    assert.ok(a.crops.every(c => c.score !== null && c.score >= 0 && c.score <= 100));
    assert.ok(a.crops.filter(c => !c.eligible).every(c => c.score! <= 39));
    assert.equal(a.crops[0].eligible, true);
});
test('live mode never fills absent soil with sample values', () => {
    const soil = soilFor(defaultFarm, 'live');
    assert.equal(soil.ph, null);
    assert.equal(soil.texture, null);
    assert.equal(soil.totalNitrogen, null);
});
test('missing climate or soil withholds suitability even when seasonal inputs are known', () => {
    const live = soilFor(defaultFarm, 'live');
    const rows = recommend(defaultFarm, live, demoWeather('Rabi'));
    assert.ok(rows.every(c => c.score === null));
    assert.ok(recommend(defaultFarm, soilFor(defaultFarm, 'demo'), unavailableWeather('offline')).every(c => c.score === null));
});
test('confirmed laboratory pH overrides demo estimates and never invents available P or K', () => {
    const f = { ...defaultFarm, soilTest: { ph: 5.4, date: '2025-02-01', lab: 'Test lab', confirmed: true } };
    assert.equal(soilFor(f, 'demo').ph, 5.4);
    assert.equal(f.soilTest['phosphorus' as keyof typeof f.soilTest], undefined);
});
test('reliable irrigation improves high-water crops compared with rain-fed screening', () => {
    const s = soilFor(defaultFarm, 'demo'), w = demoWeather('Kharif'), f = { ...defaultFarm, season: 'Kharif' as const };
    const dry = recommend({ ...f, irrigation: 'Rain-fed' }, s, w).find(c => c.id === 'cotton')!;
    const wet = recommend({ ...f, irrigation: 'Reliable' }, s, w).find(c => c.id === 'cotton')!;
    assert.ok(wet.score! > dry.score!);
});
test('area and distance units are explicit', () => { assert.ok(Math.abs(hectares({ area: 1, areaUnit: 'acres' }) - .40468564224) < 1e-10); assert.equal(haversine(23, 77, 23, 77), 0); assert.ok(haversine(23, 77, 24, 77) > 110); });
test('irrigation conserves dimensions and never recommends negative water', () => {
    const x = irrigationEstimate('wheat', 2, 4, 2, 1, .8);
    assert.equal(x.cropEtMm, 32.199999999999996);
    assert.ok(Math.abs(x.volumeM3 - x.grossMm * 10) < 1e-8);
    assert.equal(irrigationEstimate('wheat', 2, 1, 100, 1, 1).grossMm, 0);
    assert.throws(() => irrigationEstimate('rice', 2, 4, 1, 1, .75));
    assert.throws(() => irrigationEstimate('wheat', 2, 4, 1, 1, 0));
});
function parameters() { const p: Record<string, Record<string, number>> = { T2M: {}, PRECTOTCORR: {}, T2M_MIN: {}, T2M_MAX: {} }; for (let d = new Date('2019-01-01T00:00:00Z'); d <= new Date('2024-12-31T00:00:00Z'); d = new Date(+d + 86400000)) {
    const k = d.toISOString().slice(0, 10).replaceAll('-', '');
    p.T2M[k] = 20;
    p.PRECTOTCORR[k] = 2;
    p.T2M_MIN[k] = 12;
    p.T2M_MAX[k] = 28;
} return p; }
test('Rabi crosses calendar years, excludes incomplete edge seasons, and includes leap days', () => {
    const w = aggregateWeather(parameters(), 'Rabi', '2025-01-01');
    assert.equal(w.years.length, 5);
    assert.equal(w.years[0].year, 2019);
    assert.equal(w.years[0].days, 152);
    assert.equal(w.years[0].rainfall, 304);
    assert.equal(w.years.at(-1)!.year, 2023);
});
test('missing NASA sentinel is excluded, and incomplete seasons do not create confident ranks', () => {
    const p = parameters();
    for (let d = 1; d <= 31; d++)
        p.T2M[`202001${String(d).padStart(2, '0')}`] = -999;
    const w = aggregateWeather(p, 'Rabi', '2025-01-01');
    assert.equal(w.status, 'unavailable');
    assert.equal(w.years.length, 4);
});
test('API validation rejects coordinates outside India and impossible measurements', () => {
    assert.equal(farmSchema.safeParse({ ...defaultFarm, latitude: 200 }).success, false);
    assert.equal(soilTestSchema.safeParse({ ph: 20, date: '2025-01-01', lab: 'lab', confirmed: true }).success, false);
});
test('official-source metadata is present and an untrained yield model returns no invented number', async () => {
    const a = await analyze(defaultFarm, 'demo');
    assert.equal(a.sources.length, 7);
    assert.equal(a.yield.status, 'unavailable');
    assert.equal('yieldTonnesPerHa' in a.yield, false);
    assert.ok(a.sources.every(s => s.status === 'Demo sample'));
});
test('unconfirmed, empty or future soil reports and crossed boundaries are rejected', () => {
    assert.equal(soilTestSchema.safeParse({ lab: 'lab', date: '2025-01-01', confirmed: true }).success, false);
    assert.equal(soilTestSchema.safeParse({ ph: 7, lab: 'lab', date: '2025-99-99', confirmed: true }).success, false);
    assert.equal(soilTestSchema.safeParse({ ph: 7, lab: 'lab', date: '2099-01-01', confirmed: true }).success, false);
    assert.equal(farmSchema.safeParse({ ...defaultFarm, boundary: [[23, 77], [24, 78], [23, 78], [24, 77]] }).success, false);
});
