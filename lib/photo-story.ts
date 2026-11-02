export const STORY_DURATION = 22_000;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const fade = (time: number, start: number, end: number) => {
    const x = clamp((time - start) / (end - start));
    return x * x * (3 - 2 * x);
};
export function photoStory(elapsed: number) {
    const time = Math.max(0, Math.min(STORY_DURATION, elapsed));
    const palms = fade(time, 3000, 4600), watering = fade(time, 8600, 10600), grown = fade(time, 14200, 17200);
    const rain = clamp((time - 5400) / 1700);
    return {
        time,
        frames: [1 - palms, palms * (1 - watering), watering * (1 - grown), grown],
        opacities: [1, palms, watering, grown],
        rainY: 10 + 27 * rain * rain,
        rainOpacity: time >= 5400 && time < 7100 ? Math.min(1, (time - 5400) / 200) : 0,
        stage: time < 4600 ? 0 : time < 10600 ? 1 : time < 17200 ? 2 : 3,
        progress: time / STORY_DURATION,
    };
}
