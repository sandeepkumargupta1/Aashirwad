import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyze } from "../lib/analysis";
import { defaultFarm } from "../lib/agronomy";
import { farmSchema } from "../lib/validation";
import { commandAction, normalizeCommand, readFarmData } from "../lib/assistant-commands";
import { assistantActionSchema, buildAssistantContext, farmPatch, needsReview, parseAssistantPlan } from "../lib/assistant-contract";
import { SpeechInput, speechLanguage, speechProblem, type Recognizer, type RecognitionResult } from "../lib/speech-input";
import { translate } from "../lib/i18n";

const data = await analyze(defaultFarm, "demo");
const context = buildAssistantContext(data, defaultFarm, "overview", false, false, [], { netMm: 16, grossMm: 21.3, volumeM3: 431 });

test("English and Hindi commands reach the same actual website actions", () => {
    const commands: [string[], unknown][] = [
        [["Show satellite view", "उपग्रह वाला नक्शा दिखाओ"], { type: "map", layer: "satellite" }],
        [["Open my field", "मेरा खेत खोलो"], { type: "navigate", page: "farm" }],
        [["Open soil", "मिट्टी का पृष्ठ खोलो"], { type: "navigate", page: "soil" }],
        [["Open past weather", "मौसम का पृष्ठ खोलो"], { type: "navigate", page: "weather" }],
        [["Open water", "पानी का पृष्ठ खोलो"], { type: "navigate", page: "water" }],
        [["Open crops", "फसल खोलो"], { type: "navigate", page: "crops" }],
        [["Open farming tips", "खेती की सलाह खोलो"], { type: "navigate", page: "advisory" }],
        [["Open sources", "स्रोत खोलो"], { type: "navigate", page: "sources" }],
        [["Go home", "मुख्य पृष्ठ खोलो"], { type: "navigate", page: "overview" }],
        [["What is my soil pH?", "मिट्टी का पीएच कितना है?"], { type: "read", topic: "soil" }],
        [["Read my rainfall", "मेरी वर्षा की जानकारी पढ़ो"], { type: "read", topic: "weather" }],
        [["Which crops fit my field?", "मेरे खेत के लिए कौन सी फसल ठीक है?"], { type: "read", topic: "crops" }],
        [["Change season to Kharif", "मौसम खरीफ करो"], { type: "set_farm", field: "season", value: "Kharif" }],
        [["Set field size to 5 hectares", "खेत का आकार ५ हेक्टेयर रखो"], { type: "set_farm", field: "area", value: "5 hectares" }],
        [["Compare wheat and chickpea", "गेहूँ और चना की तुलना करो"], { type: "compare", cropIds: ["chickpea", "wheat"] }],
        [["Show all 9 crops", "सभी फसलें दिखाओ"], { type: "filter", filter: "all" }],
        [["Search for Sehore", "सीहोर गाँव खोजो"], null],
    ];
    for (const [phrases, expected] of commands) {
        for (const phrase of phrases) {
            const result = commandAction(phrase);
            if (expected === null) { assert.equal(result?.type, "search", phrase); continue; }
            assert.deepEqual(result, expected, phrase);
        }
    }
    assert.equal(commandAction("Speak Hindi")?.type, "language");
    assert.deepEqual(commandAction("Speak English"), { type: "language", language: "en" });
});

test("negated and unsupported requests cannot trigger changes or arbitrary execution", () => {
    for (const command of ["Don't change season to Kharif", "Do not set area to 10 acres", "मौसम मत बदलो", "Delete every file and publish my password", "Run javascript:alert(1)"]) assert.equal(commandAction(command), null, command);
    assert.equal(normalizeCommand("  क्षेत्रफल ५.५ एकड़! "), "क्षेत्रफल 5.5 एकड़");
    assert.equal(assistantActionSchema.safeParse({ type: "navigate", page: "https://example.com" }).success, false);
    assert.equal(assistantActionSchema.safeParse({ type: "execute", code: "alert(1)" }).success, false);
    assert.equal(assistantActionSchema.safeParse({ type: "set_farm", field: "season", value: "Kharif", approved: true }).success, false);
    assert.equal(assistantActionSchema.safeParse({ type: "select_place", index: -1 }).success, false);
});

test("farm updates preserve explicit units and use the existing field validation", () => {
    const action = commandAction("Set field size to 5 hectares"); assert.equal(action?.type, "set_farm"); if (action?.type !== "set_farm") return;
    const next = { ...defaultFarm, ...farmPatch(action) };
    assert.equal(next.area, 5); assert.equal(next.areaUnit, "hectares"); assert.ok(farmSchema.safeParse(next).success);
    assert.throws(() => farmPatch({ type: "set_farm", field: "season", value: "Monsoon" }));
    assert.throws(() => farmPatch({ type: "set_farm", field: "area", value: "-20" }));
    assert.equal(farmSchema.safeParse({ ...defaultFarm, ...farmPatch({ type: "set_farm", field: "area", value: "0" }) }).success, false);
    assert.equal(needsReview(action), true);
    assert.equal(needsReview({ type: "soil_save" }), true);
    assert.equal(needsReview({ type: "boundary", operation: "clear" }), true);
    assert.equal(needsReview({ type: "apply_field" }), true);
    assert.equal(needsReview({ type: "map", layer: "satellite" }), false);
});

test("answers retain real zeros, label examples, and never invent missing measurements", () => {
    const demo = readFarmData("soil", context, false); assert.match(demo, /Example data/); assert.match(demo, new RegExp(String(data.soil.ph)));
    const live = structuredClone(context); live.mode = "live"; live.soil = { ph: null, texture: null, organicCarbon: 0, origin: "unavailable" }; live.weather = { rainfall: 0, temperature: null, humidity: null, drySpells: null, period: "2020–2024", status: "unavailable" }; live.water = null;
    assert.match(readFarmData("soil", live, false), /pH: not available/); assert.match(readFarmData("soil", live, false), /Organic carbon: 0 %/);
    const weather = readFarmData("weather", live, false); assert.match(weather, /Rainfall: 0 mm/); assert.match(weather, /temperature: not available/); assert.match(weather, /not a weather forecast/);
    assert.match(readFarmData("water", live, false), /Groundwater depth at your field is not available/);
    assert.match(readFarmData("yield", live, false), /No evaluated yield model/);
    live.hasUnsavedChanges = true; assert.match(readFarmData("soil", live, false), /last saved analysis/);
    for (const topic of ["summary", "soil", "weather", "water", "crops", "irrigation", "sources", "yield", "help"] as const) assert.match(readFarmData(topic, context, true), /[\u0900-\u097f]/, topic);
    assert.deepEqual(context.soil?.ph, data.soil.ph);
});

test("assistant context excludes precise location, personal names and lab report details", () => {
    const named = { ...defaultFarm, name: "PRIVATE FARM NAME", location: "PRIVATE ADDRESS", soilTest: { date: "2026-01-01", lab: "PRIVATE LAB NAME", confirmed: true, ph: 7 } };
    const snapshot = JSON.stringify(buildAssistantContext(data, named, "farm", true, false, [], null));
    for (const key of ["latitude", "longitude", "boundary", "PRIVATE FARM NAME", "PRIVATE ADDRESS", "PRIVATE LAB NAME"]) assert.ok(!snapshot.includes(key), key);
});

test("on-device AI output is validated as a plan and never carries approval or code", () => {
    assert.deepEqual(parseAssistantPlan('{"action":{"type":"map","layer":"satellite"}}'), { type: "map", layer: "satellite" });
    assert.equal(parseAssistantPlan('{"action":null}'), null);
    for (const raw of ['{"action":{"type":"eval","code":"bad"}}', '{"action":{"type":"soil_save","approved":true}}', '{"action":{"type":"language","language":"de"}}', 'invalid']) assert.throws(() => parseAssistantPlan(raw));
    const localSource = readFileSync("lib/local-ai.ts", "utf8");
    assert.ok(!localSource.includes("api.openai.com")); assert.ok(!localSource.includes("OPENAI_API_KEY"));
    assert.match(localSource, /CreateWebWorkerMLCEngine/);
});

class FakeRecognition implements Recognizer {
    static created: FakeRecognition[] = [];
    lang = ""; continuous = false; interimResults = false; maxAlternatives = 0;
    onstart: Recognizer["onstart"] = null; onend: Recognizer["onend"] = null; onerror: Recognizer["onerror"] = null; onresult: Recognizer["onresult"] = null;
    aborted = false; started = false;
    constructor() { FakeRecognition.created.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
    result(text: string, isFinal: boolean) { this.onresult?.({ results: [{ 0: { transcript: text }, isFinal } as RecognitionResult] }); }
}
test("speech starts only on request, uses the selected language, and submits a final once", () => {
    const final: string[] = [], interim: string[] = [], states: boolean[] = [], errors: string[] = [];
    const controller = new SpeechInput({ webkitSpeechRecognition: FakeRecognition }, { final: text => final.push(text), transcript: text => interim.push(text), listening: state => states.push(state), error: code => errors.push(code) });
    const before = FakeRecognition.created.length; assert.equal(controller.supported, true); assert.equal(FakeRecognition.created.length, before);
    controller.start(speechLanguage(true)); const hi = FakeRecognition.created.at(-1)!;
    assert.equal(hi.lang, "hi-IN"); assert.equal(hi.continuous, false); hi.result("मिट्टी", false); hi.result("मिट्टी का पीएच", true); hi.result("मिट्टी का पीएच", true);
    assert.deepEqual(final, ["मिट्टी का पीएच"]); assert.equal(interim[0], "मिट्टी"); assert.ok(states.includes(true)); assert.deepEqual(errors, []);
    controller.start(speechLanguage(false)); const en = FakeRecognition.created.at(-1)!; assert.equal(en.lang, "en-IN"); assert.equal(hi.aborted, true);
    const oldCallback = en.onresult; controller.stop(); oldCallback?.({ results: [{ 0: { transcript: "stale command" }, isFinal: true }] }); assert.equal(final.length, 1); assert.equal(en.aborted, true);
});

test("permission and device failures have localized typed-input fallbacks", () => {
    const errors: string[] = [];
    const controller = new SpeechInput({ SpeechRecognition: FakeRecognition }, { final: () => assert.fail("Must not execute a command"), transcript: () => {}, listening: () => {}, error: code => errors.push(code) });
    controller.start("en-IN"); FakeRecognition.created.at(-1)!.onerror?.({ error: "not-allowed" }); controller.stop(); assert.deepEqual(errors, ["not-allowed"]);
    for (const code of ["not-allowed", "audio-capture", "network", "no-speech", "language-not-supported", "unsupported", "unavailable"]) assert.match(translate(speechProblem(code), true), /[\u0900-\u097f]/, code);
    const unsupported = new SpeechInput({}, { final: () => {}, transcript: () => {}, listening: () => {}, error: code => errors.push(code) }); assert.equal(unsupported.supported, false); unsupported.start("hi-IN"); assert.equal(errors.at(-1), "unsupported"); unsupported.stop();
});
