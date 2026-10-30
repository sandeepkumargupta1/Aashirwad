import cropData from "../data/crops.json";
import type { Crop, Farm, Soil, Weather, RankedCrop, Factor, Season } from "./types";
export const crops = cropData as Crop[];
export const defaultFarm: Farm = { name: "My farm", location: "Sehore, Madhya Pradesh", latitude: 23.2032, longitude: 77.0844, radiusKm: 1, area: 5, areaUnit: "acres", season: "Rabi", irrigation: "Limited", irrigationSource: "Borewell", existingCrop: "chickpea", boundary: [] };
export const WEIGHTS = { season: 25, water: 25, temperature: 20, ph: 20, texture: 10 };
export function hectares(f: Pick<Farm, "area" | "areaUnit">) { return f.areaUnit === "acres" ? f.area * 0.40468564224 : f.area; }
export function haversine(a: number, b: number, c: number, d: number) { const r = (n: number) => n * Math.PI / 180; const x = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); }
export function seasonKey(date: string, s: Season): number | null { const y = +date.slice(0, 4), m = +date.slice(4, 6); if (s === "Kharif")
    return m >= 6 && m <= 9 ? y : null; if (s === "Zaid")
    return m >= 3 && m <= 5 ? y : null; return m >= 11 ? y : m <= 3 ? y - 1 : null; }
function rangeScore(v: number, r: number[], slack: number) { return v >= r[0] && v <= r[1] ? 100 : Math.max(0, 100 - 100 * Math.min(Math.abs(v - r[0]), Math.abs(v - r[1])) / slack); }
export function recommend(farm: Farm, soil: Soil, weather: Weather): RankedCrop[] {
    const climateOK = weather.temperature !== null && weather.rainfall !== null && weather.years.length >= 5;
    return crops.map(c => {
        const inSeason = c.seasons.includes(farm.season);
        const waterValue = farm.irrigation === "Reliable" ? 100 : farm.irrigation === "Limited" ? (c.water === "High" ? 25 : c.water === "Medium" ? 70 : 95) : (c.water === "High" ? 10 : c.water === "Medium" ? 40 : 75);
        const rainSupport = climateOK ? Math.min(100, weather.rainfall! * 0.7 / c.waterMm[0] * 100) : 0;
        const waterScore = farm.irrigation === "Rain-fed" ? Math.max(waterValue, Math.min(c.water === "High" ? 65 : 100, rainSupport)) : waterValue;
        const factors: Factor[] = [
            { name: "Growing season", weight: 25, value: inSeason ? 100 : 0, detail: inSeason ? `${farm.season} is a listed growing season.` : `Not a listed ${farm.season} crop in these profiles.` },
            { name: "Water availability", weight: 25, value: waterScore, detail: `${farm.irrigation}; ${c.water.toLowerCase()} water demand. Historical rain is context, not guaranteed water.` },
            { name: "Seasonal temperature", weight: 20, value: climateOK ? rangeScore(weather.temperature!, c.temp, 12) : null, detail: climateOK ? `${weather.temperature!.toFixed(1)}°C seasonal mean; indicative range ${c.temp.join("–")}°C.` : "Five complete seasonal climate records are required." },
            { name: "Soil pH", weight: 20, value: soil.ph !== null ? rangeScore(soil.ph, c.ph, 2) : null, detail: soil.ph !== null ? `pH ${soil.ph}; indicative range ${c.ph.join("–")}.` : "Add a confirmed soil-test pH." },
            { name: "Soil texture", weight: 10, value: soil.texture ? (c.textures.includes(soil.texture) ? 100 : 35) : null, detail: soil.texture ? `${soil.texture}; ${c.textures.includes(soil.texture) ? "compatible texture" : "outside preferred textures"}.` : "Soil texture is unknown." }
        ];
        const coverage = factors.reduce((s, f) => s + (f.value === null ? 0 : f.weight), 0), raw = factors.reduce((s, f) => s + (f.value ?? 0) * f.weight, 0) / (coverage || 1);
        const screeningScore = Math.round(inSeason ? raw : Math.min(raw, 39));
        const enough = coverage >= 70 && climateOK && (soil.ph !== null || !!soil.texture);
        const gaps = factors.filter(f => f.value === null).map(f => f.detail);
        if (soil.origin !== "measured")
            gaps.push("No confirmed field soil test; nutrient availability is unverified.");
        gaps.push("Local yield performance, groundwater capacity and root-zone moisture have not been scored.");
        return { ...c, score: enough ? screeningScore : null, screeningScore, coverage, factors, eligible: inSeason, reasons: factors.filter(f => f.value !== null && f.value >= 70).map(f => f.detail), gaps };
    }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.screeningScore - a.screeningScore || a.name.localeCompare(b.name));
}
export function irrigationEstimate(cropId: string, stage: number, eto: number, rain: number, areaHa: number, efficiency: number) {
    const c = crops.find(x => x.id === cropId);
    if (!c?.kc)
        throw new Error("No verified stage coefficient is configured for this crop.");
    if (!Number.isInteger(stage) || stage < 0 || stage > 3 || !Number.isFinite(eto) || eto < 0 || eto > 15 || !Number.isFinite(rain) || rain < 0 || rain > 500 || !Number.isFinite(areaHa) || areaHa <= 0 || areaHa > 10000 || !Number.isFinite(efficiency) || efficiency < 0.3 || efficiency > 1)
        throw new Error("Check the irrigation inputs.");
    const etc = eto * c.kc[stage] * 7, net = Math.max(0, etc - rain), gross = net / efficiency;
    return { kc: c.kc[stage], cropEtMm: etc, netMm: net, grossMm: gross, volumeM3: gross * areaHa * 10, periodDays: 7, method: "ETc = ETo × Kc; net = max(0, 7-day ETc − effective rain); gross = net / efficiency.", assumptions: "Illustrative weekly balance with user-supplied ETo and effective rainfall. Root-zone storage, capillary rise and actual field losses are unknown. Not an irrigation schedule." };
}
