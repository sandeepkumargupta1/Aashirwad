export type Season = "Kharif" | "Rabi" | "Zaid";
export type Mode = "demo" | "live";
export type Water = "Rain-fed" | "Limited" | "Reliable";
export type Page = "overview" | "farm" | "soil" | "weather" | "water" | "crops" | "advisory" | "compare" | "sources";
export interface SoilTest {
    ph?: number;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    ec?: number;
    organicCarbon?: number;
    zinc?: number;
    iron?: number;
    date: string;
    lab: string;
    confirmed: boolean;
}
export interface Farm {
    name: string;
    location: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
    area: number;
    areaUnit: "acres" | "hectares";
    season: Season;
    irrigation: Water;
    irrigationSource: string;
    texture?: string;
    soilTest?: SoilTest;
    existingCrop: string;
    boundary: [
        number,
        number
    ][];
}
export interface Crop {
    id: string;
    name: string;
    hindi: string;
    family: string;
    seasons: string[];
    ph: number[];
    temp: number[];
    textures: string[];
    water: string;
    waterMm: number[];
    days: number[];
    kc: number[] | null;
    note: string;
    source: string;
}
export interface Factor {
    name: string;
    weight: number;
    value: number | null;
    detail: string;
}
export interface RankedCrop extends Crop {
    score: number | null;
    screeningScore: number;
    coverage: number;
    factors: Factor[];
    reasons: string[];
    gaps: string[];
    eligible: boolean;
}
export interface ClimateYear {
    year: number;
    rainfall: number;
    temperature: number;
    minTemperature: number;
    maxTemperature: number;
    drySpells: number;
    days: number;
    coverage: number;
}
export interface Weather {
    status: "available" | "unavailable" | "demo";
    source: string;
    resolution: string;
    fetchedAt: string | null;
    period: string;
    error?: string;
    cached?: boolean;
    years: ClimateYear[];
    monthly: {
        month: string;
        rainfall: number;
        temperature: number;
    }[];
    rainfall: number | null;
    temperature: number | null;
    humidity: number | null;
    wind: number | null;
    solar: number | null;
    solarUnit?: string;
    drySpells: number | null;
}
export interface Soil {
    ph: number | null;
    texture: string | null;
    sand: number | null;
    silt: number | null;
    clay: number | null;
    organicCarbon: number | null;
    totalNitrogen: number | null;
    cec: number | null;
    bulkDensity: number | null;
    origin: "demo" | "measured" | "mapped" | "unavailable";
    date: string | null;
}
export interface Well {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    depth: number;
    date: string;
    distance: number;
    quality: string;
}
export interface SourceStatus {
    id: string;
    name: string;
    type: string;
    status: string;
    detail: string;
    url: string;
    resolution: string;
}
export interface Analysis {
    mode: Mode;
    farm: Farm;
    analyzedAt: string;
    soil: Soil;
    weather: Weather;
    crops: RankedCrop[];
    sources: SourceStatus[];
    water: {
        moisture: number | null;
        moistureDate: string | null;
        wells: Well[];
        status: string;
    };
    yield: {
        status: "unavailable";
        reason: string;
    };
}
