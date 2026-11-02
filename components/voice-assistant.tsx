"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Info, Loader2, Mic, Send, Sparkles, Square, Volume2, X } from "lucide-react";
import { useLocale } from "./locale";
import { commandAction, normalizeCommand, readFarmData } from "../lib/assistant-commands";
import { needsReview, type AssistantAction, type AssistantContext } from "../lib/assistant-contract";
import { SpeechInput, speechLanguage, speechProblem, type SpeechHost } from "../lib/speech-input";
import type { LocalAssistantAI } from "../lib/local-ai";

type Message = { id: number; role: "user" | "assistant"; text: string; ai?: boolean };
type Pending = { action: AssistantAction; summary: string; revision: string; voice: boolean };
export default function VoiceAssistant(props: {
    context: AssistantContext; revision: string; disabled: boolean;
    preview: (action: AssistantAction) => string;
    execute: (action: AssistantAction) => Promise<string>;
}) {
    const { hindi, t } = useLocale();
    const [open, setOpen] = useState(false), [input, setInput] = useState(""), [messages, setMessages] = useState<Message[]>([]);
    const [listening, setListening] = useState(false), [voiceSupported, setVoiceSupported] = useState<boolean | null>(null), [speaking, setSpeaking] = useState(false), [voiceReplies, setVoiceReplies] = useState(true);
    const [busy, setBusy] = useState(false), [problem, setProblem] = useState(""), [pending, setPending] = useState<Pending | null>(null);
    const [aiReady, setAiReady] = useState(false), [aiLoading, setAiLoading] = useState(false), [progress, setProgress] = useState(0), [aiProblem, setAiProblem] = useState("");
    const state = useRef({ ...props, hindi, open, voiceReplies }); state.current = { ...props, hindi, open, voiceReplies };
    const speech = useRef<SpeechInput | null>(null), ai = useRef<LocalAssistantAI | null>(null), request = useRef(0), loadRequest = useRef(0), ids = useRef(0), pendingRef = useRef(pending); pendingRef.current = pending;
    const sendRef = useRef<(text: string, voice?: boolean) => Promise<void>>(async () => {});
    const inputRef = useRef<HTMLInputElement>(null), conversationRef = useRef<HTMLDivElement>(null), launcherRef = useRef<HTMLButtonElement>(null), utterance = useRef<SpeechSynthesisUtterance | null>(null);
    const active = busy || props.disabled;
    function stopSpeaking() { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); utterance.current = null; setSpeaking(false); }
    function say(text: string) {
        stopSpeaking();
        if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") { setProblem("Spoken replies are unavailable on this device. You can read the text."); return; }
        const language = speechLanguage(state.current.hindi), voices = speechSynthesis.getVoices(), voice = voices.find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2)));
        if (voices.length && !voice) { setProblem("A voice for the selected language is not installed on this device. You can read the text."); return; }
        const line = new SpeechSynthesisUtterance(text); utterance.current = line; line.lang = language; if (voice) line.voice = voice; line.rate = .95;
        line.onstart = () => setSpeaking(true); line.onend = () => { setSpeaking(false); utterance.current = null; };
        line.onerror = () => { setSpeaking(false); utterance.current = null; };
        speechSynthesis.speak(line);
    }
    function append(role: Message["role"], text: string, fromAI = false) { setMessages(current => [...current.slice(-29), { id: ++ids.current, role, text, ai: fromAI }]); }
    useEffect(() => {
        if (!open) return;
        const controller = new SpeechInput(window as unknown as SpeechHost, {
            listening: setListening, transcript: setInput, final: text => { void sendRef.current(text, true); }, error: code => setProblem(speechProblem(code)),
        });
        speech.current = controller; setVoiceSupported(controller.supported);
        inputRef.current?.focus();
        return () => { controller.stop(); speech.current = null; stopSpeaking(); };
    }, [open, hindi]);
    useEffect(() => { ++request.current; ai.current?.interrupt(); setBusy(false); setPending(null); setMessages([]); setInput(""); setProblem(""); }, [hindi]);
    useEffect(() => {
        if (open) return;
        ++request.current; ++loadRequest.current; ai.current?.dispose(); ai.current = null; setAiReady(false); setAiLoading(false); setBusy(false); setPending(null);
        return () => { ai.current?.dispose(); };
    }, [open]);
    useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }); }, [messages, pending, busy]);
    useEffect(() => () => { ++request.current; ai.current?.dispose(); }, []);
    function close() { speech.current?.stop(); stopSpeaking(); setOpen(false); launcherRef.current?.focus(); }
    async function execute(action: AssistantAction, voice: boolean, fromAI: boolean, id: number) {
        if (id !== request.current || !state.current.open) return;
        const language = state.current.hindi;
        let text: string;
        if (action.type === "read") text = readFarmData(action.topic, state.current.context, language);
        else if (action.type === "stop_speech") { stopSpeaking(); text = t("Spoken reply stopped."); }
        else text = await state.current.execute(action);
        if (id !== request.current || action.type === "language" || state.current.hindi !== language) return;
        append("assistant", text, fromAI);
        if (voice && state.current.voiceReplies) say(text);
    }
    async function confirm(voice = false) {
        const review = pendingRef.current;
        if (!review || active) return;
        speech.current?.stop(); stopSpeaking(); setPending(null);
        if (review.revision !== state.current.revision) { append("assistant", t("Your field settings changed. Please ask again so I can review the current values.")); return; }
        const id = ++request.current; setBusy(true);
        try { await execute(review.action, voice || review.voice, false, id); }
        catch (error) { if (id === request.current) append("assistant", t(error instanceof Error ? error.message : "That action could not be completed. Please try again.")); }
        finally { if (id === request.current) setBusy(false); }
    }
    async function send(text: string, voice = false) {
        const command = text.trim().slice(0, 600);
        if (!command || active) return;
        speech.current?.stop(); stopSpeaking(); setInput(""); setProblem(""); append("user", command);
        const q = normalizeCommand(command);
        if (pendingRef.current && /^(yes|yes confirm|confirm|confirm changes|हाँ|हां|पुष्टि करें|हाँ पुष्टि करें)$/.test(q)) { await confirm(voice); return; }
        if (pendingRef.current && /^(no|cancel|cancel changes|नहीं|रद्द|रद्द करें)$/.test(q)) { setPending(null); append("assistant", t("Cancelled. No saved values were changed.")); return; }
        setPending(null);
        const id = ++request.current, language = state.current.hindi; let planning = false; setBusy(true);
        try {
            let action = commandAction(command), fromAI = false;
            if (!action && ai.current?.ready) { planning = true; action = await ai.current.plan(command, language); planning = false; fromAI = true; }
            if (id !== request.current || language !== state.current.hindi || !state.current.open) return;
            if (!action) {
                const text = t("I could not match that request. Try a short command, choose an example below, or enable the free on-device AI for more flexible phrases.");
                append("assistant", text); if (voice && state.current.voiceReplies) say(text); return;
            }
            const summary = state.current.preview(action);
            if (needsReview(action)) {
                setPending({ action, summary, revision: state.current.revision, voice });
                if (voice && state.current.voiceReplies) say(summary + " " + t("Say confirm to apply, or cancel."));
            } else await execute(action, voice, fromAI, id);
        } catch (error) {
            if (id === request.current) append("assistant", t(error instanceof Error && !planning ? error.message : "That request could not be understood safely. Try a short command or an example below."));
        } finally { if (id === request.current) setBusy(false); }
    }
    sendRef.current = send;
    async function enableAI() {
        if (aiLoading || aiReady) return;
        const id = ++loadRequest.current; setAiProblem(""); setAiLoading(true); setProgress(0);
        try {
            const { LocalAssistantAI } = await import("../lib/local-ai");
            if (!state.current.open || id !== loadRequest.current) return;
            const local = new LocalAssistantAI(); ai.current = local;
            await local.load(setProgress);
            if (state.current.open && id === loadRequest.current && ai.current === local) setAiReady(true);
        } catch (error) { if (state.current.open && id === loadRequest.current) setAiProblem(error instanceof Error && error.message === "On-device AI needs a browser with WebGPU. Voice and typed commands still work." ? error.message : "On-device AI could not load on this device. Voice and typed commands still work. Check WebGPU support and your connection."); }
        finally { if (state.current.open && id === loadRequest.current) setAiLoading(false); }
    }
    const examples = ["Show satellite view", "What is my soil pH?", "Which crops fit my field?", "Read my rainfall"];
    return <div className="assistant-root">
        <button ref={launcherRef} type="button" className={`assistant-launcher ${open ? "is-open" : ""}`} aria-expanded={open} aria-controls="farm-assistant" onClick={() => open ? close() : setOpen(true)}><Mic size={21}/><span><strong>{t("Ask Aashirwad")}</strong><small>{t("Speak or type · free")}</small></span><Sparkles size={16}/></button>
        {open && <section id="farm-assistant" className="assistant-panel" role="dialog" aria-label={t("Aashirwad assistant")} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            <header className="assistant-header"><span className="assistant-symbol"><Bot size={24}/></span><div><h2>{t("Your farm assistant")}</h2><p>{t(hindi ? "Listening language: Hindi" : "Listening language: English")}</p></div><button type="button" className="icon-button" aria-label={t("Close assistant")} onClick={close}><ChevronDown size={21}/></button></header>
            <div className="assistant-status-strip"><span className="status-dot"/>{t(aiReady ? "On-device AI ready · no API fees" : "Free voice and typed commands")}<span>{hindi ? "हिन्दी" : "English"}</span></div>
            <div ref={conversationRef} className="assistant-conversation" role="log" aria-label={t("Assistant conversation")} aria-live="polite" aria-relevant="additions text">
                {!messages.length && <div className="assistant-welcome"><span><Mic size={28}/></span><h3>{t("Say it. Find it.")}</h3><p>{t("Ask about your field, open any page, or tell me what to change.")}</p><div className="assistant-examples">{examples.map(text => <button type="button" key={text} disabled={active} onClick={() => void send(t(text))}>{t(text)}<Send size={12}/></button>)}</div></div>}
                {messages.map(message => <div key={message.id} className={`assistant-message ${message.role}`}><span className="assistant-message-label">{t(message.role === "user" ? "You" : message.ai ? "Aashirwad · on-device AI" : "Aashirwad assistant")}</span><p>{message.text}</p>{message.role === "assistant" && <button type="button" className="assistant-read" aria-label={t("Read this reply aloud")} onClick={() => say(message.text)}><Volume2 size={13}/>{t("Listen")}</button>}</div>)}
                {busy && <div className="assistant-working" role="status"><Loader2 className="spin" size={16}/>{t("Understanding your request…")}</div>}
                {pending && <div className="assistant-review"><span><Info size={17}/>{t("Review before applying")}</span><p>{pending.summary}</p>{pending.action.type === "soil_save" && <small>{t("Confirm only after checking the values, units and date against your laboratory report.")}</small>}<div><button type="button" disabled={active} onClick={() => void confirm()}><Check size={15}/>{t("Confirm changes")}</button><button type="button" disabled={active} onClick={() => { setPending(null); stopSpeaking(); append("assistant", t("Cancelled. No saved values were changed.")); }}>{t("Cancel")}</button></div><small>{t("You can also say confirm or cancel.")}</small></div>}
            </div>
            {messages.length > 0 && <div className="assistant-quick-actions"><button type="button" disabled={active} onClick={() => void send(t("Read my summary"))}>{t("Read my summary")}</button><button type="button" disabled={active} onClick={() => void send(t("What can you do?"))}>{t("Help")}</button></div>}
            <details className="assistant-ai-options"><summary><Sparkles size={14}/>{t(aiReady ? "On-device AI is enabled" : "More flexible questions with free AI")}</summary><p>{t("Optional download of about 400 MB. AI runs on this device, needs WebGPU and about 2 GB of graphics memory. No key, subscription or API charges.")}</p>{!aiReady && <button type="button" disabled={aiLoading} onClick={() => void enableAI()}>{aiLoading ? <Loader2 className="spin" size={14}/> : <Sparkles size={14}/>} {t(aiLoading ? "Downloading or loading AI…" : "Enable free on-device AI")}{aiLoading && ` ${progress}%`}</button>}{aiLoading && <button type="button" onClick={() => { ++loadRequest.current; ai.current?.dispose(); ai.current = null; setAiLoading(false); }}>{t("Cancel download")}</button>}{aiProblem && <p className="assistant-problem" role="status">{t(aiProblem)}</p>}</details>
            <div className="assistant-input-area">
                <div className="assistant-voice-settings"><label><input type="checkbox" checked={voiceReplies} onChange={e => { setVoiceReplies(e.target.checked); if (!e.target.checked) stopSpeaking(); }}/>{t("Read voice replies aloud")}</label>{speaking && <button type="button" onClick={stopSpeaking}><Square size={12}/>{t("Stop reading")}</button>}{busy && <button type="button" onClick={() => { ++request.current; ai.current?.interrupt(); setBusy(false); }}>{t("Stop")}</button>}</div>
                {problem && <p className="assistant-problem" role="status">{t(problem)}</p>}
                {voiceSupported === false && <p className="assistant-availability">{t("Voice input is unavailable here. Type your request below.")}</p>}
                {props.disabled && <p className="assistant-availability">{t("Farm data is updating. Please wait before sending another command.")}</p>}
                <form onSubmit={e => { e.preventDefault(); void send(input); }}><button type="button" className={`assistant-mic ${listening ? "listening" : ""}`} disabled={!voiceSupported || active} aria-label={t(listening ? "Stop listening" : "Start voice command")} aria-pressed={listening} onClick={() => { if (listening) speech.current?.stop(); else { setProblem(""); stopSpeaking(); speech.current?.start(speechLanguage(hindi)); } }}>{listening ? <Square size={17}/> : <Mic size={20}/>}</button><label className="sr-only" htmlFor="assistant-command">{t("Your request")}</label><input ref={inputRef} id="assistant-command" value={input} onChange={e => setInput(e.target.value)} maxLength={600} placeholder={t(listening ? "Listening… speak your command" : "Ask or tell me what to do…")} autoComplete="off" disabled={active}/><button type="submit" className="assistant-send" disabled={!input.trim() || active} aria-label={t("Send request")}><Send size={18}/></button></form>
                <p className="assistant-privacy">{t("Microphone starts only when tapped. Your browser may process speech online; on-device AI stays local.")}</p>
            </div>
        </section>}
    </div>;
}
