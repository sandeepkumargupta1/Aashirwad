import type { Weather, Season, ClimateYear } from "./types";
import { seasonKey } from "./agronomy";
type Parameters = Record<string, Record<string, number>>;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x > -900;
const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const round = (x: number) => Math.round(x * 10) / 10;
export function aggregateWeather(params: Parameters, season: Season, fetchedAt: string, solarUnit?: string): Weather {
    const groups = new Map<number, {
        date: string;
        rain: number;
        temp: number;
        min: number;
        max: number;
    }[]>();
    const monthly = Array.from({ length: 12 }, () => ({ rain: [] as number[], temp: [] as number[] }));
    for (const date of Object.keys(params.T2M ?? {}).sort()) {
        const t = params.T2M[date], r = params.PRECTOTCORR?.[date], lo = params.T2M_MIN?.[date], hi = params.T2M_MAX?.[date];
        if (!finite(t) || !finite(r) || r < 0 || !finite(lo) || !finite(hi))
            continue;
        const m = +date.slice(4, 6) - 1;
        monthly[m].rain.push(r);
        monthly[m].temp.push(t);
        const key = seasonKey(date, season);
        if (key === null)
            continue;
        const rows = groups.get(key) ?? [];
        rows.push({ date, rain: r, temp: t, min: lo, max: hi });
        groups.set(key, rows);
    }
    const years: ClimateYear[] = [];
    for (const [year, rows] of groups) {
        const expected = season === "Kharif" ? 122 : season === "Zaid" ? 92 : (Date.UTC(year + 1, 3, 1) - Date.UTC(year, 10, 1)) / 86400000;
        const coverage = rows.length / expected;
        if (coverage < 0.98)
            continue;
        let run = 0, drySpells = 0, previous = 0;
        for (const row of rows) {
            const d = Date.UTC(+row.date.slice(0, 4), +row.date.slice(4, 6) - 1, +row.date.slice(6, 8));
            if (previous && d - previous !== 86400000)
                run = 0;
            run = row.rain < 1 ? run + 1 : 0;
            if (run === 7)
                drySpells++;
            previous = d;
        }
        years.push({ year, rainfall: round(rows.reduce((s, r) => s + r.rain, 0)), temperature: round(mean(rows.map(r => r.temp))!), minTemperature: round(mean(rows.map(r => r.min))!), maxTemperature: round(mean(rows.map(r => r.max))!), drySpells, days: rows.length, coverage });
    }
    years.sort((a, b) => a.year - b.year);
    const selected = years.slice(-5);
    const values = (key: string) => Object.entries(params[key] ?? {}).filter(([d, v]) => selected.some(y => y.year === seasonKey(d, season)) && finite(v)).map(([, v]) => v);
    return { status: selected.length >= 5 ? "available" : "unavailable", source: "NASA POWER", solarUnit: solarUnit ?? "Source units unspecified", resolution: "Meteorology about 0.5° × 0.625°, solar about 1°; regional grid, not a 1 km measurement", fetchedAt, period: selected.length ? `${selected[0].year}–${selected.at(-1)!.year} seasonal start years` : "No complete seasons", years: selected, rainfall: mean(selected.map(x => x.rainfall)), temperature: mean(selected.map(x => x.temperature)), drySpells: mean(selected.map(x => x.drySpells)), humidity: mean(values("RH2M")), wind: mean(values("WS2M")), solar: mean(values("ALLSKY_SFC_SW_DWN")), monthly: monthly.map((m, i) => ({ month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i], rainfall: round((mean(m.rain) ?? 0) * [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]), temperature: round(mean(m.temp) ?? 0) })), ...(selected.length < 5 ? { error: "Fewer than five complete seasons; rankings are withheld." } : {}) };
}
const cache = new Map<string, {
    at: number;
    data: Parameters;
    solarUnit?: string;
}>();
export function unavailableWeather(error: string): Weather { return { status: "unavailable", source: "NASA POWER", resolution: "Regional climate grid", fetchedAt: null, period: "Unavailable", years: [], monthly: [], rainfall: null, temperature: null, humidity: null, wind: null, solar: null, drySpells: null, error }; }
export async function getHistoricalWeather(latitude: number, longitude: number, season: Season): Promise<Weather> {
    const endYear = new Date().getUTCFullYear() - 1, startYear = endYear - 5, key = `${latitude.toFixed(3)}:${longitude.toFixed(3)}:${endYear}`;
    const existing = cache.get(key);
    if (existing && Date.now() - existing.at < 86400000)
        return { ...aggregateWeather(existing.data, season, new Date(existing.at).toISOString(), existing.solarUnit), cached: true };
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), start: `${startYear}0101`, end: `${endYear}1231`, community: "AG", parameters: "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN", format: "JSON" });
    try {
        const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${query}`, { signal: AbortSignal.timeout(25000), headers: { Accept: "application/json" } });
        if (!response.ok)
            throw new Error(`NASA POWER returned HTTP ${response.status}. Try again later.`);
        const json = await response.json() as {
            properties?: {
                parameter?: Parameters;
            };
            parameters?: Record<string, {
                units?: string;
            }>;
        };
        const params = json.properties?.parameter;
        if (!params?.T2M || !params.PRECTOTCORR)
            throw new Error("NASA POWER returned incomplete data.");
        const at = Date.now();
        if (cache.size >= 100)
            cache.delete(cache.keys().next().value!);
        const solarUnit = json.parameters?.ALLSKY_SFC_SW_DWN?.units;
        cache.set(key, { at, data: params, solarUnit });
        return aggregateWeather(params, season, new Date(at).toISOString(), solarUnit);
    }
    catch (e) {
        return unavailableWeather(e instanceof Error && !e.message.includes("internal error") ? e.message : "NASA POWER could not be reached from this environment. No sample values have been substituted. Try again later.");
    }
}
