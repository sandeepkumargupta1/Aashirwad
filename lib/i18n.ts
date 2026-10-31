import hindiMessages from "../data/translations-hi.json";

const messages: Record<string, string> = hindiMessages;
const englishMessages = Object.fromEntries(Object.entries(messages).map(([en, hi]) => [hi, en]));
export function translate(value: string | null | undefined, hindi: boolean, alternate?: string): string {
    if (!value) return value ?? "";
    const key = value.trim();
    if (!key) return value;
    const pad = (text: string) => value.slice(0, value.indexOf(key)) + text + value.slice(value.indexOf(key) + key.length);
    if (!hindi) return englishMessages[key] ? pad(englishMessages[key]) : value;
    const exact = alternate ?? messages[key];
    if (exact !== undefined) return pad(exact);
    const t = (text: string) => translate(text, true);
    const patterns: [RegExp, (...groups: string[]) => string][] = [
        [/^(Kharif|Rabi|Zaid) is a listed growing season\.$/, s => `${t(s)} इस फसल का उपयुक्त मौसम है।`],
        [/^(Kharif|Rabi|Zaid) is not a listed growing season\.$/, s => `${t(s)} इस फसल का सूचीबद्ध मौसम नहीं है।`],
        [/^Not a listed (Kharif|Rabi|Zaid) crop in these profiles\.$/, s => `इन विवरणों में यह ${t(s)} की फसल नहीं है।`],
        [/^(Rain-fed|Limited|Reliable); (low|medium|high) water demand\. Historical rain is context, not guaranteed water\.$/, (water, demand) => `${t(water)}; पानी की ${t(demand)} आवश्यकता। पुरानी वर्षा केवल संदर्भ है, पानी की गारंटी नहीं।`],
        [/^(Rain-fed|Limited|Reliable); (low|medium|high) water demand\. Rainfall is historical context\.$/, (water, demand) => `${t(water)}; पानी की ${t(demand)} आवश्यकता। वर्षा का डेटा ऐतिहासिक संदर्भ है।`],
        [/^Indicative temperature range: (.+) °C\. Five complete seasons required\.$/, range => `सांकेतिक तापमान सीमा: ${range} °C। पाँच पूरे मौसमों का डेटा चाहिए।`],
        [/^Indicative pH range: (.+)\. Add a confirmed soil test when missing\.$/, range => `सांकेतिक pH सीमा: ${range}। डेटा न हो तो पुष्टि की हुई मिट्टी जाँच जोड़ें।`],
        [/^Preferred texture labels: (.+)\.$/, soils => `पसंदीदा मिट्टी की बनावट: ${soils.split(", ").map(t).join(", ")}।`],
        [/^([\d.]+)°C seasonal mean; indicative range ([\d.–]+)°C\.$/, (mean, range) => `मौसमी औसत ${mean}°C; सांकेतिक सीमा ${range}°C।`],
        [/^pH ([\d.]+); indicative range ([\d.–]+)\.$/, (ph, range) => `pH ${ph}; सांकेतिक सीमा ${range}।`],
        [/^(.+); (compatible texture|outside preferred textures)\.$/, (soil, status) => `${t(soil)}; ${t(status)}।`],
        [/^Reported lab: (.+) · (.+)$/, (lab, date) => `जाँच प्रयोगशाला: ${lab} · ${date}`],
        [/^Retrieved (.+)$/, date => `डेटा प्राप्त हुआ: ${date}`],
        [/^Illustrative observation · (.+)$/, date => `उदाहरण का अवलोकन · ${date}`],
        [/^([\d.]+) km study radius$/, radius => `अध्ययन का दायरा ${radius} km`],
        [/^([\d.–]+) days$/, days => `${days} दिन`],
        [/^([\d.–]+) mm \/ growing period$/, water => `${water} mm / फसल अवधि`],
        [/^(.+) suitability details$/, crop => `${t(crop)} की उपयुक्तता का विवरण`],
        [/^NASA POWER (?:request )?failed.*$/i, () => "NASA POWER से डेटा नहीं मिला। फिर कोशिश करें।"],
        [/^NASA POWER returned HTTP (\d+)\. Try again later\.$/, code => `NASA POWER से HTTP ${code} त्रुटि मिली। बाद में फिर कोशिश करें।`],
        [/^Number must be greater than or equal to (.+)$/, limit => `संख्या कम से कम ${limit} होनी चाहिए`],
        [/^Number must be less than or equal to (.+)$/, limit => `संख्या अधिकतम ${limit} होनी चाहिए`],
        [/^String must contain at least (\d+) character\(s\)$/, count => `कम से कम ${count} अक्षर लिखें`],
        [/^String must contain at most (\d+) character\(s\)$/, count => `अधिकतम ${count} अक्षर लिखें`],
    ];
    for (const [pattern, format] of patterns) {
        const match = key.match(pattern);
        if (match) return pad(format(...match.slice(1)));
    }
    // Translate compound labels and data-generated captions without touching
    // their numbers, ISO dates, units, identifiers or farmer-entered text.
    const parts = key.split(/( days · | crop · | · | \/ |; |: )/);
    if (parts.length > 1) return pad(parts.map(part => ({ " days · ": " दिन · ", " crop · ": " की फसल · ", " · ": " · ", " / ": " / ", "; ": "; ", ": ": ": " }[part] ?? t(part))).join(""));
    return pad(key.replace(/\b(Kharif|Rabi|Zaid|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, word => messages[word] ?? word)
        .replace(/(\d{4}–\d{4}) sample seasons/g, "$1 के उदाहरण मौसम")
        .replace(/(\d{4}–\d{4}) seasonal start years/g, "$1 के मौसम शुरू होने के वर्ष"));
}

const fieldLabels: Record<string, string> = { name: "Farm name", location: "Farm location", latitude: "Latitude", longitude: "Longitude", area: "Field size", radiusKm: "Study radius", date: "Sampling date", lab: "Laboratory name", ph: "Soil pH", nitrogen: "Available nitrogen", phosphorus: "Available phosphorus (elemental P)", potassium: "Available potassium (elemental K)", organicCarbon: "Organic carbon", ec: "Electrical conductivity", zinc: "Zinc", iron: "Iron", boundary: "Field boundary" };
export function validationMessage(issues: { path: (string | number)[]; message: string }[]): string {
    return issues.map(issue => {
        const field = String(issue.path.at(-1) ?? "");
        const message = /^Expected |^Invalid enum|^Invalid literal/.test(issue.message) ? "Enter a valid value." : issue.message;
        return `${fieldLabels[field] ?? field}${field ? ": " : ""}${message}`;
    }).join(" · ");
}
export function errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) return validationMessage(error.issues);
    if (error instanceof SyntaxError) return "The report is not valid JSON. Check the file and try again.";
    return error instanceof Error ? error.message : fallback;
}
