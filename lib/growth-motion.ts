/** A small, deterministic rig: hands drive two fixed-length arm bones. */
export type Point = { x: number; y: number };
export const GROWTH_DURATION = 20_000;
export const SEED = { x: 548, y: 548 };
const radians = Math.PI / 180;
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function ease(value: number) {
    const t = clamp(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
}
const phase = (time: number, start: number, end: number) => ease((time - start) / (end - start));
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const blend = (a: Point, b: Point, amount: number): Point => ({ x: mix(a.x, b.x, amount), y: mix(a.y, b.y, amount) });
export function rotate(point: Point, angle: number, origin: Point = { x: 0, y: 0 }): Point {
    const sin = Math.sin(angle * radians), cos = Math.cos(angle * radians);
    const x = point.x - origin.x, y = point.y - origin.y;
    return { x: origin.x + x * cos - y * sin, y: origin.y + x * sin + y * cos };
}
/** The elbow stays on the same anatomical side, including near full extension. */
export function solveArm(shoulder: Point, target: Point, upper = 77, lower = 74) {
    const dx = target.x - shoulder.x, dy = target.y - shoulder.y;
    const distance = Math.hypot(dx, dy);
    const ux = distance > 0.001 ? dx / distance : 1;
    const uy = distance > 0.001 ? dy / distance : 0;
    const reach = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, distance));
    const wrist = { x: shoulder.x + ux * reach, y: shoulder.y + uy * reach };
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const elbow = { x: shoulder.x + ux * along - uy * height, y: shoulder.y + uy * along + ux * height };
    return { shoulder, elbow, wrist, cuff: blend(elbow, wrist, 0.7) };
}
export function growthPose(elapsed: number) {
    const time = Math.max(0, Math.min(GROWTH_DURATION, elapsed)) / 1000;
    const open = phase(time, 1.8, 4.5);
    const lean = phase(time, 7.3, 10.6) * (1 - phase(time, 12, 15));
    const settle = phase(time, 12, 15);
    const breath = Math.sin(time * 1.65) * 0.6;
    const angle = 42 * lean + breath * (1 - lean);
    const shift = { x: -7 * lean, y: 5 * lean + breath * 0.5 };
    const hip = { x: 350 + shift.x, y: 420 + shift.y };
    const bodyPoint = (point: Point) => {
        const p = rotate(point, angle, { x: 350, y: 420 });
        return { x: p.x + shift.x, y: p.y + shift.y };
    };
    const nearTarget = blend(blend(blend({ x: 405, y: 312 }, { x: 449, y: 329 }, open), { x: 518, y: 409 }, lean), { x: 393, y: 427 }, settle);
    const farTarget = blend(blend(blend({ x: 413, y: 313 }, { x: 460, y: 327 }, open), { x: 528, y: 405 }, lean), { x: 415, y: 424 }, settle);
    const near = solveArm(bodyPoint({ x: 332, y: 313 }), nearTarget);
    const far = solveArm(bodyPoint({ x: 369, y: 309 }), farTarget, 74, 70);
    const pour = phase(time, 10.5, 11.3);
    const handAngle = mix(mix(-90, -5, open), 23, pour) * (1 - settle) + 65 * settle;
    const farHandAngle = mix(mix(-90, -8, open), 18, pour) * (1 - settle) + 60 * settle;
    const release = rotate({ x: 32, y: -1 }, 23);
    // The pour starts after the lean settles: its flight follows gravity to the seed.
    const pourOrigin = { x: 518 + release.x, y: 409 + release.y };
    const falling = clamp((time - 11.15) / 0.65);
    const drop = blend(pourOrigin, SEED, falling * falling);
    const rain = clamp((time - 4.8) / 1.35);
    const rainPosition = { x: 478, y: mix(87, 321, rain * rain) };
    const impact = phase(time, 11.77, 12.3);
    return {
        time, angle, shift, hip, near, far, open, lean, settle, handAngle, farHandAngle,
        bodyTransform: `translate(${shift.x} ${shift.y}) rotate(${angle} 350 420)`,
        headAngle: 7 * (1 - open) - 7 * open - 12 * lean + 4 * settle,
        rain: rainPosition,
        rainOpacity: time >= 4.8 && time < 6.15 ? Math.min(1, (time - 4.8) * 6) : 0,
        poolOpacity: phase(time, 6.1, 6.4) * (1 - phase(time, 10.9, 11.3)),
        drop,
        dropOpacity: time >= 11.15 && time < 11.8 ? 1 : 0,
        rippleScale: mix(0.15, 2.8, impact),
        rippleOpacity: time >= 11.77 && time < 12.3 ? (1 - impact) * 0.8 : 0,
        seedOpacity: 1 - phase(time, 12.2, 13.3),
        roots: phase(time, 11.9, 13.7),
        stem: phase(time, 12, 18),
        leaves: Array.from({ length: 8 }, (_, index) => phase(time, 12.9 + index * 0.47, 14.6 + index * 0.47)),
        stage: time < 4.8 ? 0 : time < 11.9 ? 1 : 2,
        stageProgress: time < 4.8 ? time / 4.8 : time < 11.9 ? (time - 4.8) / 7.1 : (time - 11.9) / 8.1,
    };
}
