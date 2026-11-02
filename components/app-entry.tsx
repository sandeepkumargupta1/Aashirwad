"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Globe2, Leaf, Loader2, MapPin, Mic, ShieldCheck, Sprout, Tractor, UserRound } from "lucide-react";
import Dashboard from "./dashboard";
import GrowthScene from "./growth-scene";
import { LocaleProvider, useLocale } from "./locale";
import { translate } from "../lib/i18n";
import { ENTRY_KEY, restoreEntry, accountReply, type EntryKind, type FarmerProfile } from "../lib/account";

type EntryProps = { signedIn: boolean; signInPath: string; createSignInPath: string; signOutPath: string; userKey?: string; initialName?: string; welcomeOnly?: boolean };
export default function AppEntry({ welcomeOnly = false, ...props }: EntryProps) {
    const [access, setAccess] = useState<EntryKind | null>(null), [hindi, setHindi] = useState(false);
    const [profile, setProfile] = useState<FarmerProfile | null>(null), [loading, setLoading] = useState(props.signedIn);
    const [accountError, setAccountError] = useState(""), [retry, setRetry] = useState(0);
    useEffect(() => {
        try {
            setHindi(localStorage.getItem("aashirwad-language") === "hi");
            const kind = restoreEntry(sessionStorage.getItem(ENTRY_KEY), props.signedIn);
            if (kind === "demo" && !welcomeOnly) setAccess("demo");
        } catch { }
    }, [welcomeOnly, props.signedIn]);
    useEffect(() => {
        if (!props.signedIn) { setLoading(false); return; }
        const controller = new AbortController();
        setLoading(true); setAccountError("");
        void fetch("/api/account", { cache: "no-store", signal: controller.signal }).then(async response => {
            const result = accountReply.parse(await response.json());
            if (!response.ok) throw new Error(result.error || "Account service is unavailable. Please try again.");
            if (controller.signal.aborted) return;
            setProfile(result.profile ?? null);
            try {
                if (result.profile && !welcomeOnly && restoreEntry(sessionStorage.getItem(ENTRY_KEY), true) === "account") setAccess("account");
            } catch { }
        }).catch(error => { if (!controller.signal.aborted) setAccountError(error instanceof Error ? error.message : "Account service is unavailable. Please try again."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [props.signedIn, welcomeOnly, retry]);
    useEffect(() => { if (!access) { document.documentElement.lang = hindi ? "hi" : "en"; document.title = translate("Aashirwad — Grow with confidence", hindi); } }, [hindi, access]);
    function enter(kind: EntryKind) {
        try { sessionStorage.setItem(ENTRY_KEY, kind); } catch { }
        if (welcomeOnly) window.location.assign("/"); else setAccess(kind);
    }
    if (access && !welcomeOnly) return <Dashboard demoAccount={access === "demo"} accountName={access === "demo" ? "Demo farmer" : profile?.displayName ?? props.initialName ?? "My account"} accountKey={props.userKey} signOutPath={props.signOutPath}/>;
    return <LocaleProvider hindi={hindi}><Welcome {...props} profile={profile} loading={loading} accountError={accountError} retry={() => setRetry(value => value + 1)} enter={enter} created={value => { setProfile(value); enter("account"); }} changeLanguage={() => { setHindi(value => { try { localStorage.setItem("aashirwad-language", value ? "en" : "hi"); } catch { } return !value; }); }}/></LocaleProvider>;
}

type WelcomeProps = EntryProps & { profile: FarmerProfile | null; loading: boolean; accountError: string; retry: () => void; enter: (kind: EntryKind) => void; created: (profile: FarmerProfile) => void; changeLanguage: () => void };
function Welcome({ signedIn, signInPath, createSignInPath, initialName, profile, loading, accountError, retry, enter, created, changeLanguage }: WelcomeProps) {
    const { hindi, t } = useLocale();
    const [tab, setTab] = useState<"login" | "create">("login"), [name, setName] = useState(initialName ?? ""), [village, setVillage] = useState("");
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "create") setTab("create"); }, []);
    useEffect(() => { if (profile) { setName(profile.displayName); setVillage(profile.village); } }, [profile]);
    async function submit(event: FormEvent) {
        event.preventDefault(); setSaving(true); setError("");
        try {
            const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, village }) });
            const result = accountReply.parse(await response.json());
            if (!response.ok) throw new Error(result.error || "Account service is unavailable. Please try again.");
            if (!result.profile) throw new Error("Account service is unavailable. Please try again.");
            created(result.profile);
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Account service is unavailable. Please try again."); }
        finally { setSaving(false); }
    }
    return <main className="welcome-page welcome-compact">
        <header className="welcome-nav"><a href="/login" className="welcome-brand" aria-label={t("Aashirwad welcome")}><span><Sprout size={25}/></span><strong>{t("Aashirwad")}<i>.</i></strong></a><span className="welcome-nav-note"><Leaf size={13}/>{t("Your land. Your language.")}</span><button type="button" className="welcome-language" onClick={changeLanguage} aria-label={t(hindi ? "Switch to English" : "Switch to Hindi")}><Globe2 size={15}/>{hindi ? "English" : "हिन्दी"}</button></header>
        <div className="welcome-layout">
            <section className="welcome-story"><div className="welcome-scene-copy"><span className="welcome-kicker"><Leaf size={12}/>{t("ROOTED IN CARE. GROWN WITH CONFIDENCE.")}</span><h1>{t("Every seed. A new beginning.")}</h1><p>{t("A wish for rain. A seed of hope. A better season ahead.")}</p></div><GrowthScene/><div className="welcome-story-footer"><span><Sprout size={15}/>{t("Made for the hands that feed us.")}</span><span>{t("Grow with confidence.")}</span></div></section>
            <section className="welcome-login" aria-label={t("Sign in to Aashirwad")}><div className="welcome-login-card">
                <div className="welcome-account-heading"><span className="welcome-login-icon"><Sprout size={25}/></span><div><span className="welcome-form-kicker">{t("WELCOME TO AASHIRWAD")}</span><h2>{t("Your next season starts here.")}</h2></div></div>
                <p className="welcome-login-description">{t("Know your field. Find your crop. Grow with confidence.")}</p>
                <div className="welcome-auth-tabs" role="tablist" aria-label={t("Account options")}><button id="login-tab" role="tab" type="button" aria-selected={tab === "login"} aria-controls="account-panel" onClick={() => { setTab("login"); setError(""); }}>{t("Login")}</button><button id="create-tab" role="tab" type="button" aria-selected={tab === "create"} aria-controls="account-panel" onClick={() => { setTab("create"); setError(""); }}>{t("Create account")}</button></div>
                <div id="account-panel" className="welcome-account-panel" role="tabpanel" aria-labelledby={tab === "login" ? "login-tab" : "create-tab"}>
                    {tab === "login" ? <>
                        <div className="welcome-account-status"><span><UserRound size={19}/></span><div><strong>{t(profile ? "Welcome back" : "Your farming companion")}{profile ? `, ${profile.displayName}` : ""}</strong><p>{t(signedIn ? "You're securely signed in with ChatGPT." : "Use your ChatGPT account to sign in securely.")}</p>{signedIn && !profile && !loading && <small>{t("One quick step to set up your farmer profile.")}</small>}</div>{signedIn && <Check size={15}/>}</div>
                        {signedIn ? <button type="button" className="welcome-continue" disabled={loading || !!accountError} onClick={() => profile ? enter("account") : setTab("create")}>{loading ? <Loader2 size={17} className="spin"/> : <ShieldCheck size={17}/>}<span>{t(loading ? "Checking your account…" : profile ? "Open my account" : "Set up my account")}</span><ArrowRight size={17}/></button> : <a className="welcome-continue" href={signInPath} target="_top"><ShieldCheck size={17}/>{t("Login with ChatGPT")}<ArrowRight size={17}/></a>}
                    </> : <>
                        {signedIn ? <form onSubmit={submit} className="welcome-profile-form"><div className="welcome-profile-fields"><label htmlFor="farmer-name">{t("Your name")}<input id="farmer-name" name="name" autoComplete="name" value={name} minLength={2} maxLength={70} required onChange={event => setName(event.target.value)} placeholder={t("Farmer's name")}/></label><label htmlFor="farmer-village">{t("Village / town")}<input id="farmer-village" name="village" autoComplete="address-level3" value={village} maxLength={100} onChange={event => setVillage(event.target.value)} placeholder={t("Optional")}/></label></div><button type="submit" className="welcome-continue" disabled={saving || loading}>{saving ? <Loader2 size={17} className="spin"/> : <Sprout size={17}/>}<span>{t(saving ? "Saving your account…" : profile ? "Save and continue" : "Create my account")}</span><ArrowRight size={17}/></button></form> : <><p className="welcome-create-copy">{t("Create your free farmer profile with secure ChatGPT sign-in.")}</p><a className="welcome-continue" href={createSignInPath} target="_top"><ShieldCheck size={17}/>{t("Create account with ChatGPT")}<ArrowRight size={17}/></a></>}
                    </>}
                    {(error || accountError) && <p className="welcome-account-error" role="alert">{t(error || accountError)}{accountError && <button type="button" onClick={retry}>{t("Try again")}</button>}</p>}
                    <p className="welcome-auth-note"><ShieldCheck size={12}/>{t("Secure ChatGPT sign-in. No extra password to remember.")}</p>
                </div>
                <div className="welcome-demo-divider"><span/>{t("or explore first")}<span/></div>
                <button type="button" className="welcome-demo" onClick={() => enter("demo")}><span className="welcome-demo-icon"><Tractor size={24}/></span><span><strong>{t("Try demo account")}<i>{t("NO PASSWORD")}</i></strong><small>{t("Demo farmer · Sehore · 5 acres · Rabi")}</small></span><ArrowRight size={18}/></button>
                <div className="welcome-mini-benefits"><span><MapPin size={13}/>{t("Find your field")}</span><span><Sprout size={13}/>{t("Choose crops")}</span><span><Mic size={13}/>{t("Voice help")}</span></div>
                <div className="welcome-free"><span><i/>{t("Free farming tools")}</span><span>{t("English & Hindi")}</span></div>
            </div><footer className="welcome-login-footer">{t("A little insight. A better harvest.")}</footer></section>
        </div>
    </main>;
}
