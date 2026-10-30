"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, Line, ComposedChart } from "recharts";
import type { Weather } from "../lib/types";
export function RainChart({ weather, monthly = false }: {
    weather: Weather;
    monthly?: boolean;
}) {
    const data: {
        rainfall: number;
        month?: string;
        year?: number;
    }[] = monthly ? weather.monthly : weather.years;
    if (!data.length)
        return <div className="chart-empty">Historical data will appear here after a successful NASA POWER request.</div>;
    return <div className="chart" role="img" aria-label={monthly ? "Historical monthly rainfall in millimetres" : "Seasonal rainfall totals by year in millimetres"}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -25 }} barSize={monthly ? 22 : 40}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e8ece5"/><XAxis dataKey={monthly ? "month" : "year"} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#7b8379" }} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#92998d" }}/><Tooltip cursor={{ fill: "#f2f5ee" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e7dc", fontSize: 12 }} formatter={(v) => [`${Number(v).toFixed(1)} mm`, "Rainfall"]}/><Bar dataKey="rainfall" fill="#63886a" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div>;
}
export function TemperatureChart({ weather }: {
    weather: Weather;
}) {
    if (!weather.years.length)
        return <div className="chart-empty">Temperature trends are unavailable.</div>;
    return <div className="chart" role="img" aria-label="Seasonal mean minimum and maximum temperature in degrees Celsius"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={weather.years} margin={{ left: -25, right: 12, top: 10 }}><CartesianGrid vertical={false} stroke="#e8ece5" strokeDasharray="3 5"/><XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11 }}/><YAxis unit="°" axisLine={false} tickLine={false} tick={{ fontSize: 11 }}/><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v) => `${Number(v).toFixed(1)}°C`}/><Line dataKey="maxTemperature" name="Mean daily maximum" stroke="#c1a564" strokeWidth={2} dot={false}/><Line dataKey="temperature" name="Mean temperature" stroke="#47765b" strokeWidth={3} dot={{ r: 4 }}/><Line dataKey="minTemperature" name="Mean daily minimum" stroke="#95afbd" strokeWidth={2} dot={false}/></ComposedChart></ResponsiveContainer></div>;
}
