import { z } from "zod";
import type { Analysis, Farm, Page } from "./types";

export const pages = ["overview", "farm", "soil", "weather", "water", "crops", "advisory", "compare", "sources"] as const;
export const cropIds = ["soybean", "chickpea", "wheat", "mustard", "maize", "rice", "groundnut", "cotton", "millet"] as const;
export const farmFields = ["season", "irrigation", "area", "areaUnit", "radiusKm", "existingCrop", "name", "irrigationSource"] as const;
export const soilFields = ["ph", "nitrogen", "phosphorus", "potassium", "ec", "organicCarbon", "zinc", "iron", "lab", "date"] as const;
export const irrigationFields = ["crop", "stage", "eto", "rain", "efficiency"] as const;
const actionObjects = [
    z.object({ type: z.literal("read"), topic: z.enum(["summary", "soil", "weather", "water", "crops", "irrigation", "sources", "yield", "help"]) }).strict(),
    z.object({ type: z.literal("navigate"), page: z.enum(pages) }).strict(),
    z.object({ type: z.literal("map"), layer: z.enum(["streets", "satellite", "terrain"]) }).strict(),
    z.object({ type: z.literal("language"), language: z.enum(["en", "hi"]) }).strict(),
    z.object({ type: z.literal("location") }).strict(),
    z.object({ type: z.literal("search"), query: z.string().trim().min(2).max(100) }).strict(),
    z.object({ type: z.literal("select_place"), index: z.number().int().min(1).max(10) }).strict(),
    z.object({ type: z.literal("set_farm"), field: z.enum(farmFields), value: z.string().trim().min(1).max(100) }).strict(),
    z.object({ type: z.literal("mode"), mode: z.enum(["demo", "live"]) }).strict(),
    z.object({ type: z.literal("refresh") }).strict(),
    z.object({ type: z.literal("crop"), cropId: z.enum(cropIds) }).strict(),
    z.object({ type: z.literal("compare"), cropIds: z.array(z.enum(cropIds)).min(1).max(3) }).strict(),
    z.object({ type: z.literal("filter"), filter: z.enum(["season", "water", "all"]) }).strict(),
    z.object({ type: z.literal("soil_open") }).strict(),
    z.object({ type: z.literal("soil_fill"), field: z.enum(soilFields), value: z.string().trim().min(1).max(200) }).strict(),
    z.object({ type: z.literal("soil_save") }).strict(),
    z.object({ type: z.literal("boundary"), operation: z.enum(["draw", "finish", "clear"]) }).strict(),
    z.object({ type: z.literal("irrigation"), field: z.enum(irrigationFields), value: z.string().trim().min(1).max(40) }).strict(),
    z.object({ type: z.literal("download"), kind: z.enum(["report", "source"]) }).strict(),
    z.object({ type: z.literal("apply_field") }).strict(),
    z.object({ type: z.literal("close_dialog") }).strict(),
    z.object({ type: z.literal("stop_speech") }).strict(),
] as const;
export const assistantActionSchema = z.discriminatedUnion("type", actionObjects);
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export const assistantReplySchema = z.object({ reply: z.string().trim().min(1).max(2500), action: assistantActionSchema.nullable() }).strict();
export type AssistantReply = z.infer<typeof assistantReplySchema> & { engine: "commands" | "ai" };

const nullableNumber = z.number().finite().nullable();
export const assistantContextSchema = z.object({
    page: z.enum(pages), mode: z.enum(["demo", "live"]), hasField: z.boolean(), hasUnsavedChanges: z.boolean(),
    farm: z.object({ area: z.number().positive().max(10000), areaUnit: z.enum(["acres", "hectares"]), season: z.enum(["Kharif", "Rabi", "Zaid"]), irrigation: z.enum(["Rain-fed", "Limited", "Reliable"]), existingCrop: z.string().max(40) }),
    soil: z.object({ ph: nullableNumber, texture: z.string().max(40).nullable(), organicCarbon: nullableNumber, origin: z.enum(["demo", "measured", "mapped", "unavailable"]) }).nullable(),
    weather: z.object({ rainfall: nullableNumber, temperature: nullableNumber, humidity: nullableNumber, drySpells: nullableNumber, period: z.string().max(100), status: z.enum(["available", "unavailable", "demo"]) }).nullable(),
    crops: z.array(z.object({ id: z.enum(cropIds), name: z.string().max(40), score: nullableNumber, coverage: z.number(), eligible: z.boolean(), water: z.string().max(20), days: z.array(z.number()).max(2), note: z.string().max(500), factors: z.array(z.object({ name: z.string().max(80), value: nullableNumber, detail: z.string().max(350) })).max(8) })).max(9),
    water: z.object({ moisture: nullableNumber, wellCount: z.number().int().min(0), nearestWellDepth: nullableNumber, nearestWellDistance: nullableNumber }).nullable(),
    irrigation: z.object({ netMm: nullableNumber, grossMm: nullableNumber, volumeM3: nullableNumber }).nullable(),
    sources: z.array(z.object({ id: z.string().max(30), name: z.string().max(100), status: z.string().max(50) })).max(10),
    places: z.array(z.string().max(180)).max(10),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;
// A local snapshot for factual answers. GPS coordinates, polygons, farm/person
// names, laboratory names and report files are intentionally excluded.
export function buildAssistantContext(a: Analysis | null, farm: Farm, page: Page, hasField: boolean, dirty: boolean, places: string[], irrigation: AssistantContext["irrigation"]): AssistantContext {
    return assistantContextSchema.parse({
        page, mode: a?.mode ?? "demo", hasField, hasUnsavedChanges: dirty,
        farm: { area: farm.area, areaUnit: farm.areaUnit, season: farm.season, irrigation: farm.irrigation, existingCrop: farm.existingCrop },
        soil: a ? { ph: a.soil.ph, texture: a.soil.texture, organicCarbon: a.soil.organicCarbon, origin: a.soil.origin } : null,
        weather: a ? { rainfall: a.weather.rainfall, temperature: a.weather.temperature, humidity: a.weather.humidity, drySpells: a.weather.drySpells, period: a.weather.period, status: a.weather.status } : null,
        crops: a?.crops.map(c => ({ id: c.id, name: c.name, score: c.score, coverage: c.coverage, eligible: c.eligible, water: c.water, days: c.days, note: c.note, factors: c.factors.map(f => ({ name: f.name, value: f.value, detail: f.detail })) })) ?? [],
        water: a ? { moisture: a.water.moisture, wellCount: a.water.wells.length, nearestWellDepth: a.water.wells[0]?.depth ?? null, nearestWellDistance: a.water.wells[0]?.distance ?? null } : null,
        irrigation, sources: a?.sources.map(s => ({ id: s.id, name: s.name, status: s.status })) ?? [], places: places.slice(0, 10),
    });
}
export function needsReview(action: AssistantAction) {
    return action.type === "set_farm" || action.type === "select_place" || action.type === "soil_save" || action.type === "apply_field" || action.type === "boundary" && action.operation === "clear";
}
export function farmPatch(action: Extract<AssistantAction, { type: "set_farm" }>): Partial<Farm> {
    const { field, value } = action;
    if (field === "area" || field === "radiusKm") {
        const match = value.match(/^(\d+(?:\.\d+)?)(?:\s+(acres|hectares))?$/);
        if (!match || field === "radiusKm" && match[2]) throw new Error("Enter a valid number.");
        return { [field]: Number(match[1]), ...(match[2] ? { areaUnit: match[2] as Farm["areaUnit"] } : {}) };
    }
    if (field === "season" && !["Kharif", "Rabi", "Zaid"].includes(value) || field === "irrigation" && !["Rain-fed", "Limited", "Reliable"].includes(value) || field === "areaUnit" && !["acres", "hectares"].includes(value) || field === "existingCrop" && !cropIds.includes(value as typeof cropIds[number])) throw new Error("Enter a valid value.");
    return { [field]: value };
}
// Generated from the same Zod definitions so the model and browser share one contract.
function jsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
    if (schema instanceof z.ZodObject) {
        const properties = Object.fromEntries(Object.entries(schema.shape).map(([k, s]) => [k, jsonSchema(s as z.ZodTypeAny)]));
        return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
    }
    if (schema instanceof z.ZodString) return { type: "string" };
    if (schema instanceof z.ZodNumber) return { type: schema.isInt ? "integer" : "number" };
    if (schema instanceof z.ZodLiteral) return { type: typeof schema.value, enum: [schema.value] };
    if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
    if (schema instanceof z.ZodArray) return { type: "array", items: jsonSchema(schema.element) };
    if (schema instanceof z.ZodNullable) return { anyOf: [jsonSchema(schema.unwrap()), { type: "null" }] };
    if (schema instanceof z.ZodDiscriminatedUnion) return { anyOf: schema.options.map(jsonSchema) };
    throw new Error("Unsupported assistant schema");
}
export const assistantOutputSchema = jsonSchema(z.object({ action: assistantActionSchema.nullable() }).strict());
export function parseAssistantPlan(text: string): AssistantAction | null {
    const raw = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const result = z.object({ action: assistantActionSchema.nullable() }).strict().safeParse(JSON.parse(raw));
    if (!result.success) throw new Error("The assistant could not understand that request.");
    return result.data.action;
}
