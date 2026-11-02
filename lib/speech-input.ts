export interface RecognitionResult { isFinal: boolean; [index: number]: { transcript: string }; }
export interface Recognizer {
    lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
    onstart: (() => void) | null; onend: (() => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
    start(): void; stop(): void; abort(): void;
}
export type SpeechHost = { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
export const speechLanguage = (hindi: boolean) => hindi ? "hi-IN" : "en-IN";
export class SpeechInput {
    private recognition: Recognizer | null = null;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private generation = 0;
    constructor(private host: SpeechHost, private callbacks: { listening: (value: boolean) => void; transcript: (text: string) => void; final: (text: string) => void; error: (code: string) => void }) { }
    get supported() { return !!(this.host.SpeechRecognition || this.host.webkitSpeechRecognition); }
    start(language: string) {
        this.stop();
        const Constructor = this.host.SpeechRecognition || this.host.webkitSpeechRecognition;
        if (!Constructor) { this.callbacks.error("unsupported"); return; }
        const id = ++this.generation, recognition = new Constructor();
        this.recognition = recognition;
        let final = false, error = false;
        const current = () => id === this.generation;
        recognition.lang = language; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
        recognition.onstart = () => { if (current()) this.callbacks.listening(true); };
        recognition.onresult = event => {
            if (!current() || final) return;
            const results = Array.from(event.results), text = results.map(r => r[0]?.transcript ?? "").join(" ").trim();
            this.callbacks.transcript(text);
            if (results.some(r => r.isFinal) && text) {
                final = true; clearTimeout(this.timer); this.callbacks.listening(false);
                try { recognition.stop(); } catch { }
                this.callbacks.final(text);
            }
        };
        recognition.onerror = event => {
            if (!current() || final || event.error === "aborted") return;
            error = true; clearTimeout(this.timer); this.callbacks.listening(false); this.callbacks.error(event.error);
        };
        recognition.onend = () => {
            if (!current()) return;
            clearTimeout(this.timer); this.callbacks.listening(false);
            if (!final && !error) this.callbacks.error("no-speech");
        };
        try {
            recognition.start();
            this.timer = setTimeout(() => { if (current()) { this.stop(); this.callbacks.error("no-speech"); } }, 20000);
        } catch { this.stop(); this.callbacks.error("unavailable"); }
    }
    stop() {
        ++this.generation; clearTimeout(this.timer);
        if (this.recognition) {
            this.recognition.onresult = this.recognition.onerror = this.recognition.onstart = this.recognition.onend = null;
            try { this.recognition.abort(); } catch { }
            this.recognition = null;
        }
        this.callbacks.listening(false);
    }
}
export function speechProblem(code: string) {
    if (["not-allowed", "service-not-allowed"].includes(code)) return "Microphone access is off. Allow it in browser settings, or type your request.";
    if (code === "audio-capture") return "No microphone was found. You can type your request.";
    if (code === "network") return "Voice recognition needs a working connection. You can type your request.";
    if (code === "no-speech") return "I did not hear a command. Tap the microphone and try again.";
    if (code === "language-not-supported") return "Voice recognition is unavailable for this language on your device. You can type instead.";
    if (code === "unsupported") return "Voice input is unavailable in this browser. You can type your request.";
    return "Voice input could not start. You can type your request.";
}
