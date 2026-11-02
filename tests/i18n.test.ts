import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { translate, errorMessage } from "../lib/i18n";
import { analyze } from "../lib/analysis";
import { defaultFarm, recommend } from "../lib/agronomy";
import { soilTestSchema } from "../lib/validation";
import messages from "../data/translations-hi.json";
import photos from "../data/crop-photos.json";

test("weather, map and crop-photo labels switch in both directions", () => {
    for (const text of ["Seasonal rainfall", "Mean temperature", "Relative humidity", "Dry spells / season", "Rainfall across seasons", "Seasonal temperature trends", "Mean daily maximum", "Mean daily minimum", "Jan", "Dec", "Streets", "Satellite", "Terrain", "Map layers", "Home", "My field", "My soil", "Past weather", "Water", "Choose crops", "Farming tips", ...Object.values(photos).map(photo => photo.alt)]) {
        assert.match(translate(text, true), /[\u0900-\u097f]/, text);
        assert.equal(translate(text, false), text);
    }
    assert.equal(translate("Rabi · five-season average", true), "रबी · पाँच मौसमों का औसत");
    assert.equal(translate("Rabi · 2020–2024 sample seasons", true), "रबी · 2020–2024 के उदाहरण मौसम");
    assert.equal(translate("mm", true), "mm");
    assert.equal(translate(" mm", true), " mm");
    assert.equal(translate(" Low ", true), " कम ");
    assert.equal(translate("Farmer's own village name", true), "Farmer's own village name");
});

test("crop explanations translate without changing measurements, rankings or saved identifiers", async () => {
    const analysis = await analyze(defaultFarm, "demo");
    const snapshot = JSON.stringify(analysis);
    for (const season of ["Kharif", "Rabi", "Zaid"] as const) for (const irrigation of ["Rain-fed", "Limited", "Reliable"] as const) {
        const crops = recommend({ ...defaultFarm, season, irrigation }, analysis.soil, analysis.weather);
        for (const crop of crops) {
            assert.match(translate(crop.note, true), /[\u0900-\u097f]/);
            for (const factor of crop.factors) {
                const translated = translate(factor.detail, true);
                assert.match(translated, /[\u0900-\u097f]/, factor.detail);
                assert.deepEqual(translated.match(/\d+(?:\.\d+)?/g), factor.detail.match(/\d+(?:\.\d+)?/g));
                assert.equal(translate(factor.detail, false), factor.detail);
            }
        }
    }
    assert.equal(JSON.stringify(analysis), snapshot);
    assert.equal(analysis.farm.areaUnit, "acres");
    assert.equal(analysis.farm.irrigation, "Limited");
});

test("validation messages are readable in either language instead of raw schema JSON", () => {
    const result = soilTestSchema.safeParse({ date: "2035-01-01", lab: "", ph: 20, confirmed: true });
    assert.equal(result.success, false);
    if (result.success) return;
    const english = errorMessage(result.error, "Check the soil-test values.");
    assert.ok(!english.startsWith("["));
    assert.match(english, /Soil pH/);
    const hindi = translate(english, true);
    assert.match(hindi, /मिट्टी का pH/);
    assert.match(hindi, /14/);
    assert.ok(!hindi.includes("Number must"));
    assert.match(translate(errorMessage(new SyntaxError("Unexpected token"), "Error"), true), /JSON/);
});

test("static interface text has translations and localized options keep explicit values", () => {
    const catalog: Record<string, string> = messages;
    const allowed = new Set(["English", "EN / हिन्दी"]);
    function checkText(node: ts.Expression, file: string) {
        if (ts.isStringLiteral(node)) {
            if (/[A-Za-z]{3}/.test(node.text) && !allowed.has(node.text)) assert.ok(catalog[node.text.trim()], `${file}: ${node.text}`);
        } else if (ts.isConditionalExpression(node)) {
            checkText(node.whenTrue, file); checkText(node.whenFalse, file);
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
            checkText(node.right, file);
        }
    }
    for (const file of ["components/dashboard.tsx", "components/charts.tsx", "components/location-panel.tsx", "components/farm-map.tsx", "components/crop-photo.tsx", "components/voice-assistant.tsx", "components/app-entry.tsx", "components/growth-scene.tsx"]) {
        const root = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
            if (ts.isCallExpression(node) && node.expression.getText(root) === "t" && node.arguments.length === 1) checkText(node.arguments[0], file);
            if (ts.isJsxText(node)) assert.ok(!/[A-Za-z]{3}/.test(node.text), `${file}: unlocalized JSX ${node.text}`);
            if (ts.isJsxOpeningElement(node) && node.tagName.getText(root) === "option") assert.ok(node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(root) === "value"), `${file}: option value would change with its translation`);
            ts.forEachChild(node, visit);
        }
        visit(root);
    }
});
