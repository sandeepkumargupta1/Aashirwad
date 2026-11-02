import { assistantOutputSchema, parseAssistantPlan, type AssistantAction } from "./assistant-contract";
import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";
export const LOCAL_MODEL = "Qwen3-0.6B-q4f16_1-MLC";
export class LocalAssistantAI {
    private worker: Worker | null = null;
    private engine: WebWorkerMLCEngine | null = null;
    private generation = 0;
    get ready() { return !!this.engine; }
    async load(onProgress: (progress: number) => void) {
        if (this.engine) return;
        const id = ++this.generation;
        if (!(navigator as Navigator & { gpu?: unknown }).gpu) throw new Error("On-device AI needs a browser with WebGPU. Voice and typed commands still work.");
        const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
        if (id !== this.generation) throw new Error("AI loading cancelled.");
        this.worker = new Worker(new URL("./local-ai-worker.ts", import.meta.url), { type: "module" });
        try {
            const engine = await CreateWebWorkerMLCEngine(this.worker, LOCAL_MODEL, { initProgressCallback: report => { if (id === this.generation) onProgress(Math.round(report.progress * 100)); } });
            if (id !== this.generation) { this.worker?.terminate(); throw new Error("AI loading cancelled."); }
            this.engine = engine;
        } catch (error) { this.dispose(); throw error; }
    }
    async plan(message: string, hindi: boolean): Promise<AssistantAction | null> {
        if (!this.engine) return null;
        const engine = this.engine, id = this.generation;
        const timer = setTimeout(() => engine.interruptGenerate(), 30000);
        try {
            // Only intent is inferred. All numbers and evidence in answers are
            // read from the application by deterministic code, never invented.
            const reply = await engine.chat.completions.create({
                messages: [
                    { role: "system", content: `You control the Aashirwad farming website. Convert the user's English or Hindi request into one allowed action, or null if unclear. Output JSON only. No explanations or thinking. Never invent values, names, locations or approval. Questions about facts use read with topic soil/weather/water/crops/irrigation/summary/sources/yield/help. Open a page with navigate. Satellite map uses map layer satellite. Changing growing season uses set_farm field season and value Kharif/Rabi/Zaid. Field area accepts value such as "5 hectares". Water setting is Rain-fed/Limited/Reliable. Crop IDs: soybean,chickpea,wheat,mustard,maize,rice,groundnut,cotton,millet. Date is YYYY-MM-DD. Use no action for negated or unrelated requests. The selected language is ${hindi ? "Hindi" : "English"}. /no_think` },
                    { role: "user", content: message.slice(0, 600) + " /no_think" },
                ],
                temperature: 0, max_tokens: 256,
                response_format: { type: "json_object", schema: JSON.stringify(assistantOutputSchema) },
            });
            if (id !== this.generation) throw new Error("Request cancelled.");
            return parseAssistantPlan(reply.choices[0]?.message.content ?? "");
        } finally { clearTimeout(timer); }
    }
    interrupt() { this.engine?.interruptGenerate(); }
    dispose() { ++this.generation; this.engine?.interruptGenerate(); this.worker?.terminate(); this.worker = null; this.engine = null; }
}
