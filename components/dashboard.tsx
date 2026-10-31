"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ArrowLeft, ChevronRight, ChevronDown, MapPin, LocateFixed, Leaf, Layers, LayoutDashboard, CloudSun, Droplets, Sprout, Tractor, SlidersHorizontal, ArrowLeftRight, Database, Download, RefreshCw, Check, CheckCircle2, Info, AlertTriangle, X, Plus, Upload, Menu, Globe2, Sun, FlaskConical, Waves, BookOpen, Clock, Wind, Thermometer, ScanLine, PenTool, Trash2, Save, ExternalLink, ShieldCheck, Mountain, Loader2, Search, Navigation, Map as MapIcon, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Analysis, Farm, Mode, Page, RankedCrop, SoilTest } from "../lib/types";
import { analyze, soilFor } from "../lib/analysis";
import { crops, defaultFarm, hectares, irrigationEstimate, recommend } from "../lib/agronomy";
import { farmSchema, soilTestSchema } from "../lib/validation";
import FarmMap from "./farm-map";
import LocationPanel from "./location-panel";
import { useFarmLocation } from "../hooks/use-farm-location";
import { farmAtLocation, parseFieldLocation, nearbyDistance, supportedLocation } from "../lib/location";
import type { FieldLocation, LocationFix } from "../lib/location";
import type { PlaceResult } from "../lib/places";
import CropArt from "./crop-art";
import { RainChart, TemperatureChart } from "./charts";
import { LocaleProvider, useLocale } from "./locale";
import { translate, validationMessage, errorMessage } from "../lib/i18n";
const fmt = (n: number | null | undefined, d = 0) => n === null || n === undefined ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: d });
const nav: {
    id: Page;
    label: string;
    hi: string;
    icon: LucideIcon;
}[] = [
    { id: "overview", label: "Home", hi: "खेत का सारांश", icon: LayoutDashboard },
    { id: "farm", label: "My field", hi: "मेरा खेत", icon: MapPin },
    { id: "soil", label: "My soil", hi: "मिट्टी की जाँच", icon: Layers },
    { id: "weather", label: "Past weather", hi: "मौसम और जलवायु", icon: CloudSun },
    { id: "water", label: "Water", hi: "जल संसाधन", icon: Droplets },
    { id: "crops", label: "Choose crops", hi: "फसल के सुझाव", icon: Sprout },
    { id: "advisory", label: "Farming tips", hi: "खेती की सलाह", icon: Tractor },
    { id: "compare", label: "Compare crops", hi: "फसल की तुलना", icon: ArrowLeftRight }
];
const titles: Record<Page, [
    string,
    string
]> = { overview: ["Your farming guide", "आपकी खेती का साथी"], farm: ["Find your field", "अपना खेत खोजें"], soil: ["Get to know your soil.", "अपनी मिट्टी को समझें।"], weather: ["Learn from seasons past.", "पिछले मौसम से सीखें।"], water: ["Make every drop count.", "हर बूँद का सही उपयोग।"], crops: ["Find your next good crop.", "अपने खेत के लिए सही फसल।"], advisory: ["A little planning. A better harvest.", "बेहतर योजना, बेहतर फसल।"], compare: ["Choose what works for your land.", "अपने खेत के लिए सही चुनाव।"], sources: ["Good decisions need good data.", "सही जानकारी, बेहतर निर्णय।"] };
const descriptions: Record<Page, string> = { overview: "Find your area, choose a crop, and take the next step.", farm: "We find your current area. Tap the map to choose a nearby field.", soil: "Bring together soil estimates and your own field measurements.", weather: "Explore historical rainfall and temperature. These are not forecasts.", water: "Understand surface moisture and nearby groundwater observations.", crops: "Transparent screening based on your soil, growing season and available water.", advisory: "Explore a water-balance scenario and practical next steps for your farm.", compare: "Put crop requirements and water scenarios side by side.", sources: "See exactly where each value comes from, and what is still missing." };
function Pill({ children, tone = "green" }: {
    children: React.ReactNode;
    tone?: string;
}) { const { t } = useLocale(); return <span className={`pill ${tone}`}><span className="pill-dot"/>{typeof children === "string" ? t(children) : children}</span>; }
function SectionHead({ title, sub, action }: {
    title: string;
    sub?: string;
    action?: React.ReactNode;
}) { const { t } = useLocale(); return <div className="section-head"><div><h2>{t(title)}</h2>{sub && <p>{t(sub)}</p>}</div>{action}</div>; }
function Notice({ children, kind = "info" }: {
    children: React.ReactNode;
    kind?: string;
}) { const { t } = useLocale(); return <div className={`notice ${kind}`}><Info size={17}/><div>{typeof children === "string" ? t(children) : children}</div></div>; }
function Metric({ icon: Icon, label, value, unit, caption, color = "green", onClick }: {
    icon: LucideIcon;
    label: string;
    value: string;
    unit?: string;
    caption: string;
    color?: string;
    onClick?: () => void;
}) { const { t } = useLocale(); const Tag = onClick ? "button" : "div"; return <Tag className="metric card" onClick={onClick}><div className="metric-top"><span className={`icon-box ${color}`}><Icon size={19}/></span><ArrowUpRight size={15}/></div><div className="metric-label">{t(label)}</div><div className="metric-value">{t(value)}<span>{t(unit)}</span></div><p>{t(caption)}</p></Tag>; }
function Score({ score, small = false }: {
    score: number | null;
    small?: boolean;
}) { const { t } = useLocale(); return <div className={`score ${small ? "small" : ""}`} style={{ "--score": `${score ?? 0}%` } as React.CSSProperties}><div><strong>{score === null ? "—" : score}</strong>{!small && <span>{t("out of 100")}</span>}</div></div>; }
function CropCard({ crop, index, onClick, hindi = false }: {
    crop: RankedCrop;
    index: number;
    onClick: () => void;
    hindi?: boolean;
}) { const { t } = useLocale(); return <button className="crop-card card" onClick={onClick}><div className={`crop-visual crop-bg-${crop.id}`}><span className="crop-number">0{index + 1}</span><CropArt id={crop.id}/><span className={`water-tag water-${crop.water.toLowerCase()}`}><Droplets size={12}/>{t(crop.water)}{t(" water")}</span></div><div className="crop-card-body"><div><span className="crop-family">{t(crop.family)}</span><h3>{t(hindi ? crop.hindi : crop.name)}</h3></div><Score score={crop.score} small/><p>{t(crop.eligible ? `${crop.days.join("–")} days · ${crop.seasons.join(" / ")}` : "Outside selected season")}</p><div className="crop-card-footer"><span>{t(crop.score === null ? "More data needed" : crop.eligible ? "View suitability factors" : "View seasonal limits")}</span><ArrowUpRight size={15}/></div></div></button>; }
function downloadJSON(data: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export default function Dashboard() {
    const [page, setPage] = useState<Page>("overview"), [hindi, setHindi] = useState(false), [menu, setMenu] = useState(false), [mode, setMode] = useState<Mode>("demo"), [farm, setFarm] = useState<Farm>(defaultFarm), [draft, setDraft] = useState<Farm>(defaultFarm), [analysis, setAnalysis] = useState<Analysis | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [toast, setToast] = useState(""), [drawing, setDrawing] = useState(false), [detail, setDetail] = useState<RankedCrop | null>(null), [soilModal, setSoilModal] = useState(false), [testDraft, setTestDraft] = useState<Record<string, string>>({}), [confirmed, setConfirmed] = useState(false), [soilError, setSoilError] = useState(""), [selected, setSelected] = useState(["chickpea", "wheat", "maize"]), [cropFilter, setCropFilter] = useState("season"), [eto, setEto] = useState(4), [effectiveRain, setEffectiveRain] = useState(5), [stage, setStage] = useState(2), [efficiency, setEfficiency] = useState(0.75), [irrigationCrop, setIrrigationCrop] = useState("chickpea");
    const [moreTools, setMoreTools] = useState(false), [locationChoice, setLocationChoice] = useState<FieldLocation | null>(null), [placeQuery, setPlaceQuery] = useState(""), [nearOnly, setNearOnly] = useState(true), [places, setPlaces] = useState<PlaceResult[]>([]), [searchBusy, setSearchBusy] = useState(false), [searchError, setSearchError] = useState("");
    const seq = useRef(0), fileInput = useRef<HTMLInputElement>(null);
    const farmRef = useRef(farm), selectionRef = useRef<FieldLocation | null>(null), manualChoice = useRef(false), locationGeneration = useRef(0), searchGeneration = useRef(0);
    farmRef.current = farm;
    const location = useFarmLocation(fix => {
        if (!manualChoice.current)
            void applyCurrentLocation(fix);
    });
    const t = (en: string | null | undefined, hi?: string) => translate(en, hindi, hi);
    useEffect(() => {
        let f = defaultFarm;
        try {
            const saved = localStorage.getItem("aashirwad-farm-v1");
            if (saved) {
                const parsed = farmSchema.safeParse(JSON.parse(saved));
                if (parsed.success)
                    f = parsed.data;
            }
            const field = parseFieldLocation(localStorage.getItem("aashirwad-location-v1"));
            if (field) {
                selectionRef.current = field;
                setLocationChoice(field);
                manualChoice.current = field.origin !== "gps";
            }
            setHindi(localStorage.getItem("aashirwad-language") === "hi");
        }
        catch { }
        farmRef.current = f;
        setFarm(f);
        setDraft(f);
        const request = ++seq.current;
        void analyze(f, "demo").then(value => {
            if (request === seq.current) {
                setAnalysis(value);
                setMode("demo");
            }
        });
    }, []);
    useEffect(() => { document.documentElement.lang = hindi ? "hi" : "en"; document.title = translate("Aashirwad — Grow with confidence", hindi); }, [hindi]);
    useEffect(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast(""), 4500);
        return () => clearTimeout(timer);
    }, [toast]);
    useEffect(() => {
        if (!detail && !soilModal)
            return;
        const before = document.activeElement as HTMLElement | null;
        const bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const first = () => document.querySelector<HTMLElement>(".modal button,.modal input,.modal a");
        first()?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDetail(null);
                setSoilModal(false);
            }
            if (event.key === "Tab") {
                const all = Array.from(document.querySelectorAll<HTMLElement>(".modal button:not([disabled]),.modal input:not([hidden]),.modal select,.modal a[href]"));
                const start = all[0], end = all.at(-1);
                if (event.shiftKey && document.activeElement === start) {
                    event.preventDefault();
                    end?.focus();
                }
                else if (!event.shiftKey && document.activeElement === end) {
                    event.preventDefault();
                    start?.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener("keydown", onKey); before?.focus(); };
    }, [detail, soilModal]);
    function go(p: Page) { setPage(p); if (["soil", "weather", "water", "compare"].includes(p))
        setMoreTools(true); setMenu(false); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
    async function run(f: Farm = draft, m: Mode = mode) {
        const parsed = farmSchema.safeParse(f);
        if (!parsed.success) {
            setError(validationMessage(parsed.error.issues));
            return false;
        }
        const request = ++seq.current;
        setBusy(true);
        setError("");
        setDetail(null);
        try {
            let a: Analysis;
            if (m === "demo")
                a = await analyze(parsed.data, m);
            else {
                const response = await fetch("/api/farms/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farm: parsed.data, mode: m }), signal: AbortSignal.timeout(40000) });
                const json = await response.json() as Analysis & {
                    error?: string;
                };
                if (!response.ok)
                    throw new Error(json.error || "Farm analysis failed.");
                a = json;
            }
            if (request !== seq.current)
                return false;
            setAnalysis(a);
            setFarm(parsed.data);
            setDraft(parsed.data);
            setMode(m);
            try {
                localStorage.setItem("aashirwad-farm-v1", JSON.stringify(parsed.data));
            }
            catch { }
            setToast(m === "demo" ? "Sample farm analysis updated" : "Farm analysis updated · check source availability");
            return true;
        }
        catch (e) {
            if (request === seq.current)
                setError(e instanceof Error ? e.message : "Analysis could not be completed. Please retry.");
            return false;
        }
        finally {
            if (request === seq.current)
                setBusy(false);
        }
    }
    function changeMode(m: Mode) {
        if (busy || m === mode)
            return;
        if (m === "live" && !selectionRef.current) {
            go("farm");
            setToast("Use your current location or choose your field on the map.");
            return;
        }
        void run(farm, m);
    }
    function rememberLocation(field: FieldLocation, persist = false) {
        selectionRef.current = field;
        setLocationChoice(field);
        if (persist)
            try {
                localStorage.setItem("aashirwad-location-v1", JSON.stringify(field));
            }
            catch { }
    }
    async function applyCurrentLocation(fix: LocationFix) {
        const generation = ++locationGeneration.current;
        let field: FieldLocation = { latitude: fix.latitude, longitude: fix.longitude, origin: "gps", label: "My current area", timestamp: fix.timestamp };
        rememberLocation(field);
        setDraft(farmAtLocation(farmRef.current, field));
        try {
            const params = new URLSearchParams({ latitude: String(fix.latitude), longitude: String(fix.longitude) });
            const response = await fetch(`/api/places/reverse?${params}`, { signal: AbortSignal.timeout(8500) });
            if (response.ok) {
                const data = await response.json() as {
                    label?: string;
                };
                if (data.label)
                    field = { ...field, label: data.label };
            }
        }
        catch { }
        if (generation !== locationGeneration.current || manualChoice.current)
            return;
        rememberLocation(field, true);
        const next = farmAtLocation(farmRef.current, field);
        if (farmRef.current.soilTest && !next.soilTest)
            try {
                localStorage.setItem("aashirwad-previous-farm-v1", JSON.stringify(farmRef.current));
            }
            catch { }
        setDraft(next);
        await run(next, "live");
    }
    function useCurrentLocation() { manualChoice.current = false; void location.locate(); }
    function chooseNearby() {
        if (location.position) {
            const field: FieldLocation = { ...location.position, origin: "gps", label: "Field near my current location" };
            rememberLocation(field);
            setDraft(farmAtLocation(farmRef.current, field));
        }
        go("farm");
    }
    function choosePoint(latitude: number, longitude: number, origin: FieldLocation["origin"] = "map", label?: string) {
        if (!supportedLocation(latitude, longitude)) {
            setError("Choose a field within India.");
            return;
        }
        manualChoice.current = true;
        ++locationGeneration.current;
        const field: FieldLocation = { latitude, longitude, origin, label: label ?? (location.position ? "Field selected near my location" : "My selected field"), timestamp: Date.now() };
        rememberLocation(field);
        setDraft(d => farmAtLocation(d, field));
        setSearchError("");
    }
    async function searchPlaces(event: React.FormEvent) {
        event.preventDefault();
        const query = placeQuery.trim();
        if (query.length < 2) {
            setSearchError(t("Enter a village or town name.", "गाँव या शहर का नाम लिखें।"));
            return;
        }
        const request = ++searchGeneration.current;
        setSearchBusy(true);
        setSearchError("");
        setPlaces([]);
        const params = new URLSearchParams({ q: query, nearby: String(nearOnly && !!location.position) });
        if (location.position) {
            params.set("latitude", String(location.position.latitude));
            params.set("longitude", String(location.position.longitude));
        }
        try {
            const response = await fetch(`/api/places/search?${params}`, { signal: AbortSignal.timeout(10000) });
            const data = await response.json() as {
                places?: PlaceResult[];
                error?: string;
            };
            if (request !== searchGeneration.current)
                return;
            if (!response.ok)
                throw new Error(data.error || "Place search is unavailable. Tap your field on the map instead.");
            setPlaces(data.places ?? []);
            if (!data.places?.length)
                setSearchError(nearOnly && location.position ? "No nearby match. Try searching all of India, or choose on the map." : "No matching place. Try a nearby village name or choose on the map.");
        }
        catch (error) {
            if (request === searchGeneration.current)
                setSearchError(error instanceof Error ? error.message : "Search is unavailable. You can still use the map.");
        }
        finally {
            if (request === searchGeneration.current)
                setSearchBusy(false);
        }
    }
    async function submitSelectedFarm() {
        if (drawing) {
            setError(t("Finish the field boundary first.", "पहले खेत की सीमा पूरी करें।"));
            return;
        }
        if (!selectionRef.current) {
            setError(t("Use current location, search a village, or tap the map to choose your field.", "वर्तमान जगह लें, गाँव खोजें या नक्शे पर खेत चुनें।"));
            return;
        }
        const field = { ...selectionRef.current, latitude: draft.latitude, longitude: draft.longitude, label: draft.location };
        if (farmRef.current.soilTest && !draft.soilTest)
            try {
                localStorage.setItem("aashirwad-previous-farm-v1", JSON.stringify(farmRef.current));
            }
            catch { }
        rememberLocation(field, true);
        if (await run(draft, "live"))
            go("crops");
    }
    function openSoil() {
        setSoilError("");
        setConfirmed(false);
        const x: Record<string, string> = { date: new Date().toISOString().slice(0, 10), lab: "" };
        if (farm.soilTest)
            Object.entries(farm.soilTest).forEach(([k, v]) => {
                if (k !== "confirmed")
                    x[k] = String(v);
            });
        setTestDraft(x);
        setSoilModal(true);
    }
    async function saveSoil() {
        try {
            const raw: Record<string, unknown> = { date: testDraft.date, lab: testDraft.lab, confirmed };
            for (const k of ["ph", "nitrogen", "phosphorus", "potassium", "ec", "organicCarbon", "zinc", "iron"])
                if (testDraft[k]?.trim())
                    raw[k] = Number(testDraft[k]);
            if (!["ph", "nitrogen", "phosphorus", "potassium", "ec", "organicCarbon", "zinc", "iron"].some(k => raw[k] !== undefined))
                throw new Error("Enter at least one laboratory measurement.");
            if (raw.date as string > new Date().toISOString().slice(0, 10))
                throw new Error("The sample date cannot be in the future.");
            const test = soilTestSchema.parse(raw);
            setSoilModal(false);
            await run({ ...(page === "farm" ? draft : farm), soilTest: test }, mode);
        }
        catch (e) {
            setSoilError(errorMessage(e, "Check the soil-test values."));
        }
    }
    async function importSoil(file: File) {
        try {
            if (file.size > 100000)
                throw new Error("Choose a JSON report smaller than 100 KB.");
            const x = JSON.parse(await file.text());
            const fields = ["ph", "nitrogen", "phosphorus", "potassium", "ec", "organicCarbon", "zinc", "iron", "date", "lab"];
            const values: Record<string, string> = {};
            for (const k of fields)
                if (x[k] !== undefined)
                    values[k] = String(x[k]);
            setTestDraft(d => ({ ...d, ...values }));
            setConfirmed(false);
            setSoilError("");
            setToast("Imported. Check each value and confirm before saving.");
        }
        catch (e) {
            setSoilError(errorMessage(e, "The report could not be read."));
        }
    }
    const a = analysis, w = a?.weather, top = a?.crops[0];
    const selectedMapFarm = farm;
    const dirty = JSON.stringify(draft) !== JSON.stringify(farm);
    const ranked = a?.crops ?? [];
    const visibleCrops = ranked.filter(c => cropFilter === "all" || cropFilter === "water" ? cropFilter === "water" ? c.water === "Low" && c.eligible : true : c.eligible).slice(0, cropFilter === "all" ? 9 : 5);
    const irrigation = useMemo(() => {
        try {
            return irrigationEstimate(irrigationCrop, stage, eto, effectiveRain, hectares(farm), efficiency);
        }
        catch {
            return null;
        }
    }, [irrigationCrop, stage, eto, effectiveRain, farm, efficiency]);
    const comparison = useMemo(() => a ? (["Rain-fed", "Limited", "Reliable"] as const).map(irrigation => ({ irrigation, crops: recommend({ ...farm, irrigation }, a.soil, a.weather) })) : [], [a, farm]);
    return <LocaleProvider hindi={hindi}><div className="app-shell">
  {menu && <button className="sidebar-scrim" aria-label={t("Close navigation")} onClick={() => setMenu(false)}/>}
  <aside className={`sidebar ${menu ? "open" : ""}`}>
   <button className="brand" onClick={() => go("overview")} aria-label={t("Aashirwad home")}><span className="brand-symbol"><Sprout size={30} strokeWidth={1.8}/><i /></span><span><strong>{t("Aashirwad")}<span className="brand-dot">.</span></strong><small>{t("Your farming companion", "आपकी खेती का साथी")}</small></span></button>
   <button className="farm-switch" onClick={() => go("farm")}><span className="farm-switch-icon"><MapPin size={22}/></span><span><strong>{t("My field", "मेरा खेत")}</strong><small>{t(locationChoice?.label ?? t("Find my location", "मेरी जगह खोजें"))}</small></span><ChevronDown size={15}/></button>
   <div className="nav-label">{t("YOUR WORKSPACE", "आपका कार्यक्षेत्र")}</div>
   <nav aria-label={t("Main navigation")}>{nav.filter(n => ["overview", "farm", "crops", "advisory"].includes(n.id)).map(({ id, label, hi, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => go(id)}><Icon size={22} strokeWidth={1.8}/><span>{t(label, hi)}</span>{page === id && <i />}</button>)}
   <button className="nav-item more-tools-toggle" onClick={() => setMoreTools(!moreTools)} aria-expanded={moreTools}><Layers size={21}/><span>{t("More tools", "और सुविधाएँ")}</span><ChevronDown size={15}/></button>
   {moreTools && <div className="more-tools-nav">{nav.filter(n => ["soil", "weather", "water", "compare"].includes(n.id)).map(({ id, label, hi, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => go(id)}><Icon size={20}/><span>{t(label, hi)}</span></button>)}</div>}</nav>
   <div className="sidebar-bottom"><button className={`nav-item ${page === "sources" ? "active" : ""}`} onClick={() => go("sources")}><Database size={18}/>{t("Data & sources", "डेटा और स्रोत")}<ArrowUpRight size={14}/></button><div className="sidebar-tip"><span><Leaf size={18}/>{t("Rooted in better decisions", "बेहतर निर्णय की शुरुआत")}</span><p>{t("Every insight has a source. Every field has a story.", "हर जानकारी का स्रोत। हर खेत की अपनी कहानी।")}</p><button onClick={() => go("sources")}>{t("How it works", "यह कैसे काम करता है")}<ArrowRight size={13}/></button></div><div className="profile"><span className="farmer-profile-icon"><Sprout size={24}/></span><span><strong>{t("Made for farmers", "किसानों के लिए")}</strong><small>{t("Simple steps. Clear information.", "आसान कदम। साफ जानकारी।")}</small></span></div></div>
  </aside>
  <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" onClick={() => setMenu(true)} aria-label={t("Open navigation")}><Menu size={21}/></button><span>{t("Workspace", "कार्यक्षेत्र")}</span><ChevronRight size={13}/><strong>{t(page === "sources" ? t("Data & sources", "डेटा और स्रोत") : t(nav.find(n => n.id === page)?.label ?? "", nav.find(n => n.id === page)?.hi ?? ""))}</strong></div><div className="top-actions"><div className="mode-switch" aria-label={t("Data mode")}><button className={mode === "demo" ? "selected" : ""} onClick={() => changeMode("demo")} disabled={busy}><span className="status-dot amber"/>{t("Example", "उदाहरण")}</button><button className={mode === "live" ? "selected" : ""} onClick={() => changeMode("live")} disabled={busy}><span className="status-dot"/>{t("Real data", "वास्तविक डेटा")}</button></div><button className="language-button" aria-label={hindi ? "Switch to English" : "Switch to Hindi"} onClick={() => setHindi(v => { localStorage.setItem("aashirwad-language", v ? "en" : "hi"); return !v; })}><Globe2 size={15}/>{t(hindi ? "English" : "EN / हिन्दी")}</button></div></header>
  <main className="content" id="main-content">
   <div className="page-heading"><div><div className="eyebrow"><span />{t("A LITTLE INSIGHT. A BETTER HARVEST.", "सही जानकारी। बेहतर फसल।")}</div><h1>{t(titles[page][hindi ? 1 : 0])}</h1><p>{t(hindi ? ({ overview: "आपकी जमीन, पानी और अगली फसल के लिए उपयोगी जानकारी।", farm: "नक्शे पर खेत चुनें और अपनी जानकारी भरें।", soil: "अपने खेत के माप और मिट्टी की जानकारी जोड़ें।", weather: "यह पुराने मौसम का विश्लेषण है, भविष्य का पूर्वानुमान नहीं।", water: "सतही नमी और पास के भूजल मापन को समझें।", crops: "मिट्टी, मौसम और उपलब्ध पानी के आधार पर प्रारंभिक सुझाव।", advisory: "पानी की जरूरत का अनुमान और खेती के अगले कदम।", compare: "फसलों की जरूरत और पानी के विकल्प की तुलना करें।", sources: "जानें हर मान कहाँ से आया और कौन सा डेटा बाकी है।" })[page] : descriptions[page])}</p></div><div className="heading-actions">{page === "sources" && <button className="button secondary report-button" disabled={!a || busy} onClick={() => { downloadJSON(a, "Aashirwad_Farm_Report.json"); setToast("Farm report downloaded with data sources and limitations."); }}><Download size={16}/>{t("Export report", "रिपोर्ट डाउनलोड")}</button>}<button className="button primary" disabled={busy} onClick={() => page === "farm" ? submitSelectedFarm() : go("crops")}>{busy ? <Loader2 className="spin" size={16}/> : <ScanLine size={16}/>}{t(busy ? t("Analyzing…", "विश्लेषण…") : page === "farm" ? t("Use this field", "यह खेत चुनें") : t("See crop options", "फसल विकल्प देखें"))}</button></div></div>
   {(page === "overview" || page === "farm") && <LocationPanel status={location.status} position={location.position} selected={locationChoice} onCurrent={useCurrentLocation} onMap={chooseNearby} hindi={hindi}/>}
   {page === "overview" && <div className="simple-actions">{[{ icon: Sprout, title: t("What can I grow?", "कौन सी फसल उगाऊँ?"), sub: t("Find suitable crops", "उपयुक्त फसल देखें"), target: "crops" as Page, color: "green" }, { icon: Droplets, title: t("How much water?", "कितना पानी चाहिए?"), sub: t("Plan your irrigation", "सिंचाई की योजना बनाएँ"), target: "advisory" as Page, color: "blue" }, { icon: Layers, title: t("How is my soil?", "मेरी मिट्टी कैसी है?"), sub: t("Understand your soil", "मिट्टी की जानकारी लें"), target: "soil" as Page, color: "terra" }].map(({ icon: Icon, title, sub, target, color }) => <button key={target} className="simple-action card" onClick={() => go(target)}><span className={`icon-box ${color}`}><Icon size={29}/></span><span><strong>{t(title)}</strong><small>{t(sub)}</small></span><ArrowRight size={19}/></button>)}</div>}
   <div className={`mode-banner ${mode}`}><span className="banner-icon">{mode === "demo" ? <Sun size={18}/> : <Database size={18}/>}</span><div><strong>{t(mode === "demo" ? t("Example data", "उदाहरण डेटा") : t("Live data mode", "वास्तविक डेटा मोड"))}</strong><span>{t(mode === "demo" ? t(" These sample values are not measurements of your field.", " ये नमूने आपके खेत के माप नहीं हैं।") : t(" Public climate data + your confirmed inputs. Unavailable sources stay empty.", " सार्वजनिक जलवायु डेटा और आपके माप। अनुपलब्ध डेटा खाली रहेगा।"))}</span></div><button onClick={() => mode === "demo" ? (locationChoice ? changeMode("live") : useCurrentLocation()) : go("sources")} disabled={busy}>{t(mode === "demo" ? t("Use my area", "मेरे क्षेत्र का डेटा") : t("View sources", "स्रोत देखें"))}<ArrowRight size={14}/></button></div>
   {error && <div className="error-banner" role="alert"><AlertTriangle size={18}/><span>{t(error)}</span><button aria-label={t("Dismiss error")} onClick={() => setError("")}><X size={16}/></button></div>}
   {busy && <div className="loading-panel" role="status"><Loader2 size={24} className="spin"/><div><strong>{t("Gathering the available evidence…", "उपलब्ध जानकारी जुटा रहे हैं…")}</strong><p>{t("Preparing the selected data mode. Public climate requests may take up to 30 seconds.")}</p></div></div>}
   {!a && !busy && <div className="loading-panel"><Loader2 className="spin"/>{t("Preparing your farm workspace\u2026")}</div>}
   {a && <>
    {page === "overview" && <>
     <div className="overview-hero"><section className="card farm-card"><SectionHead title={t(locationChoice ? t("Your field", "आपका खेत") : t("Example field", "उदाहरण खेत"))} sub={t(farm.location)} action={<button className="text-button" onClick={() => go("farm")}>{t("Change field", "खेत बदलें")}<ArrowUpRight size={14}/></button>}/><div className="farm-map-wrap"><FarmMap farm={selectedMapFarm} compact currentPosition={location.position}/><span className="map-name"><span className="status-dot"/>{t(locationChoice ? t("Selected field", "चुना हुआ खेत") : t("Example field", "उदाहरण खेत"))}</span><span className="map-radius">{t(farm.boundary.length >= 3 ? "Field boundary" : `${farm.radiusKm} km study radius`)}</span></div><div className="farm-meta"><div><Mountain size={16}/><span>{t(fmt(farm.area, 1))} {t(farm.areaUnit)}</span></div><div><Sun size={16}/><span>{t(farm.season)}{t(" season")}</span></div><div><Droplets size={16}/><span>{t(farm.irrigation)}{t(" water")}</span></div></div></section>
     <section className="best-match"><div className="match-label"><Sprout size={16}/>{t("A CROP WORTH EXPLORING", "एक उपयुक्त फसल विकल्प")}</div><div className="match-content"><div><span className="match-sub">{t("For your next season", "अगले मौसम के लिए")}</span><h2>{t(hindi ? top?.hindi : top?.name)}</h2><p>{t(top?.score === null ? "Add soil and climate evidence to assess this seasonal candidate." : `${farm.season} crop · ${top?.water.toLowerCase()} water demand`)}</p></div>{top && <CropArt id={top.id} large/>}</div><div className="match-score"><Score score={top?.score ?? null}/><div><strong>{t("Relative suitability", "तुलनात्मक उपयुक्तता")}</strong><span>{t(top?.score === null ? "Evidence incomplete" : "Transparent screening · not success probability")}</span><small>{top?.coverage}{t("% of configured factors available")}</small></div></div><button className="match-button" onClick={() => top && setDetail(top)}>{t("Why this crop?", "यह फसल क्यों?")}<ArrowRight size={16}/></button><div className="match-footnote">{t(mode === "demo" ? "Based on illustrative sample conditions" : "Regional and field evidence varies")} <span>✦</span></div></section></div>
     <div className="metrics-grid"><Metric icon={Layers} label={t("Soil texture", "मिट्टी की बनावट")} value={a.soil.texture ?? "Unknown"} caption={t(mode === "demo" ? "Illustrative soil profile" : "Field input / import needed")} onClick={() => go("soil")}/><Metric icon={FlaskConical} label={t("Soil pH", "मिट्टी का pH")} value={fmt(a.soil.ph, 1)} caption={t(farm.soilTest?.ph !== undefined ? "Farmer-confirmed lab result" : mode === "demo" ? "Sample value · not a soil test" : "Add your Soil Health Card")} color="terra" onClick={() => go("soil")}/><Metric icon={CloudSun} label={t("Seasonal rainfall", "मौसमी वर्षा")} value={fmt(w?.rainfall)} unit={t("mm")} caption={t("Historical seasonal mean \u00B7 5 seasons")} color="blue" onClick={() => go("weather")}/><Metric icon={Droplets} label={t("Water availability", "पानी की उपलब्धता")} value={farm.irrigation} caption={t("Provided by you \u00B7 not a groundwater estimate")} color="gold" onClick={() => go("water")}/></div>
     <section className="crop-section"><SectionHead title={t("Good possibilities for your land", "आपके खेत के लिए अच्छे विकल्प")} sub={t("Start with the crops that fit your season", "अपने मौसम के अनुसार फसल चुनें")} action={<button className="text-button" onClick={() => go("crops")}>{t("All recommendations", "सभी सुझाव")}<ArrowRight size={15}/></button>}/><div className="crop-grid">{ranked.filter(c => c.eligible).slice(0, 3).map((c, i) => <CropCard key={c.id} crop={c} index={i} onClick={() => setDetail(c)} hindi={hindi}/>)}</div></section>
     <details className="home-details"><summary><CloudSun size={20}/>{t("More about soil and past weather", "मिट्टी और पिछले मौसम की और जानकारी")}<ChevronDown size={17}/></summary>     <div className="two-col overview-bottom"><section className="card chart-card"><SectionHead title={t("A look at the past seasons", "पिछले मौसम की एक झलक")} sub={t(`${farm.season} rainfall · ${w?.period}`)} action={<span className="chart-unit">{t("mm / season")}</span>}/><RainChart weather={a.weather}/><div className="chart-footer"><span className="legend-dot"/>{t(mode === "demo" ? "Sample rainfall records" : "NASA POWER historical rainfall")}<button onClick={() => go("weather")}>{t("Explore climate", "जलवायु देखें")}<ArrowRight size={13}/></button></div></section><section className="card next-steps"><SectionHead title={t("Your next best steps", "आपके अगले कदम")} sub={t("Small actions for a more informed season", "सही निर्णय के लिए छोटे कदम")}/>{[{ icon: FlaskConical, title: t("Start with a soil test", "मिट्टी की जाँच जोड़ें"), body: farm.soilTest?.confirmed ? "Soil test added. Keep the sample date current." : "Confirm field pH and available nutrients.", action: openSoil, done: !!farm.soilTest?.confirmed }, { icon: Sprout, title: t("Explore crop options", "फसल विकल्प देखें"), body: "See the factors behind every crop score.", action: () => go("crops"), done: false }, { icon: Droplets, title: t("Plan your water budget", "पानी की योजना बनाएं"), body: "Compare an indicative irrigation scenario.", action: () => go("advisory"), done: false }].map(({ icon: Icon, title, body, action, done }, i) => <button className="step-row" key={i} onClick={action}><span className={`step-icon ${done ? "done" : ""}`}>{done ? <Check size={18}/> : <Icon size={18}/>}</span><span><strong>{t(title)}</strong><small>{t(body)}</small></span><ChevronRight size={16}/></button>)}</section></div>
            </details>
    </>}
    {page === "farm" && <div className="farm-layout simple-farm-layout"><section className="card field-panel">
      <SectionHead title={t("Tap the map to choose your field", "नक्शे पर अपना खेत चुनें")} sub={t(location.position ? t("The map is centered near you. Move it to find your field.", "नक्शा आपके पास खुला है। अपना खेत खोजने के लिए इसे खिसकाएँ।") : t("Search a village, or zoom in and tap your field.", "गाँव खोजें या नक्शा बड़ा करके खेत पर टैप करें।"))} action={<button className="button secondary small-button" onClick={useCurrentLocation} disabled={location.status === "finding"}><LocateFixed size={19}/>{t("Near me", "मेरे पास")}</button>}/>
      <form className="place-search" onSubmit={searchPlaces}><label htmlFor="place-search-input">{t("Search a village or town", "गाँव या शहर खोजें")}</label><div className="place-search-input"><Search size={20}/><input id="place-search-input" type="search" placeholder={t("Village or town name…", "गाँव या शहर का नाम…")} value={placeQuery} maxLength={100} onChange={e => { setPlaceQuery(e.target.value); ++searchGeneration.current; setSearchBusy(false); setPlaces([]); setSearchError(""); }}/><button type="submit" className="button primary" disabled={searchBusy}>{searchBusy ? <Loader2 className="spin" size={18}/> : <Search size={18}/>} {t("Search", "खोजें")}</button></div>{location.position && <label className="nearby-search-check"><input type="checkbox" checked={nearOnly} onChange={e => { setNearOnly(e.target.checked); setPlaces([]); }}/>{t("Search near my current location (about 50 km)", "मेरी वर्तमान जगह के आस-पास खोजें (लगभग 50 किमी)")}</label>}
      </form>
      {searchError && <p className="place-search-error" role="status"><Info size={17}/>{t(searchError)}</p>}
      {!!places.length && <div className="place-results" aria-label={t("Place search results")}>{places.map(place => <button type="button" key={place.id} onClick={() => { choosePoint(place.latitude, place.longitude, "search", place.name); setPlaces([]); setPlaceQuery(place.name); }}><MapPin size={22}/><span><strong>{t(place.name)}</strong><small>{t(place.address)}</small></span><span className="place-distance">{t(place.distanceKm !== null ? `${fmt(place.distanceKm, 1)} km` : "")}<ChevronRight size={18}/></span></button>)}<p>{t("\u00A9 OpenStreetMap contributors")}</p></div>}
      <div className="easy-map"><FarmMap farm={draft} draw={drawing} currentPosition={location.position} overview={!locationChoice && !location.position} onPick={(lat, lng) => drawing ? setDraft(d => ({ ...d, boundary: [...d.boundary, [lat, lng]] })) : choosePoint(lat, lng)}/><div className="map-tap-hint"><MapPin size={17}/>{t(drawing ? t("Tap each corner of your field", "खेत के हर कोने पर टैप करें") : t("Tap your field to put the green pin there", "अपने खेत पर टैप करके हरा निशान लगाएँ"))}</div></div>
      <div className="field-selection-summary"><span className="field-selected-icon"><MapPin size={24}/></span><div><strong>{t(locationChoice ? draft.location : t("No field selected yet", "अभी खेत नहीं चुना गया है"))}</strong><p>{t(locationChoice ? (nearbyDistance(location.position, draft) !== null ? `${fmt(nearbyDistance(location.position, draft), 1)} ${t("km from your current location", "किमी आपकी वर्तमान जगह से")}` : t("Selected on the map", "नक्शे पर चुना गया")) : t("Use your location or tap the map above.", "अपनी जगह लें या ऊपर नक्शे पर टैप करें।"))}</p></div>{locationChoice && <CheckCircle2 size={22}/>}</div>
      <details className="advanced-location"><summary><Settings2 size={17}/>{t("More map options", "नक्शे के और विकल्प")}<ChevronDown size={16}/></summary><div>
        <div className="map-tools"><button type="button" className={`button ${drawing ? "primary" : "secondary"} small-button`} onClick={() => {
                    if (drawing && draft.boundary.length < 3) {
                        setError("Tap at least three corners to finish your field boundary.");
                        return;
                    }
                    if (!drawing)
                        setDraft(d => ({ ...d, boundary: [] }));
                    setDrawing(!drawing);
                }}><PenTool size={17}/>{t(drawing ? t("Finish boundary", "सीमा पूरी करें") : t("Draw field boundary", "खेत की सीमा बनाएँ"))}</button><button type="button" className="button secondary small-button" onClick={() => { setDrawing(false); setDraft(d => ({ ...d, boundary: [] })); }}><Trash2 size={16}/>{t("Clear boundary", "सीमा हटाएँ")}</button></div>
        <div className="coordinates form-grid"><label>{t("Latitude (\u00B0 N)")}<input type="number" step="any" min="6" max="38" value={draft.latitude} onChange={e => choosePoint(+e.target.value, draft.longitude)}/></label><label>{t("Longitude (\u00B0 E)")}<input type="number" step="any" min="68" max="98" value={draft.longitude} onChange={e => choosePoint(draft.latitude, +e.target.value)}/></label></div><label className="radius-input">{t("Area to study around the field", "खेत के आस-पास का क्षेत्र")}<strong>{t(draft.radiusKm.toFixed(1))}{t(" km")}</strong><input type="range" min=".1" max="5" step=".1" value={draft.radiusKm} onChange={e => setDraft(d => ({ ...d, radiusKm: +e.target.value, boundary: [] }))}/></label><p className="advanced-map-note">{t("A study radius is different from your field size. Location does not measure field boundaries or water availability.", "अध्ययन का क्षेत्र खेत के आकार से अलग है। लोकेशन से खेत की सीमा या पानी की मात्रा नहीं मापी जाती।")}</p>
      </div></details>
    </section><form className="card farm-form easy-farm-form" onSubmit={e => { e.preventDefault(); submitSelectedFarm(); }}>
      <SectionHead title={t("A few farming details", "खेती की थोड़ी जानकारी")} sub={t("Location is automatic. Check these settings for your field.", "जगह अपने आप मिलती है। ये जानकारी अपने खेत के अनुसार रखें।")}/>
      <div className="simple-form-question"><span><Mountain size={21}/>{t("How big is your field?", "आपका खेत कितना बड़ा है?")}</span><div className="form-grid"><label>{t("Field size", "खेत का आकार")}<input required type="number" min=".01" max="10000" step=".01" value={draft.area} onChange={e => setDraft(d => ({ ...d, area: +e.target.value }))}/></label><label>{t("Unit", "इकाई")}<select value={draft.areaUnit} onChange={e => setDraft(d => ({ ...d, areaUnit: e.target.value as Farm["areaUnit"] }))}><option value="acres">{t("Acres", "एकड़")}</option><option value="hectares">{t("Hectares", "हेक्टेयर")}</option></select></label></div></div>
      <label className="simple-form-question"><span><Sun size={21}/>{t("Which growing season?", "कौन सा फसल मौसम?")}</span><select value={draft.season} onChange={e => setDraft(d => ({ ...d, season: e.target.value as Farm["season"] }))}><option value="Kharif">{t("Kharif · Rainy season", "खरीफ · बरसात")}</option><option value="Rabi">{t("Rabi · Winter season", "रबी · सर्दी")}</option><option value="Zaid">{t("Zaid · Summer season", "ज़ायद · गर्मी")}</option></select></label>
      <fieldset className="simple-water-question"><legend><Droplets size={21}/>{t("How much water can you use?", "सिंचाई के लिए कितना पानी है?")}</legend>{([{ value: "Rain-fed", label: t("Rain only", "केवल बारिश"), sub: t("No extra irrigation", "अलग से सिंचाई नहीं"), icon: CloudSun }, { value: "Limited", label: t("Some irrigation", "थोड़ा सिंचाई पानी"), sub: t("Water is limited", "पानी सीमित है"), icon: Droplets }, { value: "Reliable", label: t("Enough irrigation", "पर्याप्त सिंचाई पानी"), sub: t("A reliable water source", "पानी का भरोसेमंद स्रोत"), icon: Waves }] as const).map(({ value, label, sub, icon: Icon }) => <button type="button" key={value} aria-pressed={draft.irrigation === value} className={`water-choice ${draft.irrigation === value ? "selected" : ""}`} onClick={() => setDraft(d => ({ ...d, irrigation: value }))}><Icon size={23}/><span><strong>{t(label)}</strong><small>{t(sub)}</small></span>{draft.irrigation === value ? <CheckCircle2 size={19}/> : <span className="choice-empty-circle"/>}</button>)}</fieldset>
      <details className="optional-farm-details"><summary><Plus size={17}/>{t("Add optional details", "वैकल्पिक जानकारी जोड़ें")}<ChevronDown size={16}/></summary><div><label>{t("Farm name", "खेत का नाम")}<input maxLength={100} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}/></label><label>{t("Water source", "पानी का स्रोत")}<select value={draft.irrigationSource} onChange={e => setDraft(d => ({ ...d, irrigationSource: e.target.value }))}>{["Rainfall only", "Borewell", "Canal", "Pond", "Drip system", "Other"].map(x => <option key={x} value={x}>{t(x)}</option>)}</select></label><label>{t("Known soil type", "मिट्टी का प्रकार")}<select value={draft.texture ?? ""} onChange={e => setDraft(d => ({ ...d, texture: e.target.value || undefined }))}><option value="">{t("I don’t know yet", "अभी पता नहीं")}</option>{["Loam", "Clay loam", "Sandy loam", "Clay", "Silt loam"].map(x => <option key={x} value={x}>{t(x)}</option>)}</select></label><label>{t("Current / planned crop", "वर्तमान या अगली फसल")}<select value={draft.existingCrop} onChange={e => setDraft(d => ({ ...d, existingCrop: e.target.value }))}><option value="">{t("Not decided", "अभी तय नहीं")}</option>{crops.map(c => <option key={c.id} value={c.id}>{t(hindi ? c.hindi : c.name)}</option>)}</select></label><button className="soil-add" type="button" onClick={openSoil}><FlaskConical size={21}/><span>{t("Add a soil-test report", "मिट्टी जाँच रिपोर्ट जोड़ें")}</span><Plus size={17}/></button></div></details>
      <button className="button primary full use-field-button" disabled={busy || drawing || !locationChoice} type="submit">{busy ? <Loader2 className="spin" size={20}/> : <CheckCircle2 size={20}/>} {t("Use this field & see crops", "यह खेत चुनें और फसल देखें")}<ArrowRight size={19}/></button><p className="save-note">{t("Field size and water are your settings, not automatic measurements.", "खेत का आकार और पानी आपकी जानकारी है, अपने आप मापा नहीं जाता।")}</p>
    </form></div>}

    {page === "soil" && <>
     <div className="two-col soil-top"><section className="card soil-profile"><SectionHead title={t("Your soil profile", "आपकी मिट्टी की जानकारी")} action={<Pill tone={mode === "demo" ? "amber" : "green"}>{mode === "demo" ? "Sample values" : farm.soilTest?.confirmed ? "Farmer-confirmed" : "Awaiting input"}</Pill>}/><div className="soil-profile-main"><div className="soil-cross-section"><div /><div /><div /><div /><Sprout size={38}/><span>{t("0\u201330 cm*")}</span></div><div><span className="eyebrow">{t("TEXTURE")}</span><h2>{t(a.soil.texture ?? "Not yet known")}</h2><p>{t(a.soil.texture?.includes("Clay") ? "Finer soil textures can retain water, but drainage and field structure still need checking." : "A field texture test or authorized soil raster is needed to assess drainage and water retention.")}</p><span className="muted tiny">{t("*Illustrative layer depth; not a sampled profile.")}</span></div></div><div className="texture-composition">{[{ label: "Sand", value: a.soil.sand, color: "#d5bb88" }, { label: "Silt", value: a.soil.silt, color: "#af9672" }, { label: "Clay", value: a.soil.clay, color: "#83694d" }].map(x => <div key={x.label}><div><span><i style={{ background: x.color }}/>{t(x.label)}</span><strong>{t(fmt(x.value))}{t(x.value !== null ? "%" : "")}</strong></div><div className="progress-track"><span style={{ width: `${x.value ?? 0}%`, background: x.color }}/></div></div>)}</div><div className="card-note">{t(mode === "demo" ? "Texture fractions are sample values. Your manual texture label does not establish measured percentages." : "Texture fractions require an official mapped import or laboratory measurement.")}</div></section><section className="card ph-panel"><SectionHead title={t("Soil acidity / alkalinity", "मिट्टी की अम्लता / क्षारीयता")} sub={t(farm.soilTest?.confirmed ? `Reported lab: ${farm.soilTest.lab} · ${farm.soilTest.date}` : "Add a field test to replace estimated or missing values.")}/><div className="ph-value">{t(fmt(a.soil.ph, 1))}<span>{t("pH")}</span></div><div className="ph-scale"><div />{a.soil.ph !== null && <span style={{ left: `${a.soil.ph / 14 * 100}%` }}/>}</div><div className="ph-labels"><span>{t("Acidic \u00B7 0")}</span><span>{t("Neutral \u00B7 7")}</span><span>{t("Alkaline \u00B7 14")}</span></div><Notice>{t("pH is only one part of soil health. Lime, gypsum and fertilizer doses require a field test and local guidance.")}</Notice><button className="button primary" onClick={openSoil}><Plus size={15}/>{t("Add / update soil test", "मिट्टी की जाँच जोड़ें")}</button>{farm.soilTest && <button className="text-button remove-test" onClick={() => void run({ ...farm, soilTest: undefined })}>{t("Remove entered test")}</button>}</section></div>
     <section className="card"><SectionHead title={t("Soil properties & nutrients", "मिट्टी के गुण और पोषक तत्व")} sub={t("Total nitrogen and plant-available nitrogen are different measurements.")}/><div className="table-scroll"><table><thead><tr><th>{t("Property")}</th><th>{t("Value")}</th><th>{t("Unit")}</th><th>{t("Evidence")}</th></tr></thead><tbody>{[{ name: "Organic carbon", value: a.soil.organicCarbon, unit: "%", measured: farm.soilTest?.organicCarbon !== undefined }, { name: "Total nitrogen", value: a.soil.totalNitrogen, unit: "%", measured: false }, { name: "Available nitrogen", value: farm.soilTest?.nitrogen, unit: "kg/ha", measured: true }, { name: "Available phosphorus (elemental P)", value: farm.soilTest?.phosphorus, unit: "kg/ha", measured: true }, { name: "Available potassium (elemental K)", value: farm.soilTest?.potassium, unit: "kg/ha", measured: true }, { name: "Cation exchange capacity", value: a.soil.cec, unit: "cmol(c)/kg", measured: false }, { name: "Bulk density", value: a.soil.bulkDensity, unit: "g/cm³", measured: false }, { name: "Electrical conductivity", value: farm.soilTest?.ec, unit: "dS/m", measured: true }, { name: "Zinc", value: farm.soilTest?.zinc, unit: "mg/kg", measured: true }, { name: "Iron", value: farm.soilTest?.iron, unit: "mg/kg", measured: true }].map(x => <tr key={x.name}><td>{t(x.name)}</td><td><strong>{t(fmt(x.value, 2))}</strong></td><td>{t(x.unit)}</td><td><Pill tone={x.value === undefined || x.value === null ? "gray" : x.measured ? "green" : "amber"}>{t(x.value === undefined || x.value === null ? "Not available" : x.measured ? "Farmer-confirmed" : mode === "demo" ? "Demo sample" : "Mapped estimate")}</Pill></td></tr>)}</tbody></table></div></section><Notice>{t("No nutrient deficiency or fertilizer dose is inferred from mapped soil properties. Check the units on your Soil Health Card before entering available N, P or K.")}</Notice>
    </>}
    {page === "weather" && <>
     {w?.error && <Notice kind="warning">{t(w.error)} <button className="inline-link" onClick={() => void run(farm)}>{t("Retry data request")}</button></Notice>}
     <div className="metrics-grid"><Metric icon={CloudSun} label={t("Seasonal rainfall")} value={fmt(w?.rainfall)} unit={t("mm")} caption={t(`${farm.season} · five-season average`)}/><Metric icon={Thermometer} label={t("Mean temperature")} value={fmt(w?.temperature, 1)} unit={t("\u00B0C")} caption={t("Historical seasonal daily mean")} color="terra"/><Metric icon={Droplets} label={t("Relative humidity")} value={fmt(w?.humidity)} unit={t("%")} caption={t("Seasonal daily mean, when available")} color="blue"/><Metric icon={Sun} label={t("Dry spells / season")} value={fmt(w?.drySpells, 1)} caption={t("Runs of \u22657 days with rainfall <1 mm/day")} color="gold"/></div><div className="two-col"><section className="card chart-card"><SectionHead title={t("Rainfall across seasons")} sub={t(`${farm.season} · ${w?.period}`)}/><RainChart weather={a.weather}/></section><section className="card chart-card"><SectionHead title={t("Seasonal temperature trends")} sub={t("Mean daily maximum, mean and minimum")}/><TemperatureChart weather={a.weather}/></section></div><section className="card chart-card"><SectionHead title={t("The rhythm of a typical year")} sub={t("Monthly rainfall: mean daily rainfall \u00D7 mean calendar month length")} action={<span className="chart-unit">{t("mm / month")}</span>}/><RainChart weather={a.weather} monthly/></section><div className="two-col"><section className="card insight-card"><Wind size={22}/><h3>{t("More climate context")}</h3><p>{t("Mean wind at 2 m: ")}<strong>{t(fmt(w?.wind, 1))}{t(" m/s")}</strong></p><p>{t("Solar radiation: ")}<strong>{t(fmt(w?.solar, 1))} {t(w?.solarUnit ?? "source units unavailable")}</strong></p><p className="muted tiny">{t("These inputs alone do not establish reference evapotranspiration.")}</p></section><section className="card insight-card"><Clock size={22}/><h3>{t("Understand the time window")}</h3><p>{t("Kharif: Jun\u2013Sep. Rabi: Nov\u2013Mar, grouped by its starting year. Zaid: Mar\u2013May. These are screening windows; local calendars differ.")}</p><p className="muted tiny">{t(w?.resolution)} · {t(w?.fetchedAt ? `Retrieved ${new Date(w.fetchedAt).toLocaleString(hindi ? "hi-IN" : "en-IN")}` : mode === "demo" ? "No live retrieval in demo mode" : "No successful live retrieval")}</p></section></div><Notice>{t("Past rainfall is not a forecast. Missing values are excluded; seasonal records below 98% daily completeness are excluded. At least five qualifying seasons are needed for ranking.")}</Notice>
    </>}
    {page === "water" && <>
     <div className="two-col"><section className="card moisture-card"><SectionHead title={t("Surface soil moisture")} sub={t("ISRO EOS-04 product \u00B7 500 m")} action={<Pill tone="amber">{mode === "demo" ? "Demo sample" : "Import required"}</Pill>}/><div className="moisture-value"><span className="moisture-drop"><Droplets size={42}/></span><div><strong>{t(fmt(a.water.moisture, 1))}<small>{t(a.water.moisture !== null ? "%" : "")}</small></strong><p>{t(a.water.moistureDate ? `Illustrative observation · ${a.water.moistureDate}` : "No official product imported")}</p></div></div><Notice>{t("Surface moisture describes the upper soil layer. It is not root-zone storage, groundwater depth, or an irrigation instruction.")}</Notice></section><section className="card water-input-card"><SectionHead title={t("Your available water")} sub={t("Farmer-provided context")}/><div className="water-source-display"><Waves size={32}/><div><h2>{t(farm.irrigation)}</h2><p>{t(farm.irrigationSource)} · {t(fmt(hectares(farm), 2))}{t(" ha")}</p></div></div><p>{t("Nearby groundwater measurements cannot tell us your borewell's pumping capacity or available irrigation volume.")}</p><button className="text-button" onClick={() => go("farm")}>{t("Update irrigation details")}<ArrowRight size={15}/></button></section></div>
     <section className="card"><SectionHead title={t("Nearby groundwater observations")} sub={t("Distances are from your selected farm pin; observations belong to the stations.")} action={<Pill tone={mode === "demo" ? "amber" : "gray"}>{mode === "demo" ? "Sample stations" : "No station import"}</Pill>}/>{a.water.wells.length ? <div className="table-scroll"><table><thead><tr><th>{t("Station")}</th><th>{t("Distance")}</th><th>{t("Depth to water")}</th><th>{t("Observed on")}</th><th>{t("Quality")}</th></tr></thead><tbody>{a.water.wells.map(x => <tr key={x.id}><td><strong>{t(x.name)}</strong><small>{t(x.id)}{t(" \u00B7 illustrative coordinates")}</small></td><td>{t(fmt(x.distance, 1))}{t(" km")}</td><td>{t(fmt(x.depth, 1))}{t(" m below ground")}</td><td>{t(x.date)}</td><td>{t(x.quality)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Database size={32}/><h3>{t("Groundwater records are not loaded")}</h3><p>{t("The source project includes an official CSV import pipeline with station distances, dated water levels and quality fields.")}</p><button className="button secondary" onClick={() => go("sources")}>{t("See data requirements")}<ArrowRight size={15}/></button></div>}</section><Notice>{t("One monitoring-well observation cannot establish a seasonal trend. Import multiple dated records to assess changes. We do not estimate exact borewell depth or groundwater quantity.")}</Notice>
    </>}
    {page === "crops" && <>
     <div className="toolbar"><div className="filter-tabs"><button className={cropFilter === "season" ? "active" : ""} onClick={() => setCropFilter("season")}>{t(farm.season)}{t(" options")}</button><button className={cropFilter === "water" ? "active" : ""} onClick={() => setCropFilter("water")}><Droplets size={14}/>{t("Low water")}</button><button className={cropFilter === "all" ? "active" : ""} onClick={() => setCropFilter("all")}>{t("All 9 crops")}</button></div><button className="text-button" onClick={() => go("compare")}>{t("Compare crops")}<ArrowLeftRight size={15}/></button></div>
     {top?.score === null && <Notice kind="warning">{t("Suitability scores are withheld because soil or historical climate evidence is incomplete. These are seasonal candidates, not validated recommendations. ")}<button className="inline-link" onClick={openSoil}>{t("Add a soil test")}</button>.</Notice>}
     <div className="crop-grid">{visibleCrops.map((c, i) => <CropCard key={c.id} crop={c} index={i} onClick={() => setDetail(c)} hindi={hindi}/>)}</div>{!visibleCrops.length && <div className="card empty-state"><Sprout size={32}/><h3>{t("No profiles match this filter")}</h3><p>{t("Try all crops or select a different growing season.")}</p></div>}
     <div className="two-col"><section className="card method-card"><SectionHead title={t("A score you can understand")} sub={t("Configured weights total 100")}/><div className="weight-bar">{[{ label: "Season", n: 25, color: "#315c46" }, { label: "Water", n: 25, color: "#6f9575" }, { label: "Temperature", n: 20, color: "#a2ba92" }, { label: "Soil pH", n: 20, color: "#c4d0ad" }, { label: "Texture", n: 10, color: "#d9c58c" }].map(x => <div key={x.label} style={{ flex: x.n, background: x.color }} title={t(`${x.label}: ${x.n}%`)}/>)}</div><div className="weight-legend">{t("Season 25% \u00B7 Water 25% \u00B7 Temperature 20% \u00B7 pH 20% \u00B7 Texture 10%")}</div><p>{t("Missing factors are excluded and the remaining weights are normalized. Scores require climate evidence, soil evidence and \u226570% factor coverage. Crops outside the season are capped at 39.")}</p></section><section className="card method-card"><SectionHead title={t("What these profiles mean")}/><p>{t("These are configurable, indicative agronomic screening ranges, linked to FAO and agricultural extension references. They still need regional agronomist review before use in field decisions.")}</p><p>{t("Fertility, root-zone moisture, pumping capacity and historical local performance are not silently approximated.")}</p><button className="text-button" onClick={() => go("sources")}>{t("Read source notes")}<ArrowUpRight size={14}/></button></section></div><Notice>{t("Suitability is a relative screening score, not a probability of success, a profit estimate or a guaranteed yield. Confirm variety, sowing time, market conditions and local guidance.")}</Notice>
    </>}
    {page === "advisory" && <>
     <div className="two-col advisory-layout"><section className="card irrigation-form"><SectionHead title={t("Build a water scenario", "पानी का अनुमान लगाएं")} sub={t("Illustrative 7-day crop water balance")}/><div className="form-grid"><label>{t("Crop")}<select value={irrigationCrop} onChange={e => setIrrigationCrop(e.target.value)}>{crops.filter(c => c.kc).map(c => <option value={c.id} key={c.id}>{t(c.name)}</option>)}</select></label><label>{t("Growth stage")}<select value={stage} onChange={e => setStage(+e.target.value)}>{["Initial", "Development", "Mid-season", "Late season"].map((x, i) => <option value={i} key={i}>{t(x)}</option>)}</select></label></div><label>{t("Reference evapotranspiration, ETo (mm/day)")}<input type="number" min="0" max="15" step="0.1" value={eto} onChange={e => setEto(+e.target.value)}/><small>{t("Enter a reliable local ETo value. Default 4 is a scenario input, not a measured value.")}</small></label><label>{t("Effective rainfall over 7 days (mm)")}<input type="number" min="0" max="500" step="1" value={effectiveRain} onChange={e => setEffectiveRain(+e.target.value)}/><small>{t("Water reaching the root zone; enter an estimate from a reliable local method.")}</small></label><label>{t("Application efficiency ")}<strong>{Math.round(efficiency * 100)}%</strong><input type="range" min="0.3" max="1" step="0.05" value={efficiency} onChange={e => setEfficiency(+e.target.value)}/></label><p className="muted tiny">{t("Area: ")}{t(fmt(hectares(farm), 2))}{t(" hectares. FAO indicative crop factors; actual coefficients vary with local climate and crop cover. Rice and mustard are omitted because no reviewed coefficient is configured.")}</p></section><section className="water-result"><div className="eyebrow">{t("YOUR ILLUSTRATIVE SCENARIO")}</div><h2>{t("A weekly water")}<br />{t("balance, made clear.")}</h2>{irrigation ? <><div className="water-result-number">{t(fmt(irrigation.grossMm, 1))}<span>{t("mm / 7 days")}</span></div><p>{t("Gross water requirement under your assumptions")}</p><div className="water-result-stats"><div><span>{t("Crop ET")}</span><strong>{t(fmt(irrigation.cropEtMm, 1))}{t(" mm")}</strong></div><div><span>{t("Net deficit")}</span><strong>{t(fmt(irrigation.netMm, 1))}{t(" mm")}</strong></div><div><span>{t("For your area")}</span><strong>{t(fmt(irrigation.volumeM3))}{t(" m\u00B3")}</strong></div><div><span>{t("Crop factor Kc")}</span><strong>{irrigation.kc}</strong></div></div><p className="water-result-note">{t(irrigation.assumptions)}</p></> : <p>{t("Check your inputs. ETo must be 0\u201315 mm/day, effective rain 0\u2013500 mm and efficiency 30\u2013100%.")}</p>}</section></div>
     <section className="card yield-card"><div className="yield-icon"><Tractor size={30}/></div><div><Pill tone="gray">{t("Model not available")}</Pill><h2>{t("Yield prediction waits for evidence.")}</h2><p>{t(a.yield.reason)}{t(" No expected harvest or uncertainty range is invented.")}</p></div><button className="button secondary" onClick={() => go("sources")}>{t("View model requirements")}<ArrowUpRight size={15}/></button></section><div className="two-col"><section className="card insight-card"><Sprout size={25}/><h3>{t(crops.find(c => c.id === farm.existingCrop)?.name ?? "Crop")}{t(" field notes")}</h3><p>{t(crops.find(c => c.id === farm.existingCrop)?.note ?? "Select your existing crop in My farm for crop-specific context.")}</p><p>{t("Walk the field to check drainage, soil crusting, pests and crop establishment. A coarse satellite pixel cannot replace field observations.")}</p></section><section className="card insight-card"><FlaskConical size={25}/><h3>{t("Soil management, grounded in a test")}</h3><p>{t(a.soil.ph === null ? "Soil pH is unknown. Start with a representative field sample." : a.soil.ph < 5.5 ? "The entered pH suggests acidic soil. Discuss a laboratory lime requirement with your local adviser." : a.soil.ph > 8 ? "The entered pH is alkaline. Check EC and sodicity with a laboratory before choosing amendments." : "The entered pH falls in a broadly near-neutral range. Check crop-specific needs and confirm with a field test.")}</p><p>{t("Use locally recommended organic matter and drainage practices. Fertilizer doses must follow verified Soil Health Card guidance.")}</p><button className="text-button" onClick={openSoil}>{t("Add soil-test evidence")}<Plus size={14}/></button></section></div><Notice>{t(irrigation?.method)}{t(" No precise field irrigation schedule is produced without root-zone measurements and calibrated local assumptions.")}</Notice>
    </>}
    {page === "compare" && <>
     <section className="card compare-picker"><SectionHead title={t("Choose up to three crops")} sub={t("Compare seasonal suitability and resource requirements.")}/><div className="compare-chips">{crops.map(c => <button key={c.id} className={selected.includes(c.id) ? "chosen" : ""} onClick={() => {
                        if (selected.includes(c.id))
                            setSelected(selected.filter(x => x !== c.id));
                        else if (selected.length < 3)
                            setSelected([...selected, c.id]);
                        else
                            setToast("Select up to three crops. Remove one to add another.");
                    }}>{selected.includes(c.id) ? <Check size={14}/> : <Plus size={14}/>} {t(hindi ? c.hindi : c.name)}</button>)}</div></section>{selected.length ? <section className="card compare-table"><div className="table-scroll"><table><thead><tr><th>{t("What matters")}</th>{selected.map(id => <th key={id}><CropArt id={id}/><strong>{t(hindi ? crops.find(c => c.id === id)?.hindi : crops.find(c => c.id === id)?.name)}</strong></th>)}</tr></thead><tbody>{[{ label: "Growing seasons", get: (c: RankedCrop) => c.seasons.join(", ") }, { label: "Current suitability", get: (c: RankedCrop) => c.score === null ? "More evidence needed" : `${c.score} / 100${c.eligible ? "" : " · outside season"}` }, { label: "Water demand", get: (c: RankedCrop) => c.water }, { label: "Indicative crop ET", get: (c: RankedCrop) => `${c.waterMm.join("–")} mm / growing period` }, { label: "Crop duration", get: (c: RankedCrop) => `${c.days.join("–")} days` }, { label: "Indicative soil pH", get: (c: RankedCrop) => c.ph.join("–") }, { label: "Temperature range", get: (c: RankedCrop) => `${c.temp.join("–")}°C` }, { label: "Yield estimate", get: () => "Unavailable · no evaluated model" }].map(row => <tr key={row.label}><td>{t(row.label)}</td>{selected.map(id => <td key={id}>{t(row.get(ranked.find(c => c.id === id)!))}</td>)}</tr>)}{comparison.map(s => <tr key={s.irrigation} className="scenario-row"><td><Droplets size={13}/> {t(s.irrigation)}{t(" scenario")}</td>{selected.map(id => { const c = s.crops.find(c => c.id === id)!; return <td key={id}>{t(c.score === null ? "Insufficient evidence" : `${c.score} / 100`)}</td>; })}</tr>)}</tbody></table></div></section> : <div className="card empty-state"><ArrowLeftRight size={30}/><h3>{t("Select a crop to start comparing")}</h3></div>}<Notice>{t("Water ranges describe indicative crop evapotranspiration, not total pumped irrigation. Paddy land preparation and seepage can add substantial water. Scenarios change only the farmer's stated water category; they do not predict irrigation capacity.")}</Notice>
    </>}
    {page === "sources" && <>
     <div className="source-download"><div><BookOpen size={19}/><span><strong>{t("Build on Aashirwad")}</strong><small>{t("Complete source, Python service, setup guide and dataset import tools.")}</small></span></div><a className="button secondary" href="/Aashirwad_Source.zip" download><Download size={15}/>{t("Download source code")}</a></div><div className="source-summary"><div><Database size={22}/><strong>7</strong><span>{t("data pathways")}</span></div><div><ShieldCheck size={22}/><strong>{t(mode === "demo" ? "Demo" : "Live + gaps")}</strong><span>{t("clearly labeled evidence")}</span></div><div><BookOpen size={22}/><strong>{t("Open first")}</strong><span>{t("no paid API subscription required")}</span></div></div><div className="source-grid">{a.sources.map(s => <section className="card source-card" key={s.id}><div className="source-card-top"><span className={`source-icon source-${s.id}`}>{s.id === "nasa" ? <CloudSun size={22}/> : s.id === "shc" ? <FlaskConical size={22}/> : s.id === "isro" ? <Waves size={22}/> : <Database size={22}/>}</span><Pill tone={s.status === "Fetched" || s.status === "Farmer-confirmed" || s.status === "Cached" ? "green" : s.status === "Unavailable" ? "red" : "amber"}>{t(s.status)}</Pill></div><span className="eyebrow">{t(s.type)}</span><h2>{t(s.name)}</h2><p>{t(s.detail)}</p><div className="source-resolution"><ScanLine size={13}/>{t(s.resolution)}</div><a href={s.url} target="_blank" rel="noreferrer">{t("Official documentation")}<ArrowUpRight size={15}/></a></section>)}</div><section className="card method-card"><SectionHead title={t("How your farm becomes an insight")}/><div className="process-strip">{["Farm location", "Public data + field tests", "Validated features", "Transparent screening", "Your farming plan"].map((x, i) => <div key={x}><span>0{i + 1}</span><strong>{t(x)}</strong>{i < 4 && <ChevronRight size={16}/>}</div>)}</div><p>{t("Confirmed laboratory measurements take priority. Climate requests are cached for 24 hours. Official rasters are sampled across the farm polygon or surrounding radius in the Python service. Missing data stays missing.")}</p><p>{t("Hosted version: React/TypeScript dashboard and server routes. The downloadable source includes FastAPI, SQLite, PostGIS schema, official raster/station imports and a scikit-learn training pipeline. Those local imports and trained models are not loaded into this hosted instance.")}</p></section><Notice>{t("Free access can still require registration, attribution, usage limits or approved credentials. Check each publisher's terms. Bhoonidhi and Earth Engine may require account setup. Agronomic screening ranges require regional expert review.")}</Notice>
    </>}
    <footer className="page-footer"><span><Sprout size={14}/>{t("Aashirwad · Grow with confidence", "आशीर्वाद · भरोसे के साथ खेती")}</span><span>{t(mode === "demo" ? "Sample data · for exploration" : "Always check source coverage")}<i /> {t(farm.season)}{t(" season")}</span></footer>
   </>}
  </main></div>
  {toast && <div className="toast" role="status"><CheckCircle2 size={17}/>{t(toast)}</div>}
  {detail && <div className="modal-backdrop" onClick={e => {
                if (e.target === e.currentTarget)
                    setDetail(null);
            }}><section className="modal crop-modal" role="dialog" aria-modal="true" aria-label={t(`${detail.name} suitability details`)}><button className="modal-close icon-button" onClick={() => setDetail(null)} aria-label={t("Close crop details")}><X size={20}/></button><div className={`crop-modal-header crop-bg-${detail.id}`}><CropArt id={detail.id} large/><div><span className="eyebrow">{t(detail.family)}</span><h2>{t(hindi ? detail.hindi : detail.name)}</h2><p>{t(detail.days.join("–"))}{t(" days \u00B7 ")}{t(detail.water)}{t(" water demand")}</p></div><Score score={detail.score}/></div><div className="modal-body"><Notice>{t(mode === "demo" ? "Demo conditions · " : "")}{t("Relative suitability, not a success probability. ")}{detail.coverage}{t("% of configured factor weights are supported.")}</Notice><h3>{t("What goes into this score")}</h3>{detail.factors.map(f => <div className="factor-row" key={f.name}><div><strong>{t(f.name)}<span>{f.weight}{t("% weight")}</span></strong><p>{t(f.detail)}</p></div><div className="factor-score"><strong>{f.value === null ? "—" : Math.round(f.value)}</strong><div className="progress-track"><span style={{ width: `${f.value ?? 0}%` }}/></div></div></div>)}<h3>{t("What could change the ranking")}</h3><ul className="gap-list">{detail.gaps.map(x => <li key={x}>{t(x)}</li>)}</ul><p className="crop-note"><Leaf size={17}/>{t(detail.note)}</p><p className="muted tiny">{t("Indicative profile; regional agronomist review is pending. The source is context, not a validation of every configured threshold.")}</p><div className="modal-actions"><a className="button secondary" href={detail.source} target="_blank" rel="noreferrer">{t("Agronomic reference")}<ExternalLink size={14}/></a><button className="button primary" onClick={() => {
                if (!selected.includes(detail.id))
                    setSelected(x => [...x.slice(0, 2), detail.id]);
                setDetail(null);
                go("compare");
            }}>{t("Compare this crop")}<ArrowRight size={15}/></button></div></div></section></div>}
  {soilModal && <div className="modal-backdrop" onClick={e => {
                if (e.target === e.currentTarget)
                    setSoilModal(false);
            }}><section className="modal soil-modal" role="dialog" aria-modal="true" aria-label={t("Add Soil Health Card")}><div className="modal-title"><span className="icon-box green"><FlaskConical size={22}/></span><div><h2>{t("Add your soil-test results", "मिट्टी की जाँच के परिणाम जोड़ें")}</h2><p>{t("Enter lab measurements exactly, using the units below.")}</p></div><button className="icon-button" onClick={() => setSoilModal(false)} aria-label={t("Close soil test")}><X size={20}/></button></div><div className="modal-body"><button className="upload-area" onClick={() => fileInput.current?.click()}><Upload size={24}/><strong>{t("Import a structured JSON report")}</strong><span>{t("Review the values before saving \u00B7 PDF/OCR is not supported")}</span></button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => {
                if (e.target.files?.[0])
                    void importSoil(e.target.files[0]);
                e.target.value = "";
            }}/><button className="text-button tiny" onClick={() => downloadJSON({ date: new Date().toISOString().slice(0, 10), lab: t("Enter your laboratory", "प्रयोगशाला का नाम दर्ज करें"), ph: 7.1, nitrogen: 200, phosphorus: 20, potassium: 180, ec: 0.3, organicCarbon: 0.6 }, "Soil_Test_Example_Template.json")}>{t("Download example template")}<Download size={12}/></button><div className="form-grid"><label>{t("Laboratory name")}<input required value={testDraft.lab ?? ""} onChange={e => setTestDraft(d => ({ ...d, lab: e.target.value }))}/></label><label>{t("Sampling date")}<input type="date" required max={new Date().toISOString().slice(0, 10)} value={testDraft.date ?? ""} onChange={e => setTestDraft(d => ({ ...d, date: e.target.value }))}/></label></div><div className="form-grid soil-fields">{[{ k: "ph", label: "pH (0–14)", max: 14 }, { k: "ec", label: "EC (dS/m)", max: 100 }, { k: "nitrogen", label: "Available N (kg/ha)", max: 5000 }, { k: "phosphorus", label: "Available P (kg/ha, elemental)", max: 5000 }, { k: "potassium", label: "Available K (kg/ha, elemental)", max: 5000 }, { k: "organicCarbon", label: "Organic carbon (%)", max: 100 }, { k: "zinc", label: "Zinc (mg/kg)", max: 10000 }, { k: "iron", label: "Iron (mg/kg)", max: 10000 }].map(x => <label key={x.k}>{t(x.label)}<input type="number" min="0" max={x.max} step="0.01" placeholder={t("Not tested")} value={testDraft[x.k] ?? ""} onChange={e => setTestDraft(d => ({ ...d, [x.k]: e.target.value }))}/></label>)}</div><Notice>{t("Leave untested values blank. Do not enter P\u2082O\u2085 or K\u2082O values as elemental P or K. Imported fields are not automatically verified by this app.")}</Notice><label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>{t("I checked these values, units and sample date against my laboratory report.")}</span></label>{soilError && <div className="error-banner" role="alert">{t(soilError)}</div>}<div className="modal-actions"><button className="button secondary" onClick={() => setSoilModal(false)}>{t("Cancel")}</button><button className="button primary" disabled={!confirmed || busy} onClick={() => void saveSoil()}><Save size={15}/>{t("Confirm & save results")}</button></div></div></section></div>}
 </div></LocaleProvider>;
}
