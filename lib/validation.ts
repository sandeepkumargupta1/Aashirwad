import { z } from 'zod';
const measurementKeys = ['ph', 'nitrogen', 'phosphorus', 'potassium', 'ec', 'organicCarbon', 'zinc', 'iron'] as const;
export const soilTestSchema = z.object({ ph: z.number().min(0).max(14).optional(), nitrogen: z.number().min(0).max(5000).optional(), phosphorus: z.number().min(0).max(5000).optional(), potassium: z.number().min(0).max(5000).optional(), ec: z.number().min(0).max(100).optional(), organicCarbon: z.number().min(0).max(100).optional(), zinc: z.number().min(0).max(10000).optional(), iron: z.number().min(0).max(10000).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + 'T00:00:00Z'); return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s && s <= new Date().toISOString().slice(0, 10); }, 'Enter a valid past sampling date'), lab: z.string().trim().min(1).max(200), confirmed: z.literal(true) }).refine(t => measurementKeys.some(k => t[k] !== undefined), 'Enter at least one laboratory measurement');
function validBoundary(boundary: [
    number,
    number
][]) {
    if (!boundary.length)
        return true;
    const points = boundary.length > 3 && boundary[0][0] === boundary.at(-1)![0] && boundary[0][1] === boundary.at(-1)![1] ? boundary.slice(0, -1) : boundary;
    if (points.length < 3)
        return false;
    const turn = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const area = points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (Math.abs(area) < 1e-12)
        return false;
    for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
            if (j === i + 1 || (i === 0 && j === points.length - 1))
                continue;
            const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
            if (turn(a, b, c) * turn(a, b, d) <= 0 && turn(c, d, a) * turn(c, d, b) <= 0)
                return false;
        }
    return true;
}
export const farmSchema = z.object({ name: z.string().trim().min(1).max(100), location: z.string().trim().min(1).max(150), latitude: z.number().min(6).max(38), longitude: z.number().min(68).max(98), radiusKm: z.number().min(.1).max(10), area: z.number().positive().max(10000), areaUnit: z.enum(['acres', 'hectares']), season: z.enum(['Kharif', 'Rabi', 'Zaid']), irrigation: z.enum(['Rain-fed', 'Limited', 'Reliable']), irrigationSource: z.string().max(100), texture: z.enum(['Loam', 'Clay loam', 'Sandy loam', 'Clay', 'Silt loam']).optional(), soilTest: soilTestSchema.optional(), existingCrop: z.string().max(40), boundary: z.array(z.tuple([z.number().min(6).max(38), z.number().min(68).max(98)])).max(200).refine(validBoundary, 'Draw a valid boundary with at least three points and no crossed edges') });
export const analysisSchema = z.object({ farm: farmSchema, mode: z.enum(['demo', 'live']) });
