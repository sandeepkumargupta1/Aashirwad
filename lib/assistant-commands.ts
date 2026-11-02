import { assistantActionSchema, type AssistantAction, type AssistantContext } from "./assistant-contract";
import { translate } from "./i18n";
import type { Page } from "./types";

const cropAliases: Record<string, string[]> = {
    soybean: ["soybean", "soya", "सोयाबीन"], chickpea: ["chickpea", "chana", "gram", "चना"], wheat: ["wheat", "गेहूं", "गेहूँ"], mustard: ["mustard", "सरसों"], maize: ["maize", "corn", "मक्का"], rice: ["rice", "paddy", "धान", "चावल"], groundnut: ["groundnut", "peanut", "मूंगफली", "मूँगफली"], cotton: ["cotton", "कपास"], millet: ["millet", "bajra", "बाजरा"],
};
export function normalizeCommand(text: string) {
    return text.normalize("NFKC").toLowerCase().replace(/[०-९]/g, d => String("०१२३४५६७८९".indexOf(d))).replace(/[“”"'!?।,]/g, " ").replace(/\s+/g, " ").trim();
}
function has(text: string, words: string[]) { return words.some(w => /[\u0900-\u097f]/.test(w) ? text.includes(w) : new RegExp(`(?:^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z])`).test(text)); }
export function mentionedCrops(text: string) { const q = normalizeCommand(text); return Object.entries(cropAliases).filter(([, aliases]) => has(q, aliases)).map(([id]) => id); }
function spokenNumber(q: string) {
    const n = q.match(/\d+(?:\.\d+)?/); if (n) return n[0];
    const words: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", एक: "1", दो: "2", तीन: "3", चार: "4", पाँच: "5", पांच: "5", छह: "6", सात: "7", आठ: "8", नौ: "9", दस: "10" };
    return Object.entries(words).find(([word]) => has(q, [word]))?.[1];
}
export function commandAction(text: string): AssistantAction | null {
    const q = normalizeCommand(text), action = (a: AssistantAction) => assistantActionSchema.parse(a);
    const change = /\b(set|change|update|switch|use|make)\b|बदल|चुन|रख|करो|करें|दर्ज|जोड़/.test(q);
    const question = /\b(what|how|why|which|explain|tell)\b|क्या|कितन|क्यों|बताओ|बताएँ|समझा|जानकारी/.test(q);
    // Negated requests never turn into a write or navigation action.
    if (/\b(do not|don t|dont|never|stop changing)\b|मत\s|न\s*बदल/.test(q)) return null;
    if (/^(stop|stop speaking|quiet|चुप|बोलना बंद करो|बोलना बंद करें)$/.test(q)) return action({ type: "stop_speech" });
    if (/\b(hindi|english)\b|हिंदी|हिन्दी|अंग्रेज़ी|अंग्रेजी/.test(q) && /language|speak|switch|हिंदी में|हिन्दी में|अंग्रेजी में|अंग्रेज़ी में|भाषा|बोल|^hindi$|^english$/.test(q)) return action({ type: "language", language: /english|अंग्रेज/.test(q) ? "en" : "hi" });
    if (/\b(close|dismiss)\b|बंद करो|बंद करें/.test(q) && /dialog|details|report|window|विवरण|रिपोर्ट|फॉर्म/.test(q)) return action({ type: "close_dialog" });
    if (/\b(help|commands|what can you do)\b|मदद|क्या कर सकते|कैसे इस्तेमाल/.test(q)) return action({ type: "read", topic: "help" });
    if (/download|export|डाउनलोड|निर्यात/.test(q)) return action({ type: "download", kind: /source|code|स्रोत कोड/.test(q) ? "source" : "report" });
    if (/save soil|confirm soil|save (?:the )?(?:lab|test)|जाँच.*सहेज|जांच.*सहेज|रिपोर्ट.*सहेज/.test(q)) return action({ type: "soil_save" });
    if (/soil test|lab report|soil health card|मिट्टी की जाँच|मिट्टी की जांच|प्रयोगशाला|मृदा स्वास्थ्य/.test(q) && /add|enter|open|जोड़|भर|खोल/.test(q)) return action({ type: "soil_open" });
    if (/\b(apply|save|use) (?:this |my |the )?field\b|खेत.*(?:सहेज|लागू|इस्तेमाल)/.test(q)) return action({ type: "apply_field" });
    if (/boundary|सीमा/.test(q) && /draw|start|finish|clear|remove|खिंच|खींच|बना|पूरा|पूरी|हटा/.test(q)) return action({ type: "boundary", operation: /clear|remove|हटा/.test(q) ? "clear" : /finish|पूरा|पूरी/.test(q) ? "finish" : "draw" });
    if (/current location|my location|locate me|near me|मेरी जगह|मेरी वर्तमान|वर्तमान लोकेशन|मेरी लोकेशन|मेरे पास/.test(q) && !question) return action({ type: "location" });
    const place = text.trim().match(/^(?:search(?: for)?|find (?:the )?(?:village|town|place)|गाँव खोजो|गांव खोजो|खोजें|खोजो)\s+(.+?)\s*[.!।]?$/i);
    if (place && place[1].trim().length >= 2) return action({ type: "search", query: place[1].trim().slice(0, 100) });
    const hindiPlace = text.trim().match(/^(.+?)\s+(?:गाँव\s+|गांव\s+)?(?:खोजो|खोजें|खोजिए)\s*[।.!]?$/);
    if (hindiPlace && hindiPlace[1].trim().length >= 2) return action({ type: "search", query: hindiPlace[1].trim().slice(0, 100) });
    if (/(?:choose|select|pick|चुन|चयन).*(?:result|place|match|option|जगह|परिणाम|विकल्प)/.test(q) || /^(?:choose|select|चुनें)\s+\d+$/.test(q)) {
        const n = spokenNumber(q) ?? (/first|पहला/.test(q) ? "1" : /second|दूसरा/.test(q) ? "2" : "");
        if (+n >= 1 && +n <= 10) return action({ type: "select_place", index: +n });
    }
    if (!question && /satellite|उपग्रह|सैटेलाइट/.test(q)) return action({ type: "map", layer: "satellite" });
    if (!question && /terrain|भूभाग/.test(q)) return action({ type: "map", layer: "terrain" });
    if (!question && /street (?:map|view)|streets|सड़क.*नक्शा|सड़कों.*नक्शा/.test(q)) return action({ type: "map", layer: "streets" });
    if (/refresh|reload data|update data|डेटा.*ताज़ा|डेटा.*ताजा|डेटा.*दोबारा/.test(q)) return action({ type: "refresh" });
    if (!question && /(?:real|live) data|वास्तविक डेटा/.test(q)) return action({ type: "mode", mode: "live" });
    if (!question && /example data|sample data|demo mode|demo data|उदाहरण डेटा|नमूना डेटा/.test(q)) return action({ type: "mode", mode: "demo" });
    if (/compare|तुलना/.test(q)) {
        const ids = mentionedCrops(q);
        return ids.length ? action({ type: "compare", cropIds: ids.slice(0, 3) as Extract<AssistantAction, { type: "compare" }>["cropIds"] }) : action({ type: "navigate", page: "compare" });
    }
    if (/low water crops|कम पानी.*फसल/.test(q)) return action({ type: "filter", filter: "water" });
    if (/all (?:9 |nine )?crops|सभी.*फसल/.test(q)) return action({ type: "filter", filter: "all" });
    const n = q.match(/\b(?:to|as)\s+(\d+(?:\.\d+)?)/)?.[1] ?? spokenNumber(q);
    if (change && !question) {
        const season = /kharif|खरीफ/.test(q) ? "Kharif" : /rabi|रबी/.test(q) ? "Rabi" : /zaid|ज़ायद|जायद/.test(q) ? "Zaid" : null;
        if (season) return action({ type: "set_farm", field: "season", value: season });
        if (/rain.?fed|rain only|no irrigation|वर्षा पर|बारिश पर|केवल बारिश/.test(q)) return action({ type: "set_farm", field: "irrigation", value: "Rain-fed" });
        if (/limited|some irrigation|सीमित|थोड़ी सिंचाई/.test(q)) return action({ type: "set_farm", field: "irrigation", value: "Limited" });
        if (/reliable|enough irrigation|पर्याप्त|नियमित पानी/.test(q)) return action({ type: "set_farm", field: "irrigation", value: "Reliable" });
        if (n && /radius|दायरा/.test(q)) return action({ type: "set_farm", field: "radiusKm", value: n });
        if (n && /size|area|acres?|hectares?|एकड़|हेक्टेयर|आकार|क्षेत्रफल/.test(q)) return action({ type: "set_farm", field: "area", value: `${n}${/hectares?|हेक्टेयर/.test(q) ? " hectares" : /acres?|एकड़/.test(q) ? " acres" : ""}` });
        if (/unit|इकाई/.test(q) && /hectare|हेक्टेयर|acre|एकड़/.test(q)) return action({ type: "set_farm", field: "areaUnit", value: /hectare|हेक्टेयर/.test(q) ? "hectares" : "acres" });
        const lab = text.match(/^(?:set (?:the )?lab(?:oratory)?(?: name)?(?: to)?|प्रयोगशाला का नाम)\s+(.+)$/i);
        if (lab) return action({ type: "soil_fill", field: "lab", value: lab[1].trim() });
        const date = text.match(/\d{4}-\d{2}-\d{2}/);
        if (date && /sample|date|तारीख|तिथि/.test(q)) return action({ type: "soil_fill", field: "date", value: date[0] });
        if (n && /ph|पीएच|पी एच/.test(q)) return action({ type: "soil_fill", field: "ph", value: n });
        if (n && /nitrogen|नाइट्रोजन|phosphorus|फास्फोरस|potassium|पोटैशियम|organic carbon|कार्बन/.test(q)) return action({ type: "soil_fill", field: /nitrogen|नाइट्रोजन/.test(q) ? "nitrogen" : /phosphorus|फास्फोरस/.test(q) ? "phosphorus" : /potassium|पोटैशियम/.test(q) ? "potassium" : "organicCarbon", value: n });
        if (n && /eto|evapotranspiration|rainfall.*scenario|effective rain|efficiency|दक्षता/.test(q)) return action({ type: "irrigation", field: /efficiency|दक्षता/.test(q) ? "efficiency" : /eto|evapotranspiration/.test(q) ? "eto" : "rain", value: n });
        const crop = mentionedCrops(q)[0];
        if (crop && /existing crop|current crop|मौजूदा फसल/.test(q)) return action({ type: "set_farm", field: "existingCrop", value: crop });
        if (crop && /irrigation crop|scenario crop|सिंचाई.*फसल/.test(q)) return action({ type: "irrigation", field: "crop", value: crop });
    }
    const open = /\b(open|show|go|take|view)\b|खोल|दिखा|जाओ|चलो/.test(q);
    const crop = mentionedCrops(q)[0];
    if (crop && !/best|which|recommend|कौन|उपयुक्त|सुझाव/.test(q) && /about|detail|why|बारे|विवरण|जानकारी|क्यों/.test(q)) return action({ type: "crop", cropId: crop as Extract<AssistantAction, { type: "crop" }>["cropId"] });
    if (/yield|harvest prediction|पैदावार|उत्पादन.*अनुमान/.test(q)) return action({ type: "read", topic: "yield" });
    if (/ph|पीएच|पी एच/.test(q) || !open && /soil|मिट्टी/.test(q)) return action({ type: "read", topic: "soil" });
    if (/rainfall|temperature|humidity|dry spells|बारिश|वर्षा|तापमान|आर्द्रता/.test(q)) return action({ type: "read", topic: "weather" });
    if (/groundwater|well depth|water table|भूजल|कुएँ|कुएं|जलस्तर/.test(q)) return action({ type: "read", topic: "water" });
    if (/how much water|irrigation estimate|irrigation plan|कितना पानी|सिंचाई.*अनुमान/.test(q)) return action({ type: "read", topic: "irrigation" });
    if (/best crop|which crops?|recommend|what can i grow|कौन.*फसल|क्या उगा|उपयुक्त.*फसल|फसल.*सुझाव/.test(q)) return action({ type: "read", topic: "crops" });
    if (/summary|read (?:this|the|my) (?:page|data)|summar|सारांश|जानकारी पढ़|पढ़कर/.test(q)) return action({ type: "read", topic: "summary" });
    const destinations: [RegExp, Page][] = [[/\bhome\b|मुख्य पृष्ठ|खेत का सारांश/, "overview"], [/my field|my farm|map|मेरा खेत|नक्शा/, "farm"], [/soil|मिट्टी/, "soil"], [/weather|climate|मौसम/, "weather"], [/farming tips|advisory|irrigation|खेती की सलाह|सिंचाई/, "advisory"], [/water|पानी|जल संसाधन/, "water"], [/crops|फसल/, "crops"], [/sources|source notes|डेटा और स्रोत|स्रोत/, "sources"]];
    if (open || q.length < 30) {
        const found = destinations.find(([pattern]) => pattern.test(q));
        if (found) return action({ type: "navigate", page: found[1] });
    }
    return null;
}
export function readFarmData(topic: Extract<AssistantAction, { type: "read" }>["topic"], c: AssistantContext, hindi: boolean): string {
    const t = (s: string) => translate(s, hindi), say = (en: string, hi: string) => hindi ? hi : en;
    const value = (n: number | null | undefined, unit = "") => n == null ? say("not available", "उपलब्ध नहीं") : `${Number(n.toFixed(1))}${unit ? " " + unit : ""}`;
    const prefix = (c.mode === "demo" ? say("Example data, not measurements of your field.\n\n", "यह उदाहरण डेटा है, आपके खेत का माप नहीं।\n\n") : "") + (c.hasUnsavedChanges ? say("These values describe the last saved analysis. Apply your field changes to refresh them.\n\n", "ये मान पिछले सहेजे हुए विश्लेषण के हैं। नए मान पाने के लिए खेत के बदलाव लागू करें।\n\n") : "");
    if (topic === "help") return say("I can open every page, switch map layers, find a village, read the available soil, weather and crop data, compare crops, fill forms and download reports. Say ‘Show satellite view’, ‘What is my soil pH?’ or ‘Change season to Kharif’. Saved changes need your confirmation.", "मैं हर पृष्ठ खोल सकता हूँ, नक्शे की परत बदल सकता हूँ, गाँव खोज सकता हूँ, मिट्टी, मौसम और फसल का उपलब्ध डेटा पढ़ सकता हूँ, फसलों की तुलना कर सकता हूँ, फॉर्म भर सकता हूँ और रिपोर्ट डाउनलोड कर सकता हूँ। बोलें: ‘उपग्रह वाला नक्शा दिखाओ’, ‘मिट्टी का पीएच कितना है?’ या ‘मौसम खरीफ करो’। सहेजे जाने वाले बदलाव की पुष्टि करनी होगी।");
    if (topic === "yield") return say("A yield estimate is not available. No evaluated yield model is deployed. I will not invent a harvest or profit prediction.", "पैदावार का अनुमान उपलब्ध नहीं है। जाँचा हुआ पैदावार मॉडल उपलब्ध नहीं है। मैं उत्पादन या लाभ का मनगढ़ंत अनुमान नहीं दूँगा।");
    if (topic === "soil") return prefix + say(`Soil pH: ${value(c.soil?.ph)}.\nTexture: ${t(c.soil?.texture ?? "Unknown")}.\nOrganic carbon: ${value(c.soil?.organicCarbon, "%")}.\n${c.soil?.origin === "measured" ? "Source: your confirmed laboratory entry." : c.mode === "demo" ? "Source: illustrative sample soil profile." : "Add your confirmed Soil Health Card for field measurements."}`, `मिट्टी का pH: ${value(c.soil?.ph)}।\nबनावट: ${t(c.soil?.texture ?? "Unknown")}।\nजैविक कार्बन: ${value(c.soil?.organicCarbon, "%")}।\n${c.soil?.origin === "measured" ? "स्रोत: प्रयोगशाला की आपकी पुष्टि की गई जानकारी।" : c.mode === "demo" ? "स्रोत: मिट्टी का उदाहरण विवरण।" : "खेत के माप के लिए पुष्टि किया हुआ मृदा स्वास्थ्य कार्ड जोड़ें।"}`);
    if (topic === "weather") return prefix + say(`Historical ${c.weather?.period ?? "seasonal"} data:\nRainfall: ${value(c.weather?.rainfall, "mm")}.\nMean temperature: ${value(c.weather?.temperature, "°C")}.\nRelative humidity: ${value(c.weather?.humidity, "%")}.\nDry spells per season: ${value(c.weather?.drySpells)}.\nThese are past seasons, not a weather forecast.`, `${t(c.weather?.period ?? "Historical seasonal mean")} का पुराना डेटा:\nवर्षा: ${value(c.weather?.rainfall, "mm")}।\nऔसत तापमान: ${value(c.weather?.temperature, "°C")}।\nसापेक्ष आर्द्रता: ${value(c.weather?.humidity, "%")}।\nहर मौसम में सूखे दौर: ${value(c.weather?.drySpells)}।\nयह पुराने मौसम का डेटा है, आने वाले मौसम का पूर्वानुमान नहीं।`);
    if (topic === "water") return prefix + say(`Water available: ${t(c.farm.irrigation)} (your setting).\nSurface moisture: ${value(c.water?.moisture)}.\nNearby well observations: ${c.water?.wellCount ?? 0}.\n${c.water?.wellCount ? `Nearest observed depth below ground: ${value(c.water.nearestWellDepth, "m")}; distance ${value(c.water.nearestWellDistance, "km")}. A nearby well does not measure your field's groundwater or borewell capacity.` : "Groundwater depth at your field is not available. A map or soil photo cannot determine it."}`, `उपलब्ध पानी: ${t(c.farm.irrigation)} (आपकी सेटिंग)।\nसतह की नमी: ${value(c.water?.moisture)}।\nपास के कुओं के अवलोकन: ${c.water?.wellCount ?? 0}।\n${c.water?.wellCount ? `पास के मापन में जमीन से नीचे गहराई: ${value(c.water.nearestWellDepth, "m")} और दूरी ${value(c.water.nearestWellDistance, "km")}। इससे आपके खेत का भूजल या बोरवेल की क्षमता नहीं मापी जाती।` : "आपके खेत में भूजल की गहराई उपलब्ध नहीं है। नक्शे या मिट्टी की तस्वीर से यह नहीं निकाली जा सकती।"}`);
    if (topic === "irrigation") return say(`Illustrative 7-day scenario:\nNet water: ${value(c.irrigation?.netMm, "mm")}.\nGross irrigation: ${value(c.irrigation?.grossMm, "mm")}.\nVolume: ${value(c.irrigation?.volumeM3, "m³")}.\nThis uses your scenario inputs. It is not a measured need or a precise irrigation schedule.`, `सात दिन का उदाहरण अनुमान:\nशुद्ध पानी: ${value(c.irrigation?.netMm, "mm")}।\nकुल सिंचाई: ${value(c.irrigation?.grossMm, "mm")}।\nपानी की मात्रा: ${value(c.irrigation?.volumeM3, "m³")}।\nयह आपकी दी जानकारी का उदाहरण है। यह खेत का मापा हुआ पानी या सटीक सिंचाई समय-सारणी नहीं है।`);
    if (topic === "sources") return c.sources.length ? c.sources.map(s => `${t(s.name)}: ${t(s.status)}`).join("\n") : say("The data has not loaded yet.", "डेटा अभी लोड नहीं हुआ है।");
    if (topic === "crops") {
        const top = c.crops.filter(crop => crop.eligible).slice(0, 3);
        return prefix + (top.length ? top.map((crop, i) => `${i + 1}. ${t(crop.name)} — ${crop.score === null ? say("more soil and climate evidence needed", "मिट्टी और जलवायु का और डेटा चाहिए") : say(`relative suitability ${crop.score}/100`, `तुलनात्मक उपयुक्तता ${crop.score}/100`)}; ${t(crop.water)} ${say("water demand", "पानी की जरूरत")}.`).join("\n") : say("No crop candidates are available yet.", "अभी फसल विकल्प उपलब्ध नहीं हैं।")) + say("\nThese scores are screening guidance, not a guaranteed yield or success probability.", "\nये अंक प्रारंभिक आकलन हैं, पैदावार की गारंटी या सफलता की संभावना नहीं।");
    }
    return prefix + say(`Season: ${t(c.farm.season)}. Field size: ${c.farm.area} ${t(c.farm.areaUnit)}. Water: ${t(c.farm.irrigation)}.\nSoil pH: ${value(c.soil?.ph)}. Historical rainfall: ${value(c.weather?.rainfall, "mm")}.\n${c.hasUnsavedChanges ? "There are unsaved field settings. " : ""}Ask about soil, past weather, crops or irrigation for more detail.`, `मौसम: ${t(c.farm.season)}। खेत का आकार: ${c.farm.area} ${t(c.farm.areaUnit)}। पानी: ${t(c.farm.irrigation)}।\nमिट्टी का pH: ${value(c.soil?.ph)}। पुरानी वर्षा: ${value(c.weather?.rainfall, "mm")}।\n${c.hasUnsavedChanges ? "खेत की कुछ सेटिंग अभी सहेजी नहीं गई हैं। " : ""}और जानकारी के लिए मिट्टी, पुराने मौसम, फसल या सिंचाई के बारे में पूछें।`);
}
