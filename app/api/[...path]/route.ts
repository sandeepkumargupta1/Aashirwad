import { analyze, sourceCatalog } from "../../../lib/analysis";
import { crops, irrigationEstimate } from "../../../lib/agronomy";
import { getHistoricalWeather } from "../../../lib/weather";
import { analysisSchema } from "../../../lib/validation";
import { z } from "zod";
import { handlePlaces } from "../../../lib/places";
async function forwardPython(request: Request, body?: string) {
    const base = process.env.PYTHON_API_BASE_URL;
    if (!base)
        return null;
    const source = new URL(request.url), target = new URL(source.pathname + source.search, base);
    const upstream = await fetch(target, { method: request.method, headers: { "Content-Type": "application/json", Accept: "application/json" }, ...(body ? { body } : {}), signal: AbortSignal.timeout(35000) });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
export async function POST(request: Request) {
    try {
        const path = new URL(request.url).pathname, raw = await request.text();
        if (raw.length > 50000)
            return Response.json({ error: "Request too large" }, { status: 413 });
        const body = JSON.parse(raw);
        const upstream = await forwardPython(request, raw);
        if (upstream)
            return upstream;
        if (path === "/api/farms/analyze" || path === "/api/crops/recommendations") {
            const d = analysisSchema.parse(body);
            return Response.json(await analyze(d.farm, d.mode));
        }
        if (path === "/api/irrigation/estimate") {
            const v = z.object({ cropId: z.string(), stage: z.number().int(), eto: z.number(), rain: z.number(), areaHa: z.number(), efficiency: z.number() }).parse(body);
            return Response.json(irrigationEstimate(v.cropId, v.stage, v.eto, v.rain, v.areaHa, v.efficiency));
        }
        if (path === "/api/yield/predict")
            return Response.json({ status: "unavailable", reason: "No evaluated crop model is deployed. No synthetic yield is returned." }, { status: 422 });
        return Response.json({ error: "Route not found" }, { status: 404 });
    }
    catch (e) {
        return Response.json({ error: e instanceof z.ZodError ? e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
    }
}
export async function GET(request: Request) {
    const places = await handlePlaces(request);
    if (places)
        return places;
    try {
        const upstream = await forwardPython(request);
        if (upstream)
            return upstream;
    }
    catch {
        return Response.json({ error: "The configured Python service is unreachable." }, { status: 503 });
    }
    const u = new URL(request.url), p = u.pathname;
    if (p === "/api/health")
        return Response.json({ status: "ok", application: "Aashirwad", version: "1.0.0" });
    if (p === "/api/sources")
        return Response.json(sourceCatalog);
    if (p === "/api/crops/recommendations")
        return Response.json({ profiles: crops, notice: "POST a farm and mode for rankings." });
    if (p === "/api/weather/historical") {
        const d = z.object({ latitude: z.coerce.number().min(6).max(38), longitude: z.coerce.number().min(68).max(98), season: z.enum(["Kharif", "Rabi", "Zaid"]).default("Rabi") }).safeParse(Object.fromEntries(u.searchParams));
        if (!d.success)
            return Response.json({ error: "Valid Indian coordinates and season required." }, { status: 400 });
        return Response.json(await getHistoricalWeather(d.data.latitude, d.data.longitude, d.data.season));
    }
    if (["/api/soil", "/api/moisture", "/api/groundwater"].includes(p))
        return Response.json({ status: "unavailable", reason: "Official regional raster/station imports are not loaded in this hosted instance. Use the Python connectors; enter field soil tests in the dashboard.", values: null });
    return Response.json({ error: "Route not found" }, { status: 404 });
}
